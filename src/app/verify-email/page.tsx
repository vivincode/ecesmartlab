"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialEmail = searchParams.get("email") || "";
  const urlError = searchParams.get("error") || "";

  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState(urlError);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSentMessage("");

    if (!email.trim()) {
      setError("Enter the institutional email address you registered with.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend verification email.");
        return;
      }
      setSentMessage(data.message || "Verification email dispatched. Check your inbox.");
      toast("Verification email sent!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore if unconfigured
    }
    router.push("/login");
    router.refresh();
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
            href="/login"
            className="font-mono text-xs font-bold text-sky-700 uppercase hover:underline"
          >
            Sign In →
          </Link>
        </div>

        <BrutalCard className="shadow-brutal-6 p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-4">
            <div className="shadow-brutal-2 flex h-11 w-11 shrink-0 items-center justify-center border-2 border-slate-900 bg-white p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/psgitech-crest.png"
                alt="PSG iTech Crest"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <MonoLabel>PSG ITECH SMARTLAB // EMAIL VERIFICATION</MonoLabel>
              <h1 className="font-display text-xl font-black tracking-tight text-slate-950 uppercase">
                Verify Your Email
              </h1>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
            <p>
              We sent a verification link to{" "}
              <span className="font-mono font-black text-slate-950">
                {email || "your institutional email"}
              </span>
              .
            </p>
            <p>
              Click the confirmation link in your email to activate your account. Until your email is
              verified, access to the dashboard, catalog borrowing, lab bookings, and APIs remains
              locked.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 border-2 border-rose-700 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {sentMessage && (
            <div className="mt-4 flex items-start gap-2 border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>{sentMessage}</span>
            </div>
          )}

          <form onSubmit={handleResend} className="mt-5 space-y-3">
            <div>
              <label
                htmlFor="verify-email-input"
                className="mb-1 block font-mono text-[10px] font-black uppercase"
              >
                Registered Email Address
              </label>
              <input
                id="verify-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm font-medium focus:border-sky-700 focus:outline-none"
              />
            </div>

            <ActionButton
              type="submit"
              variant="primary"
              size="md"
              disabled={sending}
              className="w-full"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
              {sending ? "Sending Verification Email..." : "Resend Verification Email"}
            </ActionButton>
          </form>

          <div className="mt-5 flex items-center justify-between border-t-2 border-slate-200 pt-4 text-xs">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] font-bold text-slate-600 uppercase hover:text-slate-950"
            >
              <LogOut className="h-3.5 w-3.5" />
              Switch Account
            </button>
            <Link
              href="/register"
              className="font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
            >
              Register Another
            </Link>
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-tech-grid flex items-center justify-center font-mono text-xs font-bold uppercase">
          Loading Verification Portal...
        </div>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  );
}
