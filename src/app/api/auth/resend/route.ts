import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";

const resendSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured on the server." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Valid email is required" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`resend:${ip}:${email}`, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many resend requests. Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const origin =
    request.nextUrl.origin && !request.nextUrl.origin.includes("0.0.0.0")
      ? request.nextUrl.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emailRedirectTo = `${origin.replace(/\/$/, "")}/auth/callback?next=/dashboard`;
  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToApply.push(...cookiesToSet);
        },
      },
    }
  );

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    const status = error.status === 429 ? 429 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const res = NextResponse.json({
    ok: true,
    message: "Verification email dispatched. Check your inbox and spam folder.",
    emailRedirectTo,
  });

  for (const { name, value, options } of cookiesToApply) {
    res.cookies.set(name, value, options);
  }

  return res;
}
