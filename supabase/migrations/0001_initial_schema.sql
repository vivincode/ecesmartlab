-- ==============================================================================
-- SmartLab Component Lending & Management Platform
-- Migration 0001: Normalized PostgreSQL Schema (26 Core Tables)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- ENUMERATIONS
-- ------------------------------------------------------------------------------
CREATE TYPE app_role AS ENUM ('student', 'staff', 'admin');

CREATE TYPE component_condition AS ENUM (
  'New',
  'Good',
  'Needs inspection',
  'Damaged',
  'Under maintenance',
  'Retired'
);

CREATE TYPE component_status AS ENUM (
  'Available',
  'Low stock',
  'Out of stock',
  'Maintenance',
  'Retired'
);

CREATE TYPE asset_status AS ENUM (
  'Available',
  'Reserved',
  'Borrowed',
  'Under maintenance',
  'Damaged',
  'Lost',
  'Retired'
);

CREATE TYPE request_status AS ENUM (
  'Pending',
  'Approved',
  'Rejected',
  'Cancelled',
  'Ready for pickup',
  'Checked out',
  'Returned'
);

CREATE TYPE loan_status AS ENUM (
  'Active',
  'Due soon',
  'Overdue',
  'Partially returned',
  'Returned',
  'Lost',
  'Damaged'
);

CREATE TYPE extension_status AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE TYPE booking_status AS ENUM (
  'Pending',
  'Approved',
  'Rejected',
  'Cancelled',
  'Blocked'
);

CREATE TYPE maintenance_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');

CREATE TYPE maintenance_status AS ENUM (
  'Reported',
  'Pending',
  'In progress',
  'Waiting for parts',
  'Resolved',
  'Closed'
);

CREATE TYPE inventory_tx_type AS ENUM (
  'initial_stock',
  'restock',
  'adjustment',
  'reserve',
  'release_reservation',
  'checkout',
  'return',
  'damaged',
  'lost',
  'retired'
);

-- ------------------------------------------------------------------------------
-- HELPER FUNCTION: updated_at trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. institutions
-- ------------------------------------------------------------------------------
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  domain TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. roles
-- ------------------------------------------------------------------------------
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_role NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. departments
-- ------------------------------------------------------------------------------
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 4. profiles (1:1 with auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  role app_role NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  academic_id TEXT NOT NULL UNIQUE,
  phone TEXT,
  year_of_study TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_academic_id ON profiles(academic_id);
CREATE INDEX idx_profiles_department ON profiles(department_id);

-- ------------------------------------------------------------------------------
-- 5. laboratories
-- ------------------------------------------------------------------------------
CREATE TABLE laboratories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  building TEXT,
  room_number TEXT,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 24 CHECK (capacity > 0),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '20:00',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_laboratories_department ON laboratories(department_id);

-- ------------------------------------------------------------------------------
-- 6. lab_staff_assignments
-- ------------------------------------------------------------------------------
CREATE TABLE lab_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (laboratory_id, staff_id)
);

CREATE INDEX idx_lab_staff_staff ON lab_staff_assignments(staff_id);
CREATE INDEX idx_lab_staff_lab ON lab_staff_assignments(laboratory_id);

-- ------------------------------------------------------------------------------
-- 7. categories (hierarchical category + subcategory)
-- ------------------------------------------------------------------------------
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. components
-- ------------------------------------------------------------------------------
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  usage_instructions TEXT,
  manufacturer TEXT,
  model TEXT,
  storage_location TEXT NOT NULL DEFAULT 'Main Shelf',
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  datasheet_url TEXT,
  is_serialized BOOLEAN NOT NULL DEFAULT FALSE,
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  borrowed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (borrowed_quantity >= 0),
  min_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (min_stock_threshold >= 0),
  condition component_condition NOT NULL DEFAULT 'Good',
  status component_status NOT NULL DEFAULT 'Available',
  replacement_value NUMERIC(10, 2) CHECK (replacement_value IS NULL OR replacement_value >= 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_component_quantities CHECK (
    available_quantity + reserved_quantity + borrowed_quantity <= total_quantity
  )
);

