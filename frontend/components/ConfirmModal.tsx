"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        className="bg-[#1A1D28] border border-[#2B2F3D] rounded-xl w-full max-w-md overflow-hidden shadow-2xl space-y-0"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#2B2F3D] flex items-center justify-between bg-[#12141C]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                isDestructive
                  ? "bg-[#2E181B] border-[#E0594A]/40 text-[#E0594A]"
                  : "bg-[#2E260F] border-[#E3A73B]/40 text-[#E3A73B]"
              }`}
            >
              {isDestructive ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <h3 id="confirm-modal-title" className="font-heading text-sm font-bold text-[#E7E9F2]">
              {title}
            </h3>
          </div>

          <button
            onClick={onCancel}
            aria-label="Tutup dialog konfirmasi"
            className="p-1.5 rounded-lg text-[#8D91A6] hover:text-[#E7E9F2] hover:bg-[#242838] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          <p id="confirm-modal-description" className="text-xs text-[#B5B9CC] leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#2B2F3D] bg-[#12141C]/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#242838] hover:bg-[#2F3447] text-xs font-semibold text-[#8D91A6] hover:text-[#E7E9F2] transition cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm ${
              isDestructive
                ? "bg-[#E0594A] hover:bg-[#c94d3f] text-[#12141C]"
                : "bg-[#4CB782] hover:bg-[#3ea070] text-[#12141C]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
