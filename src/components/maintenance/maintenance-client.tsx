"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wrench, X } from "lucide-react";
import {
  ActionButton,
  BrutalCard,
  EmptyState,
  MonoLabel,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type {
  ComponentRecord,
  Laboratory,
  MaintenancePriority,
  MaintenanceReport,
  MaintenanceStatus,
  Profile,
} from "@/types/database";

const STATUSES: MaintenanceStatus[] = [
  "Reported",
  "Pending",
  "In progress",
  "Waiting for parts",
  "Resolved",
  "Closed",
];

const CATEGORIES = [
  "Broken component",
  "Missing equipment",
  "Faulty instrument",
  "Damaged cable",
  "Power/Connectivity",
  "General lab",
] as const;

export function MaintenanceClient({
  profile,
  initialReports,
  laboratories,
  components,
  preselectedComponentId,
}: {
  profile: Profile;
  initialReports: MaintenanceReport[];
  laboratories: Laboratory[];
  components: ComponentRecord[];
  preselectedComponentId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isStaff = profile.role === "staff" || profile.role === "admin";

  const [reports, setReports] = useState<MaintenanceReport[]>(initialReports);
  const [showCreate, setShowCreate] = useState(Boolean(preselectedComponentId));
  const [updateTarget, setUpdateTarget] = useState<MaintenanceReport | null>(null);

  const [form, setForm] = useState({
    laboratory_id: laboratories[0]?.id || "",
    component_id: preselectedComponentId || "",
    category: "Broken component" as (typeof CATEGORIES)[number],
    title: "",
    description: "",
    priority: "Medium" as MaintenancePriority,
    photo_urls: [] as string[],
  });

  const [updateStatus, setUpdateStatus] = useState<MaintenanceStatus>("In progress");
  const [updateComment, setUpdateComment] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [clearDefect, setClearDefect] = useState(true);

  async function refresh() {
    const res = await fetch("/api/maintenance");
    if (res.ok) {
      const d = await res.json();
      setReports(d.reports ?? []);
    }
    router.refresh();
  }

  async function handlePhotoUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "maintenance");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (!res.ok) {
      toast(d.error || "Upload failed", "error");
      return;
    }
    setForm((f) => ({ ...f, photo_urls: [...f.photo_urls, d.url] }));
    toast("Photo uploaded", "success");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) {
      toast(d.error || "Failed to submit report", "error");
      return;
    }
    toast("Defect report logged", "success");
    setShowCreate(false);
    setForm({
      laboratory_id: laboratories[0]?.id || "",
      component_id: "",
      category: "Broken component",
      title: "",
      description: "",
      priority: "Medium",
      photo_urls: [],
    });
    await refresh();
  }

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updateTarget) return;
    const res = await fetch(`/api/maintenance/${updateTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: updateStatus,
        comment: updateComment,
        resolution_notes: resolutionNotes,
        clear_component_defect: clearDefect,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast(d.error || "Update failed", "error");
      return;
    }
    toast("Maintenance status updated", "success");
    setUpdateTarget(null);
    setUpdateComment("");
    setResolutionNotes("");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>EQUIPMENT HEALTH &amp; DEFECT QUARANTINE</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Maintenance &amp; Defect Tracking
          </h1>
        </div>
        <ActionButton variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          Report Defect
        </ActionButton>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title="No defects or maintenance tickets"
          description="All tracked laboratory equipment and benches are currently operational."
        />
      ) : (
        <BrutalCard className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                <th className="px-4 py-3">Lab / Component</th>
                <th className="px-4 py-3">Issue &amp; Category</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">Status</th>
                {isStaff && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-[10px] font-black text-sky-700">
                      {r.laboratories?.code ?? "LAB"}
                    </div>
                    <div className="font-bold">{r.components?.name ?? "General Lab Issue"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950">{r.title}</div>
                    <div className="text-[11px] text-slate-600">{r.description}</div>
                    <span className="mt-0.5 inline-block font-mono text-[9px] font-bold text-slate-400 uppercase">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.reporter?.full_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {r.reporter?.academic_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.priority} />
                  </td>
                  <td className="px-4 py-3 font-mono">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  {isStaff && (
                    <td className="px-4 py-3 text-right">
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setUpdateTarget(r);
                          setUpdateStatus(r.status);
                          setResolutionNotes(r.resolution_notes || "");
                        }}
                      >
                        Update
                      </ActionButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </BrutalCard>
      )}

      {/* Report Defect Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>DEFECT INTAKE</MonoLabel>
                <h3 className="text-base font-black uppercase">Report Equipment or Lab Issue</h3>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Laboratory *
                  </label>
                  <select
                    value={form.laboratory_id}
                    onChange={(e) => setForm((f) => ({ ...f, laboratory_id: e.target.value }))}
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    {laboratories.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} — {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Component (Optional)
                  </label>
                  <select
                    value={form.component_id}
                    onChange={(e) => setForm((f) => ({ ...f, component_id: e.target.value }))}
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="">General Lab Problem</option>
                    {components
                      .filter((c) => c.laboratory_id === form.laboratory_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.sku} — {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Defect Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as (typeof CATEGORIES)[number],
                      }))
                    }
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priority: e.target.value as MaintenancePriority,
                      }))
                    }
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High (flags inspection)</option>
                    <option value="Critical">Critical (immediate quarantine)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Issue Summary *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Oscilloscope Channel 2 BNC connector loose"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border-2 border-slate-900 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Attach Photo
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(f);
                  }}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary">
                  Submit Report
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* Staff Update Maintenance Modal */}
      {updateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-md p-6">
            <h3 className="text-base font-black uppercase">Update Ticket: {updateTarget.title}</h3>
            <form onSubmit={handleStatusUpdate} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  New Status
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as MaintenanceStatus)}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Technician Progress Note *
                </label>
                <textarea
                  required
                  rows={2}
                  value={updateComment}
                  onChange={(e) => setUpdateComment(e.target.value)}
                  placeholder="Replaced blown fuse / ordered replacement probe"
                  className="w-full border-2 border-slate-900 p-2.5 text-xs"
                />
              </div>
              {(updateStatus === "Resolved" || updateStatus === "Closed") && (
                <>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                      Resolution Notes
                    </label>
                    <input
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 font-mono text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={clearDefect}
                      onChange={(e) => setClearDefect(e.target.checked)}
                    />
                    Clear defect lock &amp; restore component to Available
                  </label>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setUpdateTarget(null)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary">
                  Save Update
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
