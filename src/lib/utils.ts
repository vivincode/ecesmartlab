import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input.includes("T") ? input : `${input}T12:00:00`) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (
    [
      "available",
      "approved",
      "returned",
      "resolved",
      "closed",
      "good",
      "new",
      "active",
      "ready for pickup",
    ].includes(normalized)
  ) {
    return "border-emerald-700 bg-emerald-50 text-emerald-800";
  }
  if (
    [
      "pending",
      "low stock",
      "due soon",
      "partially returned",
      "needs inspection",
      "in progress",
      "waiting for parts",
      "checked out",
    ].includes(normalized)
  ) {
    return "border-amber-700 bg-amber-50 text-amber-900";
  }
  if (
    [
      "rejected",
      "overdue",
      "damaged",
      "lost",
      "out of stock",
      "critical",
      "high",
      "under maintenance",
      "blocked",
    ].includes(normalized)
  ) {
    return "border-rose-700 bg-rose-50 text-rose-800";
  }
  return "border-slate-700 bg-slate-100 text-slate-800";
}

export function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\]/g, "").trim().slice(0, 80);
}
