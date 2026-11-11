import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAssignedLabIds, requireRole } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const labId = sp.get("labId");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("loans")
    .select(
      "*, profiles!loans_borrower_id_fkey(full_name, academic_id, email), laboratories(name, code), loan_items(*, components(name, sku, is_serialized), component_assets(asset_code, serial_number)), extensions(*)"
    )
    .order("checked_out_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);

  if (context.profile.role === "staff") {
    const labIds = await getAssignedLabIds(context.profile);
    if (labIds && labIds.length > 0) {
      query = query.in("laboratory_id", labIds);
    } else if (labIds && labIds.length === 0) {
      return NextResponse.json({ loans: [] });
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ loans: data ?? [] });
}
