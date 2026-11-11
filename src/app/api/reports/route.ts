import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAssignedLabIds, requireRole } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const labId = sp.get("labId");

  const supabase = await createServerSupabase();
  const assignedLabs = await getAssignedLabIds(context.profile);

  if (assignedLabs !== null) {
    if (labId && labId !== "all" && !assignedLabs.includes(labId)) {
      return NextResponse.json({ error: "Not assigned to this laboratory" }, { status: 403 });
    }
    if (assignedLabs.length === 0) {
      return NextResponse.json({
        components: [],
        loans: [],
        maintenance: [],
        transactions: [],
      });
    }
  }

  let compQ = supabase
    .from("components")
    .select("*, laboratories(name, code), departments(name, code), categories!components_category_id_fkey(name)")
    .is("deleted_at", null);
  let loansQ = supabase
    .from("loans")
    .select("*, profiles!loans_borrower_id_fkey(full_name, academic_id), laboratories(name, code), loan_items(*, components(name, sku))")
    .order("checked_out_at", { ascending: false });
  let maintQ = supabase
    .from("maintenance_reports")
    .select("*, laboratories(name, code), components(name, sku)")
    .order("created_at", { ascending: false });
  let txQ = supabase
    .from("inventory_transactions")
    .select("*, components(name, sku), laboratories(name, code)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (labId && labId !== "all") {
    compQ = compQ.eq("laboratory_id", labId);
    loansQ = loansQ.eq("laboratory_id", labId);
    maintQ = maintQ.eq("laboratory_id", labId);
    txQ = txQ.eq("laboratory_id", labId);
  } else if (assignedLabs && assignedLabs.length > 0) {
    compQ = compQ.in("laboratory_id", assignedLabs);
    loansQ = loansQ.in("laboratory_id", assignedLabs);
    maintQ = maintQ.in("laboratory_id", assignedLabs);
    txQ = txQ.in("laboratory_id", assignedLabs);
  }

  if (from) {
    loansQ = loansQ.gte("checked_out_at", `${from}T00:00:00Z`);
    maintQ = maintQ.gte("created_at", `${from}T00:00:00Z`);
    txQ = txQ.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    loansQ = loansQ.lte("checked_out_at", `${to}T23:59:59Z`);
    maintQ = maintQ.lte("created_at", `${to}T23:59:59Z`);
    txQ = txQ.lte("created_at", `${to}T23:59:59Z`);
  }

  const [comps, loans, maintenance, transactions] = await Promise.all([
    compQ,
    loansQ,
    maintQ,
    txQ,
  ]);

  return NextResponse.json({
    components: comps.data ?? [],
    loans: loans.data ?? [],
    maintenance: maintenance.data ?? [],
    transactions: transactions.data ?? [],
  });
}
