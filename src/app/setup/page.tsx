import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft, Database, Shield, Terminal } from "lucide-react";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const supabaseReady = isSupabaseConfigured();
  const serviceReady = isServiceRoleConfigured();

  return (
    <div className="min-h-screen bg-tech-grid px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-slate-700 uppercase hover:text-sky-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Landing Page
        </Link>

        <BrutalCard className="shadow-brutal-6 p-6 sm:p-8">
          <MonoLabel>ENVIRONMENT &amp; DATABASE DIAGNOSTICS</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black text-slate-950 uppercase sm:text-3xl">
            SmartLab Production Setup Guide
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            SmartLab uses real PostgreSQL persistence, Row Level Security (RLS), and Supabase Auth
            cookies—never localStorage or hardcoded demo logins.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-slate-900 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black uppercase">Public Supabase Keys</span>
                {supabaseReady ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" />
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {supabaseReady
                  ? "NEXT_PUBLIC_SUPABASE_URL & ANON_KEY detected."
                  : "Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env.local."}
              </p>
            </div>

            <div className="border-2 border-slate-900 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black uppercase">Service Role Key</span>
                {serviceReady ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" />
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {serviceReady
                  ? "Server-only SUPABASE_SERVICE_ROLE_KEY detected."
                  : "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local."}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="border-2 border-slate-900 p-4">
              <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                <Database className="h-4 w-4 text-sky-700" />
                Step 1 — Run SQL Migrations in Supabase SQL Editor
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                <li>
                  <code>supabase/migrations/0001_initial_schema.sql</code> (26 tables, constraints, indexes)
                </li>
                <li>
                  <code>supabase/migrations/0002_rls_and_functions.sql</code> (RLS policies, auth trigger, transactional RPCs, storage bucket)
                </li>
                <li>
                  <code>supabase/migrations/0003_seed.sql</code> (institutions, roles, 3 departments, 4 labs, 12+ components, serialized assets)
                </li>
              </ol>
            </div>

            <div className="border-2 border-slate-900 p-4">
              <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                <Terminal className="h-4 w-4 text-sky-700" />
                Step 2 — Configure .env.local
              </div>
              <pre className="mt-2 overflow-x-auto bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
{`cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY`}
              </pre>
            </div>

            <div className="border-2 border-slate-900 p-4">
              <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                <Shield className="h-4 w-4 text-sky-700" />
                Step 3 — Provision First Administrator
              </div>
              <p className="mt-2 text-xs text-slate-700">
                Register an account via <code>/register</code>, then promote that user to{" "}
                <code>admin</code> in the Supabase SQL Editor:
              </p>
              <pre className="mt-2 overflow-x-auto bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
{`UPDATE profiles SET role = 'admin', role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE email = 'admin@college.edu';`}
              </pre>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login">
              <ActionButton variant="primary">Proceed to Sign In</ActionButton>
            </Link>
            <Link href="/register">
              <ActionButton variant="secondary">Register Account</ActionButton>
            </Link>
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}
