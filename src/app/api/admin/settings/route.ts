import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole } from "@/lib/auth/guards";
import { institutionalSettingsSchema } from "@/lib/validators/schemas";

export async function GET() {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("institutional_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = institutionalSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid settings payload" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: existing } = await admin
    .from("institutional_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const payload = {
    ...parsed.data,
    updated_by: context.userId,
  };

  const { data: updated, error } = existing
    ? await admin
        .from("institutional_settings")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await admin.from("institutional_settings").insert(payload).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: context.userId,
    action: "institutional_settings_updated",
    entityType: "institutional_settings",
    entityId: updated.id,
    summary: "Updated institutional lending and notification policies",
  });

  return NextResponse.json({ settings: updated });
}
