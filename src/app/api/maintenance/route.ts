import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { createNotification, logAuditEvent, requireRole } from "@/lib/auth/guards";
import { maintenanceReportSchema } from "@/lib/validators/schemas";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const labId = request.nextUrl.searchParams.get("labId");
  const status = request.nextUrl.searchParams.get("status");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("maintenance_reports")
    .select(
      "*, laboratories(name, code), components(name, sku), reporter:profiles!maintenance_reports_reported_by_fkey(full_name, academic_id)"
    )
    .order("created_at", { ascending: false });

  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = maintenanceReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid defect report" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const { data: report, error } = await supabase
    .from("maintenance_reports")
    .insert({
      laboratory_id: d.laboratory_id,
      component_id: d.component_id || null,
      asset_id: d.asset_id || null,
      reported_by: context.userId,
      category: d.category,
      title: d.title,
      description: d.description,
      priority: d.priority,
      photo_urls: d.photo_urls,
      status: "Reported",
    })
    .select("*")
    .single();

  if (error || !report) {
    return NextResponse.json({ error: error?.message || "Failed to report defect" }, { status: 400 });
  }

  // Automatically block defective serialized/critical equipment from being borrowed until cleared
  if (d.asset_id) {
    await admin
      .from("component_assets")
      .update({ condition: "Damaged", status: "Under maintenance" })
      .eq("id", d.asset_id);
  }
  if (d.component_id && (d.priority === "High" || d.priority === "Critical")) {
    await admin
      .from("components")
      .update({ condition: "Needs inspection" })
      .eq("id", d.component_id);
  }

  const { data: staffRows } = await admin
    .from("lab_staff_assignments")
    .select("staff_id")
    .eq("laboratory_id", d.laboratory_id);

  for (const s of staffRows ?? []) {
    await createNotification({
      userId: s.staff_id,
      type: "defect_reported",
      title: `Defect reported (${d.priority})`,
      message: `${d.title} reported by ${context.profile.full_name}.`,
      linkUrl: "/maintenance",
    });
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: d.laboratory_id,
    action: "defect_reported",
    entityType: "maintenance_report",
    entityId: report.id,
    summary: `Reported ${d.priority} defect: ${d.title}`,
  });

  return NextResponse.json({ report }, { status: 201 });
}
