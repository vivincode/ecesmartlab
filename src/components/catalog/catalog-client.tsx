"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Grid3X3,
  List,
  Plus,
  Search,
  Upload,
  X,
  ExternalLink,
  PackageCheck,
  QrCode,
  Trash2,
  Edit3,
} from "lucide-react";
import {
  ActionButton,
  BrutalCard,
  EmptyState,
  MonoLabel,
  StatusBadge,
} from "@/components/ui/primitives";
import { QrCodeBadge } from "@/components/catalog/qr-code-badge";
import { useToast } from "@/components/ui/toast";
import { addDaysISO } from "@/lib/utils";
import type {
  Category,
  ComponentCondition,
  ComponentRecord,
  Department,
  Laboratory,
  Profile,
  ProjectTeam,
} from "@/types/database";

interface CatalogClientProps {
  profile: Profile;
  initialComponents: ComponentRecord[];
  laboratories: Laboratory[];
  departments: Department[];
  categories: Category[];
  teams: ProjectTeam[];
  initialSearch?: string;
  initialAvailability?: string;
}

const CONDITIONS: ComponentCondition[] = [
  "New",
  "Good",
  "Needs inspection",
  "Damaged",
  "Under maintenance",
  "Retired",
];

export function CatalogClient({
  profile,
  initialComponents,
  laboratories,
  departments,
  categories,
  teams,
  initialSearch = "",
  initialAvailability = "all",
}: CatalogClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const canManage = profile.role === "staff" || profile.role === "admin";

  const [components, setComponents] = useState<ComponentRecord[]>(initialComponents);
  const [search, setSearch] = useState(initialSearch);
  const [labFilter, setLabFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState(initialAvailability);
  const [sort, setSort] = useState("created_desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modals
  const [borrowTarget, setBorrowTarget] = useState<ComponentRecord | null>(null);
  const [qrTarget, setQrTarget] = useState<ComponentRecord | null>(null);
  const [editTarget, setEditTarget] = useState<ComponentRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Borrow form state
  const [reqQty, setReqQty] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [neededUntil, setNeededUntil] = useState(addDaysISO(7));
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Component Create/Edit form state
  const [compForm, setCompForm] = useState({
    name: "",
    sku: "",
    laboratory_id: laboratories[0]?.id || "",
    department_id: departments[0]?.id || "",
    category_id: categories[0]?.id || "",
    manufacturer: "",
    model: "",
    storage_location: "Main Shelf",
    description: "",
    usage_instructions: "",
    total_quantity: 10,
    available_quantity: 10,
    min_stock_threshold: 2,
    condition: "Good" as ComponentCondition,
    is_serialized: false,
    replacement_value: "",
    datasheet_url: "",
    image_urls: [] as string[],
  });

  const [csvText, setCsvText] = useState(
    "name,sku,total_quantity,min_stock_threshold,storage_location,manufacturer,model\nSTM32 Nucleo-F446RE,EMB-STM-044,10,2,Cabinet A-03,STMicroelectronics,NUCLEO-F446RE"
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = components.filter((c) => {
      if (q) {
        const hay = `${c.name} ${c.sku} ${c.manufacturer || ""} ${c.model || ""} ${
          c.laboratories?.name || ""
        } ${c.categories?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (labFilter !== "all" && c.laboratory_id !== labFilter) return false;
      if (deptFilter !== "all" && c.department_id !== deptFilter) return false;
      if (catFilter !== "all" && c.category_id !== catFilter) return false;
      if (condFilter !== "all" && c.condition !== condFilter) return false;
      if (availFilter === "available" && c.available_quantity <= 0) return false;
      if (availFilter === "low" && c.available_quantity > c.min_stock_threshold) return false;
      if (availFilter === "out" && c.available_quantity > 0) return false;
      return true;
    });

    if (sort === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "avail_desc") list.sort((a, b) => b.available_quantity - a.available_quantity);
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [components, search, labFilter, deptFilter, catFilter, condFilter, availFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function refreshComponents() {
    const res = await fetch("/api/components?limit=100");
    if (res.ok) {
      const d = await res.json();
      setComponents(d.components ?? []);
    }
  }

  function openCreateModal() {
    setEditTarget(null);
    setCompForm({
      name: "",
      sku: "",
      laboratory_id: laboratories[0]?.id || "",
      department_id: departments[0]?.id || "",
      category_id: categories[0]?.id || "",
      manufacturer: "",
      model: "",
      storage_location: "Main Shelf",
      description: "",
      usage_instructions: "",
      total_quantity: 10,
      available_quantity: 10,
      min_stock_threshold: 2,
      condition: "Good",
      is_serialized: false,
      replacement_value: "",
      datasheet_url: "",
      image_urls: [],
    });
    setShowCreateModal(true);
  }

  function openEditModal(c: ComponentRecord) {
    setEditTarget(c);
    setCompForm({
      name: c.name,
      sku: c.sku,
      laboratory_id: c.laboratory_id,
      department_id: c.department_id,
      category_id: c.category_id,
      manufacturer: c.manufacturer || "",
      model: c.model || "",
      storage_location: c.storage_location,
      description: c.description || "",
      usage_instructions: c.usage_instructions || "",
      total_quantity: c.total_quantity,
      available_quantity: c.available_quantity,
      min_stock_threshold: c.min_stock_threshold,
      condition: c.condition,
      is_serialized: c.is_serialized,
      replacement_value: c.replacement_value != null ? String(c.replacement_value) : "",
      datasheet_url: c.datasheet_url || "",
      image_urls: c.image_urls || [],
    });
    setShowCreateModal(true);
  }

  async function handleFileUpload(file: File, kind: "image" | "datasheet") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", kind === "image" ? "component-images" : "datasheets");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Upload failed", "error");
      return;
    }
    if (kind === "image") {
      setCompForm((f) => ({ ...f, image_urls: [...f.image_urls, data.url] }));
    } else {
      setCompForm((f) => ({ ...f, datasheet_url: data.url }));
    }
    toast("File uploaded to Supabase Storage", "success");
  }

  async function handleSaveComponent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...compForm,
        replacement_value: compForm.replacement_value ? Number(compForm.replacement_value) : null,
      };
      const url = editTarget ? `/api/components/${editTarget.id}` : "/api/components";
      const method = editTarget ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to save component", "error");
        setSubmitting(false);
        return;
      }
      toast(editTarget ? "Component updated" : "Component added to catalog", "success");
      setShowCreateModal(false);
      await refreshComponents();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComponent(c: ComponentRecord) {
    if (!confirm(`Archive "${c.name}" (${c.sku})?`)) return;
    const res = await fetch(`/api/components/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Could not remove component", "error");
      return;
    }
    toast("Component retired from active catalog", "success");
    await refreshComponents();
  }

  async function handleBorrowSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!borrowTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/borrow-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laboratory_id: borrowTarget.laboratory_id,
          team_id: selectedTeamId || null,
          project_name: projectName,
          purpose,
          needed_until: neededUntil,
          items: [{ component_id: borrowTarget.id, requested_qty: reqQty }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to submit borrow request", "error");
        setSubmitting(false);
        return;
      }
      toast(`Request ${data.request?.request_number ?? ""} submitted for approval!`, "success");
      setBorrowTarget(null);
      setProjectName("");
      setPurpose("");
      setReqQty(1);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCsvImport(e: React.FormEvent) {
    e.preventDefault();
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      toast("Provide a CSV header and at least one data row.", "error");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => {
        rec[h] = vals[i] ?? "";
      });
      return {
        name: rec.name,
        sku: rec.sku,
        total_quantity: Number(rec.total_quantity || 1),
        min_stock_threshold: Number(rec.min_stock_threshold || 2),
        storage_location: rec.storage_location || "Main Shelf",
        manufacturer: rec.manufacturer || "",
        model: rec.model || "",
        laboratory_id: laboratories[0]?.id,
        department_id: departments[0]?.id,
        category_id: categories[0]?.id,
      };
    });

    setSubmitting(true);
    try {
      const res = await fetch("/api/components/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "CSV import failed", "error");
        return;
      }
      toast(`Imported ${data.importedCount} components`, "success");
      setShowImportModal(false);
      await refreshComponents();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>HARDWARE REPOSITORY // {filtered.length} SKUS</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Component Catalog &amp; Inventory
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setShowImportModal(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                CSV Import
              </ActionButton>
              <ActionButton variant="primary" size="sm" onClick={openCreateModal}>
                <Plus className="h-3.5 w-3.5" />
                Add Component
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <BrutalCard className="p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, SKU, manufacturer..."
              className="w-full border-2 border-slate-900 bg-white py-2 pr-3 pl-8 text-xs font-medium focus:border-sky-700 focus:outline-none"
            />
          </div>

          <select
            value={labFilter}
            onChange={(e) => {
              setLabFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by laboratory"
            className="border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
          >
            <option value="all">All Laboratories</option>
            {laboratories.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>

          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={availFilter}
            onChange={(e) => {
              setAvailFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by availability"
            className="border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
          >
            <option value="all">All Availability</option>
            <option value="available">Available Now</option>
            <option value="low">Low Stock Alert</option>
            <option value="out">Out of Stock</option>
          </select>

          <div className="flex items-center justify-between gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort components"
              className="w-full border-2 border-slate-900 bg-white px-2 py-2 text-xs font-bold"
            >
              <option value="created_desc">Newest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="avail_desc">Most Available</option>
            </select>
            <div className="flex shrink-0 border-2 border-slate-900 bg-slate-100 p-0.5">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={`cursor-pointer p-1.5 ${
                  viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={`cursor-pointer p-1.5 ${
                  viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5">
          <span className="font-mono text-[10px] font-black text-slate-500 uppercase">
            Department:
          </span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-slate-900 bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>
          <span className="ml-2 font-mono text-[10px] font-black text-slate-500 uppercase">
            Condition:
          </span>
          <select
            value={condFilter}
            onChange={(e) => setCondFilter(e.target.value)}
            className="border border-slate-900 bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold"
          >
            <option value="all">All Conditions</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </BrutalCard>

      {/* Empty State */}
      {paged.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5 text-slate-700" />}
          title="No matching components found"
          description="Try clearing filters or searching by a different SKU, manufacturer, or laboratory."
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((c) => {
            const blocked = ["Damaged", "Under maintenance", "Retired"].includes(c.condition);
            return (
              <BrutalCard key={c.id} className="flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <MonoLabel>
                      {c.sku} · {c.laboratories?.code ?? "LAB"}
                    </MonoLabel>
                    <StatusBadge status={c.status} />
                  </div>

                  {c.image_urls && c.image_urls[0] && (
                    <Link
                      href={`/catalog/${c.id}`}
                      className="mt-2.5 block overflow-hidden border-2 border-slate-900 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_urls[0]}
                        alt={c.name}
                        className="h-36 w-full object-contain p-1.5 transition-transform duration-200 hover:scale-105"
                      />
                    </Link>
                  )}

                  <Link href={`/catalog/${c.id}`} className="group mt-2.5 block">
                    <h3 className="text-base font-black text-slate-950 group-hover:text-sky-700">
                      {c.name}
                    </h3>
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {c.description || `${c.manufacturer || ""} ${c.model || ""}`}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-2 border-slate-200 bg-slate-50 p-2 font-mono text-[10px]">
                    <div>
                      <span className="block text-slate-400">CATEGORY</span>
                      <span className="font-bold text-slate-900">
                        {c.categories?.name ?? "Hardware"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">LOCATION</span>
                      <span className="font-bold text-slate-900">{c.storage_location}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-slate-900 pt-3">
                  <div>
                    <span className="block font-mono text-xs font-black text-slate-950">
                      {c.available_quantity} / {c.total_quantity} AVAIL
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Cond: {c.condition}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQrTarget(c)}
                      title="View QR Label"
                      className="cursor-pointer border-2 border-slate-900 bg-white p-1.5 hover:bg-slate-100"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          title="Edit component"
                          className="cursor-pointer border-2 border-slate-900 bg-white p-1.5 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComponent(c)}
                          title="Archive component"
                          className="cursor-pointer border-2 border-slate-900 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <ActionButton
                        size="sm"
                        variant="primary"
                        disabled={c.available_quantity < 1 || blocked}
                        onClick={() => {
                          setBorrowTarget(c);
                          setReqQty(1);
                        }}
                      >
                        Request
                      </ActionButton>
                    )}
                  </div>
                </div>
              </BrutalCard>
            );
          })}
        </div>
      ) : (
        <BrutalCard className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black tracking-wider text-slate-700 uppercase">
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Lab / Loc</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paged.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.image_urls && c.image_urls[0] && (
                        <Link
                          href={`/catalog/${c.id}`}
                          className="block h-10 w-10 shrink-0 overflow-hidden border border-slate-900 bg-slate-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.image_urls[0]}
                            alt={c.name}
                            className="h-full w-full object-contain p-0.5"
                          />
                        </Link>
                      )}
                      <div>
                        <Link
                          href={`/catalog/${c.id}`}
                          className="font-black text-slate-950 hover:text-sky-700"
                        >
                          {c.name}
                        </Link>
                        <div className="font-mono text-[10px] font-bold text-sky-700">{c.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    <div>{c.laboratories?.code}</div>
                    <div className="text-slate-500">{c.storage_location}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-black">
                    {c.available_quantity} / {c.total_quantity}
                  </td>
                  <td className="px-4 py-3">{c.condition}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/catalog/${c.id}`}
                        className="border border-slate-900 px-2 py-1 font-mono text-[10px] font-black uppercase hover:bg-slate-100"
                      >
                        Details <ExternalLink className="ml-0.5 inline h-3 w-3" />
                      </Link>
                      {!canManage && (
                        <ActionButton
                          size="sm"
                          disabled={c.available_quantity < 1}
                          onClick={() => setBorrowTarget(c)}
                        >
                          Request
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BrutalCard>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t-2 border-slate-900 pt-4 font-mono text-xs">
          <span className="font-bold text-slate-600">
            PAGE {page} OF {totalPages} ({filtered.length} ITEMS)
          </span>
          <div className="flex gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </ActionButton>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-sm p-6 text-center">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <MonoLabel>ASSET QR TAG</MonoLabel>
              <button type="button" onClick={() => setQrTarget(null)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <QrCodeBadge
                value={`SMARTLAB:SKU:${qrTarget.sku}:${qrTarget.id}`}
                label={qrTarget.sku}
                size={160}
              />
            </div>
            <h3 className="mt-4 text-sm font-black text-slate-950">{qrTarget.name}</h3>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {qrTarget.laboratories?.name} · {qrTarget.storage_location}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <ActionButton variant="secondary" size="sm" onClick={() => window.print()}>
                Print Label
              </ActionButton>
              <ActionButton variant="primary" size="sm" onClick={() => setQrTarget(null)}>
                Close
              </ActionButton>
            </div>
          </BrutalCard>
        </div>
      )}

      {/* Borrow Request Modal */}
      {borrowTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>NEW EQUIPMENT REQUEST // {borrowTarget.sku}</MonoLabel>
                <h3 className="text-base font-black text-slate-950">{borrowTarget.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setBorrowTarget(null)}
                className="cursor-pointer border-2 border-slate-900 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Quantity (Max {borrowTarget.available_quantity}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={borrowTarget.available_quantity}
                    required
                    value={reqQty}
                    onChange={(e) => setReqQty(Number(e.target.value))}
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Expected Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={addDaysISO(0)}
                    value={neededUntil}
                    onChange={(e) => setNeededUntil(e.target.value)}
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Academic Project Name *
                </label>
                <input
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Autonomous SLAM Rover / Digital Logic Lab"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Purpose &amp; Experiment Details *
                </label>
                <textarea
                  required
                  rows={2}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Describe how this component will be used"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>

              {teams.length > 0 && (
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Borrow on behalf of Project Team (Optional)
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="">Personal Academic Request</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setBorrowTarget(null)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={submitting}>
                  <PackageCheck className="h-4 w-4" />
                  {submitting ? "Submitting..." : "Submit Request"}
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* Add / Edit Component Modal (Staff & Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>INVENTORY MANAGEMENT</MonoLabel>
                <h3 className="text-lg font-black uppercase">
                  {editTarget ? `Edit ${editTarget.sku}` : "Add New Component"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer border-2 border-slate-900 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComponent} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Component Name *
                  </label>
                  <input
                    required
                    value={compForm.name}
                    onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Unique SKU / Inventory Code *
                  </label>
                  <input
                    required
                    value={compForm.sku}
                    onChange={(e) =>
                      setCompForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold uppercase"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Laboratory *
                  </label>
                  <select
                    value={compForm.laboratory_id}
                    onChange={(e) => setCompForm((f) => ({ ...f, laboratory_id: e.target.value }))}
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
                    Department *
                  </label>
                  <select
                    value={compForm.department_id}
                    onChange={(e) => setCompForm((f) => ({ ...f, department_id: e.target.value }))}
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Category *
                  </label>
                  <select
                    value={compForm.category_id}
                    onChange={(e) => setCompForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Manufacturer
                  </label>
                  <input
                    value={compForm.manufacturer}
                    onChange={(e) => setCompForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Model
                  </label>
                  <input
                    value={compForm.model}
                    onChange={(e) => setCompForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Storage Location *
                  </label>
                  <input
                    required
                    value={compForm.storage_location}
                    onChange={(e) =>
                      setCompForm((f) => ({ ...f, storage_location: e.target.value }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Total Qty *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={compForm.total_quantity}
                    onChange={(e) =>
                      setCompForm((f) => ({ ...f, total_quantity: Number(e.target.value) }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Available *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={compForm.available_quantity}
                    onChange={(e) =>
                      setCompForm((f) => ({ ...f, available_quantity: Number(e.target.value) }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Min Alert
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={compForm.min_stock_threshold}
                    onChange={(e) =>
                      setCompForm((f) => ({ ...f, min_stock_threshold: Number(e.target.value) }))
                    }
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Condition
                  </label>
                  <select
                    value={compForm.condition}
                    onChange={(e) =>
                      setCompForm((f) => ({
                        ...f,
                        condition: e.target.value as ComponentCondition,
                      }))
                    }
                    className="w-full border-2 border-slate-900 bg-white px-2 py-2 text-xs font-bold"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={compForm.description}
                  onChange={(e) => setCompForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Usage &amp; Safety Instructions
                </label>
                <textarea
                  rows={2}
                  value={compForm.usage_instructions}
                  onChange={(e) =>
                    setCompForm((f) => ({ ...f, usage_instructions: e.target.value }))
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div className="grid gap-3 border-2 border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Upload Component Photo
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "image");
                    }}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Upload Datasheet (PDF)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "datasheet");
                    }}
                    className="text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 font-mono text-xs font-bold">
                <input
                  type="checkbox"
                  checked={compForm.is_serialized}
                  onChange={(e) => setCompForm((f) => ({ ...f, is_serialized: e.target.checked }))}
                />
                Track individual serialized asset IDs (oscilloscopes, multimeters, SBC kits)
              </label>

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Saving..." : editTarget ? "Save Changes" : "Create Component"}
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-xl p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>BULK INVENTORY IMPORT</MonoLabel>
                <h3 className="text-base font-black uppercase">Import Components via CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="cursor-pointer border-2 border-slate-900 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCsvImport} className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                Paste CSV rows below. Duplicate SKUs are automatically skipped.
              </p>
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full border-2 border-slate-900 bg-slate-50 p-3 font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowImportModal(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Importing..." : "Run Import"}
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
