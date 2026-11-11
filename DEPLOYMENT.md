# SmartLab Production Deployment & Operations Guide

## 1. Hosting Stack (Vercel + Supabase)
1. **Database & Auth**: Deploy PostgreSQL, Auth, Storage (`smartlab-files`), and Realtime on Supabase Pro (or self-hosted Supabase).
2. **Frontend & API**: Deploy the Next.js App Router application to Vercel (Node.js 20+ runtime).
3. Configure Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Mark as Sensitive / Server-only)
   - `NEXT_PUBLIC_APP_URL` (`https://smartlab.yourcollege.edu`)
   - `CRON_SECRET` (High-entropy random secret for automated overdue scans)
   - `RESEND_API_KEY` & `EMAIL_FROM` (Optional email notifications)

## 2. Automated Overdue Loan Monitoring
Schedule a Vercel Cron Job (or GitHub Action / external cron) calling:
```http
POST https://smartlab.yourcollege.edu/api/cron/overdue
Authorization: Bearer <CRON_SECRET>
```
Recommended cadence: Every hour or daily at `08:00` local campus time. This runs `sync_overdue_loans()` in PostgreSQL to update `Active -> Due soon / Overdue` and dispatch notifications.

## 3. Database Backup & Recovery Strategy
- **Daily Automated Backups**: Enable Supabase Point-in-Time Recovery (PITR) or daily `pg_dump` snapshots stored in encrypted institutional object storage.
- **Migration Hygiene**: Never edit deployed migrations in place; create sequential files (`0004_...sql`) and test against a staging Supabase branch before production rollout.
- **Audit Preservation**: `activity_logs` and `inventory_transactions` are append-only operational trails. Soft deletions (`deleted_at`) preserve historical loan and inspection integrity.

## 4. Security Checklist
- [x] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to browser code (enforced with runtime window check in `src/lib/supabase/server.ts`).
- [x] Row Level Security (RLS) enabled on all 26 PostgreSQL tables.
- [x] Staff inventory & approval mutations verify `lab_staff_assignments` on the server.
- [x] Students cannot self-approve requests (`requester_id <> staff_id` enforced in RPC and API route).
- [x] HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`) configured in `next.config.ts`.
- [x] Upload endpoint restricts MIME types (`PNG`, `JPEG`, `WEBP`, `PDF`) and enforces 10 MB file size cap.
