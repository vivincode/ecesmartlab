import { NextResponse } from "next/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    serviceRoleConfigured: isServiceRoleConfigured(),
    timestamp: new Date().toISOString(),
  });
}
