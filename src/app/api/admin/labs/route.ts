import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole } from "@/lib/auth/guards";
import { laboratorySchema } from "@/lib/validators/schemas";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("laboratories")
    .select("*, departments(id, name, code), lab_staff_assignments(staff_id, is_lead, profiles!lab_staff_assignments_staff_id_fkey(full_name, academic_id))")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ laboratories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = laboratorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid laboratory data" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: lab, error } = await admin
    .from("laboratories")
    .insert({ ...parsed.data, code: parsed.data.code.toUpperCase() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: lab.id,
    action: "laboratory_created",
    entityType: "laboratory",
    entityId: lab.id,
    summary: `Created laboratory ${lab.name} (${lab.code})`,
  });

  return NextResponse.json({ laboratory: lab }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Laboratory id is required" }, { status: 400 });

  const parsed = laboratorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: lab, error } = await admin
    .from("laboratories")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: id,
    action: "laboratory_updated",
    entityType: "laboratory",
    entityId: id,
    summary: `Updated laboratory ${lab.name}`,
  });

  return NextResponse.json({ laboratory: lab });
}
