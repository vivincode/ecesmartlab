import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole, verifyStaffLabAccess } from "@/lib/auth/guards";
import { componentUpdateSchema } from "@/lib/validators/schemas";
import { calculateComponentStatus } from "@/lib/domain/lending";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("components")
    .select(
      "*, departments(id, name, code), laboratories(id, name, code), categories!components_category_id_fkey(id, name, slug), component_assets(*)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  return NextResponse.json({ component: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("components")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const hasLabAccess = await verifyStaffLabAccess(context.profile, existing.laboratory_id);
  if (!hasLabAccess) {
    return NextResponse.json({ error: "Not assigned to this laboratory" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = componentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid update payload" },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  const nextTotal = updates.total_quantity ?? existing.total_quantity;
  const nextAvail = updates.available_quantity ?? existing.available_quantity;
  const nextCondition = updates.condition ?? existing.condition;
  const nextMin = updates.min_stock_threshold ?? existing.min_stock_threshold;

  if (nextAvail + existing.reserved_quantity + existing.borrowed_quantity > nextTotal) {
    return NextResponse.json(
      {
        error: `Available (${nextAvail}) + reserved (${existing.reserved_quantity}) + borrowed (${existing.borrowed_quantity}) cannot exceed total (${nextTotal}).`,
      },
      { status: 400 }
    );
  }

  const nextStatus = calculateComponentStatus(nextAvail, nextMin, nextCondition);

  const { data: updated, error } = await supabase
    .from("components")
    .update({
      ...updates,
      sku: updates.sku ? updates.sku.toUpperCase() : existing.sku,
      status: nextStatus,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (nextAvail !== existing.available_quantity) {
    await supabase.from("inventory_transactions").insert({
      component_id: id,
      laboratory_id: existing.laboratory_id,
      transaction_type: nextAvail > existing.available_quantity ? "restock" : "adjustment",
      quantity_delta: nextAvail - existing.available_quantity,
      before_available: existing.available_quantity,
      after_available: nextAvail,
      reference_type: "component",
      reference_id: id,
      actor_id: context.userId,
      notes: "Stock adjusted by staff",
    });
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: existing.laboratory_id,
    action: "component_updated",
    entityType: "component",
    entityId: id,
    summary: `Updated component ${updated.name} (${updated.sku})`,
  });

  return NextResponse.json({ component: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("components")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const hasLabAccess = await verifyStaffLabAccess(context.profile, existing.laboratory_id);
  if (!hasLabAccess) {
    return NextResponse.json({ error: "Not assigned to this laboratory" }, { status: 403 });
  }

  if (existing.borrowed_quantity > 0 || existing.reserved_quantity > 0) {
    return NextResponse.json(
      { error: "Cannot archive component while units are reserved or borrowed." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("components")
    .update({ deleted_at: new Date().toISOString(), status: "Retired" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: existing.laboratory_id,
    action: "component_deleted",
    entityType: "component",
    entityId: id,
    summary: `Archived component ${existing.name} (${existing.sku})`,
  });

  return NextResponse.json({ ok: true });
}
