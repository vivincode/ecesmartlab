import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { requireRole } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Authorized cron caller
  } else {
    const { errorResponse } = await requireRole(["staff", "admin"]);
    if (errorResponse) return errorResponse;
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("sync_overdue_loans");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ updatedCount: data ?? 0 });
}
