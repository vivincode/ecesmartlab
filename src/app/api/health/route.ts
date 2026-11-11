import { NextResponse } from "next/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { getActiveEmailTransportLabel } from "@/lib/notifications/email";

export async function GET() {
  const emailTransport = await getActiveEmailTransportLabel();

  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    serviceRoleConfigured: isServiceRoleConfigured(),
    emailTransport,
    timestamp: new Date().toISOString(),
  });
}
