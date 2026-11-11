"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, BrutalCard, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Department, Profile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [year, setYear] = useState("");
  const [deptId, setDeptId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/profile").then((r) => r.json()), fetch("/api/meta").then((r) => r.json())]).then(
      ([pRes, mRes]) => {
        if (pRes.profile) {
          setProfile(pRes.profile);
          setFullName(pRes.profile.full_name || "");
          setPhone(pRes.profile.phone || "");
          setYear(pRes.profile.year_of_study || "");
          setDeptId(pRes.profile.department_id || "");
        }
        setDepartments(mRes.departments ?? []);
      }
    );
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone: phone || null,
          year_of_study: year || null,
          department_id: deptId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Failed to update profile", "error");
        return;
      }
      setProfile(d.profile);
      toast("Profile updated", "success");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      toast('Type "DELETE" to confirm account removal', "error");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(d.error || "Unable to delete account", "error");
        setDeleting(false);
        return;
      }

      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // Session already cleared server-side
      }

      toast("Account deleted", "success");
      router.push("/");
      router.refresh();
    } catch {
      toast("Network error while deleting account", "error");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-b-2 border-slate-900 pb-4">
        <MonoLabel>ACCOUNT SETTINGS</MonoLabel>
        <h1 className="font-display mt-1 text-2xl font-black uppercase sm:text-3xl">
          My Profile
        </h1>
      </div>

      <BrutalCard className="p-6">
        {profile && (
          <div className="mb-5 flex items-center justify-between border-2 border-slate-900 bg-slate-50 p-3 font-mono text-xs">
            <div>
              <span className="block text-[10px] text-slate-500">ACADEMIC ID</span>
              <span className="font-black">{profile.academic_id}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">ASSIGNED ROLE</span>
              <span className="font-black text-sky-700 uppercase">{profile.role}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">EMAIL</span>
              <span className="font-bold">{profile.email}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              Full Name *
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                Phone Number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                Year / Cohort
              </label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="3rd Year B.E."
                className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] font-black uppercase">
              Department
            </label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="w-full border-2 border-slate-900 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <ActionButton type="submit" variant="primary" disabled={saving}>
            <UserCheck className="h-4 w-4" />
            {saving ? "Saving..." : "Save Profile"}
          </ActionButton>
        </form>
      </BrutalCard>

      <BrutalCard className="border-rose-700 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <MonoLabel className="text-rose-700">DANGER ZONE</MonoLabel>
            <h2 className="font-display mt-1 text-lg font-black text-slate-950 uppercase">
              Delete Account
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Permanently remove your SmartLab account. Any borrowed equipment must be returned
              first.
            </p>
          </div>
          {!showDeleteConfirm && (
            <ActionButton
              type="button"
              variant="secondary"
              className="shrink-0 border-rose-700 text-rose-700 hover:bg-rose-50"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </ActionButton>
          )}
        </div>

        {showDeleteConfirm && (
          <form
            onSubmit={handleDeleteAccount}
            className="mt-4 space-y-3 border-t-2 border-rose-200 pt-4"
          >
            <label
              htmlFor="delete-confirm-input"
              className="block font-mono text-[11px] font-black text-rose-800 uppercase"
            >
              Type DELETE to confirm permanent account removal
            </label>
            <input
              id="delete-confirm-input"
              required
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full border-2 border-rose-700 bg-white px-3 py-2 font-mono text-sm uppercase focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <ActionButton
                type="submit"
                variant="primary"
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                className="bg-rose-700 text-white hover:bg-rose-800"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Confirm Delete Account"}
              </ActionButton>
              <ActionButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </ActionButton>
            </div>
          </form>
        )}
      </BrutalCard>
    </div>
  );
}
