import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(80),
    email: z.string().trim().email("Enter a valid institutional email"),
    academicId: z
      .string()
      .trim()
      .min(3, "Register number is required")
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Register number may only contain letters, numbers, hyphens, or underscores"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string().optional(),
    role: z.enum(["student", "staff"]).default("student"),
    staffInviteCode: z.string().optional(),
    departmentId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((data) => data.confirmPassword === undefined || data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(24).optional().nullable(),
  year_of_study: z.string().trim().max(32).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
});

export const componentBaseSchema = z.object({
  name: z.string().trim().min(2, "Component name is required").max(120),
  sku: z
    .string()
    .trim()
    .min(2, "SKU / inventory code is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "SKU must be alphanumeric with hyphens/underscores"),
  department_id: z.string().uuid("Select a department"),
  laboratory_id: z.string().uuid("Select a laboratory"),
  category_id: z.string().uuid("Select a category"),
  subcategory_id: z.string().uuid().optional().nullable().or(z.literal("")),
  description: z.string().trim().max(2000).optional().default(""),
  usage_instructions: z.string().trim().max(2000).optional().default(""),
  manufacturer: z.string().trim().max(100).optional().default(""),
  model: z.string().trim().max(100).optional().default(""),
  storage_location: z.string().trim().min(1).max(100).default("Main Shelf"),
  specifications: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
  image_urls: z.array(z.string().url()).optional().default([]),
  datasheet_url: z.string().url().optional().nullable().or(z.literal("")),
  is_serialized: z.boolean().default(false),
  total_quantity: z.coerce.number().int().min(0),
  available_quantity: z.coerce.number().int().min(0),
  min_stock_threshold: z.coerce.number().int().min(0).default(2),
  condition: z.enum([
    "New",
    "Good",
    "Needs inspection",
    "Damaged",
    "Under maintenance",
    "Retired",
  ]),
  replacement_value: z.coerce.number().min(0).optional().nullable(),
});

export const componentSchema = componentBaseSchema.refine(
  (d) => d.available_quantity <= d.total_quantity,
  {
    message: "Available quantity cannot exceed total quantity",
    path: ["available_quantity"],
  }
);

export const componentUpdateSchema = componentBaseSchema.partial();

export const borrowRequestSchema = z.object({
  laboratory_id: z.string().uuid("Select a valid laboratory"),
  team_id: z.string().uuid().optional().nullable().or(z.literal("")),
  project_name: z.string().trim().min(2, "Project name is required").max(120),
  purpose: z.string().trim().min(3, "Purpose is required").max(300),
  description: z.string().trim().max(1000).optional().default(""),
  needed_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid return date required"),
  items: z
    .array(
      z.object({
        component_id: z.string().uuid(),
        requested_qty: z.coerce.number().int().min(1).max(100),
      })
    )
    .min(1, "Select at least one component"),
});

export const reviewRequestSchema = z.object({
  action: z.enum(["approve", "reject", "checkout", "cancel", "override_approve"]),
  rejection_reason: z.string().trim().max(400).optional(),
  override_reason: z.string().trim().max(400).optional(),
});

export const returnInspectionSchema = z.object({
  returned_good: z.coerce.number().int().min(0),
  damaged: z.coerce.number().int().min(0).default(0),
  lost: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(1000).optional().default(""),
  photo_urls: z.array(z.string().url()).optional().default([]),
});

export const extensionRequestSchema = z.object({
  loan_id: z.string().uuid(),
  requested_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5, "Please explain why you need an extension").max(500),
});

export const labBookingSchema = z
  .object({
    laboratory_id: z.string().uuid(),
    team_id: z.string().uuid().optional().nullable().or(z.literal("")),
    session_purpose: z.string().trim().min(3, "Session purpose is required").max(200),
    booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    seats_requested: z.coerce.number().int().min(1).max(200),
    is_maintenance_block: z.boolean().optional().default(false),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  });

export const maintenanceReportSchema = z.object({
  laboratory_id: z.string().uuid(),
  component_id: z.string().uuid().optional().nullable().or(z.literal("")),
  asset_id: z.string().uuid().optional().nullable().or(z.literal("")),
  category: z.enum([
    "Broken component",
    "Missing equipment",
    "Faulty instrument",
    "Damaged cable",
    "Power/Connectivity",
    "General lab",
  ]),
  title: z.string().trim().min(3, "Title is required").max(140),
  description: z.string().trim().min(5, "Description is required").max(1500),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  photo_urls: z.array(z.string().url()).optional().default([]),
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum([
    "Reported",
    "Pending",
    "In progress",
    "Waiting for parts",
    "Resolved",
    "Closed",
  ]),
  comment: z.string().trim().min(2).max(800),
  resolution_notes: z.string().trim().max(1000).optional(),
  clear_component_defect: z.boolean().optional().default(false),
});

export const projectTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name is required").max(80),
  description: z.string().trim().max(500).optional().default(""),
  department_id: z.string().uuid().optional().nullable().or(z.literal("")),
  project_title: z.string().trim().min(2, "Project title is required").max(120),
  course_code: z.string().trim().max(32).optional().default(""),
  faculty_mentor: z.string().trim().max(80).optional().default(""),
  allow_member_requests: z.boolean().default(true),
});

export const institutionalSettingsSchema = z.object({
  max_borrow_qty_per_request: z.coerce.number().int().min(1).max(100),
  max_active_loans_per_student: z.coerce.number().int().min(1).max(50),
  max_loan_duration_days: z.coerce.number().int().min(1).max(180),
  overdue_grace_hours: z.coerce.number().int().min(0).max(240),
  staff_invite_code: z.string().trim().min(6).max(64).optional(),
  enable_email_notifications: z.boolean(),
  enable_deposits: z.boolean(),
  enable_late_fees: z.boolean(),
  late_fee_per_day: z.coerce.number().min(0).max(1000),
  enable_replacement_charges: z.boolean(),
});

export const laboratorySchema = z.object({
  department_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(24),
  building: z.string().trim().max(60).optional().default(""),
  room_number: z.string().trim().max(24).optional().default(""),
  description: z.string().trim().max(500).optional().default(""),
  capacity: z.coerce.number().int().min(1).max(500),
  open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default("08:00"),
  close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default("20:00"),
});
