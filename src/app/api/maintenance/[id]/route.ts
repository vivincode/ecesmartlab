import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";
import { maintenanceUpdateSchema } from "@/lib/validators/schemas";
import { calculateComponentStatus } from "@/lib/domain/lending";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = maintenanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid maintenance update" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: report } = await admin
    .from("maintenance_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Maintenance report not found" }, { status: 404 });
  }

  const allowed = await verifyStaffLabAccess(context.profile, report.laboratory_id);
  if (!allowed) return NextResponse.json({ error: "Not assigned to this lab" }, { status: 403 });

  const d = parsed.data;
  const isResolved = d.status === "Resolved" || d.status === "Closed";

  await admin
    .from("maintenance_reports")
    .update({
      status: d.status,
      assigned_to: report.assigned_to || context.userId,
      resolution_notes: d.resolution_notes ?? report.resolution_notes,
      resolved_at: isResolved ? new Date().toISOString() : null,
    })
    .eq("id", id);

  await admin.from("maintenance_updates").insert({
    report_id: id,
    author_id: context.userId,
    previous_status: report.status,
    new_status: d.status,
    comment: d.comment,
  });

  if (isResolved && d.clear_component_defect) {
    if (report.asset_id) {
      await admin
        .from("component_assets")
        .update({ condition: "Good", status: "Available" })
        .eq("id", report.asset_id);
    }
    if (report.component_id) {
      const { data: comp } = await admin
        .from("components")
        .select("available_quantity, min_stock_threshold")
        .eq("id", report.component_id)
        .single();
      if (comp) {
        await admin
          .from("components")
          .update({
            condition: "Good",
            status: calculateComponentStatus(
              comp.available_quantity,
              comp.min_stock_threshold,
              "Good"
            ),
          })
          .eq("id", report.component_id);
      }
    }
  }

  if (isResolved) {
    await createNotification({
      userId: report.reported_by,
      type: "maintenance_resolved",
      title: "Maintenance issue resolved",
      message: `"${report.title}" was marked ${d.status}.`,
      linkUrl: "/maintenance",
    });
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: report.laboratory_id,
    action: "maintenance_updated",
    entityType: "maintenance_report",
    entityId: id,
    summary: `Updated "${report.title}" to ${d.status}`,
  });

  return NextResponse.json({ ok: true, status: d.status });
}
