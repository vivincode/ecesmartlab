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
  const admin = createAdminSupabase();

  // Check duplicate academic_id
  const { data: existingId } = await admin
    .from("profiles")
    .select("id")
    .ilike("academic_id", data.academicId)
    .maybeSingle();

  if (existingId) {
    return NextResponse.json(
      { error: "That Academic / Staff ID is already registered." },
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

  // Create user via Supabase Auth Admin API
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName,
      academic_id: data.academicId.toUpperCase(),
    },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create account" },
      { status: 400 }
    );
  }

  // Fetch target role row and assign role securely on server
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
      academic_id: data.academicId.toUpperCase(),
      department_id: data.departmentId || null,
    })
    .eq("id", created.user.id);

  await logAuditEvent({
    actorId: created.user.id,
    action: "user_registered",
    entityType: "profile",
    entityId: created.user.id,
    summary: `New ${data.role} account registered (${data.academicId.toUpperCase()})`,
    ipAddress: ip,
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: created.user.id,
        email: data.email,
        role: data.role,
        academic_id: data.academicId.toUpperCase(),
      },
    },
    { status: 201 }
  );
}
