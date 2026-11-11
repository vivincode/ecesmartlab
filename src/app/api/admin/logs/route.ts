import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { sanitizeSearch } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const q = sanitizeSearch(request.nextUrl.searchParams.get("q") || "");
  const labId = request.nextUrl.searchParams.get("labId");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("activity_logs")
    .select("*, profiles!activity_logs_actor_id_fkey(full_name, academic_id, role), laboratories(name, code)")
    .order("created_at", { ascending: false })
    .limit(150);

  if (q) query = query.or(`summary.ilike.%${q}%,action.ilike.%${q}%`);
  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ logs: data ?? [] });
}
