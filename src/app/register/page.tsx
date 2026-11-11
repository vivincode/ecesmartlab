"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Department } from "@/types/database";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [role, setRole] = useState<"student" | "staff">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [academicId, setAcademicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [staffInviteCode, setStaffInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(Boolean(d.configured));
        setDepartments(d.departments ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          academicId,
          password,
          confirmPassword,
          role,
          staffInviteCode: role === "staff" ? staffInviteCode : undefined,
          departmentId: departmentId || undefined,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Sign in immediately via Supabase Auth
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        toast("Account created! Please sign in.", "success");
        router.push("/login");
        return;
      }

      toast("Welcome to SmartLab!", "success");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-tech-grid flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-slate-700 uppercase hover:text-sky-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to SmartLab
          </Link>
          <Link href="/login" className="font-mono text-xs font-bold text-sky-700 uppercase hover:underline">
            Already registered? Sign In
          </Link>
        </div>

        <BrutalCard className="shadow-brutal-6 p-6 sm:p-8">
          <div className="border-b-2 border-slate-900 pb-4">
            <MonoLabel>ACCOUNT PROVISIONING</MonoLabel>
            <h1 className="font-display mt-1 text-2xl font-black tracking-tight text-slate-950 uppercase">
              Register for Lab Access
            </h1>
          </div>

          {configured === false && (
            <div className="mt-4 border-2 border-amber-700 bg-amber-50 p-3 text-xs font-bold text-amber-950">
              Supabase is not connected yet. Configure <code>.env.local</code> first on{" "}
              <Link href="/setup" className="underline">
                /setup
              </Link>
              .
            </div>
          )}

          {/* Segmented Role Selector */}
          <div className="mt-5 grid grid-cols-2 border-2 border-slate-900 bg-slate-100 p-1">
            {(["student", "staff"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`cursor-pointer py-2 font-mono text-xs font-black uppercase transition-colors ${
                  role === r ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r === "student" ? "Student Account" : "Lab Staff / Faculty"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Full Name *
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  {role === "staff" ? "Staff ID *" : "Student Roll / ID *"}
                </label>
                <input
                  required
                  value={academicId}
                  onChange={(e) => setAcademicId(e.target.value)}
                  placeholder={role === "staff" ? "STAFF-ECE-01" : "ECE23014"}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 font-mono text-sm font-bold uppercase focus:border-sky-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Institutional Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya@college.edu"
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {role === "staff" && (
              <div className="border-2 border-sky-800 bg-sky-50 p-3">
                <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-black text-sky-900 uppercase">
                  <KeyRound className="h-3.5 w-3.5" />
                  Authorized Staff Invite Code *
                </label>
                <input
                  type="password"
                  required
                  value={staffInviteCode}
                  onChange={(e) => setStaffInviteCode(e.target.value)}
                  placeholder="Enter admin-issued invitation code"
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 font-mono text-sm focus:outline-none"
                />
                <p className="mt-1 text-[11px] font-medium text-sky-900">
                  Validated server-side against <code>institutional_settings</code>.
                </p>
              </div>
            )}

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 border-2 border-rose-700 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <ActionButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || configured === false}
              className="w-full"
            >
              {loading ? "Provisioning Account..." : "Create Account"}
            </ActionButton>
          </form>
        </BrutalCard>
      </div>
    </div>
  );
}
