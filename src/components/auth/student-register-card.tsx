"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Department } from "@/types/database";

interface StudentRegisterCardProps {
  initialDepartments?: Array<Pick<Department, "id" | "name" | "code">>;
  initialConfigured?: boolean;
  headingAs?: "h1" | "h2";
}

export function StudentRegisterCard({
  initialDepartments,
  initialConfigured,
  headingAs = "h2",
}: StudentRegisterCardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [academicId, setAcademicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [departments, setDepartments] = useState<Array<Pick<Department, "id" | "name" | "code">>>(
    initialDepartments ?? []
  );
  const [configured, setConfigured] = useState<boolean | null>(
    initialConfigured !== undefined ? initialConfigured : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState("");

  useEffect(() => {
    if (initialDepartments !== undefined && initialConfigured !== undefined) {
      return;
    }

    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(Boolean(d.configured));
        setDepartments(d.departments ?? []);
      })
      .catch(() => setConfigured(false));
  }, [initialDepartments, initialConfigured]);

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

  const HeadingTag = headingAs;

  return (
    <BrutalCard className="shadow-brutal-6 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="shadow-brutal-2 flex h-11 w-11 shrink-0 items-center justify-center border-2 border-slate-900 bg-white p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/psgitech-crest.png"
              alt="PSG iTech Crest"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <MonoLabel>STUDENT REGISTRATION</MonoLabel>
            <HeadingTag className="font-display mt-0.5 text-xl font-black tracking-tight text-slate-950 uppercase sm:text-2xl">
              Create Account
            </HeadingTag>
          </div>
        </div>
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 text-left">
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

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="reg-number"
              className="mb-1 block font-mono text-[10px] font-black uppercase"
            >
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
            <label
              htmlFor="reg-dept"
              className="mb-1 block font-mono text-[10px] font-black uppercase"
            >
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
            placeholder="student@psgitech.ac.in"
            className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="mb-1 block font-mono text-[10px] font-black uppercase"
          >
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
          {loading ? "Creating Account..." : "Create Account"}
        </ActionButton>

        <div className="border-t border-slate-200 pt-3 text-center font-mono text-xs">
          <span className="text-slate-600">Already registered? </span>
          <Link href="/login" className="font-black text-sky-700 uppercase hover:underline">
            Sign In →
          </Link>
        </div>
      </form>
    </BrutalCard>
  );
}
