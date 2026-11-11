import { LandingPage } from "@/components/landing/landing-page";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <LandingPage
        stats={{
          configured: false,
          totalComponents: 0,
          totalLabs: 0,
          totalDepartments: 0,
          availableUnits: 0,
          featuredComponents: [],
        }}
      />
    );
  }

  try {
    const supabase = await createServerSupabase();
    const [compsRes, labsRes, deptsRes] = await Promise.all([
      supabase
        .from("components")
        .select(
          "id, name, sku, available_quantity, total_quantity, condition, status, storage_location, laboratories(name, code), categories!components_category_id_fkey(name)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("laboratories").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("departments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ]);

    const comps = (compsRes.data ?? []) as unknown as Array<{
      id: string;
      name: string;
      sku: string;
      available_quantity: number;
      total_quantity: number;
      condition: string;
      status: string;
      storage_location: string;
      laboratories?: { name: string; code: string } | null;
      categories?: { name: string } | null;
    }>;

    const availableUnits = comps.reduce((sum, c) => sum + (c.available_quantity || 0), 0);

    return (
      <LandingPage
        stats={{
          configured: true,
          totalComponents: comps.length,
          totalLabs: labsRes.count ?? 0,
          totalDepartments: deptsRes.count ?? 0,
          availableUnits,
          featuredComponents: comps.slice(0, 6),
        }}
      />
    );
  } catch {
    return (
      <LandingPage
        stats={{
          configured: false,
          totalComponents: 0,
          totalLabs: 0,
          totalDepartments: 0,
          availableUnits: 0,
          featuredComponents: [],
        }}
      />
    );
  }
}
