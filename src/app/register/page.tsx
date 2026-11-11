"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Department } from "@/types/database";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [academicId, setAcademicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState("");

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
    setNeedsVerificationEmail("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          academicId,
          departmentId: departmentId || undefined,
          email,
          password,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Registration failed");
        if (payload.needsVerification) {
          setNeedsVerificationEmail(payload.email || email.trim());
        }
        setLoading(false);
        return;
      }

      if (payload.requiresEmailVerification !== false) {
        toast("Account created! Verify your email to activate access.", "success");
        router.push(`/verify-email?email=${encodeURIComponent(payload.email || email.trim())}`);
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
      <div className="w-full max-w-md">
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

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="reg-name" className="mb-1 block font-mono text-[10px] font-black uppercase">
                Name *
              </label>
              <input
                id="reg-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Priya Sharma"
                className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-number" className="mb-1 block font-mono text-[10px] font-black uppercase">
                Register Number *
              </label>
              <input
                id="reg-number"
                required
                value={academicId}
                onChange={(e) => setAcademicId(e.target.value)}
                placeholder="715526106001"
                className="w-full border-2 border-slate-900 bg-white px-3 py-2 font-mono text-sm font-bold uppercase focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-dept" className="mb-1 block font-mono text-[10px] font-black uppercase">
                Department
              </label>
              <select
                id="reg-dept"
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

            <div>
              <label htmlFor="reg-email" className="mb-1 block font-mono text-[10px] font-black uppercase">
                Email *
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="mb-1 block font-mono text-[10px] font-black uppercase">
                Password (min 8 chars) *
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border-2 border-slate-900 bg-white py-2 pr-10 pl-3 text-sm focus:border-sky-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute top-2 right-2.5 p-1 text-slate-500 hover:text-slate-900"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 border-2 border-rose-700 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span>{error}</span>
                  {needsVerificationEmail && (
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(needsVerificationEmail)}`}
                      className="mt-1 block font-mono text-[11px] underline"
                    >
                      Resend verification email →
                    </Link>
                  )}
                </div>
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
