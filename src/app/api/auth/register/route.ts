import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { registerSchema } from "@/lib/validators/schemas";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/auth/guards";
import {
  buildVerificationEmailHtml,
  isCustomEmailConfigured,
  sendEmailNotification,
} from "@/lib/notifications/email";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured on the server." },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Generous per-IP cap so shared campus Wi-Fi NAT does not block simultaneous student registrations
  const ipRl = checkRateLimit(`register:${ip}`, 120, 60_000);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Retry in ${ipRl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "role" in body &&
    body.role !== undefined &&
    body.role !== "student"
  ) {
    return NextResponse.json(
      {
        error:
          "Public registration is restricted to student accounts. Faculty and admin accounts are provisioned internally.",
      },
      { status: 403 }
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid registration input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const emailRl = checkRateLimit(`register-email:${email}`, 5, 60_000);
  if (!emailRl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts for this email. Retry in ${emailRl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }
  const academicId = data.academicId.toUpperCase();
  const admin = createAdminSupabase();

  // Check duplicate academic_id
  const { data: existingId } = await admin
    .from("profiles")
    .select("id")
    .ilike("academic_id", academicId)
    .maybeSingle();

  if (existingId) {
    return NextResponse.json(
      { error: "That Academic / Staff ID is already registered." },
      { status: 409 }
    );
  }

  // Check duplicate email so unverified accounts get a clear resend path
  const { data: existingEmailProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingEmailProfile) {
    const { data: authUserRes } = await admin.auth.admin.getUserById(existingEmailProfile.id);
    const isConfirmed = Boolean(authUserRes?.user?.email_confirmed_at);
    return NextResponse.json(
      {
        error: isConfirmed
          ? "An account with this email is already registered. Please sign in."
          : "This email is already registered and awaiting email verification.",
        needsVerification: !isConfirmed,
        email,
      },
      { status: 409 }
    );
  }

  const origin =
    request.nextUrl.origin && !request.nextUrl.origin.includes("0.0.0.0")
      ? request.nextUrl.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cleanOrigin = origin.replace(/\/$/, "");
  const emailRedirectTo = `${cleanOrigin}/auth/callback?next=/dashboard`;

  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];
  let createdUser: { id: string; email_confirmed_at?: string | null } | null = null;

  if (isCustomEmailConfigured()) {
    // Custom SMTP / Resend path: creates the user with email_confirmed_at = NULL without
    // hitting Supabase's built-in 2 emails/hour cap, then sends the branded verification link.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: data.password,
      options: {
        redirectTo: emailRedirectTo,
        data: {
          full_name: data.fullName,
          academic_id: academicId,
        },
      },
    });

    if (linkError || !linkData?.user || !linkData.properties?.hashed_token) {
      return NextResponse.json(
        { error: linkError?.message || "Unable to generate verification link." },
        { status: 400 }
      );
    }

    const verificationUrl = `${cleanOrigin}/auth/callback?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token
    )}&type=signup&next=${encodeURIComponent("/dashboard")}`;

    const mailRes = await sendEmailNotification({
      to: email,
      subject: "Verify your PSG iTech SmartLab email address",
      html: buildVerificationEmailHtml({
        recipientName: data.fullName,
        verificationUrl,
        email,
      }),
    });

    if (!mailRes.sent) {
      await admin.auth.admin.deleteUser(linkData.user.id).catch(() => {});
      return NextResponse.json(
        {
          error: `Verification email delivery failed (${mailRes.reason || "mailer error"}). Please verify SMTP/Resend configuration.`,
        },
        { status: 502 }
      );
    }

    createdUser = linkData.user;
  } else {
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

    // Standard Supabase signUp() enforces email_confirmed_at NULL until confirmation link is clicked
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: data.fullName,
          academic_id: academicId,
        },
      },
    });

    if (signUpError) {
      const status = signUpError.status === 429 ? 429 : 400;
      const message =
        status === 429
          ? `${signUpError.message}. Configure SMTP_* or RESEND_API_KEY in .env.local (or Custom SMTP in Supabase) for unlimited verification emails.`
          : signUpError.message;
      return NextResponse.json({ error: message }, { status });
    }

    if (
      !signUpData.user ||
      (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0)
    ) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in or resend verification.",
          needsVerification: true,
          email,
        },
        { status: 409 }
      );
    }

    createdUser = signUpData.user;
  }

  // Public registration always assigns 'student' role; faculty/admin roles are granted only via /admin
  const { data: roleRow } = await admin
    .from("roles")
    .select("id")
    .eq("name", "student")
    .maybeSingle();

  await admin
    .from("profiles")
    .update({
      role: "student",
      role_id: roleRow?.id ?? null,
      full_name: data.fullName,
      academic_id: academicId,
      department_id: data.departmentId || null,
    })
    .eq("id", createdUser.id);

  await logAuditEvent({
    actorId: createdUser.id,
    action: "user_registered_pending_verification",
    entityType: "profile",
    entityId: createdUser.id,
    summary: `Registered student account (${academicId}) awaiting email verification`,
    ipAddress: ip,
  });

  const emailConfirmed = Boolean(createdUser.email_confirmed_at);
  const res = NextResponse.json(
    {
      ok: true,
      requiresEmailVerification: !emailConfirmed,
      email,
      emailRedirectTo,
      user: {
        id: createdUser.id,
        email,
        role: "student",
        academic_id: academicId,
        emailConfirmed,
      },
    },
    { status: 201 }
  );

  for (const { name, value, options } of cookiesToApply) {
    res.cookies.set(name, value, options);
  }

  return res;
}
