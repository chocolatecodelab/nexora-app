"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
  durationMs?: number;
}

export function Toast({ toast, onClose, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onClose, durationMs]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div
        className={`p-3.5 rounded-[10px] border shadow-xl flex items-start gap-3 backdrop-blur-md ${
          isSuccess
            ? "bg-[#1B2B23]/95 border-[#4CB782]/40 text-[#4CB782]"
            : isError
            ? "bg-[#2E181B]/95 border-[#E0594A]/40 text-[#E0594A]"
            : "bg-[#1A2338]/95 border-[#6C9BFF]/40 text-[#6C9BFF]"
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#4CB782]" />}
          {isError && <AlertCircle className="w-4 h-4 text-[#E0594A]" />}
          {!isSuccess && !isError && <Info className="w-4 h-4 text-[#6C9BFF]" />}
        </div>

        <div className="flex-1 text-xs font-mono font-medium leading-relaxed text-[#E7E9F2]">
          {toast.message}
        </div>

        <button
          onClick={onClose}
          aria-label="Tutup notifikasi"
          className="shrink-0 p-1 rounded hover:bg-black/20 text-[#8D91A6] hover:text-[#E7E9F2] transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
