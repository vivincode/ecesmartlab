import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { registerSchema } from "@/lib/validators/schemas";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured on the server." },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`register:${ip}`, 8, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid registration input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
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

  // Verify staff invite code against institutional_settings when registering as staff
  if (data.role === "staff") {
    const { data: settings } = await admin
      .from("institutional_settings")
      .select("staff_invite_code")
      .limit(1)
      .maybeSingle();

    const expectedCode =
      settings?.staff_invite_code || process.env.INITIAL_STAFF_INVITE_CODE || "";

    if (!expectedCode || data.staffInviteCode !== expectedCode) {
      return NextResponse.json(
        { error: "Invalid staff invitation code. Contact your institution administrator." },
        { status: 403 }
      );
    }
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

  // Use standard Supabase signUp() so email confirmation is enforced and email_confirmed_at remains NULL until clicked
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
    return NextResponse.json({ error: signUpError.message }, { status });
  }

  if (!signUpData.user || (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0)) {
    return NextResponse.json(
      {
        error: "An account with this email already exists. Please sign in or resend verification.",
        needsVerification: true,
        email,
      },
      { status: 409 }
    );
  }

  // Assign role and department metadata on profiles (auth email_confirmed_at stays NULL until user verifies email)
  const { data: roleRow } = await admin
    .from("roles")
    .select("id")
    .eq("name", data.role)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({
      role: data.role,
      role_id: roleRow?.id ?? null,
      full_name: data.fullName,
      academic_id: academicId,
      department_id: data.departmentId || null,
    })
    .eq("id", signUpData.user.id);

  await logAuditEvent({
    actorId: signUpData.user.id,
    action: "user_registered_pending_verification",
    entityType: "profile",
    entityId: signUpData.user.id,
    summary: `Registered ${data.role} account (${academicId}) awaiting email verification`,
    ipAddress: ip,
  });

  const emailConfirmed = Boolean(signUpData.user.email_confirmed_at);
  const res = NextResponse.json(
    {
      ok: true,
      requiresEmailVerification: !emailConfirmed,
      email,
      emailRedirectTo,
      user: {
        id: signUpData.user.id,
        email,
        role: data.role,
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
