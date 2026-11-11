# SmartLab — College Component Lending & Laboratory Management Platform

A production-ready, full-stack hardware inventory, borrowing workflow, laboratory booking, project team, and maintenance management platform engineered with **Next.js (App Router, TypeScript)**, **Tailwind CSS v4**, **Framer Motion**, **Recharts**, and **Supabase (PostgreSQL, Auth, Storage, Realtime, RLS)**.

## Core Architecture & Features

- **Role-Based Access Control (RBAC)**:
  - **Student**: Browse catalog, search & filter components, submit project borrow requests, cancel pending requests, view active loans & due dates, request extensions, create/join project teams, book lab workbench seats, report defects, receive realtime notifications.
  - **Laboratory Staff / Faculty**: Manage inventory & serialized assets for assigned labs, CSV bulk import, approve/reject requests with rejection reasons, record QR/asset checkouts, process full/partial returns & damage inspections with photo uploads, manage lab bookings & maintenance closures, update maintenance tickets, export CSV/PDF reports.
  - **Administrator**: Full institutional governance—manage all users, roles, lab assignments, departments, laboratories, lending policies, invite codes, request overrides with audit logging, and platform-wide analytics.
- **Database Integrity & Concurrency Control**:
  - 26 normalized PostgreSQL tables with UUID PKs, foreign keys, check constraints (`available + reserved + borrowed <= total`), and Row Level Security (RLS) policies.
  - Atomic PL/pgSQL RPC functions (`approve_borrow_request`, `checkout_borrow_request`, `process_return_inspection`, `approve_lab_booking`, `sync_overdue_loans`) using `SELECT ... FOR UPDATE` row locks to eliminate double allocation and capacity overflows.
- **Asset Identification & Reporting**:
  - QR code tag generation (`qrcode`) for component SKUs and serialized assets.
  - Printable checkout & return receipts.
  - Date-filtered CSV (RFC-4180 + formula-injection guarded) and PDF (`jspdf-autotable`) exports.

---

## Quick Start Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase & Environment Variables
1. Create a new project on [Supabase](https://supabase.com/).
2. Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (**Server-only — never prefix with `NEXT_PUBLIC_`**)
3. Open your Supabase **SQL Editor** and execute the migrations in order:
   1. `supabase/migrations/0001_initial_schema.sql`
   2. `supabase/migrations/0002_rls_and_functions.sql`
   3. `supabase/migrations/0003_seed.sql`

### 3. Provision Your First Administrator
1. Start the dev server (`npm run dev`) and register a user at `/register`.
2. Promote that account to `admin` in the Supabase SQL Editor:
   ```sql
   UPDATE profiles
   SET role = 'admin', role_id = (SELECT id FROM roles WHERE name = 'admin')
   WHERE email = 'your-admin@college.edu';
   ```
3. Sign in at `/login` and visit `/admin` to assign staff to labs and configure institutional policies.

### 4. Verify Build & Automated Tests
```bash
npm run typecheck
npm test
npm run build
```

---

## Project Structure

```text
├── supabase/migrations/
│   ├── 0001_initial_schema.sql      # 26 normalized PostgreSQL tables & constraints
│   ├── 0002_rls_and_functions.sql   # RLS policies, auth trigger, transactional RPCs, storage
│   └── 0003_seed.sql                # Institutional seed data (depts, labs, categories, SKUs)
├── src/
│   ├── app/
│   │   ├── (app)/                   # Authenticated RBAC portal routes
│   │   │   ├── dashboard/           # Student, Staff & Admin dashboards + Recharts analytics
│   │   │   ├── catalog/             # Searchable catalog, QR tags, CSV import, [id] detail
│   │   │   ├── borrow/              # Requests, approvals, checkouts, return inspections, receipts
│   │   │   ├── bookings/            # Lab calendar, capacity checks, maintenance closures
│   │   │   ├── teams/               # Project teams, invite codes, shared hardware
│   │   │   ├── maintenance/         # Defect reporting & technician resolution workflow
│   │   │   ├── reports/             # CSV & PDF exports + overdue sync
│   │   │   ├── admin/               # Users, labs, institutional settings, audit logs
│   │   │   ├── notifications/       # Realtime notification center
│   │   │   └── profile/             # User profile management
│   │   ├── api/                     # Zod-validated, RBAC-guarded Next.js API Route Handlers
│   │   ├── login/ & register/       # Supabase Auth portals
│   │   └── setup/                   # Live environment & migration diagnostics
│   ├── lib/
│   │   ├── auth/guards.ts           # Server-side RBAC, lab scope checks, audit logger
│   │   ├── domain/lending.ts        # Pure lending, capacity, & overdue evaluation logic
│   │   ├── reports/export.ts        # RFC-4180 CSV & jsPDF report generators
│   │   ├── security/rate-limit.ts   # Sliding-window API rate limiter
│   │   ├── supabase/                # Browser, SSR Server, and privileged Admin clients
│   │   └── validators/schemas.ts    # Zod validation schemas
│   └── types/database.ts            # Full TypeScript definitions
└── tests/                           # Vitest automated domain, validation & security tests
```
