import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import type { AppRole, Profile } from "@/types/database";

export interface AuthContext {
  userId: string;
  profile: Profile;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email_confirmed_at) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*, departments(id, name, code)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();

  if (profileError || !profile || !profile.is_active) return null;

  return {
    userId: user.id,
    profile: profile as Profile,
  };
}

export async function requireRole(
  allowedRoles: AppRole[]
): Promise<{ context?: AuthContext; errorResponse?: NextResponse }> {
  if (!isSupabaseConfigured()) {
    return {
      errorResponse: NextResponse.json(
        { error: "Supabase backend is not configured yet. See .env.example and README.md." },
        { status: 503 }
      ),
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (!user.email_confirmed_at) {
    return {
      errorResponse: NextResponse.json(
        { error: "Email verification required. Please check your inbox and verify your email address." },
        { status: 403 }
      ),
    };
  }

  const context = await getAuthContext();
  if (!context) {
    return {
      errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(context.profile.role)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: insufficient role permissions" },
        { status: 403 }
      ),
    };
  }

  return { context };
}

export async function verifyStaffLabAccess(
  profile: Profile,
  laboratoryId: string
): Promise<boolean> {
  if (profile.role === "admin") return true;
  if (profile.role !== "staff") return false;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lab_staff_assignments")
    .select("id")
    .eq("laboratory_id", laboratoryId)
    .eq("staff_id", profile.id)
    .maybeSingle();

  return Boolean(data);
}

export async function getAssignedLabIds(profile: Profile): Promise<string[] | null> {
  if (profile.role === "admin") return null; // null means unrestricted across all labs
  if (profile.role !== "staff") return [];

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lab_staff_assignments")
    .select("laboratory_id")
    .eq("staff_id", profile.id);

  return (data ?? []).map((row) => row.laboratory_id);
}

export async function logAuditEvent(params: {
  actorId: string | null;
  laboratoryId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminSupabase();
    await admin.from("activity_logs").insert({
      actor_id: params.actorId,
      laboratory_id: params.laboratoryId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
    });
  } catch {
    // Audit logging should never crash a primary response if network hiccups
  }
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminSupabase();
    await admin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link_url: params.linkUrl ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Non-fatal notification insert failure
  }
}
