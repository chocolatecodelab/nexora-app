"use client";

import React, { useState } from "react";
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  FileEdit,
  FilePlus,
  ListOrdered,
  AlertTriangle,
  Loader2,
  Code,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { ImplementationPlan, Task } from "@/types";

interface PlanReviewModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (taskId: string) => Promise<void>;
  onReject: (taskId: string, feedback: string) => Promise<void>;
}

export function PlanReviewModal({
  task,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: PlanReviewModalProps) {
  const [feedback, setFeedback] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !task.plan_json) return null;

  const plan: ImplementationPlan = task.plan_json;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(task.id);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) return;
    setIsProcessing(true);
    try {
      await onReject(task.id, feedback.trim());
      setShowRejectInput(false);
      setFeedback("");
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass-panel-glow max-w-2xl w-full rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#E3A73B]/10 text-[#E3A73B] border border-[#E3A73B]/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Human Approval Gate</h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    plan.risk === "high"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : plan.risk === "medium"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {plan.risk} Risk Assessment
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Review proposed changes before Coding Agent modifies any files
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 transition"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showRawJson ? "Visual View" : "Raw JSON"}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {showRawJson ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
              <pre>{JSON.stringify(plan, null, 2)}</pre>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Executive Summary
                </h4>
                <p className="text-sm text-slate-100 leading-relaxed">{plan.summary}</p>
              </div>

              {/* Files to Modify & Create */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Files to Modify */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-2">
                    <FileEdit className="w-4 h-4" />
                    <span>Files to Modify ({plan.files_to_modify.length})</span>
                  </div>
                  {plan.files_to_modify.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">None</p>
                  ) : (
                    <ul className="space-y-1">
                      {plan.files_to_modify.map((f) => (
                        <li
                          key={f}
                          className="text-xs font-mono text-slate-300 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/60 truncate"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Files to Create */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-2">
                    <FilePlus className="w-4 h-4" />
                    <span>Files to Create ({plan.files_to_create.length})</span>
                  </div>
                  {plan.files_to_create.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">None</p>
                  ) : (
                    <ul className="space-y-1">
                      {plan.files_to_create.map((f) => (
                        <li
                          key={f}
                          className="text-xs font-mono text-slate-300 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/60 truncate"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Steps Checklist */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 mb-3">
                  <ListOrdered className="w-4 h-4" />
                  <span>Implementation Steps ({plan.steps.length})</span>
                </div>
                <ol className="space-y-2">
                  {plan.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Feedback Input on Reject */}
              {showRejectInput && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 animate-in fade-in duration-150">
                  <label className="block text-xs font-semibold text-rose-300 mb-1.5">
                    Provide Feedback for Plan Revision:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please use the existing auth utility instead of creating a new helper file..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={!feedback.trim() || isProcessing}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Submit Revision</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {!showRejectInput && (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject & Request Changes</span>
              </button>
            )}

            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Approve & Start Coding</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
