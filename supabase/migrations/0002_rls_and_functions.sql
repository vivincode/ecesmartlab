-- ==============================================================================
-- SmartLab Component Lending & Management Platform
-- Migration 0002: RLS Policies, Auth Triggers & Transactional Inventory RPCs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECURITY HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = TRUE AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid() AND is_active = TRUE AND deleted_at IS NULL), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('staff', 'admin') FROM profiles WHERE id = auth.uid() AND is_active = TRUE AND deleted_at IS NULL), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_staff_for_lab(p_lab_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin() OR EXISTS (
    SELECT 1 FROM lab_staff_assignments lsa
    JOIN profiles p ON p.id = lsa.staff_id
    WHERE lsa.laboratory_id = p_lab_id
      AND lsa.staff_id = auth.uid()
      AND p.role = 'staff'
      AND p.is_active = TRUE
      AND p.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------------------------
-- AUTH TRIGGER: Automatically create profile on Supabase Auth signup
-- Always defaults role to 'student' to prevent privilege escalation from client.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academic_id TEXT;
  v_full_name TEXT;
  v_role_id UUID;
BEGIN
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  v_academic_id := COALESCE(
    NULLIF(UPPER(TRIM(NEW.raw_user_meta_data->>'academic_id')), ''),
    'STU-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8))
  );

  SELECT id INTO v_role_id FROM roles WHERE name = 'student' LIMIT 1;

  INSERT INTO profiles (id, role_id, role, full_name, email, academic_id, is_active)
  VALUES (NEW.id, v_role_id, 'student', v_full_name, NEW.email, v_academic_id, TRUE)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS POLICIES
-- ------------------------------------------------------------------------------

-- Public read tables (catalog, labs, departments, categories)
CREATE POLICY "Public read institutions" ON institutions FOR SELECT USING (TRUE);
CREATE POLICY "Admin manage institutions" ON institutions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Authenticated read roles" ON roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage roles" ON roles FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Public read departments" ON departments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Admin manage departments" ON departments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Public read laboratories" ON laboratories FOR SELECT USING (deleted_at IS NULL AND is_active = TRUE);
CREATE POLICY "Admin read all laboratories" ON laboratories FOR SELECT USING (is_staff_or_admin());
CREATE POLICY "Admin manage laboratories" ON laboratories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Staff read lab assignments" ON lab_staff_assignments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manage lab assignments" ON lab_staff_assignments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Public read categories" ON categories FOR SELECT USING (TRUE);
CREATE POLICY "Admin manage categories" ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Profiles
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_staff_or_admin());
CREATE POLICY "Users update own safe profile" ON profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admin manage profiles" ON profiles FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Components & Assets
CREATE POLICY "Public read components" ON components FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Staff manage assigned lab components" ON components FOR ALL
  USING (is_staff_for_lab(laboratory_id))
  WITH CHECK (is_staff_for_lab(laboratory_id));

CREATE POLICY "Authenticated read component assets" ON component_assets FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Staff manage component assets" ON component_assets FOR ALL
  USING (EXISTS (SELECT 1 FROM components c WHERE c.id = component_assets.component_id AND is_staff_for_lab(c.laboratory_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM components c WHERE c.id = component_assets.component_id AND is_staff_for_lab(c.laboratory_id)));

-- Inventory Transactions
CREATE POLICY "Staff read inventory transactions" ON inventory_transactions FOR SELECT
  USING (is_staff_for_lab(laboratory_id));
CREATE POLICY "Staff insert inventory transactions" ON inventory_transactions FOR INSERT
  WITH CHECK (is_staff_for_lab(laboratory_id));

-- Projects & Teams
CREATE POLICY "Users read own or team projects" ON projects FOR SELECT
  USING (created_by = auth.uid() OR is_staff_or_admin() OR EXISTS (
    SELECT 1 FROM project_teams pt WHERE pt.project_id = projects.id AND is_team_member(pt.id)
  ));
CREATE POLICY "Users create projects" ON projects FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners or admin update projects" ON projects FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Members and staff read teams" ON project_teams FOR SELECT
  USING (deleted_at IS NULL AND (leader_id = auth.uid() OR is_team_member(id) OR is_staff_or_admin()));
CREATE POLICY "Authenticated create teams" ON project_teams FOR INSERT TO authenticated
  WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leader or admin update teams" ON project_teams FOR UPDATE
  USING (leader_id = auth.uid() OR is_admin());

CREATE POLICY "Members read team roster" ON team_members FOR SELECT
  USING (is_team_member(team_id) OR is_staff_or_admin());
CREATE POLICY "Leader or self join team" ON team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_teams pt WHERE pt.id = team_id AND pt.leader_id = auth.uid()));
CREATE POLICY "Leader remove team member" ON team_members FOR DELETE
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_teams pt WHERE pt.id = team_id AND pt.leader_id = auth.uid()) OR is_admin());

