import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAuditEvent, requireRole, verifyStaffLabAccess } from "@/lib/auth/guards";
import { componentSchema } from "@/lib/validators/schemas";
import { calculateComponentStatus } from "@/lib/domain/lending";
import { sanitizeSearch } from "@/lib/utils";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const search = sanitizeSearch(sp.get("q") || "");
  const labId = sp.get("labId");
  const deptId = sp.get("departmentId");
  const catId = sp.get("categoryId");
  const condition = sp.get("condition");
  const availability = sp.get("availability");
  const sort = sp.get("sort") || "created_desc";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") || 24)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createServerSupabase();
  let query = supabase
    .from("components")
    .select(
      "*, departments(id, name, code), laboratories(id, name, code), categories!components_category_id_fkey(id, name, slug), component_assets(*)",
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,sku.ilike.%${search}%,manufacturer.ilike.%${search}%,model.ilike.%${search}%,description.ilike.%${search}%`
    );
  }
  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);
  if (deptId && deptId !== "all") query = query.eq("department_id", deptId);
  if (catId && catId !== "all") query = query.eq("category_id", catId);
  if (condition && condition !== "all") query = query.eq("condition", condition);
  if (availability === "available") query = query.gt("available_quantity", 0);
  if (availability === "low") query = query.eq("status", "Low stock");
  if (availability === "out") query = query.eq("available_quantity", 0);

  if (sort === "name_asc") query = query.order("name", { ascending: true });
  else if (sort === "avail_desc") query = query.order("available_quantity", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    components: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = componentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid component payload" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const hasLabAccess = await verifyStaffLabAccess(context.profile, d.laboratory_id);
  if (!hasLabAccess) {
    return NextResponse.json(
      { error: "You are not assigned to manage inventory for this laboratory." },
      { status: 403 }
    );
  }

  const supabase = await createServerSupabase();
  const status = calculateComponentStatus(d.available_quantity, d.min_stock_threshold, d.condition);

  const { data: inserted, error } = await supabase
    .from("components")
    .insert({
      ...d,
      sku: d.sku.toUpperCase(),
      subcategory_id: d.subcategory_id || null,
      datasheet_url: d.datasheet_url || null,
      status,
      created_by: context.userId,
    })
    .select("*")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Duplicate SKU / inventory code already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 400 });
  }

  await supabase.from("inventory_transactions").insert({
    component_id: inserted.id,
    laboratory_id: inserted.laboratory_id,
    transaction_type: "initial_stock",
    quantity_delta: inserted.available_quantity,
    before_available: 0,
    after_available: inserted.available_quantity,
    reference_type: "component",
    reference_id: inserted.id,
    actor_id: context.userId,
    notes: "Initial component catalog entry",
  });

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: inserted.laboratory_id,
    action: "component_created",
    entityType: "component",
    entityId: inserted.id,
    summary: `Added component ${inserted.name} (${inserted.sku}) with ${inserted.total_quantity} units`,
  });

  return NextResponse.json({ component: inserted }, { status: 201 });
}
