import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/dashboard";
  }
  return nextParam;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  const nextPath = getSafeRedirectPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", origin));
  }

  if (errorParam || errorDesc) {
    const errUrl = new URL("/verify-email", origin);
    errUrl.searchParams.set("error", errorDesc || errorParam || "Email verification link is invalid or expired.");
    return NextResponse.redirect(errUrl);
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

  const applyCookies = (res: NextResponse) => {
    for (const { name, value, options } of cookiesToApply) {
      res.cookies.set(name, value, options);
    }
    return res;
  };

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      const errUrl = new URL("/verify-email", origin);
      errUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(errUrl);
    }

    if (!data.user?.email_confirmed_at) {
      const pendingUrl = new URL("/verify-email", origin);
      if (data.user?.email) pendingUrl.searchParams.set("email", data.user.email);
      return applyCookies(NextResponse.redirect(pendingUrl));
    }

    return applyCookies(NextResponse.redirect(new URL(nextPath, origin)));
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const isPkceMismatch =
        error.message.toLowerCase().includes("code verifier") ||
        error.message.toLowerCase().includes("pkce");

      if (isPkceMismatch) {
        // When opened in a different browser/tab without the PKCE verifier cookie,
        // direct the user to sign in (unverified emails are still blocked by Supabase Auth).
        const loginUrl = new URL("/login", origin);
        loginUrl.searchParams.set("check_verification", "1");
        return NextResponse.redirect(loginUrl);
      }

      const errUrl = new URL("/verify-email", origin);
      errUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(errUrl);
    }

    if (!data.user?.email_confirmed_at) {
      const pendingUrl = new URL("/verify-email", origin);
      if (data.user?.email) pendingUrl.searchParams.set("email", data.user.email);
      return applyCookies(NextResponse.redirect(pendingUrl));
    }

    return applyCookies(NextResponse.redirect(new URL(nextPath, origin)));
  }

  return NextResponse.redirect(new URL("/login", origin));
}
