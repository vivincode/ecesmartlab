import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/reports-client";
import type { Laboratory } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
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

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const { data: labs } = await supabase
    .from("laboratories")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  return <ReportsClient laboratories={(labs ?? []) as Laboratory[]} />;
}
