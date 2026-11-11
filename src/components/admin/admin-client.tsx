"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Shield, Users, Building2, Settings, Activity } from "lucide-react";
import {
  ActionButton,
  BrutalCard,
  MonoLabel,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import type {
  ActivityLog,
  AppRole,
  Department,
  InstitutionalSettings,
  Laboratory,
  Profile,
} from "@/types/database";

interface AdminClientProps {
  initialUsers: Profile[];
  initialLabs: Laboratory[];
  departments: Department[];
  initialSettings: InstitutionalSettings | null;
  initialLogs: ActivityLog[];
}

export function AdminClient({
  initialUsers,
  initialLabs,
  departments,
  initialSettings,
  initialLogs,
}: AdminClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<"users" | "labs" | "policies" | "logs">("users");
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [labs, setLabs] = useState<Laboratory[]>(initialLabs);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [logSearch, setLogSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Staff lab assignment editor state
  const [assignUser, setAssignUser] = useState<Profile | null>(null);
  const [selectedLabIds, setSelectedLabIds] = useState<string[]>([]);

  // New Lab form
  const [labForm, setLabForm] = useState({
    name: "",
    code: "",
    department_id: departments[0]?.id || "",
    building: "",
    room_number: "",
    capacity: 24,
  });

  // Institutional settings form
  const [policyForm, setPolicyForm] = useState({
    max_borrow_qty_per_request: initialSettings?.max_borrow_qty_per_request ?? 10,
    max_active_loans_per_student: initialSettings?.max_active_loans_per_student ?? 5,
    max_loan_duration_days: initialSettings?.max_loan_duration_days ?? 14,
    overdue_grace_hours: initialSettings?.overdue_grace_hours ?? 24,
    staff_invite_code: "",
    enable_email_notifications: initialSettings?.enable_email_notifications ?? false,
    enable_deposits: initialSettings?.enable_deposits ?? false,
    enable_late_fees: initialSettings?.enable_late_fees ?? false,
    late_fee_per_day: initialSettings?.late_fee_per_day ?? 0,
    enable_replacement_charges: initialSettings?.enable_replacement_charges ?? false,
  });

  async function refreshUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
    }
    router.refresh();
  }

  async function updateUserRoleOrStatus(
    userId: string,
    payload: { role?: AppRole; is_active?: boolean; assigned_lab_ids?: string[] }
  ) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...payload }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast(d.error || "Update failed", "error");
      return;
    }
    toast("User account updated", "success");
    setAssignUser(null);
    await refreshUsers();
  }

  async function createLaboratory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labForm),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Failed to create lab", "error");
        return;
      }
      toast(`Created laboratory ${d.laboratory?.code}`, "success");
      setLabForm({
        name: "",
        code: "",
        department_id: departments[0]?.id || "",
        building: "",
        room_number: "",
        capacity: 24,
      });
      const labsRes = await fetch("/api/admin/labs");
      if (labsRes.ok) {
        const ld = await labsRes.json();
        setLabs(ld.laboratories ?? []);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function savePolicies(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        max_borrow_qty_per_request: policyForm.max_borrow_qty_per_request,
        max_active_loans_per_student: policyForm.max_active_loans_per_student,
        max_loan_duration_days: policyForm.max_loan_duration_days,
        overdue_grace_hours: policyForm.overdue_grace_hours,
        enable_email_notifications: policyForm.enable_email_notifications,
        enable_deposits: policyForm.enable_deposits,
        enable_late_fees: policyForm.enable_late_fees,
        late_fee_per_day: policyForm.late_fee_per_day,
        enable_replacement_charges: policyForm.enable_replacement_charges,
      };
      if (policyForm.staff_invite_code.trim()) {
        body.staff_invite_code = policyForm.staff_invite_code.trim();
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Failed to update settings", "error");
        return;
      }
      toast("Institutional policies saved", "success");
      setPolicyForm((p) => ({ ...p, staff_invite_code: "" }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function refreshLogs() {
    const res = await fetch(`/api/admin/logs?q=${encodeURIComponent(logSearch)}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs ?? []);
    }
  }

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.summary.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.profiles?.academic_id || "").toLowerCase().includes(q)
    );
  }, [logs, logSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>ADMINISTRATOR CONTROL PLANE</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Institutional Governance &amp; Audit
          </h1>
        </div>
        <div className="inline-flex flex-wrap border-2 border-slate-900 bg-slate-100 p-1">
          {[
            { id: "users", label: "Users & Roles", icon: Users },
            { id: "labs", label: "Laboratories", icon: Building2 },
            { id: "policies", label: "Policies", icon: Settings },
            { id: "logs", label: "Audit Logs", icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-black uppercase ${
                  tab === item.id ? "bg-slate-900 text-white" : "text-slate-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* USERS TAB */}
      {tab === "users" && (
        <BrutalCard className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Academic ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950">{u.full_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">{u.academic_id}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        updateUserRoleOrStatus(u.id, { role: e.target.value as AppRole })
                      }
                      className="border-2 border-slate-900 bg-white px-2 py-1 font-mono text-[11px] font-black uppercase"
                    >
                      <option value="student">student</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.is_active ? "Active" : "Blocked"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {u.role === "staff" && (
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setAssignUser(u);
                            setSelectedLabIds([]);
                          }}
                        >
                          Assign Labs
                        </ActionButton>
                      )}
                      <ActionButton
                        size="sm"
                        variant={u.is_active ? "danger" : "primary"}
                        onClick={() => {
                          if (
                            confirm(
                              `${u.is_active ? "Deactivate" : "Reactivate"} ${u.full_name}?`
                            )
                          ) {
                            updateUserRoleOrStatus(u.id, { is_active: !u.is_active });
                          }
                        }}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BrutalCard>
      )}

      {/* LABS TAB */}
      {tab === "labs" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <BrutalCard className="p-5 lg:col-span-2">
            <h2 className="mb-3 border-b-2 border-slate-900 pb-2 text-sm font-black uppercase">
              Active Laboratory Compartments ({labs.length})
            </h2>
            <div className="divide-y divide-slate-200 text-xs">
              {labs.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-mono text-[10px] font-black text-sky-700">
                      {l.code} · {l.departments?.code ?? "DEPT"}
                    </span>
                    <div className="font-black text-slate-950">{l.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {l.building || "Campus"} {l.room_number ? `Room ${l.room_number}` : ""}
                    </div>
                  </div>
                  <span className="border-2 border-slate-900 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-black">
                    {l.capacity} SEATS
                  </span>
                </div>
              ))}
            </div>
          </BrutalCard>

          <BrutalCard className="p-5">
            <MonoLabel>PROVISION COMPARTMENT</MonoLabel>
            <h2 className="mt-1 text-base font-black uppercase">Add New Laboratory</h2>
            <form onSubmit={createLaboratory} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Lab Name *
                </label>
                <input
                  required
                  value={labForm.name}
                  onChange={(e) => setLabForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Power Electronics Lab"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Code *
                  </label>
                  <input
                    required
                    value={labForm.code}
                    onChange={(e) =>
                      setLabForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="EEE-202"
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={labForm.capacity}
                    onChange={(e) =>
                      setLabForm((f) => ({ ...f, capacity: Number(e.target.value) }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Department *
                </label>
                <select
                  value={labForm.department_id}
                  onChange={(e) => setLabForm((f) => ({ ...f, department_id: e.target.value }))}
                  className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Building"
                  value={labForm.building}
                  onChange={(e) => setLabForm((f) => ({ ...f, building: e.target.value }))}
                  className="border-2 border-slate-900 px-3 py-2 text-xs"
                />
                <input
                  placeholder="Room #"
                  value={labForm.room_number}
                  onChange={(e) => setLabForm((f) => ({ ...f, room_number: e.target.value }))}
                  className="border-2 border-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <ActionButton type="submit" variant="primary" className="w-full" disabled={saving}>
                <Plus className="h-3.5 w-3.5" />
                Create Laboratory
              </ActionButton>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* POLICIES TAB */}
      {tab === "policies" && (
        <BrutalCard className="p-6">
          <div className="border-b-2 border-slate-900 pb-3">
            <MonoLabel>CONFIGURABLE INSTITUTIONAL RULES</MonoLabel>
            <h2 className="mt-1 text-lg font-black uppercase">
              Lending Limits, Overdue Rules &amp; Optional Commercial Modules
            </h2>
          </div>

          <form onSubmit={savePolicies} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Max Qty / Request
                </label>
                <input
                  type="number"
                  min={1}
                  value={policyForm.max_borrow_qty_per_request}
                  onChange={(e) =>
                    setPolicyForm((p) => ({
                      ...p,
                      max_borrow_qty_per_request: Number(e.target.value),
                    }))
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Max Active Loans / Student
                </label>
                <input
                  type="number"
                  min={1}
                  value={policyForm.max_active_loans_per_student}
                  onChange={(e) =>
                    setPolicyForm((p) => ({
                      ...p,
                      max_active_loans_per_student: Number(e.target.value),
                    }))
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Max Loan Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={policyForm.max_loan_duration_days}
                  onChange={(e) =>
                    setPolicyForm((p) => ({
                      ...p,
                      max_loan_duration_days: Number(e.target.value),
                    }))
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Overdue Grace (Hours)
                </label>
                <input
                  type="number"
                  min={0}
                  value={policyForm.overdue_grace_hours}
                  onChange={(e) =>
                    setPolicyForm((p) => ({
                      ...p,
                      overdue_grace_hours: Number(e.target.value),
                    }))
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div className="border-2 border-slate-900 bg-slate-50 p-4">
              <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                Rotate Staff Registration Invite Code (Leave blank to keep current)
              </label>
              <input
                type="password"
                value={policyForm.staff_invite_code}
                onChange={(e) =>
                  setPolicyForm((p) => ({ ...p, staff_invite_code: e.target.value }))
                }
                placeholder="Enter new staff invite code"
                className="w-full max-w-sm border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs"
              />
            </div>

            <div className="space-y-2 border-t-2 border-slate-200 pt-4">
              <MonoLabel>OPTIONAL MODULAR COMMERCIAL FEATURES (DISABLED BY DEFAULT)</MonoLabel>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {[
                  { key: "enable_email_notifications", label: "Enable Email Notifications (Resend)" },
                  { key: "enable_deposits", label: "Enable Borrowing Deposits" },
                  { key: "enable_late_fees", label: "Enable Late Return Fees" },
                  { key: "enable_replacement_charges", label: "Enable Replacement Charge Billing" },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 border border-slate-300 bg-white p-3 font-mono text-xs font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(policyForm[opt.key as keyof typeof policyForm])}
                      onChange={(e) =>
                        setPolicyForm((p) => ({ ...p, [opt.key]: e.target.checked }))
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <ActionButton type="submit" variant="primary" disabled={saving}>
              <Shield className="h-4 w-4" />
              Save Institutional Policies
            </ActionButton>
          </form>
        </BrutalCard>
      )}

      {/* AUDIT LOGS TAB */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter activity logs by action, actor, or summary..."
                className="w-full border-2 border-slate-900 bg-white py-2 pr-3 pl-9 font-mono text-xs"
              />
            </div>
            <ActionButton variant="secondary" size="sm" onClick={refreshLogs}>
              Refresh
            </ActionButton>
          </div>

          <BrutalCard className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold">{l.profiles?.full_name ?? "System"}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {l.profiles?.academic_id}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-black text-sky-700">
                      {l.action}
                    </td>
                    <td className="px-4 py-2.5">{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BrutalCard>
        </div>
      )}

      {/* Assign Labs to Staff Modal */}
      {assignUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-md p-6">
            <h3 className="text-base font-black uppercase">
              Assign Laboratories to {assignUser.full_name}
            </h3>
            <div className="mt-4 space-y-2">
              {labs.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center gap-2 border border-slate-300 p-2.5 font-mono text-xs font-bold"
                >
                  <input
                    type="checkbox"
                    checked={selectedLabIds.includes(l.id)}
                    onChange={(e) =>
                      setSelectedLabIds((prev) =>
                        e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                      )
                    }
                  />
                  {l.code} — {l.name}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setAssignUser(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={() =>
                  updateUserRoleOrStatus(assignUser.id, { assigned_lab_ids: selectedLabIds })
                }
              >
                Save Assignments
              </ActionButton>
            </div>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
