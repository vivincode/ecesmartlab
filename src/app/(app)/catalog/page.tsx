import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogClient } from "@/components/catalog/catalog-client";
import type {
  Category,
  ComponentRecord,
  Department,
  Laboratory,
  Profile,
  ProjectTeam,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; availability?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, compsRes, labsRes, deptsRes, catsRes, teamsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("components")
      .select(
        "*, departments(id, name, code), laboratories(id, name, code), categories!components_category_id_fkey(id, name, slug), component_assets(*)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("laboratories")
      .select("*")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("departments").select("*").is("deleted_at", null).order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("project_teams").select("*").is("deleted_at", null).order("name"),
  ]);

  if (!profileRes.data) redirect("/login");

  return (
    <CatalogClient
      profile={profileRes.data as Profile}
      initialComponents={(compsRes.data ?? []) as ComponentRecord[]}
      laboratories={(labsRes.data ?? []) as Laboratory[]}
      departments={(deptsRes.data ?? []) as Department[]}
      categories={(catsRes.data ?? []) as Category[]}
      teams={(teamsRes.data ?? []) as ProjectTeam[]}
      initialSearch={sp.q || ""}
      initialAvailability={sp.availability || "all"}
    />
  );
}
