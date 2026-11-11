import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminSupabase } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  buildVerificationEmailHtml,
  hasCustomEmailTransport,
  sendEmailNotification,
} from "@/lib/notifications/email";

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
  const cleanOrigin = origin.replace(/\/$/, "");
  const emailRedirectTo = `${cleanOrigin}/auth/callback?next=/dashboard`;

  if ((await hasCustomEmailTransport()) && isServiceRoleConfigured()) {
    const admin = createAdminSupabase();
    const { data: profileRow } = await admin
      .from("profiles")
      .select("id, full_name")
      .ilike("email", email)
      .maybeSingle();

    if (!profileRow) {
      return NextResponse.json({
        ok: true,
        message: "If an unverified account exists for this email, a verification link has been sent.",
        emailRedirectTo,
      });
    }

    const { data: authUserRes } = await admin.auth.admin.getUserById(profileRow.id);
    if (!authUserRes?.user) {
      return NextResponse.json({
        ok: true,
        message: "If an unverified account exists for this email, a verification link has been sent.",
        emailRedirectTo,
      });
    }

    if (authUserRes.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "This email address is already verified. Please sign in." },
        { status: 400 }
      );
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: emailRedirectTo,
      },
    });

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json(
        { error: linkError?.message || "Unable to generate verification link." },
        { status: 400 }
      );
    }

    const verificationUrl = `${cleanOrigin}/auth/callback?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token
    )}&type=magiclink&next=${encodeURIComponent("/dashboard")}`;

    const mailRes = await sendEmailNotification({
      to: email,
      subject: "Verify your PSG iTech SmartLab email address",
      html: buildVerificationEmailHtml({
        recipientName: profileRow.full_name,
        verificationUrl,
        email,
      }),
    });

    if (!mailRes.sent) {
      return NextResponse.json(
        {
          error: `Verification email delivery failed (${mailRes.reason || "mailer error"}).`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      deliveryProvider: mailRes.provider || "smtp",
      message: "Verification email dispatched. Check your inbox and spam folder.",
      emailRedirectTo,
    });
  }

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
    const message =
      status === 429
        ? `${error.message}. Configure SMTP_* or RESEND_API_KEY in .env.local (or Custom SMTP in Supabase) for unlimited verification emails.`
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  const res = NextResponse.json({
    ok: true,
    deliveryProvider: "supabase",
    message: "Verification email dispatched. Check your inbox and spam folder.",
    emailRedirectTo,
  });

  for (const { name, value, options } of cookiesToApply) {
    res.cookies.set(name, value, options);
  }

  return res;
}
