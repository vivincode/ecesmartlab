import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole, verifyStaffLabAccess } from "@/lib/auth/guards";
import { calculateComponentStatus } from "@/lib/domain/lending";
import { z } from "zod";

const importItemSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(2),
  laboratory_id: z.string().uuid(),
  department_id: z.string().uuid(),
  category_id: z.string().uuid(),
  manufacturer: z.string().trim().optional().default(""),
  model: z.string().trim().optional().default(""),
  storage_location: z.string().trim().optional().default("Main Shelf"),
  total_quantity: z.coerce.number().int().min(0),
  min_stock_threshold: z.coerce.number().int().min(0).default(2),
  is_serialized: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = z.array(importItemSchema).min(1).max(200).safeParse(body?.rows);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid CSV import payload" },
      { status: 400 }
    );
  }

  const rows = parsed.data;
  for (const row of rows) {
    const allowed = await verifyStaffLabAccess(context.profile, row.laboratory_id);
    if (!allowed) {
      return NextResponse.json(
        { error: `Not authorized for laboratory ${row.laboratory_id}` },
        { status: 403 }
      );
    }
  }

  const supabase = await createServerSupabase();
  const payload = rows.map((r) => ({
    name: r.name,
    sku: r.sku.toUpperCase(),
    laboratory_id: r.laboratory_id,
    department_id: r.department_id,
    category_id: r.category_id,
    manufacturer: r.manufacturer,
    model: r.model,
    storage_location: r.storage_location,
    total_quantity: r.total_quantity,
    available_quantity: r.total_quantity,
    min_stock_threshold: r.min_stock_threshold,
    is_serialized: r.is_serialized,
    condition: "Good" as const,
    status: calculateComponentStatus(r.total_quantity, r.min_stock_threshold, "Good"),
    created_by: context.userId,
  }));

  const { data, error } = await supabase
    .from("components")
    .upsert(payload, { onConflict: "sku", ignoreDuplicates: true })
    .select("id, sku, name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    actorId: context.userId,
    action: "components_bulk_imported",
    entityType: "component",
    summary: `Bulk imported ${(data ?? []).length} components via CSV`,
  });

  return NextResponse.json({ importedCount: (data ?? []).length, components: data ?? [] });
}
