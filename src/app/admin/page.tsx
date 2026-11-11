import { redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AppShell } from "@/components/shell/app-shell";
import { AdminClient } from "@/components/admin/admin-client";
import { AdminLoginView } from "@/components/admin/admin-login-view";
import type {
  ActivityLog,
  Department,
  InstitutionalSettings,
  Laboratory,
  NotificationRecord,
  Profile,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return <AdminLoginView />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, departments(id, name, code)")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return <AdminLoginView />;
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminSupabase();
  const [usersRes, labsRes, activeLabsRes, notifRes, deptsRes, settingsRes, logsRes] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*, departments(id, name, code)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      admin
        .from("laboratories")
        .select("*, departments(id, name, code)")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("laboratories")
        .select("*, departments(id, name, code)")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("departments").select("*").is("deleted_at", null).order("name"),
      admin.from("institutional_settings").select("*").limit(1).maybeSingle(),
      admin
        .from("activity_logs")
        .select("*, profiles!activity_logs_actor_id_fkey(full_name, academic_id, role)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <AppShell
      profile={profile as Profile}
      laboratories={(activeLabsRes.data ?? []) as Laboratory[]}
      initialNotifications={(notifRes.data ?? []) as NotificationRecord[]}
    >
      <AdminClient
        initialUsers={(usersRes.data ?? []) as Profile[]}
        initialLabs={(labsRes.data ?? []) as Laboratory[]}
        departments={(deptsRes.data ?? []) as Department[]}
        initialSettings={(settingsRes.data ?? null) as InstitutionalSettings | null}
        initialLogs={(logsRes.data ?? []) as ActivityLog[]}
      />
    </AppShell>
  );
}