-- Borrow Requests & Items
CREATE POLICY "Read own, team, or assigned lab requests" ON borrow_requests FOR SELECT
  USING (
    requester_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_staff_for_lab(laboratory_id)
  );
CREATE POLICY "Students create own borrow requests" ON borrow_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Requesters cancel pending or staff update" ON borrow_requests FOR UPDATE
  USING (
    (requester_id = auth.uid() AND status = 'Pending')
    OR is_staff_for_lab(laboratory_id)
  );

CREATE POLICY "Read borrow request items" ON borrow_request_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM borrow_requests br WHERE br.id = request_id AND (
      br.requester_id = auth.uid() OR (br.team_id IS NOT NULL AND is_team_member(br.team_id)) OR is_staff_for_lab(br.laboratory_id)
    )
  ));
CREATE POLICY "Insert borrow request items" ON borrow_request_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM borrow_requests br WHERE br.id = request_id AND br.requester_id = auth.uid()
  ));

-- Stock Reservations
CREATE POLICY "Staff read reservations" ON stock_reservations FOR SELECT
  USING (EXISTS (SELECT 1 FROM components c WHERE c.id = component_id AND is_staff_for_lab(c.laboratory_id)));

-- Loans, Loan Items, Return Inspections, Extensions
CREATE POLICY "Read own, team, or lab loans" ON loans FOR SELECT
  USING (
    borrower_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_staff_for_lab(laboratory_id)
  );
CREATE POLICY "Staff manage lab loans" ON loans FOR ALL
  USING (is_staff_for_lab(laboratory_id))
  WITH CHECK (is_staff_for_lab(laboratory_id));

CREATE POLICY "Read loan items" ON loan_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM loans l WHERE l.id = loan_id AND (
      l.borrower_id = auth.uid() OR (l.team_id IS NOT NULL AND is_team_member(l.team_id)) OR is_staff_for_lab(l.laboratory_id)
    )
  ));
CREATE POLICY "Staff manage loan items" ON loan_items FOR ALL
  USING (EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_id AND is_staff_for_lab(l.laboratory_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_id AND is_staff_for_lab(l.laboratory_id)));

CREATE POLICY "Read return inspections" ON return_inspections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM loans l WHERE l.id = loan_id AND (l.borrower_id = auth.uid() OR is_staff_for_lab(l.laboratory_id))
  ));
CREATE POLICY "Staff insert return inspections" ON return_inspections FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_id AND is_staff_for_lab(l.laboratory_id)));

CREATE POLICY "Read own or lab extensions" ON extensions FOR SELECT
  USING (requested_by = auth.uid() OR EXISTS (
    SELECT 1 FROM loans l WHERE l.id = loan_id AND is_staff_for_lab(l.laboratory_id)
  ));
CREATE POLICY "Borrower request extension" ON extensions FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND EXISTS (
    SELECT 1 FROM loans l WHERE l.id = loan_id AND l.borrower_id = auth.uid()
  ));
CREATE POLICY "Staff update extensions" ON extensions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_id AND is_staff_for_lab(l.laboratory_id)));

