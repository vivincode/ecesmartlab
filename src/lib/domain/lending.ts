import type { LoanStatus } from "@/types/database";

/**
 * Pure domain logic shared between server routes and automated tests.
 */

export function calculateComponentStatus(
  available: number,
  minThreshold: number,
  condition: string
): "Available" | "Low stock" | "Out of stock" | "Maintenance" | "Retired" {
  if (condition === "Retired") return "Retired";
  if (condition === "Damaged" || condition === "Under maintenance") return "Maintenance";
  if (available <= 0) return "Out of stock";
  if (available <= minThreshold) return "Low stock";
  return "Available";
}

export function canBorrowComponent(
  availableQty: number,
  requestedQty: number,
  condition: string
): { allowed: boolean; reason?: string } {
  if (["Damaged", "Under maintenance", "Retired"].includes(condition)) {
    return { allowed: false, reason: `Component is currently marked "${condition}" and blocked from lending.` };
  }
  if (requestedQty <= 0) {
    return { allowed: false, reason: "Requested quantity must be at least 1." };
  }
  if (availableQty < requestedQty) {
    return {
      allowed: false,
      reason: `Only ${availableQty} unit(s) available; requested ${requestedQty}.`,
    };
  }
  return { allowed: true };
}

export interface BookingSlot {
  booking_date: string;
  start_time: string;
  end_time: string;
  seats_requested: number;
  status: string;
}

export function checkBookingCapacityAndOverlap(
  existingBookings: BookingSlot[],
  candidate: {
    booking_date: string;
    start_time: string;
    end_time: string;
    seats_requested: number;
  },
  labCapacity: number
): { allowed: boolean; occupiedSeats: number; reason?: string } {
  if (candidate.end_time <= candidate.start_time) {
    return { allowed: false, occupiedSeats: 0, reason: "End time must be after start time." };
  }
  if (candidate.seats_requested > labCapacity) {
    return {
      allowed: false,
      occupiedSeats: 0,
      reason: `Requested ${candidate.seats_requested} seats exceeds laboratory capacity (${labCapacity}).`,
    };
  }

  const overlapping = existingBookings.filter(
    (b) =>
      b.booking_date === candidate.booking_date &&
      b.start_time < candidate.end_time &&
      b.end_time > candidate.start_time
  );

  const hasMaintenanceBlock = overlapping.some((b) => b.status === "Blocked");
  if (hasMaintenanceBlock) {
    return {
      allowed: false,
      occupiedSeats: labCapacity,
      reason: "Selected time window is blocked for laboratory maintenance.",
    };
  }

  const occupiedSeats = overlapping
    .filter((b) => b.status === "Approved")
    .reduce((sum, b) => sum + b.seats_requested, 0);

  if (occupiedSeats + candidate.seats_requested > labCapacity) {
    return {
      allowed: false,
      occupiedSeats,
      reason: `Insufficient remaining seats (${Math.max(0, labCapacity - occupiedSeats)} left) for this time window.`,
    };
  }

  return { allowed: true, occupiedSeats };
}

export function evaluateLoanStatus(
  currentStatus: LoanStatus,
  dueDateISO: string,
  referenceDateISO: string
): LoanStatus {
  if (["Returned", "Lost", "Damaged"].includes(currentStatus)) {
    return currentStatus;
  }
  if (dueDateISO < referenceDateISO) {
    return "Overdue";
  }
  const dueMs = new Date(`${dueDateISO}T00:00:00Z`).getTime();
  const refMs = new Date(`${referenceDateISO}T00:00:00Z`).getTime();
  const diffDays = Math.ceil((dueMs - refMs) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1 && currentStatus === "Active") {
    return "Due soon";
  }
  return currentStatus;
}
