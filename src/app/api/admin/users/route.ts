import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole } from "@/lib/auth/guards";

export async function GET() {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("*, departments(id, name, code)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const targetUserId = body?.user_id as string | undefined;
  const role = body?.role as "student" | "staff" | "admin" | undefined;
  const isActive = typeof body?.is_active === "boolean" ? body.is_active : undefined;
  const departmentId = body?.department_id as string | null | undefined;
  const assignedLabIds = Array.isArray(body?.assigned_lab_ids)
    ? (body.assigned_lab_ids as string[])
    : undefined;

  if (!targetUserId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  if (targetUserId === context.userId && isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own admin account." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const updates: Record<string, unknown> = {};
  if (role) {
    const { data: roleRow } = await admin.from("roles").select("id").eq("name", role).single();
    updates.role = role;
    if (roleRow) updates.role_id = roleRow.id;
  }
  if (isActive !== undefined) updates.is_active = isActive;
  if (departmentId !== undefined) updates.department_id = departmentId;

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("profiles").update(updates).eq("id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (assignedLabIds) {
    await admin.from("lab_staff_assignments").delete().eq("staff_id", targetUserId);
    if (assignedLabIds.length > 0) {
      await admin.from("lab_staff_assignments").insert(
        assignedLabIds.map((labId, idx) => ({
          laboratory_id: labId,
          staff_id: targetUserId,
          is_lead: idx === 0,
          assigned_by: context.userId,
        }))
      );
    }
  }

  await logAuditEvent({
    actorId: context.userId,
    action: "admin_user_updated",
    entityType: "profile",
    entityId: targetUserId,
    summary: `Updated user ${targetUserId} (${JSON.stringify(updates)})`,
  });

  return NextResponse.json({ ok: true });
}