-- Lab Bookings
CREATE POLICY "Read approved bookings or own or lab staff" ON lab_bookings FOR SELECT
  USING (
    user_id = auth.uid()
    OR status IN ('Approved', 'Blocked')
    OR is_staff_for_lab(laboratory_id)
  );
CREATE POLICY "Authenticated create lab booking" ON lab_bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_maintenance_block = FALSE OR is_staff_for_lab(laboratory_id)));
CREATE POLICY "User cancel pending or staff update booking" ON lab_bookings FOR UPDATE
  USING ((user_id = auth.uid() AND status = 'Pending') OR is_staff_for_lab(laboratory_id));

-- Maintenance Reports & Updates
CREATE POLICY "Authenticated read maintenance reports" ON maintenance_reports FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated create maintenance reports" ON maintenance_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Staff update maintenance reports" ON maintenance_reports FOR UPDATE
  USING (is_staff_for_lab(laboratory_id));

CREATE POLICY "Authenticated read maintenance updates" ON maintenance_updates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Staff insert maintenance updates" ON maintenance_updates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM maintenance_reports mr WHERE mr.id = report_id AND is_staff_for_lab(mr.laboratory_id)));

-- Notifications
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Activity Logs
CREATE POLICY "Staff read lab activity logs, admin read all" ON activity_logs FOR SELECT
  USING (is_admin() OR (laboratory_id IS NOT NULL AND is_staff_for_lab(laboratory_id)) OR actor_id = auth.uid());

-- Institutional Settings (never expose staff_invite_code to non-admins via SELECT)
CREATE POLICY "Admin manage institutional settings" ON institutional_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ------------------------------------------------------------------------------
-- TRANSACTIONAL RPC FUNCTIONS (Concurrency-safe with row-level locks)
-- ------------------------------------------------------------------------------

-- 1. Approve Borrow Request & Reserve Inventory Atomically
CREATE OR REPLACE FUNCTION approve_borrow_request(
  p_request_id UUID,
  p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req borrow_requests%ROWTYPE;
  v_item RECORD;
  v_comp components%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM borrow_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found';
  END IF;
  IF v_req.status <> 'Pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved (current: %)', v_req.status;
  END IF;
  IF v_req.requester_id = p_staff_id THEN
    RAISE EXCEPTION 'Users cannot approve their own borrow requests';
  END IF;

  -- Lock components in consistent ID order to prevent deadlocks
  FOR v_item IN
    SELECT bri.* FROM borrow_request_items bri
    WHERE bri.request_id = p_request_id
    ORDER BY bri.component_id
  LOOP
    SELECT * INTO v_comp FROM components WHERE id = v_item.component_id FOR UPDATE;
    IF NOT FOUND OR v_comp.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Component % no longer exists', v_item.component_id;
    END IF;
    IF v_comp.condition IN ('Damaged', 'Under maintenance', 'Retired') THEN
      RAISE EXCEPTION 'Component % is marked % and cannot be lent', v_comp.name, v_comp.condition;
    END IF;
    IF v_comp.available_quantity < v_item.requested_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (available: %, requested: %)',
        v_comp.name, v_comp.available_quantity, v_item.requested_qty;
    END IF;

    UPDATE components
    SET available_quantity = available_quantity - v_item.requested_qty,
        reserved_quantity = reserved_quantity + v_item.requested_qty,
        status = CASE
          WHEN (available_quantity - v_item.requested_qty) = 0 THEN 'Out of stock'::component_status
          WHEN (available_quantity - v_item.requested_qty) <= min_stock_threshold THEN 'Low stock'::component_status
          ELSE 'Available'::component_status
        END
    WHERE id = v_comp.id;

    UPDATE borrow_request_items
    SET approved_qty = v_item.requested_qty
    WHERE id = v_item.id;

    INSERT INTO stock_reservations (request_id, component_id, quantity)
    VALUES (p_request_id, v_comp.id, v_item.requested_qty);

    INSERT INTO inventory_transactions (
      component_id, laboratory_id, transaction_type, quantity_delta,
      before_available, after_available, reference_type, reference_id, actor_id, notes
    ) VALUES (
      v_comp.id, v_comp.laboratory_id, 'reserve', -v_item.requested_qty,
      v_comp.available_quantity, v_comp.available_quantity - v_item.requested_qty,
      'borrow_request', p_request_id, p_staff_id, 'Reserved on request approval'
    );
  END LOOP;

  UPDATE borrow_requests
  SET status = 'Ready for pickup',
      reviewed_by = p_staff_id,
      reviewed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, type, title, message, link_url, metadata)
  VALUES (
    v_req.requester_id,
    'request_approved',
    'Borrow request approved',
    'Your request ' || v_req.request_number || ' is approved and ready for pickup.',
    '/borrow',
    jsonb_build_object('request_id', p_request_id)
  );

  INSERT INTO activity_logs (actor_id, laboratory_id, action, entity_type, entity_id, summary)
  VALUES (
    p_staff_id, v_req.laboratory_id, 'approve_borrow_request', 'borrow_request', p_request_id,
    'Approved request ' || v_req.request_number
  );

  RETURN jsonb_build_object('ok', true, 'request_id', p_request_id, 'status', 'Ready for pickup');
