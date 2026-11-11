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
    image_urls?: string[];
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
    title: "Check Lab Stock",
    desc: "Filter components across department labs by real-time availability, specs, and asset tags.",
  },
  {
    step: "02",
    title: "Request Components",
    desc: "Pick the components and quantities needed for your project and select a return date.",
  },
  {
    step: "03",
    title: "Staff Approval & Pickup",
    desc: "Lab staff review your request and check out equipment at the counter using QR asset tags.",
  },
  {
    step: "04",
    title: "Inspect & Return",
    desc: "Staff verify returned items by condition and log any damaged or missing units for repair.",
  },
];

const FAQS = [
  {
    q: "Who can borrow hardware through SmartLab?",
    a: "Registered PSG iTech students and project teams. Faculty and lab staff accounts are created by the administrator.",
  },
  {
    q: "How does SmartLab prevent double-booking?",
    a: "Available stock and lab seat counts are updated on approval and checkout so two users cannot claim the same unit.",
  },
  {
    q: "What happens if equipment is returned damaged or missing?",
    a: "Staff record damaged or missing quantities during return inspection, opening a maintenance ticket and holding faulty units from checkout.",
  },
  {
    q: "Can student project teams share equipment lists?",
    a: "Yes. Teams share an invite code so members can view borrowed parts and avoid duplicate requests for the same project.",
  },
];

const TICKER_ITEMS = [
  "LIVE COMPONENT STOCK",
  "QR CHECKOUT & RETURN",
  "DEPARTMENT LAB ACCESS",
  "DUE DATE REMINDERS",
  "LAB SEAT BOOKINGS",
  "CSV & PDF REPORTS",
  "MAINTENANCE TRACKING",
];

export function LandingPage({ stats }: { stats: LandingStats }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-tech-grid text-slate-900">
      {/* Top Engineering Navigation */}
      <header className="sticky top-0 z-40 border-b-2 border-slate-900 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="shadow-brutal-2 flex h-10 w-10 shrink-0 items-center justify-center border-2 border-slate-900 bg-white p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/psgitech-crest.png"
                alt="PSG iTech Crest"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="font-display block text-sm font-bold tracking-tight text-slate-950 uppercase">
                PSG iTech <span className="text-sky-700">//</span> SmartLab
              </span>
              <span className="hidden font-mono text-[9px] font-black tracking-widest text-slate-700 uppercase sm:block">
                PSG Institute of Technology and Applied Research
              </span>
              <span className="block font-mono text-[9px] font-black tracking-widest text-sky-700 uppercase sm:hidden">
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
            <div className="mb-4 inline-block border-2 border-slate-900 bg-white px-3 py-2 shadow-brutal-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/psgitech-logo.webp"
                alt="PSG Institute of Technology and Applied Research"
                className="h-10 w-auto object-contain sm:h-12"
              />
            </div>

            <div className="mb-5 inline-flex items-center gap-2 border-2 border-slate-900 bg-white px-3 py-1 shadow-brutal-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <MonoLabel className="text-slate-900">
                PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH // SMARTLAB
              </MonoLabel>
            </div>

            <h1 className="font-display text-4xl leading-[1.03] font-black tracking-tight text-slate-950 uppercase sm:text-5xl lg:text-6xl">
              Lab Component Lending For{" "}
              <span className="text-sky-700">Engineering Labs.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed font-medium text-slate-600 sm:text-lg">
              Check live stock for microcontrollers, sensors, and test instruments, submit borrow
              requests for your projects, book lab benches, and track due dates across departments.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link href="/register">
                <ActionButton variant="primary" size="lg">
                  Create Student Account
                  <ArrowRight className="h-4 w-4" />
                </ActionButton>
              </Link>
              <Link href="/catalog">
                <ActionButton variant="secondary" size="lg">
                  Explore Component Catalog
                </ActionButton>
              </Link>
            </div>

            {/* Quick Inventory Summary */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "CATALOG ITEMS",
                  value: stats.configured ? String(stats.totalComponents) : "SQL Ready",
                },
                {
                  label: "AVAILABLE UNITS",
                  value: stats.configured ? String(stats.availableUnits) : "Live Sync",
                },
                {
                  label: "ACTIVE LABS",
                  value: stats.configured ? String(stats.totalLabs) : "Multi-Lab",
                },
                {
                  label: "DEPARTMENTS",
                  value: stats.configured ? String(stats.totalDepartments) : "All Depts",
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

          {/* Lab Equipment Snapshot */}
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
                    LIVE LAB INVENTORY
                  </span>
                </div>
                <span className="bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                  ONLINE
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
                  <span className="block text-slate-400">CHECKOUT</span>
                  <span className="text-slate-900">QR SCAN</span>
                </div>
                <div>
                  <span className="block text-slate-400">REPORTS</span>
                  <span className="text-slate-900">CSV + PDF</span>
                </div>
                <div>
                  <span className="block text-slate-400">ALERTS</span>
                  <span className="text-slate-900">EMAIL + IN-APP</span>
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
                  {c.image_urls && c.image_urls[0] && (
                    <div className="mt-3 overflow-hidden border-2 border-slate-900 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_urls[0]}
                        alt={c.name}
                        className="h-36 w-full object-contain p-1.5"
                      />
                    </div>
                  )}
                  <h3 className="mt-2.5 text-base font-black text-slate-950">{c.name}</h3>
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
            <MonoLabel>HOW IT WORKS</MonoLabel>
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
          <MonoLabel>EQUIPMENT CATEGORIES</MonoLabel>
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
              Find parts and book benches easily
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {[
                "Check live stock, specs, and datasheets before walking to the lab",
                "Project team spaces so members can share borrowed equipment lists",
                "Request loan extensions and see due date updates in one place",
                "Book lab seats and workbenches with real-time slot availability",
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
              Keep lab loans and inventory organized
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {[
                "Lab-scoped access so staff manage only their assigned laboratories",
                "Log partial returns, damaged items, and repair tickets cleanly",
                "Print QR code labels, import CSV stock lists, and export CSV/PDF reports",
                "Set borrow duration limits, stock alerts, and review activity history",
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
          <MonoLabel>COMMON QUESTIONS</MonoLabel>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/psgitech-crest.png"
              alt="PSG iTech Crest"
              className="h-7 w-7 border border-slate-900 bg-white object-contain p-0.5"
            />
            <span className="font-mono text-xs font-bold text-slate-700 uppercase">
              PSG ITECH SMARTLAB // PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-bold uppercase">
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
