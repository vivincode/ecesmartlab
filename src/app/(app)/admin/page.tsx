import { redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { AdminClient } from "@/components/admin/admin-client";
import type {
  ActivityLog,
  Department,
  InstitutionalSettings,
  Laboratory,
  Profile,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminSupabase();
  const [usersRes, labsRes, deptsRes, settingsRes, logsRes] = await Promise.all([
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
    admin.from("departments").select("*").is("deleted_at", null).order("name"),
    admin.from("institutional_settings").select("*").limit(1).maybeSingle(),
    admin
      .from("activity_logs")
      .select("*, profiles!activity_logs_actor_id_fkey(full_name, academic_id, role)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <AdminClient
      initialUsers={(usersRes.data ?? []) as Profile[]}
      initialLabs={(labsRes.data ?? []) as Laboratory[]}
      departments={(deptsRes.data ?? []) as Department[]}
      initialSettings={(settingsRes.data ?? null) as InstitutionalSettings | null}
      initialLogs={(logsRes.data ?? []) as ActivityLog[]}
    />
  );
}