END;
$$;

-- 2. Checkout Approved Borrow Request -> Active Loan
CREATE OR REPLACE FUNCTION checkout_borrow_request(
  p_request_id UUID,
  p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req borrow_requests%ROWTYPE;
  v_loan_id UUID;
  v_loan_number TEXT;
  v_item RECORD;
  v_comp components%ROWTYPE;
  v_asset_id UUID;
BEGIN
  SELECT * INTO v_req FROM borrow_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Borrow request not found';
  END IF;
  IF v_req.status NOT IN ('Approved', 'Ready for pickup') THEN
    RAISE EXCEPTION 'Request must be Approved or Ready for pickup before checkout';
  END IF;

  v_loan_number := 'LN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 5));

  INSERT INTO loans (
    loan_number, request_id, borrower_id, team_id, laboratory_id,
    checked_out_by, due_date, status
  ) VALUES (
    v_loan_number, p_request_id, v_req.requester_id, v_req.team_id, v_req.laboratory_id,
    p_staff_id, v_req.needed_until, 'Active'
  ) RETURNING id INTO v_loan_id;

  FOR v_item IN
    SELECT bri.* FROM borrow_request_items bri
    WHERE bri.request_id = p_request_id AND bri.approved_qty > 0
    ORDER BY bri.component_id
  LOOP
    SELECT * INTO v_comp FROM components WHERE id = v_item.component_id FOR UPDATE;

    v_asset_id := NULL;
    IF v_comp.is_serialized THEN
      SELECT id INTO v_asset_id FROM component_assets
      WHERE component_id = v_comp.id AND status = 'Available' AND deleted_at IS NULL
      LIMIT 1 FOR UPDATE;
      IF v_asset_id IS NOT NULL THEN
        UPDATE component_assets SET status = 'Borrowed' WHERE id = v_asset_id;
      END IF;
    END IF;

    UPDATE components
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.approved_qty),
        borrowed_quantity = borrowed_quantity + v_item.approved_qty
    WHERE id = v_comp.id;

    UPDATE stock_reservations
    SET released_at = NOW()
    WHERE request_id = p_request_id AND component_id = v_comp.id AND released_at IS NULL;

    INSERT INTO loan_items (loan_id, component_id, asset_id, quantity_borrowed, condition_out)
    VALUES (v_loan_id, v_comp.id, v_asset_id, v_item.approved_qty, v_comp.condition);

    INSERT INTO inventory_transactions (
      component_id, asset_id, laboratory_id, transaction_type, quantity_delta,
      before_available, after_available, reference_type, reference_id, actor_id, notes
    ) VALUES (
      v_comp.id, v_asset_id, v_comp.laboratory_id, 'checkout', 0,
      v_comp.available_quantity, v_comp.available_quantity,
      'loan', v_loan_id, p_staff_id, 'Checked out to borrower (' || v_loan_number || ')'
    );
  END LOOP;

  UPDATE borrow_requests SET status = 'Checked out' WHERE id = p_request_id;

  INSERT INTO notifications (user_id, type, title, message, link_url, metadata)
  VALUES (
    v_req.requester_id,
    'equipment_checked_out',
    'Equipment checked out',
    'Loan ' || v_loan_number || ' is active. Due date: ' || v_req.needed_until::text,
    '/borrow',
    jsonb_build_object('loan_id', v_loan_id, 'loan_number', v_loan_number)
  );

  INSERT INTO activity_logs (actor_id, laboratory_id, action, entity_type, entity_id, summary)
  VALUES (
    p_staff_id, v_req.laboratory_id, 'checkout_loan', 'loan', v_loan_id,
    'Checked out loan ' || v_loan_number || ' for request ' || v_req.request_number
  );

  RETURN jsonb_build_object('ok', true, 'loan_id', v_loan_id, 'loan_number', v_loan_number);
