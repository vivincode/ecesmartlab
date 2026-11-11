import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent, requireRole } from "@/lib/auth/guards";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { profileUpdateSchema } from "@/lib/validators/schemas";

export async function GET() {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;
  return NextResponse.json({ profile: context.profile });
}

export async function PATCH(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid profile data" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      year_of_study: parsed.data.year_of_study ?? null,
      department_id: parsed.data.department_id ?? null,
    })
    .eq("id", context.userId)
    .select("*, departments(id, name, code)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE() {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Server configuration missing for account deletion." },
      { status: 503 }
    );
  }

  const userId = context.userId;
  const admin = createAdminSupabase();

  const { count: activeLoansCount } = await admin
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("borrower_id", userId)
    .in("status", ["Active", "Overdue"]);

  if ((activeLoansCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Please return all active or overdue borrowed items before deleting your account." },
      { status: 400 }
    );
  }

  const { count: approvedRequestsCount } = await admin
    .from("borrow_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", userId)
    .eq("status", "Approved");

  if ((approvedRequestsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Resolve approved borrow requests awaiting pickup before deleting your account." },
      { status: 400 }
    );
  }

  if (context.profile.role === "admin") {
    const { count: otherAdminsCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true)
      .is("deleted_at", null)
      .neq("id", userId);

    if ((otherAdminsCount ?? 0) < 1) {
      return NextResponse.json(
        { error: "Cannot delete the only active administrator account." },
        { status: 400 }
      );
    }
  }

  await Promise.all([
    admin
      .from("borrow_requests")
      .update({ status: "Cancelled" })
      .eq("requester_id", userId)
      .eq("status", "Pending"),
    admin
      .from("lab_bookings")
      .update({ status: "Cancelled" })
      .eq("user_id", userId)
      .eq("status", "Pending"),
  ]);

  await logAuditEvent({
    actorId: userId,
    action: "user_self_deleted",
    entityType: "profile",
    entityId: userId,
    summary: `User deleted their own account (${context.profile.academic_id})`,
  });

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);

  if (deleteErr) {
    // Preserve historical returned loan / audit references when FK constraints block hard delete
    const tombEmail = `deleted-${userId}@deleted.local`;
    const tombAcademicId = `DEL-${userId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;

    await admin
      .from("profiles")
      .update({
        full_name: "Deleted Account",
        email: tombEmail,
        academic_id: tombAcademicId,
        phone: null,
        year_of_study: null,
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await admin.auth.admin.updateUserById(userId, {
      email: tombEmail,
      password: crypto.randomBytes(24).toString("hex"),
      ban_duration: "876000h",
    });
  }

  const supabase = await createServerSupabase();
  await supabase.auth.signOut().catch(() => {});

  return NextResponse.json({ ok: true });
}
