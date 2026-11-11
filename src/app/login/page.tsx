"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const checkVerificationParam = searchParams.get("check_verification");
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.supabaseConfigured)))
      .catch(() => setConfigured(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUnconfirmedEmail("");
    if (configured === false) {
      setError("Supabase credentials are not configured yet. Visit /setup to connect your database.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        if (signInErr.message.toLowerCase().includes("email not confirmed")) {
          setUnconfirmedEmail(email.trim());
          setError("Your email address is not verified yet. Please confirm your email before signing in.");
        } else {
          setError(signInErr.message);
        }
        setLoading(false);
        return;
      }

      toast("Signed in successfully", "success");
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
    }
  }

  async function handleResendFromLogin() {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unconfirmedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not resend verification email", "error");
        return;
      }
      toast("Verification email sent! Check your inbox.", "success");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-tech-grid flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-slate-700 uppercase hover:text-sky-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to SmartLab
          </Link>
          <Link
            href="/register"
            className="font-mono text-[11px] font-bold text-sky-700 uppercase hover:underline"
          >
            Student Sign Up
          </Link>
        </div>

        <BrutalCard className="shadow-brutal-6 p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-4">
            <div className="shadow-brutal-2 flex h-10 w-10 items-center justify-center border-2 border-slate-900 bg-slate-900 font-mono text-sm font-black text-white">
              SL
            </div>
            <div>
              <MonoLabel>AUTHENTICATION PORTAL</MonoLabel>
              <h1 className="font-display text-xl font-black tracking-tight text-slate-950 uppercase">
                Sign in to SmartLab
              </h1>
            </div>
          </div>

          {checkVerificationParam && (
            <div className="mt-4 flex items-start gap-2 border-2 border-sky-700 bg-sky-50 p-3 text-xs font-bold text-sky-950">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <span>
                Sign in with your email and password to complete verification and access SmartLab.
              </span>
            </div>
          )}

          {configured === false && (
            <div className="mt-4 border-2 border-amber-700 bg-amber-50 p-3 text-xs font-bold text-amber-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                <span>Supabase environment variables are missing.</span>
              </div>
              <Link href="/setup" className="mt-1 inline-block font-mono underline">
                Follow the setup guide →
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-[11px] font-black tracking-wider text-slate-800 uppercase"
              >
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-sm font-medium focus:border-sky-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block font-mono text-[11px] font-black tracking-wider text-slate-800 uppercase"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border-2 border-slate-900 bg-white py-2.5 pr-10 pl-9 text-sm font-medium focus:border-sky-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute top-2.5 right-2.5 p-1 text-slate-500 hover:text-slate-900"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="border-2 border-rose-700 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900"
              >
                <p>{error}</p>
                {unconfirmedEmail && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleResendFromLogin}
                      disabled={resending}
                      className="cursor-pointer border border-rose-800 bg-white px-2.5 py-1 font-mono text-[10px] font-black text-rose-900 uppercase hover:bg-rose-100 disabled:opacity-50"
                    >
                      {resending ? "Sending..." : "Resend Verification Email"}
                    </button>
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(unconfirmedEmail)}`}
                      className="font-mono text-[10px] font-black text-rose-900 uppercase underline"
                    >
                      Open Verification Page →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <ActionButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </ActionButton>
          </form>

          <div className="mt-5 border-t-2 border-slate-200 pt-4 text-center text-xs text-slate-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-mono font-black text-sky-700 uppercase hover:underline">
              Register Now →
            </Link>
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-tech-grid flex items-center justify-center font-mono text-xs font-bold uppercase">
          Loading Auth Portal...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