END;
$$;

-- 3. Process Full or Partial Return & Inspection Atomically
CREATE OR REPLACE FUNCTION process_return_inspection(
  p_loan_id UUID,
  p_staff_id UUID,
  p_returned_good INTEGER,
  p_damaged INTEGER,
  p_lost INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_photo_urls TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan loans%ROWTYPE;
  v_item RECORD;
  v_comp components%ROWTYPE;
  v_remaining INTEGER;
  v_good_left INTEGER := COALESCE(p_returned_good, 0);
  v_dmg_left INTEGER := COALESCE(p_damaged, 0);
  v_lost_left INTEGER := COALESCE(p_lost, 0);
  v_take_good INTEGER;
  v_take_dmg INTEGER;
  v_take_lost INTEGER;
  v_all_settled BOOLEAN := TRUE;
  v_new_loan_status loan_status;
BEGIN
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  IF v_loan.status IN ('Returned', 'Lost') THEN
    RAISE EXCEPTION 'Loan is already finalized';
  END IF;

  FOR v_item IN
    SELECT * FROM loan_items WHERE loan_id = p_loan_id ORDER BY component_id FOR UPDATE
  LOOP
    v_remaining := v_item.quantity_borrowed - (v_item.quantity_returned + v_item.quantity_damaged + v_item.quantity_lost);
    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    v_take_good := LEAST(v_remaining, v_good_left);
    v_good_left := v_good_left - v_take_good;
    v_remaining := v_remaining - v_take_good;

    v_take_dmg := LEAST(v_remaining, v_dmg_left);
    v_dmg_left := v_dmg_left - v_take_dmg;
    v_remaining := v_remaining - v_take_dmg;

    v_take_lost := LEAST(v_remaining, v_lost_left);
    v_lost_left := v_lost_left - v_take_lost;

    SELECT * INTO v_comp FROM components WHERE id = v_item.component_id FOR UPDATE;

    UPDATE loan_items
    SET quantity_returned = quantity_returned + v_take_good,
        quantity_damaged = quantity_damaged + v_take_dmg,
        quantity_lost = quantity_lost + v_take_lost,
        condition_in = CASE
          WHEN v_take_dmg > 0 THEN 'Damaged'::component_condition
          ELSE 'Good'::component_condition
        END
    WHERE id = v_item.id;

    UPDATE components
    SET borrowed_quantity = GREATEST(0, borrowed_quantity - (v_take_good + v_take_dmg + v_take_lost)),
        available_quantity = available_quantity + v_take_good,
        total_quantity = GREATEST(0, total_quantity - v_take_lost),
        condition = CASE
          WHEN v_comp.is_serialized AND v_take_dmg > 0 THEN 'Damaged'::component_condition
          ELSE v_comp.condition
        END,
        status = CASE
          WHEN (available_quantity + v_take_good) = 0 THEN 'Out of stock'::component_status
          WHEN (available_quantity + v_take_good) <= min_stock_threshold THEN 'Low stock'::component_status
          ELSE 'Available'::component_status
        END
    WHERE id = v_comp.id;

    IF v_item.asset_id IS NOT NULL THEN
      UPDATE component_assets
      SET status = CASE
            WHEN v_take_lost > 0 THEN 'Lost'::asset_status
            WHEN v_take_dmg > 0 THEN 'Damaged'::asset_status
            ELSE 'Available'::asset_status
          END,
          condition = CASE
            WHEN v_take_dmg > 0 THEN 'Damaged'::component_condition
            ELSE 'Good'::component_condition
          END
      WHERE id = v_item.asset_id;
    END IF;

    IF v_take_good > 0 THEN
      INSERT INTO inventory_transactions (
        component_id, asset_id, laboratory_id, transaction_type, quantity_delta,
        before_available, after_available, reference_type, reference_id, actor_id, notes
      ) VALUES (
        v_comp.id, v_item.asset_id, v_comp.laboratory_id, 'return', v_take_good,
        v_comp.available_quantity, v_comp.available_quantity + v_take_good,
        'loan', p_loan_id, p_staff_id, COALESCE(p_notes, 'Checked in by staff')
      );
    END IF;

    IF v_take_dmg > 0 THEN
      INSERT INTO maintenance_reports (
        laboratory_id, component_id, asset_id, reported_by, category,
        title, description, photo_urls, priority, status
      ) VALUES (
        v_comp.laboratory_id, v_comp.id, v_item.asset_id, p_staff_id, 'Broken component',
        'Return inspection damage: ' || v_comp.name,
        COALESCE(p_notes, 'Marked damaged during loan return inspection (' || v_loan.loan_number || ')'),
        p_photo_urls, 'High', 'Reported'
      );
    END IF;
  END LOOP;

  SELECT NOT EXISTS (
    SELECT 1 FROM loan_items
    WHERE loan_id = p_loan_id
      AND (quantity_returned + quantity_damaged + quantity_lost) < quantity_borrowed
  ) INTO v_all_settled;

  IF NOT v_all_settled THEN
    v_new_loan_status := 'Partially returned';
  ELSIF COALESCE(p_damaged, 0) > 0 THEN
    v_new_loan_status := 'Damaged';
  ELSIF COALESCE(p_lost, 0) > 0 AND COALESCE(p_returned_good, 0) = 0 THEN
    v_new_loan_status := 'Lost';
  ELSE
    v_new_loan_status := 'Returned';
  END IF;

  UPDATE loans
  SET status = v_new_loan_status,
      returned_at = CASE WHEN v_all_settled THEN NOW() ELSE returned_at END
  WHERE id = p_loan_id;

  IF v_loan.request_id IS NOT NULL AND v_all_settled THEN
    UPDATE borrow_requests SET status = 'Returned' WHERE id = v_loan.request_id;
  END IF;

  INSERT INTO return_inspections (
    loan_id, inspected_by, overall_condition, notes, damage_photo_urls,
    missing_quantity, repair_required
  ) VALUES (
    p_loan_id, p_staff_id,
    CASE WHEN COALESCE(p_damaged, 0) > 0 THEN 'Damaged'::component_condition ELSE 'Good'::component_condition END,
    p_notes, p_photo_urls, COALESCE(p_lost, 0), COALESCE(p_damaged, 0) > 0
  );

  INSERT INTO notifications (user_id, type, title, message, link_url, metadata)
  VALUES (
    v_loan.borrower_id,
    'return_confirmed',
    'Loan return processed',
    'Loan ' || v_loan.loan_number || ' status updated to ' || v_new_loan_status::text || '.',
    '/borrow',
    jsonb_build_object('loan_id', p_loan_id, 'status', v_new_loan_status)
  );

  INSERT INTO activity_logs (actor_id, laboratory_id, action, entity_type, entity_id, summary)
  VALUES (
    p_staff_id, v_loan.laboratory_id, 'return_inspection', 'loan', p_loan_id,
    'Processed return for ' || v_loan.loan_number || ' (' || v_new_loan_status::text || ')'
  );

  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'status', v_new_loan_status);
