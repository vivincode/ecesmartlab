"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Lock, Plus, X } from "lucide-react";
import {
  ActionButton,
  BrutalCard,
  EmptyState,
  MonoLabel,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { addDaysISO, formatDate } from "@/lib/utils";
import type { LabBooking, Laboratory, Profile, ProjectTeam } from "@/types/database";

interface BookingsClientProps {
  profile: Profile;
  initialBookings: LabBooking[];
  laboratories: Laboratory[];
  teams: ProjectTeam[];
}

export function BookingsClient({
  profile,
  initialBookings,
  laboratories,
  teams,
}: BookingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isStaff = profile.role === "staff" || profile.role === "admin";

  const [bookings, setBookings] = useState<LabBooking[]>(initialBookings);
  const [selectedLabId, setSelectedLabId] = useState(laboratories[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState(addDaysISO(1));
  const [showModal, setShowModal] = useState(false);
  const [isMaintenanceBlock, setIsMaintenanceBlock] = useState(false);

  const [purpose, setPurpose] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [seats, setSeats] = useState(2);
  const [teamId, setTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeLab = laboratories.find((l) => l.id === selectedLabId) || laboratories[0];

  const daySchedule = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.laboratory_id === selectedLabId &&
        b.booking_date === selectedDate &&
        ["Approved", "Blocked", "Pending"].includes(b.status)
    );
  }, [bookings, selectedLabId, selectedDate]);

  async function refresh() {
    const res = await fetch("/api/bookings");
    if (res.ok) {
      const d = await res.json();
      setBookings(d.bookings ?? []);
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laboratory_id: selectedLabId,
          team_id: teamId || null,
          session_purpose: purpose,
          booking_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          seats_requested: seats,
          is_maintenance_block: isMaintenanceBlock,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Booking failed", "error");
        return;
      }
      toast(
        isMaintenanceBlock ? "Maintenance closure blocked" : "Booking request submitted",
        "success"
      );
      setShowModal(false);
      setPurpose("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "cancel") {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Action failed", "error");
      return;
    }
    toast(`Booking ${action}d`, "success");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>LABORATORY SCHEDULING</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Lab Workbench Bookings &amp; Capacity
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsMaintenanceBlock(true);
                setShowModal(true);
              }}
            >
              <Lock className="h-3.5 w-3.5" />
              Block Maintenance Slot
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => {
              setIsMaintenanceBlock(false);
              setShowModal(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Book Lab Session
          </ActionButton>
        </div>
      </div>

      {/* Interactive Calendar & Capacity Selector */}
      <BrutalCard className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              Laboratory Compartment
            </label>
            <select
              value={selectedLabId}
              onChange={(e) => setSelectedLabId(e.target.value)}
              className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold"
            >
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name} (Cap: {l.capacity})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              Inspect Date Schedule
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs font-bold"
            />
          </div>
          <div className="border-2 border-slate-900 bg-slate-50 p-3">
            <span className="block font-mono text-[9px] font-black text-sky-700 uppercase">
              COMPARTMENT CAPACITY
            </span>
            <span className="font-display text-lg font-black">
              {activeLab?.capacity ?? 0} SEATS
            </span>
            <span className="block font-mono text-[10px] text-slate-500">
              Hours: {activeLab?.open_time?.slice(0, 5)} – {activeLab?.close_time?.slice(0, 5)}
            </span>
          </div>
        </div>

        {/* Visual Day Timeline */}
        <div className="mt-5 border-t-2 border-slate-200 pt-4">
          <MonoLabel>
            TIMELINE FOR {activeLab?.code} ON {formatDate(selectedDate)}
          </MonoLabel>
          {daySchedule.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-emerald-700">
              All {activeLab?.capacity} seats are open across all hours on this date.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {daySchedule.map((b) => (
                <div
                  key={b.id}
                  className={`border-2 p-3 text-xs ${
                    b.status === "Blocked"
                      ? "border-rose-700 bg-rose-50"
                      : "border-slate-900 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black">
                      {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-1 font-bold text-slate-900">{b.session_purpose}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {b.seats_requested} seats · {b.profiles?.full_name ?? "Staff"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BrutalCard>

      {/* Bookings Table */}
      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" />}
          title="No lab bookings yet"
          description="Reserve a workbench slot above to schedule your hardware testing session."
        />
      ) : (
        <BrutalCard className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] font-black uppercase">
                <th className="px-4 py-3">Laboratory</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Session Purpose</th>
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-black text-sky-700">
                    {b.laboratories?.code ?? "LAB"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{b.profiles?.full_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {b.profiles?.academic_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{b.session_purpose}</td>
                  <td className="px-4 py-3 font-mono">
                    <div>{formatDate(b.booking_date)}</div>
                    <div className="text-[10px] text-slate-500">
                      {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-black">{b.seats_requested}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {b.status === "Pending" && b.user_id === profile.id && (
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAction(b.id, "cancel")}
                        >
                          Cancel
                        </ActionButton>
                      )}
                      {isStaff && b.status === "Pending" && (
                        <>
                          <ActionButton
                            size="sm"
                            variant="primary"
                            onClick={() => handleAction(b.id, "approve")}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="danger"
                            onClick={() => handleAction(b.id, "reject")}
                          >
                            <X className="h-3 w-3" />
                            Deny
                          </ActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BrutalCard>
      )}

      {/* Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>
                  {isMaintenanceBlock ? "STAFF MAINTENANCE CLOSURE" : "NEW LAB RESERVATION"}
                </MonoLabel>
                <h3 className="text-base font-black uppercase">
                  {isMaintenanceBlock ? "Block Lab Time Window" : "Book Lab Session"}
                </h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Laboratory *
                </label>
                <select
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold"
                >
                  {laboratories.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (Capacity: {l.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  {isMaintenanceBlock ? "Closure Reason *" : "Session Purpose *"}
                </label>
                <input
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={
                    isMaintenanceBlock
                      ? "e.g. Oscilloscope calibration & bench maintenance"
                      : "e.g. Embedded firmware debugging & power rail testing"
                  }
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={addDaysISO(0)}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full border-2 border-slate-900 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Start *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border-2 border-slate-900 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    End *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border-2 border-slate-900 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              {!isMaintenanceBlock && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                      Seats Needed (Max {activeLab?.capacity ?? 1}) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={activeLab?.capacity ?? 30}
                      required
                      value={seats}
                      onChange={(e) => setSeats(Number(e.target.value))}
                      className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-sm font-bold"
                    />
                  </div>
                  {teams.length > 0 && (
                    <div>
                      <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                        Project Team (Optional)
                      </label>
                      <select
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        className="w-full border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold"
                      >
                        <option value="">Individual Booking</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Saving..." : isMaintenanceBlock ? "Block Slot" : "Submit Booking"}
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
