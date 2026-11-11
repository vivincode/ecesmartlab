"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev.slice(-3), { id, message, variant }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto shadow-brutal-3 flex items-start gap-2.5 border-2 border-slate-900 px-3.5 py-2.5 text-xs font-bold ${
                item.variant === "success"
                  ? "bg-emerald-50 text-emerald-950"
                  : item.variant === "error"
                    ? "bg-rose-50 text-rose-950"
                    : "bg-white text-slate-900"
              }`}
            >
              {item.variant === "success" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              )}
              {item.variant === "error" && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
              )}
              {item.variant === "info" && (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              )}
              <span className="flex-1 leading-snug">{item.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
