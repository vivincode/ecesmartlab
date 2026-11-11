import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { DashboardClient, type DashboardPayload } from "@/components/dashboard/dashboard-client";
import type { Profile } from "@/types/database";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, departments(id, name, code)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const typedProfile = profile as Profile;
  const isStaff = typedProfile.role === "staff";
  const isAdmin = typedProfile.role === "admin";

  // Scope staff queries to their assigned labs
  let assignedLabIds: string[] | null = null;
  if (isStaff) {
    const { data: assignments } = await supabase
      .from("lab_staff_assignments")
      .select("laboratory_id")
      .eq("staff_id", user.id);
    assignedLabIds = (assignments ?? []).map((a) => a.laboratory_id);
  }

  let compQ = supabase
    .from("components")
    .select(
      "id, name, sku, total_quantity, available_quantity, min_stock_threshold, condition, status, laboratory_id, laboratories(name, code), departments(name, code), categories!components_category_id_fkey(name)"
    )
    .is("deleted_at", null);

  let reqQ = supabase
    .from("borrow_requests")
    .select(
      "id, request_number, project_name, status, needed_until, created_at, laboratory_id, requester_id, profiles!borrow_requests_requester_id_fkey(full_name, academic_id), laboratories(name)"
    )
    .order("created_at", { ascending: false });

  let loansQ = supabase
    .from("loans")
    .select("id, status, due_date, checked_out_at, returned_at, laboratory_id, borrower_id");

  let bookingsQ = supabase.from("lab_bookings").select("id, status, laboratory_id, user_id");
  let maintQ = supabase.from("maintenance_reports").select("id, status, laboratory_id");

  if (typedProfile.role === "student") {
    reqQ = reqQ.eq("requester_id", user.id);
    loansQ = loansQ.eq("borrower_id", user.id);
    bookingsQ = bookingsQ.eq("user_id", user.id);
  } else if (isStaff && assignedLabIds) {
    const scopeIds =
      assignedLabIds.length > 0 ? assignedLabIds : ["00000000-0000-0000-0000-000000000000"];
    compQ = compQ.in("laboratory_id", scopeIds);
    reqQ = reqQ.in("laboratory_id", scopeIds);
    loansQ = loansQ.in("laboratory_id", scopeIds);
    bookingsQ = bookingsQ.in("laboratory_id", scopeIds);
    maintQ = maintQ.in("laboratory_id", scopeIds);
  }

  const [compsRes, reqsRes, loansRes, bookingsRes, maintRes, usersCount, deptsCount, labsCount] =
    await Promise.all([
      compQ,
      reqQ,
      loansQ,
      bookingsQ,
      maintQ,
      isAdmin
        ? supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null)
        : Promise.resolve({ count: 0 }),
      supabase.from("departments").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("laboratories").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ]);

  const comps = (compsRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    sku: string;
    total_quantity: number;
    available_quantity: number;
    min_stock_threshold: number;
    condition: string;
    status: string;
    laboratories?: { name: string; code: string } | null;
    departments?: { name: string; code: string } | null;
    categories?: { name: string } | null;
  }>;

  const reqs = (reqsRes.data ?? []) as unknown as DashboardPayload["recentRequests"];
  const loans = loansRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const maint = maintRes.data ?? [];
  const today = todayISO();

  const catMap = new Map<string, { name: string; total: number; available: number }>();
  const deptMap = new Map<string, { name: string; units: number }>();

  for (const c of comps) {
    const catName = c.categories?.name ?? "Uncategorized";
    const curCat = catMap.get(catName) ?? { name: catName, total: 0, available: 0 };
    curCat.total += c.total_quantity;
    curCat.available += c.available_quantity;
    catMap.set(catName, curCat);

    const deptCode = c.departments?.code ?? "GEN";
    const curDept = deptMap.get(deptCode) ?? { name: deptCode, units: 0 };
    curDept.units += c.total_quantity;
    deptMap.set(deptCode, curDept);
  }

  const monthMap = new Map<string, { month: string; requests: number; checkouts: number }>();
  for (const r of reqs) {
    const m = r.created_at.slice(0, 7);
    const cur = monthMap.get(m) ?? { month: m, requests: 0, checkouts: 0 };
    cur.requests += 1;
    if (r.status === "Checked out" || r.status === "Returned") cur.checkouts += 1;
    monthMap.set(m, cur);
  }

  const maintMap = new Map<string, number>();
  for (const m of maint) {
    maintMap.set(m.status, (maintMap.get(m.status) ?? 0) + 1);
  }

  const lowStockItems = comps.filter((c) => c.available_quantity <= c.min_stock_threshold);

  const payload: DashboardPayload = {
    profile: typedProfile,
    metrics: {
      totalUsers: usersCount.count ?? 0,
      totalDepartments: deptsCount.count ?? 0,
      totalLaboratories: labsCount.count ?? 0,
      totalComponents: comps.length,
      totalUnits: comps.reduce((s, c) => s + c.total_quantity, 0),
      availableUnits: comps.reduce((s, c) => s + c.available_quantity, 0),
      activeLoans: loans.filter((l) =>
        ["Active", "Due soon", "Overdue", "Partially returned"].includes(l.status)
      ).length,
      dueSoonLoans: loans.filter((l) => l.status === "Due soon").length,
      overdueLoans: loans.filter(
        (l) => l.status === "Overdue" || (l.status === "Active" && l.due_date < today)
      ).length,
      pendingRequests: reqs.filter((r) => r.status === "Pending").length,
      pendingBookings: bookings.filter((b) => b.status === "Pending").length,
      openMaintenance: maint.filter((m) => !["Resolved", "Closed"].includes(m.status)).length,
      damagedComponents: comps.filter((c) =>
        ["Damaged", "Under maintenance"].includes(c.condition)
      ).length,
      lowStockCount: lowStockItems.length,
      todayCheckouts: loans.filter((l) => l.checked_out_at?.slice(0, 10) === today).length,
      todayReturns: loans.filter((l) => l.returned_at?.slice(0, 10) === today).length,
    },
    categoryBreakdown: Array.from(catMap.values()),
    departmentUsage: Array.from(deptMap.values()),
    lendingTrend: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    maintenanceBreakdown: Array.from(maintMap.entries()).map(([name, count]) => ({
      name,
      count,
    })),
    lowStockItems: lowStockItems.slice(0, 6),
    recentRequests: reqs.slice(0, 6),
    recommendedComponents: comps.filter((c) => c.available_quantity > 0).slice(0, 6),
  };

  return <DashboardClient data={payload} />;
}
