"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel, StatusBadge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/database";

export interface DashboardPayload {
  profile: Profile;
  metrics: {
    totalUsers: number;
    totalDepartments: number;
    totalLaboratories: number;
    totalComponents: number;
    totalUnits: number;
    availableUnits: number;
    activeLoans: number;
    dueSoonLoans: number;
    overdueLoans: number;
    pendingRequests: number;
    pendingBookings: number;
    openMaintenance: number;
    damagedComponents: number;
    lowStockCount: number;
    todayCheckouts: number;
    todayReturns: number;
  };
  categoryBreakdown: { name: string; total: number; available: number }[];
  departmentUsage: { name: string; units: number }[];
  lendingTrend: { month: string; requests: number; checkouts: number }[];
  maintenanceBreakdown: { name: string; count: number }[];
  lowStockItems: Array<{
    id: string;
    name: string;
    sku: string;
    available_quantity: number;
    min_stock_threshold: number;
    laboratories?: { name: string; code: string } | null;
  }>;
  recentRequests: Array<{
    id: string;
    request_number: string;
    project_name: string;
    status: string;
    needed_until: string;
    created_at: string;
    profiles?: { full_name: string; academic_id: string } | null;
    laboratories?: { name: string } | null;
  }>;
  recommendedComponents: Array<{
    id: string;
    name: string;
    sku: string;
    available_quantity: number;
    laboratories?: { name: string } | null;
  }>;
}

const CHART_COLORS = ["#0f172a", "#0284c7", "#16a34a", "#d97706", "#dc2626", "#64748b"];

