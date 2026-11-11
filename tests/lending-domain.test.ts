import { describe, expect, it } from "vitest";
import {
  calculateComponentStatus,
  canBorrowComponent,
  checkBookingCapacityAndOverlap,
  evaluateLoanStatus,
} from "@/lib/domain/lending";

describe("Component Inventory & Borrow Rules", () => {
  it("computes component status accurately from availability and condition", () => {
    expect(calculateComponentStatus(10, 2, "Good")).toBe("Available");
    expect(calculateComponentStatus(2, 2, "Good")).toBe("Low stock");
    expect(calculateComponentStatus(0, 2, "Good")).toBe("Out of stock");
    expect(calculateComponentStatus(5, 2, "Damaged")).toBe("Maintenance");
    expect(calculateComponentStatus(5, 2, "Under maintenance")).toBe("Maintenance");
    expect(calculateComponentStatus(5, 2, "Retired")).toBe("Retired");
  });

  it("blocks borrowing defective or retired equipment even when quantity > 0", () => {
    const damaged = canBorrowComponent(4, 1, "Damaged");
    expect(damaged.allowed).toBe(false);
    expect(damaged.reason).toContain("Damaged");

    const maint = canBorrowComponent(4, 1, "Under maintenance");
    expect(maint.allowed).toBe(false);

    const ok = canBorrowComponent(4, 2, "Good");
    expect(ok.allowed).toBe(true);

    const over = canBorrowComponent(2, 3, "Good");
    expect(over.allowed).toBe(false);
  });
});

describe("Lab Booking Overlap & Capacity Guards", () => {
  const existing = [
    {
      booking_date: "2026-11-20",
      start_time: "10:00",
      end_time: "12:00",
      seats_requested: 12,
      status: "Approved",
    },
    {
      booking_date: "2026-11-20",
      start_time: "14:00",
      end_time: "16:00",
      seats_requested: 20,
      status: "Blocked",
    },
  ];

  it("allows non-overlapping or within-capacity overlapping slots", () => {
    const res = checkBookingCapacityAndOverlap(
      existing,
      {
        booking_date: "2026-11-20",
        start_time: "11:00",
        end_time: "13:00",
        seats_requested: 8,
      },
      20
    );
    expect(res.allowed).toBe(true);
    expect(res.occupiedSeats).toBe(12);
  });

  it("prevents capacity overflow on overlapping slots", () => {
    const res = checkBookingCapacityAndOverlap(
      existing,
      {
        booking_date: "2026-11-20",
        start_time: "10:30",
        end_time: "11:30",
        seats_requested: 9,
      },
      20
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Insufficient remaining seats");
  });

  it("rejects bookings overlapping a maintenance closure block", () => {
    const res = checkBookingCapacityAndOverlap(
      existing,
      {
        booking_date: "2026-11-20",
        start_time: "15:00",
        end_time: "17:00",
        seats_requested: 1,
      },
      20
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("maintenance");
  });
});

describe("Overdue & Due Soon Loan Evaluation", () => {
  it("flags overdue loans past due_date and due-soon loans within 24h", () => {
    expect(evaluateLoanStatus("Active", "2026-11-10", "2026-11-11")).toBe("Overdue");
    expect(evaluateLoanStatus("Active", "2026-11-12", "2026-11-11")).toBe("Due soon");
    expect(evaluateLoanStatus("Active", "2026-11-18", "2026-11-11")).toBe("Active");
    expect(evaluateLoanStatus("Returned", "2026-11-01", "2026-11-11")).toBe("Returned");
  });
});
