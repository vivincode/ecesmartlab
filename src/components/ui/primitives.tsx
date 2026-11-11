import React from "react";
import { cn, statusTone } from "@/lib/utils";

export function BrutalCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shadow-brutal-3 border-2 border-slate-900 bg-white",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MonoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-black tracking-wider text-sky-700 uppercase",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-black tracking-wide uppercase",
        statusTone(status),
        className
      )}
    >
      {status}
    </span>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-sky-700 border-2 border-slate-900 shadow-brutal-2 press",
    secondary: "bg-white text-slate-900 hover:bg-slate-50 border-2 border-slate-900 shadow-brutal-2 press",
    danger: "bg-rose-600 text-white hover:bg-rose-700 border-2 border-slate-900 shadow-brutal-2 press",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-2 border-transparent",
  };
  const sizes = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-4 py-2 text-xs",
    lg: "px-5 py-2.5 text-sm",
  };

  return (
    <button
      {...props}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 font-mono font-black tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-2 border-dashed border-slate-300 bg-slate-50/70 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-slate-900 bg-white shadow-brutal-2">
        {icon}
      </div>
      <h3 className="text-sm font-black tracking-wide text-slate-900 uppercase">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 w-full animate-pulse border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}