export function DashboardClient({ data }: { data: DashboardPayload }) {
  const { profile, metrics } = data;
  const isStaffOrAdmin = profile.role === "staff" || profile.role === "admin";
  const isAdmin = profile.role === "admin";

  const statCards =
    profile.role === "student"
      ? [
          { label: "ACTIVE LOANS", value: metrics.activeLoans, icon: Box, tone: "text-sky-700" },
          { label: "PENDING REQUESTS", value: metrics.pendingRequests, icon: Clock, tone: "text-amber-700" },
          { label: "DUE SOON", value: metrics.dueSoonLoans, icon: CalendarClock, tone: "text-amber-700" },
          { label: "OVERDUE ITEMS", value: metrics.overdueLoans, icon: AlertTriangle, tone: "text-rose-700" },
        ]
      : isAdmin
        ? [
            { label: "TOTAL USERS", value: metrics.totalUsers, icon: Users, tone: "text-slate-900" },
            { label: "DEPTS / LABS", value: `${metrics.totalDepartments} / ${metrics.totalLaboratories}`, icon: Layers, tone: "text-sky-700" },
            { label: "INVENTORY UNITS", value: `${metrics.availableUnits} / ${metrics.totalUnits}`, icon: Box, tone: "text-emerald-700" },
            { label: "ACTIVE LOANS", value: metrics.activeLoans, icon: ClipboardList, tone: "text-sky-700" },
            { label: "PENDING REQUESTS", value: metrics.pendingRequests, icon: Clock, tone: "text-amber-700" },
            { label: "OVERDUE EQUIPMENT", value: metrics.overdueLoans, icon: AlertTriangle, tone: "text-rose-700" },
            { label: "OPEN MAINTENANCE", value: metrics.openMaintenance, icon: Wrench, tone: "text-rose-700" },
            {
              label: "UTILIZATION",
              value:
                metrics.totalUnits > 0
                  ? `${Math.round(((metrics.totalUnits - metrics.availableUnits) / metrics.totalUnits) * 100)}%`
                  : "0%",
              icon: ShieldCheck,
              tone: "text-slate-900",
            },
          ]
        : [
            { label: "LAB INVENTORY UNITS", value: metrics.totalUnits, icon: Box, tone: "text-slate-900" },
            { label: "AVAILABLE STOCK", value: metrics.availableUnits, icon: CheckCircle2, tone: "text-emerald-700" },
            { label: "PENDING APPROVALS", value: metrics.pendingRequests + metrics.pendingBookings, icon: Clock, tone: "text-amber-700" },
            { label: "ACTIVE LOANS", value: metrics.activeLoans, icon: ClipboardList, tone: "text-sky-700" },
            { label: "OVERDUE LOANS", value: metrics.overdueLoans, icon: AlertTriangle, tone: "text-rose-700" },
            { label: "TODAY IN / OUT", value: `${metrics.todayCheckouts} / ${metrics.todayReturns}`, icon: CalendarClock, tone: "text-sky-700" },
            { label: "MAINTENANCE OPEN", value: metrics.openMaintenance, icon: Wrench, tone: "text-rose-700" },
            { label: "LOW STOCK ALERTS", value: metrics.lowStockCount, icon: AlertTriangle, tone: "text-amber-700" },
          ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>
            {profile.role.toUpperCase()} WORKSPACE // {profile.academic_id}
          </MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight text-slate-950 uppercase sm:text-3xl">
            Welcome, {profile.full_name}
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {isAdmin
              ? "Overview of lab inventory, active loans, reports, and user settings."
              : profile.role === "staff"
                ? "Assigned laboratory stock, pending borrow approvals, checkouts, and maintenance tickets."
                : "View your borrowed components, pending requests, project teams, and lab bookings."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog">
            <ActionButton variant="primary" size="sm">
              Browse Catalog
              <ArrowRight className="h-3.5 w-3.5" />
            </ActionButton>
          </Link>
          {profile.role === "student" ? (
            <Link href="/bookings">
              <ActionButton variant="secondary" size="sm">
                Book Lab Slot
              </ActionButton>
            </Link>
          ) : (
            <Link href="/borrow">
              <ActionButton variant="secondary" size="sm">
                Review Queue ({metrics.pendingRequests})
              </ActionButton>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <BrutalCard className="p-4">
                <div className="flex items-center justify-between">
                  <MonoLabel className="text-slate-500">{card.label}</MonoLabel>
                  <Icon className={`h-4 w-4 ${card.tone}`} />
                </div>
                <div className="font-display mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                  {card.value}
                </div>
              </BrutalCard>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics Charts (Staff & Admin) */}
      {isStaffOrAdmin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <BrutalCard className="p-5">
            <div className="mb-4 flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
              <div>
                <MonoLabel>INVENTORY DISTRIBUTION</MonoLabel>
                <h2 className="text-sm font-black uppercase">Stock by Hardware Category</h2>
              </div>
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">
                Total vs Available
              </span>
            </div>
            <div className="h-64 w-full">
              {data.categoryBreakdown.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-xs text-slate-400">
                  No category inventory recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#334155" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#334155" }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total Units" fill="#0f172a" />
                    <Bar dataKey="available" name="Available" fill="#0284c7" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </BrutalCard>

          <BrutalCard className="p-5">
            <div className="mb-4 flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
              <div>
                <MonoLabel>BORROWING VELOCITY</MonoLabel>
                <h2 className="text-sm font-black uppercase">Monthly Lending Activity</h2>
              </div>
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">
                Requests &amp; Checkouts
              </span>
            </div>
            <div className="h-64 w-full">
              {data.lendingTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-xs text-slate-400">
                  Lending trend populates as requests are submitted.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.lendingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#334155" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#334155" }} allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      name="Requests"
                      stroke="#0f172a"
                      fill="#e2e8f0"
                    />
                    <Area
                      type="monotone"
                      dataKey="checkouts"
                      name="Checkouts"
                      stroke="#0284c7"
                      fill="#bae6fd"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </BrutalCard>
        </div>
      )}

      {/* Admin Additional Analytics */}
      {isAdmin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <BrutalCard className="p-5">
            <div className="mb-4 border-b-2 border-slate-200 pb-2.5">
              <MonoLabel>DEPARTMENTAL FOOTPRINT</MonoLabel>
              <h2 className="text-sm font-black uppercase">Units by Department</h2>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="units" name="Inventory Units" fill="#0284c7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BrutalCard>

          <BrutalCard className="p-5">
            <div className="mb-4 border-b-2 border-slate-200 pb-2.5">
              <MonoLabel>MAINTENANCE HEALTH</MonoLabel>
              <h2 className="text-sm font-black uppercase">Defect Reports by Status</h2>
            </div>
            <div className="h-56 w-full">
              {data.maintenanceBreakdown.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-xs text-slate-400">
                  Zero maintenance tickets logged.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.maintenanceBreakdown}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label
                    >
                      {data.maintenanceBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </BrutalCard>
        </div>
      )}

      {/* Lower Two-Column Activity & Alerts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent Requests */}
        <BrutalCard className="p-5">
          <div className="mb-3 flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
            <div>
              <MonoLabel>BORROWING PIPELINE</MonoLabel>
              <h2 className="text-sm font-black uppercase">Recent Requests</h2>
            </div>
            <Link
              href="/borrow"
              className="font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
            >
              View All →
            </Link>
          </div>
          {data.recentRequests.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-slate-500">
              No borrowing requests recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {data.recentRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <span className="block font-mono text-[10px] font-black text-sky-700">
                      {req.request_number} · {req.laboratories?.name ?? "Lab"}
                    </span>
                    <span className="block truncate text-xs font-extrabold text-slate-900">
                      {req.project_name}
                    </span>
                    <span className="block font-mono text-[10px] text-slate-500">
                      {req.profiles?.full_name ?? "Student"} · Return by {formatDate(req.needed_until)}
                    </span>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </BrutalCard>

        {/* Low Stock Alerts (Staff/Admin) OR Recommended Components (Student) */}
        {isStaffOrAdmin ? (
          <BrutalCard className="p-5">
            <div className="mb-3 flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
              <div>
                <MonoLabel>INVENTORY THRESHOLDS</MonoLabel>
                <h2 className="text-sm font-black uppercase">Low-Stock Alerts</h2>
              </div>
              <Link
                href="/catalog?availability=low"
                className="font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
              >
                Manage Stock →
              </Link>
            </div>
            {data.lowStockItems.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-emerald-700">
                All components are above minimum stock thresholds.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <span className="block font-mono text-[10px] font-black text-amber-700">
                        {item.sku} · {item.laboratories?.code ?? "LAB"}
                      </span>
                      <span className="block text-xs font-extrabold text-slate-900">
                        {item.name}
                      </span>
                    </div>
                    <span className="border-2 border-amber-700 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-black text-amber-900">
                      {item.available_quantity} left (min {item.min_stock_threshold})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BrutalCard>
        ) : (
          <BrutalCard className="p-5">
            <div className="mb-3 flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
              <div>
                <MonoLabel>AVAILABLE FOR PROJECTS</MonoLabel>
                <h2 className="text-sm font-black uppercase">Recommended Hardware</h2>
              </div>
              <Link
                href="/catalog"
                className="font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
              >
                Full Catalog →
              </Link>
            </div>
            <div className="divide-y divide-slate-200">
              {data.recommendedComponents.map((comp) => (
                <div key={comp.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <span className="block font-mono text-[10px] font-black text-sky-700">
                      {comp.sku} · {comp.laboratories?.name ?? "Lab"}
                    </span>
                    <span className="block text-xs font-extrabold text-slate-900">
                      {comp.name}
                    </span>
                  </div>
                  <Link
                    href={`/catalog/${comp.id}`}
                    className="border-2 border-slate-900 bg-white px-2.5 py-1 font-mono text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white"
                  >
                    {comp.available_quantity} Avail
                  </Link>
                </div>
              ))}
            </div>
          </BrutalCard>
        )}
      </div>
    </div>
  );
}
