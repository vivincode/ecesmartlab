import { NextResponse } from "next/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { isCustomEmailConfigured, isSmtpConfigured } from "@/lib/notifications/email";

export async function GET() {
  const emailTransport = isSmtpConfigured()
    ? "smtp"
    : isCustomEmailConfigured()
      ? "resend"
      : "supabase-default";

  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    serviceRoleConfigured: isServiceRoleConfigured(),
    emailTransport,
    timestamp: new Date().toISOString(),
  });
}