END;
$$;

-- 4. Approve Lab Booking (Capacity & Overlap Guard with Lock)
CREATE OR REPLACE FUNCTION approve_lab_booking(
  p_booking_id UUID,
  p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking lab_bookings%ROWTYPE;
  v_lab laboratories%ROWTYPE;
  v_occupied INTEGER;
  v_blocked BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM lab_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.status <> 'Pending' THEN
    RAISE EXCEPTION 'Booking is not pending';
  END IF;

  SELECT * INTO v_lab FROM laboratories WHERE id = v_booking.laboratory_id FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM lab_bookings
    WHERE laboratory_id = v_booking.laboratory_id
      AND booking_date = v_booking.booking_date
      AND status = 'Blocked'
      AND start_time < v_booking.end_time
      AND end_time > v_booking.start_time
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'Laboratory time slot is blocked for maintenance or closure';
  END IF;

  SELECT COALESCE(SUM(seats_requested), 0) INTO v_occupied
  FROM lab_bookings
  WHERE laboratory_id = v_booking.laboratory_id
    AND booking_date = v_booking.booking_date
    AND status = 'Approved'
    AND start_time < v_booking.end_time
    AND end_time > v_booking.start_time;

  IF v_occupied + v_booking.seats_requested > v_lab.capacity THEN
    RAISE EXCEPTION 'Capacity exceeded for % on % (%/% seats already reserved)',
      v_lab.name, v_booking.booking_date, v_occupied, v_lab.capacity;
  END IF;

  UPDATE lab_bookings
  SET status = 'Approved',
      reviewed_by = p_staff_id,
      reviewed_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO notifications (user_id, type, title, message, link_url, metadata)
  VALUES (
    v_booking.user_id,
    'booking_approved',
    'Lab booking approved',
    'Your booking for ' || v_lab.name || ' on ' || v_booking.booking_date::text || ' is confirmed.',
    '/bookings',
    jsonb_build_object('booking_id', p_booking_id)
  );

  INSERT INTO activity_logs (actor_id, laboratory_id, action, entity_type, entity_id, summary)
  VALUES (
    p_staff_id, v_booking.laboratory_id, 'approve_lab_booking', 'lab_booking', p_booking_id,
    'Approved lab booking on ' || v_booking.booking_date::text
  );

  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', 'Approved');
END;
$$;

-- 5. Automated Overdue & Due Soon Sync
CREATE OR REPLACE FUNCTION sync_overdue_loans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_loan RECORD;
BEGIN
  FOR v_loan IN
    SELECT id, borrower_id, loan_number, due_date, status
    FROM loans
    WHERE status IN ('Active', 'Due soon', 'Partially returned')
  LOOP
    IF v_loan.due_date < CURRENT_DATE THEN
      UPDATE loans SET status = 'Overdue' WHERE id = v_loan.id;
      INSERT INTO notifications (user_id, type, title, message, link_url)
      VALUES (
        v_loan.borrower_id,
        'loan_overdue',
        'Equipment overdue',
        'Loan ' || v_loan.loan_number || ' was due on ' || v_loan.due_date::text || '. Please return immediately.',
        '/borrow'
      );
      v_count := v_count + 1;
    ELSIF v_loan.due_date <= CURRENT_DATE + INTERVAL '1 day' AND v_loan.status = 'Active' THEN
      UPDATE loans SET status = 'Due soon' WHERE id = v_loan.id;
      INSERT INTO notifications (user_id, type, title, message, link_url)
      VALUES (
        v_loan.borrower_id,
        'loan_due_soon',
        'Equipment due soon',
        'Loan ' || v_loan.loan_number || ' is due on ' || v_loan.due_date::text || '.',
        '/borrow'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- SUPABASE STORAGE BUCKET (Component images, datasheets, damage photos)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'smartlab-files',
  'smartlab-files',
  TRUE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public view smartlab files"
ON storage.objects FOR SELECT
USING (bucket_id = 'smartlab-files');

CREATE POLICY "Authenticated upload smartlab files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'smartlab-files');
