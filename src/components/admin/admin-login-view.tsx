"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function AdminLoginView() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        setLoading(false);
        return;
      }

      const profileRes = await fetch("/api/profile");
      const profileData = await profileRes.json().catch(() => null);

      if (!profileRes.ok || profileData?.profile?.role !== "admin") {
        await supabase.auth.signOut();
        setError("Access denied: administrator privileges are required for /admin.");
        setLoading(false);
        return;
      }

      toast("Administrator authenticated", "success");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
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
              <MonoLabel>PSG ITECH // RESTRICTED ADMIN PORTAL</MonoLabel>
              <h1 className="font-display text-xl font-black tracking-tight text-slate-950 uppercase">
                Administrator Sign In
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block font-mono text-[11px] font-black tracking-wider text-slate-800 uppercase"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  className="w-full border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-sm font-medium focus:border-sky-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block font-mono text-[11px] font-black tracking-wider text-slate-800 uppercase"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="admin-password"
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
                {error}
              </div>
            )}

            <ActionButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Verifying Access..." : "Sign In to Admin"}
            </ActionButton>
          </form>
        </BrutalCard>
      </div>
    </div>
  );
}
