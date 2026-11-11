"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { downloadCSV, downloadPDFReport, generateCSV } from "@/lib/reports/export";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { Laboratory } from "@/types/database";

export function ReportsClient({ laboratories }: { laboratories: Laboratory[] }) {
  const { toast } = useToast();
  const [labId, setLabId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchReportData() {
    const params = new URLSearchParams();
    if (labId !== "all") params.set("labId", labId);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    const res = await fetch(`/api/reports?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to fetch report data");
    }
    return res.json();
  }

  async function exportDataset(
    kind: "inventory" | "loans" | "overdue" | "maintenance" | "transactions",
    format: "csv" | "pdf"
  ) {
    setLoading(true);
    try {
      const data = await fetchReportData();
      let title = "";
      let headers: string[] = [];
      let rows: (string | number)[][] = [];

      if (kind === "inventory") {
        title = "Current Inventory & Available Stock";
        headers = ["SKU", "Component", "Laboratory", "Department", "Total", "Available", "Reserved", "Borrowed", "Condition", "Status"];
        rows = (data.components ?? []).map((c: Record<string, unknown>) => [
          String(c.sku),
          String(c.name),
          String((c.laboratories as { code?: string } | null)?.code ?? "—"),
          String((c.departments as { code?: string } | null)?.code ?? "—"),
          Number(c.total_quantity),
          Number(c.available_quantity),
          Number(c.reserved_quantity),
          Number(c.borrowed_quantity),
          String(c.condition),
          String(c.status),
        ]);
      } else if (kind === "loans" || kind === "overdue") {
        const list = (data.loans ?? []).filter((l: { status: string }) =>
          kind === "overdue" ? l.status === "Overdue" : true
        );
        title = kind === "overdue" ? "Overdue Equipment Loans" : "Borrowing & Loan History";
        headers = ["Loan #", "Borrower", "Academic ID", "Laboratory", "Checked Out", "Due Date", "Status"];
        rows = list.map((l: Record<string, unknown>) => [
          String(l.loan_number),
          String((l.profiles as { full_name?: string } | null)?.full_name ?? "—"),
          String((l.profiles as { academic_id?: string } | null)?.academic_id ?? "—"),
          String((l.laboratories as { code?: string } | null)?.code ?? "—"),
          formatDate(String(l.checked_out_at)),
          formatDate(String(l.due_date)),
          String(l.status),
        ]);
      } else if (kind === "maintenance") {
        title = "Maintenance & Defect Records";
        headers = ["Laboratory", "Component", "Title", "Category", "Priority", "Status", "Reported"];
        rows = (data.maintenance ?? []).map((m: Record<string, unknown>) => [
          String((m.laboratories as { code?: string } | null)?.code ?? "—"),
          String((m.components as { name?: string } | null)?.name ?? "General"),
          String(m.title),
          String(m.category),
          String(m.priority),
          String(m.status),
          formatDate(String(m.created_at)),
        ]);
      } else {
        title = "Inventory Movement & Adjustment Ledger";
        headers = ["Timestamp", "Component", "SKU", "Lab", "Type", "Delta", "Before", "After", "Notes"];
        rows = (data.transactions ?? []).map((t: Record<string, unknown>) => [
          formatDate(String(t.created_at)),
          String((t.components as { name?: string } | null)?.name ?? "—"),
          String((t.components as { sku?: string } | null)?.sku ?? "—"),
          String((t.laboratories as { code?: string } | null)?.code ?? "—"),
          String(t.transaction_type),
          Number(t.quantity_delta),
          Number(t.before_available),
          Number(t.after_available),
          String(t.notes ?? ""),
        ]);
      }

      const fileBase = `smartlab-${kind}-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") {
        downloadCSV(fileBase, generateCSV(headers, rows));
      } else {
        downloadPDFReport({
          title,
          subtitle: `Filter: ${labId === "all" ? "All Labs" : labId} | Range: ${
            fromDate || "Start"
          } to ${toDate || "Present"}`,
          filename: fileBase,
          headers,
          rows,
        });
      }
      toast(`Exported ${title} (${format.toUpperCase()})`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function runOverdueSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/overdue", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Sync failed", "error");
        return;
      }
      toast(`Synced overdue statuses (${d.updatedCount} loans updated)`, "success");
    } finally {
      setLoading(false);
    }
  }

  const reportCards = [
    {
      key: "inventory" as const,
      title: "Current Inventory & Available Stock",
      desc: "Complete hardware stock ledger with total, available, reserved, and borrowed quantities.",
    },
    {
      key: "loans" as const,
      title: "Borrowing & Loan History",
      desc: "Student and team borrowing records filtered by laboratory and date window.",
    },
    {
      key: "overdue" as const,
      title: "Overdue Equipment Report",
      desc: "Active loans past expected return date requiring staff follow-up.",
    },
    {
      key: "maintenance" as const,
      title: "Maintenance & Defect Records",
      desc: "All reported component defects, repair status, and resolution history.",
    },
    {
      key: "transactions" as const,
      title: "Inventory Adjustments Ledger",
      desc: "Immutable audit trail of restocks, reservations, checkouts, and returns.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>COMPLIANCE &amp; INSTITUTIONAL EXPORTS</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Reports, Overdue Sync &amp; CSV/PDF Exports
          </h1>
        </div>
        <ActionButton variant="secondary" size="sm" onClick={runOverdueSync} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Run Overdue Loan Check
        </ActionButton>
      </div>

      <BrutalCard className="p-5">
        <MonoLabel>REPORT SCOPE &amp; DATE FILTERS</MonoLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              Laboratory
            </label>
            <select
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
              className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="all">All Accessible Labs</option>
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>
      </BrutalCard>

      <div className="grid gap-4 md:grid-cols-2">
        {reportCards.map((rc) => (
          <BrutalCard key={rc.key} className="flex flex-col justify-between p-5">
            <div>
              <MonoLabel>REPORT MODULE</MonoLabel>
              <h2 className="mt-1 text-base font-black text-slate-950">{rc.title}</h2>
              <p className="mt-1 text-xs text-slate-600">{rc.desc}</p>
            </div>
            <div className="mt-4 flex gap-2 border-t-2 border-slate-200 pt-3">
              <ActionButton
                size="sm"
                variant="primary"
                disabled={loading}
                onClick={() => exportDataset(rc.key, "csv")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export CSV
              </ActionButton>
              <ActionButton
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => exportDataset(rc.key, "pdf")}
              >
                <FileText className="h-3.5 w-3.5" />
                Export PDF
                <Download className="h-3 w-3" />
              </ActionButton>
            </div>
          </BrutalCard>
        ))}
      </div>
    </div>
  );
}
