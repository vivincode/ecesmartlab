import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AppShell } from "@/components/shell/app-shell";
import type { Laboratory, NotificationRecord, Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, labsRes, notifRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, departments(id, name, code)")
      .eq("id", user.id)
      .single(),
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
  ]);

  if (!profileRes.data || !profileRes.data.is_active) {
    redirect("/login");
  }

  return (
    <AppShell
      profile={profileRes.data as Profile}
      laboratories={(labsRes.data ?? []) as Laboratory[]}
      initialNotifications={(notifRes.data ?? []) as NotificationRecord[]}
    >
      {children}
    </AppShell>
  );
}
