"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StudentRegisterCard } from "@/components/auth/student-register-card";

export default function RegisterPage() {
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
            Sign In →
          </Link>
        </div>

        <StudentRegisterCard headingAs="h1" />
      </div>
    </div>
  );
}
