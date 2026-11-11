"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
  PackageCheck,
} from "lucide-react";
import {
  ActionButton,
  BrutalCard,
  EmptyState,
  MonoLabel,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { addDaysISO, formatDate } from "@/lib/utils";
import type { BorrowRequest, Loan, Profile } from "@/types/database";

interface BorrowClientProps {
  profile: Profile;
  initialRequests: BorrowRequest[];
  initialLoans: Loan[];
}

export function BorrowClient({
  profile,
  initialRequests,
  initialLoans,
}: BorrowClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isStaff = profile.role === "staff" || profile.role === "admin";
  const isAdmin = profile.role === "admin";

  const [requests, setRequests] = useState<BorrowRequest[]>(initialRequests);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [tab, setTab] = useState<"requests" | "loans">("requests");
  const [reqFilter, setReqFilter] = useState("all");
  const [loanSearch, setLoanSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modals
  const [rejectTarget, setRejectTarget] = useState<BorrowRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null);
  const [goodQty, setGoodQty] = useState(1);
  const [damagedQty, setDamagedQty] = useState(0);
  const [lostQty, setLostQty] = useState(0);
  const [returnNotes, setReturnNotes] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const [extendTarget, setExtendTarget] = useState<Loan | null>(null);
  const [extendDate, setExtendDate] = useState(addDaysISO(7));
  const [extendReason, setExtendReason] = useState("");
  const [receiptLoan, setReceiptLoan] = useState<Loan | null>(null);

  async function reloadAll() {
    const [rRes, lRes] = await Promise.all([fetch("/api/borrow-requests"), fetch("/api/loans")]);
    if (rRes.ok) {
      const rData = await rRes.json();
      setRequests(rData.requests ?? []);
    }
    if (lRes.ok) {
      const lData = await lRes.json();
      setLoans(lData.loans ?? []);
    }
    router.refresh();
  }

  async function handleRequestAction(
    req: BorrowRequest,
    action: "approve" | "reject" | "checkout" | "cancel" | "override_approve",
    reason?: string
  ) {
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/borrow-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejection_reason: action === "reject" ? reason : undefined,
          override_reason: action === "override_approve" ? reason : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Action failed", "error");
        return;
      }
      toast(`Request ${req.request_number} updated (${action})`, "success");
      setRejectTarget(null);
      setRejectReason("");
      await reloadAll();
    } finally {
      setBusyId(null);
    }
  }

  function openReturnModal(loan: Loan) {
    const totalRemaining = (loan.loan_items ?? []).reduce(
      (sum, li) =>
        sum + (li.quantity_borrowed - (li.quantity_returned + li.quantity_damaged + li.quantity_lost)),
      0
    );
    setReturnTarget(loan);
    setGoodQty(Math.max(1, totalRemaining));
    setDamagedQty(0);
    setLostQty(0);
    setReturnNotes("");
    setDamagePhotos([]);
  }

  async function handleDamagePhotoUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "return-inspections");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Upload failed", "error");
      return;
    }
    setDamagePhotos((p) => [...p, data.url]);
    toast("Inspection photo uploaded", "success");
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnTarget) return;
    setBusyId(returnTarget.id);
    try {
      const res = await fetch(`/api/loans/${returnTarget.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returned_good: goodQty,
          damaged: damagedQty,
          lost: lostQty,
          notes: returnNotes,
          photo_urls: damagePhotos,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to process return", "error");
        return;
      }
      toast(`Return processed: ${data.status}`, "success");
      setReturnTarget(null);
      await reloadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function submitExtension(e: React.FormEvent) {
    e.preventDefault();
    if (!extendTarget) return;
    setBusyId(extendTarget.id);
    try {
      const res = await fetch(`/api/loans/${extendTarget.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_due_date: extendDate,
          reason: extendReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not submit extension", "error");
        return;
      }
      toast("Extension request sent for staff approval", "success");
      setExtendTarget(null);
      setExtendReason("");
      await reloadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function reviewExtension(extensionId: string, decision: "Approved" | "Rejected") {
    const res = await fetch(`/api/loans/${extensionId}/extend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Extension review failed", "error");
      return;
    }
    toast(`Extension ${decision.toLowerCase()}`, "success");
    await reloadAll();
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => reqFilter === "all" || r.status === reqFilter);
  }, [requests, reqFilter]);

  const filteredLoans = useMemo(() => {
    const q = loanSearch.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => {
      const hay = `${l.loan_number} ${l.profiles?.academic_id || ""} ${
        l.profiles?.full_name || ""
      } ${(l.loan_items || [])
        .map((i) => `${i.components?.name || ""} ${i.components?.sku || ""} ${i.component_assets?.asset_code || ""}`)
        .join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [loans, loanSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>EQUIPMENT ACCESS LIFECYCLE</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Borrow Requests, Checkouts &amp; Returns
          </h1>
        </div>
        <div className="inline-flex border-2 border-slate-900 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("requests")}
            className={`cursor-pointer px-3.5 py-1.5 font-mono text-xs font-black uppercase ${
              tab === "requests" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("loans")}
            className={`cursor-pointer px-3.5 py-1.5 font-mono text-xs font-black uppercase ${
              tab === "loans" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Active &amp; Past Loans ({loans.length})
          </button>
        </div>
      </div>

      {tab === "requests" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={reqFilter}
              onChange={(e) => setReqFilter(e.target.value)}
              className="border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs font-bold"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Ready for pickup">Ready for pickup</option>
              <option value="Checked out">Checked out</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Returned">Returned</option>
            </select>
          </div>

          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={<PackageCheck className="h-5 w-5" />}
              title="No borrow requests in this view"
              description="Submit a hardware request from the Component Catalog to get started."
            />
          ) : (
            <BrutalCard className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                    <th className="px-4 py-3">Request # / Project</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Components</th>
                    <th className="px-4 py-3">Needed Until</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[10px] font-black text-sky-700">
                          {req.request_number} · {req.laboratories?.code}
                        </div>
                        <div className="font-black text-slate-950">{req.project_name}</div>
                        <div className="text-[11px] text-slate-500">{req.purpose}</div>
                        {req.rejection_reason && (
                          <div className="mt-1 font-mono text-[10px] font-bold text-rose-700">
                            Reason: {req.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{req.profiles?.full_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {req.profiles?.academic_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(req.borrow_request_items ?? []).map((item) => (
                          <div key={item.id} className="font-mono text-[11px]">
                            <span className="font-black">{item.requested_qty}×</span>{" "}
                            {item.components?.name ?? "Component"}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 font-mono">{formatDate(req.needed_until)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {req.status === "Pending" && req.requester_id === profile.id && (
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              disabled={busyId === req.id}
                              onClick={() => handleRequestAction(req, "cancel")}
                            >
                              Cancel
                            </ActionButton>
                          )}

                          {isStaff && req.status === "Pending" && (
                            <>
                              <ActionButton
                                size="sm"
                                variant="primary"
                                disabled={busyId === req.id}
                                onClick={() => handleRequestAction(req, "approve")}
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </ActionButton>
                              <ActionButton
                                size="sm"
                                variant="danger"
                                disabled={busyId === req.id}
                                onClick={() => setRejectTarget(req)}
                              >
                                <X className="h-3 w-3" />
                                Reject
                              </ActionButton>
                            </>
                          )}

                          {isAdmin && req.status === "Rejected" && (
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              disabled={busyId === req.id}
                              onClick={() =>
                                handleRequestAction(
                                  req,
                                  "override_approve",
                                  "Admin policy override"
                                )
                              }
                            >
                              <ShieldAlert className="h-3 w-3" />
                              Override
                            </ActionButton>
                          )}

                          {isStaff &&
                            (req.status === "Ready for pickup" || req.status === "Approved") && (
                              <ActionButton
                                size="sm"
                                variant="primary"
                                disabled={busyId === req.id}
                                onClick={() => handleRequestAction(req, "checkout")}
                              >
                                Record Checkout
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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              value={loanSearch}
              onChange={(e) => setLoanSearch(e.target.value)}
              placeholder="Scan / search Loan #, Student ID, SKU, or Asset Code..."
              className="w-full border-2 border-slate-900 bg-white py-2 pr-3 pl-9 font-mono text-xs font-bold focus:outline-none"
            />
          </div>

          {filteredLoans.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No matching loans"
              description="Checked-out equipment loans appear here once staff record pickup."
            />
          ) : (
            <BrutalCard className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                    <th className="px-4 py-3">Loan #</th>
                    <th className="px-4 py-3">Borrower</th>
                    <th className="px-4 py-3">Items &amp; Assets</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLoans.map((loan) => {
                    const pendingExt = (loan.extensions ?? []).find(
                      (ex) => ex.status === "Pending"
                    );
                    const isSettled = ["Returned", "Lost", "Damaged"].includes(loan.status);
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono">
                          <div className="font-black text-sky-700">{loan.loan_number}</div>
                          <div className="text-[10px] text-slate-500">
                            Out: {formatDate(loan.checked_out_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold">{loan.profiles?.full_name}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {loan.profiles?.academic_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(loan.loan_items ?? []).map((li) => (
                            <div key={li.id} className="font-mono text-[11px]">
                              <span className="font-black">{li.quantity_borrowed}×</span>{" "}
                              {li.components?.name}{" "}
                              {li.component_assets?.asset_code && (
                                <span className="border border-slate-900 bg-slate-100 px-1 text-[9px] font-black">
                                  {li.component_assets.asset_code}
                                </span>
                              )}
                              <span className="ml-1 text-[10px] text-slate-500">
                                (Ret: {li.quantity_returned}, Dmg: {li.quantity_damaged})
                              </span>
                            </div>
                          ))}
                          {pendingExt && (
                            <div className="mt-1.5 border border-amber-700 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-950">
                              Extension requested until {formatDate(pendingExt.requested_due_date)}
                              {isStaff && (
                                <span className="ml-2 inline-flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => reviewExtension(pendingExt.id, "Approved")}
                                    className="cursor-pointer font-black text-emerald-800 underline"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => reviewExtension(pendingExt.id, "Rejected")}
                                    className="cursor-pointer font-black text-rose-800 underline"
                                  >
                                    Decline
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {formatDate(loan.due_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={loan.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReceiptLoan(loan)}
                              title="Print Checkout / Return Receipt"
                              className="cursor-pointer border-2 border-slate-900 bg-white p-1.5 hover:bg-slate-100"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>

                            {!isSettled && loan.borrower_id === profile.id && !pendingExt && (
                              <ActionButton
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setExtendTarget(loan);
                                  setExtendDate(addDaysISO(7));
                                }}
                              >
                                Extend
                              </ActionButton>
                            )}

                            {isStaff && !isSettled && (
                              <ActionButton
                                size="sm"
                                variant="primary"
                                onClick={() => openReturnModal(loan)}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Inspect &amp; Return
                              </ActionButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </BrutalCard>
          )}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-md p-6">
            <h3 className="text-base font-black uppercase">
              Reject Request {rejectTarget.request_number}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Provide a clear reason for the student notification log.
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Equipment reserved for scheduled lab exam"
              className="mt-3 w-full border-2 border-slate-900 p-2.5 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setRejectTarget(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                disabled={rejectReason.trim().length < 3 || busyId === rejectTarget.id}
                onClick={() => handleRequestAction(rejectTarget, "reject", rejectReason)}
              >
                Confirm Rejection
              </ActionButton>
            </div>
          </BrutalCard>
        </div>
      )}

      {/* Return & Inspection Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>RETURN &amp; CONDITION INSPECTION</MonoLabel>
                <h3 className="text-base font-black uppercase">{returnTarget.loan_number}</h3>
              </div>
              <button type="button" onClick={() => setReturnTarget(null)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitReturn} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Returned Good
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={goodQty}
                    onChange={(e) => setGoodQty(Number(e.target.value))}
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black text-rose-700 uppercase">
                    Damaged
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(Number(e.target.value))}
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black text-rose-700 uppercase">
                    Missing / Lost
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lostQty}
                    onChange={(e) => setLostQty(Number(e.target.value))}
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Condition observations, missing probes, calibration status..."
                  className="w-full border-2 border-slate-900 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Damage / Condition Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDamagePhotoUpload(f);
                  }}
                  className="text-xs"
                />
                {damagePhotos.length > 0 && (
                  <p className="mt-1 font-mono text-[10px] text-emerald-700">
                    {damagePhotos.length} photo(s) attached
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setReturnTarget(null)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={busyId === returnTarget.id}>
                  Confirm Inspection
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* Extension Request Modal */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-md p-6">
            <h3 className="text-base font-black uppercase">
              Request Loan Extension // {extendTarget.loan_number}
            </h3>
            <form onSubmit={submitExtension} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  New Expected Return Date *
                </label>
                <input
                  type="date"
                  required
                  min={extendTarget.due_date}
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full border-2 border-slate-900 p-2.5 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setExtendTarget(null)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary">
                  Submit Extension
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="border-b-2 border-slate-900 pb-3">
              <MonoLabel>SMARTLAB OFFICIAL RECEIPT</MonoLabel>
              <h3 className="font-display text-xl font-black uppercase">
                {receiptLoan.loan_number}
              </h3>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower</span>
                <span className="font-bold">
                  {receiptLoan.profiles?.full_name} ({receiptLoan.profiles?.academic_id})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Laboratory</span>
                <span className="font-bold">{receiptLoan.laboratories?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Checked Out</span>
                <span className="font-mono">{formatDate(receiptLoan.checked_out_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date</span>
                <span className="font-mono font-bold">{formatDate(receiptLoan.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={receiptLoan.status} />
              </div>

              <div className="mt-3 border-t-2 border-slate-900 pt-3">
                <span className="block font-mono text-[10px] font-black uppercase">
                  EQUIPMENT ITEMS
                </span>
                {(receiptLoan.loan_items ?? []).map((li) => (
                  <div key={li.id} className="mt-1 flex justify-between font-mono text-[11px]">
                    <span>
                      {li.quantity_borrowed}× {li.components?.name} ({li.components?.sku})
                    </span>
                    <span>
                      Ret:{li.quantity_returned} Dmg:{li.quantity_damaged}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="no-print mt-6 flex justify-end gap-2 border-t-2 border-slate-200 pt-4">
              <ActionButton variant="secondary" onClick={() => setReceiptLoan(null)}>
                Close
              </ActionButton>
              <ActionButton variant="primary" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </ActionButton>
            </div>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
