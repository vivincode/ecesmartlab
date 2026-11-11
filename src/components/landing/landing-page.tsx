"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Layers,
  Lock,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
  Activity,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel, StatusBadge } from "@/components/ui/primitives";

interface LandingStats {
  configured: boolean;
  totalComponents: number;
  totalLabs: number;
  totalDepartments: number;
  availableUnits: number;
  featuredComponents: Array<{
    id: string;
    name: string;
    sku: string;
    available_quantity: number;
    total_quantity: number;
    condition: string;
    status: string;
    storage_location: string;
    laboratories?: { name: string; code: string } | null;
    categories?: { name: string } | null;
  }>;
}

const CATEGORIES = [
  {
    code: "CAT-01",
    name: "Microcontrollers & SBCs",
    examples: "Arduino Uno, ESP32-S3, STM32, Raspberry Pi 5",
    icon: Cpu,
  },
  {
    code: "CAT-02",
    name: "Sensors & Modules",
    examples: "RPLIDAR A1M8, 9-DOF IMU, Ultrasonic, LoRa RF",
    icon: Radio,
  },
  {
    code: "CAT-03",
    name: "Test & Measurement",
    examples: "Rigol DS1054Z, Fluke 115 DMM, Logic Pro 8",
    icon: Activity,
  },
  {
    code: "CAT-04",
    name: "Passives & Prototyping",
    examples: "1% Metal Film Kits, 830-pt Breadboards, Jumpers",
    icon: Layers,
  },
  {
    code: "CAT-05",
    name: "Actuators & Power",
    examples: "High-Torque Servos, BLDC ESCs, Buck Converters",
    icon: Zap,
  },
  {
    code: "CAT-06",
    name: "Fabrication & Soldering",
    examples: "Hakko FX-888D Stations, Hot Air Rework, Crimpers",
    icon: Wrench,
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Discover & Verify Stock",
    desc: "Filter components across every department lab by real-time availability, datasheet specs, and serialized asset tags.",
  },
  {
    step: "02",
    title: "Submit Project Request",
    desc: "Attach your academic project or team ID, select unit quantities, and pick an expected return date within lab policy.",
  },
  {
    step: "03",
    title: "Staff Review & QR Checkout",
    desc: "Assigned lab staff approve requests atomically—reserving stock via database row locks—and scan QR codes at pickup.",
  },
  {
    step: "04",
    title: "Inspect, Return & Audit",
    desc: "Partial or full returns are inspected for condition. Defective units trigger maintenance tickets and block unsafe reuse.",
  },
];

const FAQS = [
  {
    q: "Who can borrow hardware through SmartLab?",
    a: "Registered students, project teams, and faculty across connected engineering departments. Staff accounts require an administrator-issued invitation code during registration.",
  },
  {
    q: "How does SmartLab prevent double-booking and negative stock?",
    a: "All borrow approvals, checkouts, return inspections, and lab seat bookings execute inside PostgreSQL transactional RPC functions with row-level locks (SELECT ... FOR UPDATE).",
  },
  {
    q: "What happens if equipment is returned damaged or missing?",
    a: "Staff log exact returned, damaged, and lost counts in the Return Inspection workflow. Damaged items automatically generate a Maintenance Report and block future borrowing until cleared.",
  },
  {
    q: "Can student project teams share equipment visibility?",
    a: "Yes. Teams get an invite code, configurable member borrowing permissions, shared loan tracking, and automatic duplicate-borrowing prevention per project.",
  },
];

const TICKER_ITEMS = [
  "ATOMIC POSTGRESQL RESERVATIONS",
  "QR ASSET CHECKOUT & RETURN",
  "MULTI-LAB RBAC ISOLATION",
  "REAL-TIME OVERDUE TELEMETRY",
  "CAPACITY-GUARDED LAB BOOKINGS",
  "CSV & PDF AUDIT EXPORTS",
  "DEFECT AUTO-QUARANTINE",
];

