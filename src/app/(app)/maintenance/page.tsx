import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MaintenanceClient } from "@/components/maintenance/maintenance-client";
import type {
  ComponentRecord,
  Laboratory,
  MaintenanceReport,
  Profile,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ component?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, reportsRes, labsRes, compsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("maintenance_reports")
      .select(
        "*, laboratories(name, code), components(name, sku), reporter:profiles!maintenance_reports_reported_by_fkey(full_name, academic_id)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("laboratories")
      .select("*")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("components").select("*").is("deleted_at", null).order("name"),
  ]);

  if (!profileRes.data) redirect("/login");

  return (
    <MaintenanceClient
      profile={profileRes.data as Profile}
      initialReports={(reportsRes.data ?? []) as MaintenanceReport[]}
      laboratories={(labsRes.data ?? []) as Laboratory[]}
      components={(compsRes.data ?? []) as ComponentRecord[]}
      preselectedComponentId={sp.component}
    />
  );
}
