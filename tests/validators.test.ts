import { describe, expect, it } from "vitest";
import {
  borrowRequestSchema,
  componentSchema,
  componentUpdateSchema,
  labBookingSchema,
  registerSchema,
  returnInspectionSchema,
} from "@/lib/validators/schemas";

describe("Zod Security & Input Validation Schemas", () => {
  it("enforces matching passwords and valid academic IDs on registration", () => {
    const bad = registerSchema.safeParse({
      fullName: "Priya Sharma",
      email: "priya@college.edu",
      academicId: "ECE 23014!",
      password: "password123",
      confirmPassword: "password123",
      role: "student",
    });
    expect(bad.success).toBe(false);

    const ok = registerSchema.safeParse({
      fullName: "Priya Sharma",
      email: "priya@college.edu",
      academicId: "ECE23014",
      password: "password123",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.role).toBe("student");
    }

    const mismatch = registerSchema.safeParse({
      fullName: "Priya Sharma",
      email: "priya@college.edu",
      academicId: "ECE23014",
      password: "password123",
      confirmPassword: "differentPassword",
    });
    expect(mismatch.success).toBe(false);
  });

  it("prevents available quantity exceeding total quantity in component schema", () => {
    const res = componentSchema.safeParse({
      name: "Arduino Uno",
      sku: "BRD-ARD-001",
      department_id: "22222222-2222-2222-2222-222222222201",
      laboratory_id: "33333333-3333-3333-3333-333333333301",
      category_id: "44444444-4444-4444-4444-444444444401",
      total_quantity: 5,
      available_quantity: 6,
      condition: "Good",
    });
    expect(res.success).toBe(false);
  });

  it("validates borrow requests and lab booking time ranges", () => {
    const req = borrowRequestSchema.safeParse({
      laboratory_id: "33333333-3333-3333-3333-333333333301",
      project_name: "IoT Weather Node",
      purpose: "Sensor telemetry calibration",
      needed_until: "2026-11-25",
      items: [
        {
          component_id: "55555555-5555-5555-5555-555555555505",
          requested_qty: 2,
        },
      ],
    });
    expect(req.success).toBe(true);

    const badBooking = labBookingSchema.safeParse({
      laboratory_id: "33333333-3333-3333-3333-333333333301",
      session_purpose: "Testing",
      booking_date: "2026-11-25",
      start_time: "14:00",
      end_time: "12:00",
      seats_requested: 2,
    });
    expect(badBooking.success).toBe(false);
  });

  it("rejects negative return counts", () => {
    const res = returnInspectionSchema.safeParse({
      returned_good: -1,
      damaged: 0,
      lost: 0,
    });
    expect(res.success).toBe(false);
  });

  it("allows partial updates in componentUpdateSchema without requiring all fields", () => {
    const ok = componentUpdateSchema.safeParse({
      available_quantity: 4,
      condition: "Needs inspection",
    });
    expect(ok.success).toBe(true);

    const bad = componentUpdateSchema.safeParse({
      available_quantity: -2,
    });
    expect(bad.success).toBe(false);
  });
});