CREATE INDEX idx_components_lab ON components(laboratory_id);
CREATE INDEX idx_components_dept ON components(department_id);
CREATE INDEX idx_components_cat ON components(category_id);
CREATE INDEX idx_components_sku ON components(sku);
CREATE INDEX idx_components_status ON components(status);

-- ------------------------------------------------------------------------------
-- 9. component_assets (individual serialized items)
-- ------------------------------------------------------------------------------
CREATE TABLE component_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL UNIQUE,
  serial_number TEXT UNIQUE,
  barcode TEXT,
  qr_payload TEXT,
  condition component_condition NOT NULL DEFAULT 'Good',
  status asset_status NOT NULL DEFAULT 'Available',
  notes TEXT,
  purchased_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_component_assets_component ON component_assets(component_id);
CREATE INDEX idx_component_assets_status ON component_assets(status);

-- ------------------------------------------------------------------------------
-- 10. inventory_transactions
-- ------------------------------------------------------------------------------
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES component_assets(id) ON DELETE SET NULL,
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  transaction_type inventory_tx_type NOT NULL,
  quantity_delta INTEGER NOT NULL,
  before_available INTEGER NOT NULL,
  after_available INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_tx_component ON inventory_transactions(component_id, created_at DESC);
CREATE INDEX idx_inv_tx_lab ON inventory_transactions(laboratory_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. projects
-- ------------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  course_code TEXT,
  faculty_mentor TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. project_teams
-- ------------------------------------------------------------------------------
CREATE TABLE project_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  allow_member_requests BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 13. team_members
-- ------------------------------------------------------------------------------
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES project_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  can_borrow BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ------------------------------------------------------------------------------
-- 14. borrow_requests
-- ------------------------------------------------------------------------------
CREATE TABLE borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES project_teams(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE RESTRICT,
  project_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  description TEXT,
  needed_until DATE NOT NULL,
  status request_status NOT NULL DEFAULT 'Pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_borrow_requests_requester ON borrow_requests(requester_id);
CREATE INDEX idx_borrow_requests_lab_status ON borrow_requests(laboratory_id, status);
CREATE INDEX idx_borrow_requests_team ON borrow_requests(team_id);

-- ------------------------------------------------------------------------------
-- 15. borrow_request_items
-- ------------------------------------------------------------------------------
CREATE TABLE borrow_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES borrow_requests(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  requested_qty INTEGER NOT NULL CHECK (requested_qty > 0),
  approved_qty INTEGER NOT NULL DEFAULT 0 CHECK (approved_qty >= 0),
  UNIQUE (request_id, component_id)
);

-- ------------------------------------------------------------------------------
-- 16. stock_reservations
-- ------------------------------------------------------------------------------
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES borrow_requests(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES component_assets(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_res_active ON stock_reservations(component_id) WHERE released_at IS NULL;

-- ------------------------------------------------------------------------------
-- 17. loans
-- ------------------------------------------------------------------------------
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  request_id UUID REFERENCES borrow_requests(id) ON DELETE SET NULL,
  borrower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES project_teams(id) ON DELETE SET NULL,
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE RESTRICT,
  checked_out_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  status loan_status NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_lab_status ON loans(laboratory_id, status);
CREATE INDEX idx_loans_due_date ON loans(due_date);

-- ------------------------------------------------------------------------------
-- 18. loan_items
-- ------------------------------------------------------------------------------
CREATE TABLE loan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  asset_id UUID REFERENCES component_assets(id) ON DELETE SET NULL,
  quantity_borrowed INTEGER NOT NULL CHECK (quantity_borrowed > 0),
  quantity_returned INTEGER NOT NULL DEFAULT 0 CHECK (quantity_returned >= 0),
  quantity_damaged INTEGER NOT NULL DEFAULT 0 CHECK (quantity_damaged >= 0),
  quantity_lost INTEGER NOT NULL DEFAULT 0 CHECK (quantity_lost >= 0),
  condition_out component_condition NOT NULL DEFAULT 'Good',
  condition_in component_condition,
  CONSTRAINT chk_loan_item_returned CHECK (
    quantity_returned + quantity_damaged + quantity_lost <= quantity_borrowed
  )
);

CREATE INDEX idx_loan_items_loan ON loan_items(loan_id);

-- ------------------------------------------------------------------------------
-- 19. return_inspections
-- ------------------------------------------------------------------------------
CREATE TABLE return_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  inspected_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_condition component_condition NOT NULL DEFAULT 'Good',
  notes TEXT,
  damage_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  missing_quantity INTEGER NOT NULL DEFAULT 0 CHECK (missing_quantity >= 0),
  repair_required BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------------------------
-- 20. extensions
-- ------------------------------------------------------------------------------
CREATE TABLE extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  current_due_date DATE NOT NULL,
  requested_due_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status extension_status NOT NULL DEFAULT 'Pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 21. lab_bookings
-- ------------------------------------------------------------------------------
CREATE TABLE lab_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES project_teams(id) ON DELETE SET NULL,
  session_purpose TEXT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  seats_requested INTEGER NOT NULL DEFAULT 1 CHECK (seats_requested > 0),
  status booking_status NOT NULL DEFAULT 'Pending',
  is_maintenance_block BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_booking_time CHECK (end_time > start_time)
);

CREATE INDEX idx_lab_bookings_lab_date ON lab_bookings(laboratory_id, booking_date);
CREATE INDEX idx_lab_bookings_user ON lab_bookings(user_id);

-- ------------------------------------------------------------------------------
-- 22. maintenance_reports
-- ------------------------------------------------------------------------------
CREATE TABLE maintenance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES component_assets(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Broken component',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  priority maintenance_priority NOT NULL DEFAULT 'Medium',
  status maintenance_status NOT NULL DEFAULT 'Reported',
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_lab_status ON maintenance_reports(laboratory_id, status);

-- ------------------------------------------------------------------------------
-- 23. maintenance_updates
-- ------------------------------------------------------------------------------
CREATE TABLE maintenance_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES maintenance_reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  previous_status maintenance_status,
  new_status maintenance_status NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 24. notifications
-- ------------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- 25. activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  laboratory_id UUID REFERENCES laboratories(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_lab ON activity_logs(laboratory_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 26. institutional_settings
-- ------------------------------------------------------------------------------
CREATE TABLE institutional_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
  max_borrow_qty_per_request INTEGER NOT NULL DEFAULT 10 CHECK (max_borrow_qty_per_request > 0),
  max_active_loans_per_student INTEGER NOT NULL DEFAULT 5 CHECK (max_active_loans_per_student > 0),
  max_loan_duration_days INTEGER NOT NULL DEFAULT 14 CHECK (max_loan_duration_days > 0),
  overdue_grace_hours INTEGER NOT NULL DEFAULT 24 CHECK (overdue_grace_hours >= 0),
  staff_invite_code TEXT NOT NULL DEFAULT 'STAFF-ACCESS-2026',
  enable_email_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  enable_deposits BOOLEAN NOT NULL DEFAULT FALSE,
  enable_late_fees BOOLEAN NOT NULL DEFAULT FALSE,
  late_fee_per_day NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  enable_replacement_charges BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- ATTACH updated_at TRIGGERS
-- ------------------------------------------------------------------------------
CREATE TRIGGER trg_institutions_updated BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_laboratories_updated BEFORE UPDATE ON laboratories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_components_updated BEFORE UPDATE ON components FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_component_assets_updated BEFORE UPDATE ON component_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_project_teams_updated BEFORE UPDATE ON project_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_borrow_requests_updated BEFORE UPDATE ON borrow_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lab_bookings_updated BEFORE UPDATE ON lab_bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_maintenance_reports_updated BEFORE UPDATE ON maintenance_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_institutional_settings_updated BEFORE UPDATE ON institutional_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
