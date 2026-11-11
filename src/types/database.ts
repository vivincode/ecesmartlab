export type AppRole = "student" | "staff" | "admin";

export type ComponentCondition =
  | "New"
  | "Good"
  | "Needs inspection"
  | "Damaged"
  | "Under maintenance"
  | "Retired";

export type ComponentStatus =
  | "Available"
  | "Low stock"
  | "Out of stock"
  | "Maintenance"
  | "Retired";

export type AssetStatus =
  | "Available"
  | "Reserved"
  | "Borrowed"
  | "Under maintenance"
  | "Damaged"
  | "Lost"
  | "Retired";

export type RequestStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Ready for pickup"
  | "Checked out"
  | "Returned";

export type LoanStatus =
  | "Active"
  | "Due soon"
  | "Overdue"
  | "Partially returned"
  | "Returned"
  | "Lost"
  | "Damaged";

export type ExtensionStatus = "Pending" | "Approved" | "Rejected";

export type BookingStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Blocked";

export type MaintenancePriority = "Low" | "Medium" | "High" | "Critical";

export type MaintenanceStatus =
  | "Reported"
  | "Pending"
  | "In progress"
  | "Waiting for parts"
  | "Resolved"
  | "Closed";

export interface Profile {
  id: string;
  institution_id: string | null;
  department_id: string | null;
  role_id: string | null;
  role: AppRole;
  full_name: string;
  email: string;
  academic_id: string;
  phone: string | null;
  year_of_study: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments?: { id: string; name: string; code: string } | null;
}

export interface Department {
  id: string;
  institution_id: string | null;
  name: string;
  code: string;
  description: string | null;
  head_name: string | null;
  created_at: string;
}

export interface Laboratory {
  id: string;
  institution_id: string | null;
  department_id: string;
  name: string;
  code: string;
  building: string | null;
  room_number: string | null;
  description: string | null;
  capacity: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
  created_at: string;
  departments?: Department | null;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

export interface ComponentAsset {
  id: string;
  component_id: string;
  asset_code: string;
  serial_number: string | null;
  barcode: string | null;
  qr_payload: string | null;
  condition: ComponentCondition;
  status: AssetStatus;
  notes: string | null;
  purchased_at: string | null;
}

export interface ComponentRecord {
  id: string;
  department_id: string;
  laboratory_id: string;
  category_id: string;
  subcategory_id: string | null;
  name: string;
  sku: string;
  description: string | null;
  usage_instructions: string | null;
  manufacturer: string | null;
  model: string | null;
  storage_location: string;
  specifications: Record<string, string | number | boolean>;
  image_urls: string[];
  datasheet_url: string | null;
  is_serialized: boolean;
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  borrowed_quantity: number;
  min_stock_threshold: number;
  condition: ComponentCondition;
  status: ComponentStatus;
  replacement_value: number | null;
  created_at: string;
  updated_at: string;
  departments?: { id: string; name: string; code: string } | null;
  laboratories?: { id: string; name: string; code: string } | null;
  categories?: { id: string; name: string; slug: string } | null;
  component_assets?: ComponentAsset[];
}

export interface BorrowRequestItem {
  id: string;
  request_id: string;
  component_id: string;
  requested_qty: number;
  approved_qty: number;
  components?: {
    id: string;
    name: string;
    sku: string;
    available_quantity: number;
    storage_location: string;
  } | null;
}

export interface BorrowRequest {
  id: string;
  request_number: string;
  requester_id: string;
  team_id: string | null;
  project_id: string | null;
  laboratory_id: string;
  project_name: string;
  purpose: string;
  description: string | null;
  needed_until: string;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  override_reason: string | null;
  created_at: string;
  profiles?: { full_name: string; academic_id: string; email: string } | null;
  laboratories?: { name: string; code: string } | null;
  project_teams?: { name: string; code: string } | null;
  borrow_request_items?: BorrowRequestItem[];
}

export interface LoanItem {
  id: string;
  loan_id: string;
  component_id: string;
  asset_id: string | null;
  quantity_borrowed: number;
  quantity_returned: number;
  quantity_damaged: number;
  quantity_lost: number;
  condition_out: ComponentCondition;
  condition_in: ComponentCondition | null;
  components?: { name: string; sku: string; is_serialized: boolean } | null;
  component_assets?: { asset_code: string; serial_number: string | null } | null;
}

export interface Loan {
  id: string;
  loan_number: string;
  request_id: string | null;
  borrower_id: string;
  team_id: string | null;
  laboratory_id: string;
  checked_out_by: string | null;
  checked_out_at: string;
  due_date: string;
  returned_at: string | null;
  status: LoanStatus;
  notes: string | null;
  profiles?: { full_name: string; academic_id: string; email: string } | null;
  laboratories?: { name: string; code: string } | null;
  loan_items?: LoanItem[];
  extensions?: ExtensionRequest[];
}

export interface ExtensionRequest {
  id: string;
  loan_id: string;
  requested_by: string;
  current_due_date: string;
  requested_due_date: string;
  reason: string;
  status: ExtensionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface LabBooking {
  id: string;
  laboratory_id: string;
  user_id: string;
  team_id: string | null;
  session_purpose: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  seats_requested: number;
  status: BookingStatus;
  is_maintenance_block: boolean;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  profiles?: { full_name: string; academic_id: string } | null;
  laboratories?: { name: string; code: string; capacity: number } | null;
}

export interface MaintenanceReport {
  id: string;
  laboratory_id: string;
  component_id: string | null;
  asset_id: string | null;
  reported_by: string;
  assigned_to: string | null;
  category: string;
  title: string;
  description: string;
  photo_urls: string[];
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  laboratories?: { name: string; code: string } | null;
  components?: { name: string; sku: string } | null;
  reporter?: { full_name: string; academic_id: string } | null;
}

export interface ProjectTeam {
  id: string;
  name: string;
  code: string;
  description: string | null;
  department_id: string | null;
  project_id: string | null;
  leader_id: string;
  allow_member_requests: boolean;
  is_active: boolean;
  created_at: string;
  leader?: { full_name: string; academic_id: string } | null;
  projects?: { title: string; course_code: string | null; faculty_mentor: string | null } | null;
  team_members?: {
    id: string;
    user_id: string;
    role: "leader" | "member";
    can_borrow: boolean;
    profiles?: { full_name: string; academic_id: string; email: string } | null;
  }[];
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  laboratory_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: { full_name: string; academic_id: string; role: AppRole } | null;
  laboratories?: { name: string; code: string } | null;
}

export interface InstitutionalSettings {
  id: string;
  institution_id: string | null;
  max_borrow_qty_per_request: number;
  max_active_loans_per_student: number;
  max_loan_duration_days: number;
  overdue_grace_hours: number;
  enable_email_notifications: boolean;
  enable_deposits: boolean;
  enable_late_fees: boolean;
  late_fee_per_day: number;
  enable_replacement_charges: boolean;
  updated_at: string;
}
