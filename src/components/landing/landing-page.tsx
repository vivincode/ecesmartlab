"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Cpu,
  Layers,
  Radio,
  Wrench,
  Zap,
} from "lucide-react";
import { ActionButton, BrutalCard, MonoLabel, StatusBadge } from "@/components/ui/primitives";
import { StudentRegisterCard } from "@/components/auth/student-register-card";

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
  departments: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

const CATEGORIES = [
  {
    code: "CAT-01",
    name: "Microcontrollers & SBCs",
    examples: "Arduino Uno, ESP32-S3, Raspberry Pi 5",
    icon: Cpu,
  },
  {
    code: "CAT-02",
    name: "Sensors & Modules",
    examples: "RPLIDAR A1M8, BNO055 9-DOF IMU",
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
    examples: "Resistor Kits, 830-Point Breadboards",
    icon: Layers,
  },
  {
    code: "CAT-05",
    name: "Actuators & Motion",
    examples: "MG996R High-Torque Metal Gear Servos",
    icon: Zap,
  },
  {
    code: "CAT-06",
    name: "Soldering & Bench Tools",
    examples: "Hakko FX-888D Soldering Stations",
    icon: Wrench,
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Check Availability",
    desc: "Browse components by laboratory, category, and stock count.",
  },
  {
    step: "02",
    title: "Submit Request",
    desc: "Select components, quantities, and your return date.",
  },
  {
    step: "03",
    title: "Approval & Pickup",
    desc: "Receive email confirmation once approved and collect at the lab counter.",
  },
  {
    step: "04",
    title: "Return Inspection",
    desc: "Lab staff check returned items and close your loan.",
  },
];

const FAQS = [
  {
    q: "Who can register for SmartLab?",
    a: "PSG iTech students can register using the form above and verify their email to borrow equipment.",
  },
  {
    q: "How do I receive confirmation for my borrow request?",
    a: "You receive an email receipt with the approved components and due date as soon as lab staff approve your request.",
  },
  {
    q: "Can student teams share equipment?",
    a: "Yes. After signing in, create or join a project team to coordinate component loans.",
  },
  {
    q: "What if an item is returned damaged?",
    a: "Staff log damaged units during return inspection so repairs can be scheduled before reissue.",
  },
];

export function LandingPage({ stats }: { stats: LandingStats }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-tech-grid text-slate-900">
      {/* Top Navigation */}
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
                PSG iTech SmartLab
              </span>
              <span className="hidden font-mono text-[9px] font-black tracking-widest text-slate-600 uppercase sm:block">
                PSG Institute of Technology and Applied Research
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 font-mono text-xs font-bold tracking-wider text-slate-700 uppercase md:flex">
            <a href="#register" className="hover:text-sky-700">
              Register
            </a>
            <a href="#discovery" className="hover:text-sky-700">
              Catalog
            </a>
            <a href="#workflow" className="hover:text-sky-700">
              Process
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
            <Link href="/catalog">
              <ActionButton variant="primary" size="sm">
                Catalog
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
                SUPABASE NOT CONFIGURED — Add credentials in <code>.env.local</code>.
              </span>
            </div>
            <Link href="/setup" className="underline hover:text-sky-700">
              Setup Guide →
            </Link>
          </div>
        </div>
      )}

      {/* Centered Registration Hero */}
      <section id="register" className="mx-auto max-w-5xl px-4 pt-10 pb-14 sm:px-6 lg:pt-14 lg:pb-18">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="text-center"
        >
          <div className="mx-auto mb-5 inline-block border-2 border-slate-900 bg-white px-3.5 py-2 shadow-brutal-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/psgitech-logo.webp"
              alt="PSG Institute of Technology and Applied Research"
              className="h-10 w-auto object-contain sm:h-12"
            />
          </div>

          <h1 className="font-display text-3xl leading-tight font-black tracking-tight text-slate-950 uppercase sm:text-4xl lg:text-5xl">
            Engineering Lab Equipment &amp;{" "}
            <span className="text-sky-700">Checkout Portal</span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-600 sm:text-base">
            Create your student account to borrow components, reserve lab benches, and track returns.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.06 }}
          className="mx-auto mt-8 w-full max-w-lg"
        >
          <StudentRegisterCard
            initialDepartments={stats.departments}
            initialConfigured={stats.configured}
            headingAs="h2"
          />
        </motion.div>

        {/* Live Lab Stats Strip */}
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "CATALOG ITEMS",
              value: stats.configured ? String(stats.totalComponents) : "—",
            },
            {
              label: "UNITS AVAILABLE",
              value: stats.configured ? String(stats.availableUnits) : "—",
            },
            {
              label: "ACTIVE LABS",
              value: stats.configured ? String(stats.totalLabs) : "—",
            },
            {
              label: "DEPARTMENTS",
              value: stats.configured ? String(stats.totalDepartments) : "—",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="shadow-brutal-2 border-2 border-slate-900 bg-white px-4 py-3 text-center"
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
      </section>

      {/* Equipment Catalog Preview */}
      <section id="discovery" className="border-t-2 border-slate-900 bg-white/80">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <MonoLabel>AVAILABLE EQUIPMENT</MonoLabel>
              <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
                Lab Component Catalog
              </h2>
            </div>
            <Link href="/catalog">
              <ActionButton variant="secondary" size="sm">
                View Full Catalog
                <ArrowRight className="h-3.5 w-3.5" />
              </ActionButton>
            </Link>
          </div>

          {stats.featuredComponents.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.featuredComponents.map((c) => (
                <BrutalCard key={c.id} className="flex flex-col justify-between bg-white p-4">
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
                          className="h-40 w-full object-contain p-2"
                        />
                      </div>
                    )}
                    <h3 className="mt-3 text-base font-black text-slate-950">{c.name}</h3>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                      {c.laboratories?.name ?? "Laboratory"} · {c.storage_location}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t-2 border-slate-200 pt-3">
                    <span className="font-mono text-xs font-black text-slate-900">
                      {c.available_quantity} / {c.total_quantity} AVAILABLE
                    </span>
                    <Link
                      href="/login"
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
              <p className="text-sm font-medium text-slate-600">
                Sign in or browse the catalog once the database is connected to view live component
                availability.
              </p>
            </BrutalCard>
          )}
        </div>
      </section>

      {/* Process */}
      <section id="workflow" className="border-y-2 border-slate-900 bg-slate-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8">
            <MonoLabel>HOW IT WORKS</MonoLabel>
            <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
              Borrowing &amp; Checkout Process
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((w) => (
              <BrutalCard key={w.step} className="p-5">
                <span className="inline-block bg-slate-900 px-2.5 py-1 font-mono text-xs font-black text-white">
                  {w.step}
                </span>
                <h3 className="mt-3 text-base font-black text-slate-950">{w.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{w.desc}</p>
              </BrutalCard>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8">
          <MonoLabel>CATEGORIES</MonoLabel>
          <h2 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Supported Equipment
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

      {/* FAQ */}
      <section id="faq" className="border-t-2 border-slate-900 bg-white/80 py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <MonoLabel>FAQ</MonoLabel>
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
              PSG Institute of Technology and Applied Research — SmartLab
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-bold uppercase">
            <Link href="/catalog" className="text-slate-600 hover:text-sky-700">
              Catalog
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-sky-700">
              Sign In
            </Link>
            <Link href="/register" className="text-sky-700 hover:underline">
              Register →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
