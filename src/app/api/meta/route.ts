import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      departments: [],
      laboratories: [],
      categories: [],
    });
  }

  const supabase = await createServerSupabase();
  const [deptsRes, labsRes, catsRes] = await Promise.all([
    supabase.from("departments").select("*").is("deleted_at", null).order("name"),
    supabase
      .from("laboratories")
      .select("*, departments(id, name, code)")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  return NextResponse.json({
    configured: true,
    departments: deptsRes.data ?? [],
    laboratories: labsRes.data ?? [],
    categories: catsRes.data ?? [],
  });
}
