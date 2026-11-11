"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Box,
  CalendarClock,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  User,
  Users,
  Wrench,
  X,
  CheckCheck,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Laboratory, NotificationRecord, Profile } from "@/types/database";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface AppShellProps {
  profile: Profile;
  laboratories: Laboratory[];
  initialNotifications: NotificationRecord[];
  children: React.ReactNode;
}

export function AppShell({
  profile,
  laboratories,
  initialNotifications,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>(initialNotifications);
  const [globalQuery, setGlobalQuery] = useState("");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`notifications:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profile.id}`,
          },
          (payload) => {
            const incoming = payload.new as NotificationRecord;
            setNotifications((prev) => [incoming, ...prev]);
            toast(incoming.title, "info");
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return;
    }
  }, [profile.id, toast]);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleGlobalSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!globalQuery.trim()) return;
    router.push(`/catalog?q=${encodeURIComponent(globalQuery.trim())}`);
    setGlobalQuery("");
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["student", "staff", "admin"] },
    { href: "/catalog", label: "Components", icon: Box, roles: ["student", "staff", "admin"] },
    { href: "/borrow", label: "Borrow & Loans", icon: ClipboardCheck, roles: ["student", "staff", "admin"] },
    { href: "/bookings", label: "Lab Bookings", icon: CalendarClock, roles: ["student", "staff", "admin"] },
    { href: "/teams", label: "Project Teams", icon: Users, roles: ["student", "staff", "admin"] },
    { href: "/maintenance", label: "Maintenance", icon: Wrench, roles: ["student", "staff", "admin"] },
    { href: "/reports", label: "Reports & Export", icon: FileBarChart2, roles: ["staff", "admin"] },
    { href: "/admin", label: "Admin Control", icon: Shield, roles: ["admin"] },
  ].filter((item) => item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-tech-grid lg:grid lg:grid-cols-[252px_1fr]">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r-2 border-slate-900 bg-white transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b-2 border-slate-900 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="shadow-brutal-2 flex h-9 w-9 shrink-0 items-center justify-center border-2 border-slate-900 bg-white p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/psgitech-crest.png"
                alt="PSG iTech Crest"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-display block truncate text-sm font-black tracking-tight uppercase">
                PSG iTech SmartLab
              </span>
              <span className="block font-mono text-[9px] font-black text-sky-700 uppercase">
                {profile.role} PORTAL
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="border-2 border-slate-900 p-1 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <span className="mb-2 block px-2 font-mono text-[9px] font-black tracking-widest text-slate-400 uppercase">
            OPERATIONS // WORKSPACE
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 border-2 px-3 py-2.5 font-mono text-xs font-black tracking-wide uppercase transition-colors ${
                  active
                    ? "shadow-brutal-2 border-slate-900 bg-slate-900 text-white"
                    : "border-transparent text-slate-700 hover:border-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t-2 border-slate-900 p-3">
          <div className="border-2 border-slate-900 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-mono text-[10px] font-black uppercase">
                {laboratories.length} ACTIVE LABS
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-600">
              All borrow approvals &amp; returns persist to PostgreSQL with RLS.
            </p>
          </div>
          <Link
            href="/profile"
            onClick={() => setMobileOpen(false)}
            className="mt-2.5 flex items-center gap-2 border-2 border-slate-900 bg-white px-3 py-2 font-mono text-[11px] font-black uppercase hover:bg-slate-50"
          >
            <User className="h-3.5 w-3.5 text-sky-700" />
            <span className="truncate">{profile.academic_id}</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b-2 border-slate-900 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="border-2 border-slate-900 bg-white p-1.5 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <form onSubmit={handleGlobalSearch} className="hidden items-center sm:flex">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  placeholder="Search SKU, component, manufacturer..."
                  aria-label="Global component search"
                  className="w-64 border-2 border-slate-900 bg-slate-50 py-1.5 pr-3 pl-8 font-mono text-xs font-medium focus:bg-white focus:outline-none md:w-80"
                />
              </div>
            </form>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="press relative flex h-9 w-9 cursor-pointer items-center justify-center border-2 border-slate-900 bg-white shadow-brutal-2"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center border border-slate-900 bg-sky-600 px-1 font-mono text-[9px] font-black text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="shadow-brutal-6 absolute right-0 mt-2 w-80 border-2 border-slate-900 bg-white sm:w-96">
                  <div className="flex items-center justify-between border-b-2 border-slate-900 px-3.5 py-2.5">
                    <span className="font-mono text-xs font-black uppercase">
                      Notifications ({unreadCount} unread)
                    </span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] font-black text-sky-700 uppercase hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 divide-y divide-slate-200 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center font-mono text-xs text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <Link
                          key={n.id}
                          href={n.link_url || "/notifications"}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-3.5 py-2.5 hover:bg-slate-50 ${
                            !n.is_read ? "bg-sky-50/70" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-900">{n.title}</span>
                            {!n.is_read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-600" />
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-600">{n.message}</p>
                          <span className="mt-1 block font-mono text-[9px] text-slate-400">
                            {formatDateTime(n.created_at)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                  <div className="border-t-2 border-slate-900 bg-slate-50 px-3.5 py-2 text-center">
                    <Link
                      href="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="font-mono text-[10px] font-black text-sky-700 uppercase hover:underline"
                    >
                      View full notification history →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User Badge */}
            <div className="hidden text-right sm:block">
              <div className="text-xs font-black text-slate-900">{profile.full_name}</div>
              <div className="font-mono text-[10px] font-bold text-sky-700 uppercase">
                {profile.role} · {profile.academic_id}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="press flex h-9 cursor-pointer items-center gap-1.5 border-2 border-slate-900 bg-white px-2.5 font-mono text-[11px] font-black uppercase shadow-brutal-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