export function LandingPage({ stats }: { stats: LandingStats }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-tech-grid text-slate-900">
      {/* Top Engineering Navigation */}
      <header className="sticky top-0 z-40 border-b-2 border-slate-900 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="shadow-brutal-2 flex h-9 w-9 items-center justify-center border-2 border-slate-900 bg-slate-900 font-mono text-sm font-black text-white">
              SL
            </div>
            <div>
              <span className="font-display block text-sm font-bold tracking-tight text-slate-950 uppercase">
                SmartLab
              </span>
              <span className="block font-mono text-[9px] font-black tracking-widest text-sky-700 uppercase">
                COMPONENT LENDING PLATFORM
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 font-mono text-xs font-bold tracking-wider text-slate-700 uppercase md:flex">
            <a href="#discovery" className="hover:text-sky-700">
              Catalog
            </a>
            <a href="#workflow" className="hover:text-sky-700">
              Workflow
            </a>
            <a href="#categories" className="hover:text-sky-700">
              Categories
            </a>
            <a href="#faq" className="hover:text-sky-700">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/login">
              <ActionButton variant="secondary" size="sm">
                Sign In
              </ActionButton>
            </Link>
            <Link href="/register">
              <ActionButton variant="primary" size="sm">
                Register
                <ArrowRight className="h-3.5 w-3.5" />
              </ActionButton>
            </Link>
          </div>
        </div>
      </header>

      {!stats.configured && (
        <div className="border-b-2 border-slate-900 bg-amber-50 px-4 py-2.5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold text-amber-950">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <span>
                SUPABASE ENV NOT CONFIGURED — Add credentials in <code>.env.local</code> to activate live database &amp; auth.
              </span>
            </div>
            <Link href="/setup" className="underline hover:text-sky-700">
              View Setup Guide →
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-20 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}
            className="lg:col-span-7"
          >
            <div className="mb-5 inline-flex items-center gap-2 border-2 border-slate-900 bg-white px-3 py-1 shadow-brutal-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <MonoLabel className="text-slate-900">
                INSTITUTIONAL HARDWARE &amp; LAB OPERATIONS // V1.0
              </MonoLabel>
            </div>

            <h1 className="font-display text-4xl leading-[1.03] font-black tracking-tight text-slate-950 uppercase sm:text-5xl lg:text-6xl">
              Precision Component Lending For College{" "}
              <span className="text-sky-700">Engineering Labs.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed font-medium text-slate-600 sm:text-lg">
              Centralize microcontrollers, test instruments, serialized assets, and workbench bookings
              across every department. Built with PostgreSQL row-level security, transactional stock
              locks, QR checkout, and automated defect quarantine.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link href="/register">
                <ActionButton variant="primary" size="lg">
                  Create Student / Staff Account
                  <ArrowRight className="h-4 w-4" />
                </ActionButton>
              </Link>
              <Link href="/catalog">
                <ActionButton variant="secondary" size="lg">
                  Explore Component Catalog
                </ActionButton>
              </Link>
            </div>

            {/* Telemetry Metric Strip */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "TRACKED SKUS",
                  value: stats.configured ? String(stats.totalComponents) : "SQL Ready",
                },
                {
                  label: "AVAILABLE UNITS",
                  value: stats.configured ? String(stats.availableUnits) : "Live Sync",
                },
                {
                  label: "LAB COMPARTMENTS",
                  value: stats.configured ? String(stats.totalLabs) : "Multi-Lab",
                },
                {
                  label: "DEPARTMENTS",
                  value: stats.configured ? String(stats.totalDepartments) : "RBAC Scoped",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="shadow-brutal-2 border-2 border-slate-900 bg-white p-3"
                >
                  <span className="block font-mono text-[9px] font-black tracking-wider text-sky-700 uppercase">
                    {m.label}
                  </span>
                  <span className="font-display mt-1 block text-xl font-black text-slate-950">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Asterix-style Engineering Telemetry Frame */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="lg:col-span-5"
          >
            <div className="shadow-brutal-10 border-4 border-slate-900 bg-white p-5">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-sky-700" />
                  <span className="font-mono text-xs font-black tracking-wider uppercase">
                    INVENTORY TELEMETRY DECK
                  </span>
                </div>
                <span className="bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                  RLS ACTIVE
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  {
                    code: "COM-OSC-006",
                    name: "Rigol DS1054Z 4-Ch Oscilloscope",
                    lab: "ECE-305",
                    badge: "SERIALIZED",
                  },
                  {
                    code: "EMB-ESP-021",
                    name: "ESP32-S3 DevKitC-1 Dual-Core",
                    lab: "ECE-204",
                    badge: "BULK STOCK",
                  },
                  {
                    code: "RAE-LID-004",
                    name: "RPLIDAR A1M8 360° Laser Scanner",
                    lab: "RAE-108",
                    badge: "QR TRACKED",
                  },
                  {
                    code: "INS-DMM-001",
                    name: "Fluke 115 True-RMS Multimeter",
                    lab: "ECE-101",
                    badge: "ASSET ID",
                  },
                ].map((item) => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between border-2 border-slate-900 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] font-black text-sky-700">
                        {item.code} // {item.lab}
                      </span>
                      <span className="block truncate text-xs font-extrabold text-slate-900">
                        {item.name}
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 border border-slate-900 bg-white px-2 py-0.5 font-mono text-[9px] font-black text-slate-900">
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t-2 border-slate-900 pt-3 font-mono text-[10px] font-bold text-slate-600">
                <div>
                  <span className="block text-slate-400">LOCKING</span>
                  <span className="text-slate-900">FOR UPDATE</span>
                </div>
                <div>
                  <span className="block text-slate-400">EXPORTS</span>
                  <span className="text-slate-900">CSV + PDF</span>
                </div>
                <div>
                  <span className="block text-slate-400">ALERTS</span>
                  <span className="text-slate-900">REALTIME</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Spec Marquee Ticker */}
      <div className="overflow-hidden border-y-2 border-slate-900 bg-slate-950 py-2.5 text-white">
        <div className="animate-ticker flex items-center gap-8 font-mono text-xs font-black tracking-widest uppercase">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
            <span key={idx} className="flex items-center gap-3 whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Live Component Discovery Section */}
      <section id="discovery" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div>
            <MonoLabel>LIVE CATALOG DISCOVERY</MonoLabel>
            <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
              Lab Equipment &amp; Component Inventory
            </h2>
          </div>
          <Link href="/catalog">
            <ActionButton variant="secondary" size="sm">
              Open Full Searchable Catalog
              <ArrowRight className="h-3.5 w-3.5" />
            </ActionButton>
          </Link>
        </div>

        {stats.featuredComponents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.featuredComponents.map((c) => (
              <BrutalCard key={c.id} className="flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <MonoLabel>{c.sku}</MonoLabel>
                    <StatusBadge status={c.status} />
                  </div>
                  <h3 className="mt-2 text-base font-black text-slate-950">{c.name}</h3>
                  <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                    {c.laboratories?.name ?? "Laboratory"} · {c.storage_location}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t-2 border-slate-200 pt-3">
                  <span className="font-mono text-xs font-black text-slate-900">
                    {c.available_quantity} / {c.total_quantity} AVAILABLE
                  </span>
                  <Link
                    href={`/login`}
                    className="font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
                  >
                    Request →
                  </Link>
                </div>
              </BrutalCard>
            ))}
          </div>
        ) : (
          <BrutalCard className="p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <MonoLabel>DATABASE READY FOR CONNECTION</MonoLabel>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Run the included SQL migrations to populate 12+ seeded engineering components
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Once your Supabase project URL and keys are added to <code>.env.local</code>, this
                  section streams live availability directly from PostgreSQL.
                </p>
              </div>
              <Link href="/setup">
                <ActionButton variant="primary" size="sm">
                  Open Setup Checklist
                </ActionButton>
              </Link>
            </div>
          </BrutalCard>
        )}
      </section>

      {/* How It Works */}
      <section id="workflow" className="border-y-2 border-slate-900 bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10">
            <MonoLabel>OPERATIONAL LIFECYCLE</MonoLabel>
            <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
              How Borrowing &amp; Lab Access Works
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((w) => (
              <BrutalCard key={w.step} className="p-5">
                <span className="inline-block bg-slate-900 px-2.5 py-1 font-mono text-xs font-black text-white">
                  STEP {w.step}
                </span>
                <h3 className="mt-4 text-base font-black text-slate-950">{w.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{w.desc}</p>
              </BrutalCard>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8">
          <MonoLabel>HARDWARE TAXONOMY</MonoLabel>
          <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Supported Equipment Categories
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <BrutalCard key={cat.code} className="p-5">
                <div className="flex items-center justify-between">
                  <MonoLabel>{cat.code}</MonoLabel>
                  <div className="flex h-9 w-9 items-center justify-center border-2 border-slate-900 bg-sky-50 text-sky-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-3 text-base font-black text-slate-950">{cat.name}</h3>
                <p className="mt-1 text-xs text-slate-600">{cat.examples}</p>
              </BrutalCard>
            );
          })}
        </div>
      </section>

      {/* Benefits for Students & Faculty */}
      <section className="border-y-2 border-slate-900 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <BrutalCard className="p-6">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-sky-700" />
              <MonoLabel>FOR STUDENTS &amp; PROJECT TEAMS</MonoLabel>
            </div>
            <h3 className="font-display mt-2 text-xl font-black uppercase">
              Build faster without lab bottlenecks
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {[
                "Real-time stock counts, pinout specs, and datasheets before walking to the lab",
                "Project team spaces with shared loan visibility and duplicate-request guards",
                "Self-service loan extension requests and instant status notifications",
                "Capacity-checked laboratory seat & workbench reservations",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </BrutalCard>

          <BrutalCard className="p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-sky-700" />
              <MonoLabel>FOR STAFF &amp; ADMINISTRATORS</MonoLabel>
            </div>
            <h3 className="font-display mt-2 text-xl font-black uppercase">
              Zero spreadsheet drift, full auditability
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {[
                "Scoped lab permissions—staff only manage laboratories assigned to them",
                "Partial returns, damage photo uploads, and automatic maintenance blocking",
                "QR code label generation, CSV bulk stock import, and CSV/PDF audit exports",
                "Configurable institutional limits, grace periods, and immutable audit logs",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </BrutalCard>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <MonoLabel>TECHNICAL &amp; POLICY QUESTIONS</MonoLabel>
          <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="shadow-brutal-2 border-2 border-slate-900 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-black text-slate-950">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t-2 border-slate-200 px-5 py-3.5 text-xs leading-relaxed text-slate-600">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-3 border-slate-900 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4 text-sky-700" />
            <span className="font-mono text-xs font-bold text-slate-700 uppercase">
              SMARTLAB // INSTITUTIONAL COMPONENT LENDING &amp; LAB MANAGEMENT
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-bold uppercase">
            <Link href="/setup" className="text-slate-600 hover:text-sky-700">
              Setup Guide
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-sky-700">
              Sign In
            </Link>
            <Link href="/register" className="text-sky-700 hover:underline">
              Create Account →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
