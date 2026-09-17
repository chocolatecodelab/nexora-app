"use client";

import React, { useState } from "react";
import {
  FileEdit,
  FilePlus,
  ListOrdered,
  Check,
  X,
  Loader2,
  Code,
  Cpu,
  AlertCircle,
  Clock,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { ImplementationPlan, Task } from "@/types";

interface ImplementationPlanCardProps {
  task: Task;
  onApprove: (taskId: string) => Promise<void>;
  onReject: (taskId: string, feedback: string) => Promise<void>;
}

export function ImplementationPlanCard({
  task,
  onApprove,
  onReject,
}: ImplementationPlanCardProps) {
  const [feedbackText, setFeedbackText] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const plan: ImplementationPlan | undefined = task.plan_json || undefined;
  const isAwaitingApproval = task.status === "awaiting_approval";
  const isPlanning = ["queued", "analyzing_issue", "analyzing_repo", "planning"].includes(task.status);
  const isCancelled = task.status === "cancelled";
  const isFailed = task.status === "failed";

  const handleApprove = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onApprove(task.id);
    } catch (err: any) {
      console.error("Failed to approve plan:", err);
      setActionError(err instanceof Error ? err.message : "Gagal menyetujui plan. Pastikan koneksi backend aktif.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onReject(task.id, feedbackText.trim());
      setShowRejectInput(false);
      setFeedbackText("");
    } catch (err: any) {
      console.error("Failed to reject plan:", err);
      setActionError(err instanceof Error ? err.message : "Gagal mengirimkan revisi plan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading Skeleton when plan is being generated
  if (!plan) {
    if (isPlanning) {
      return (
        <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-6 space-y-5 animate-pulse">
          <div className="flex items-center justify-between pb-3 border-b border-[#2B2F3D]">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-[#E3A73B] animate-pulse" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#E3A73B]">
                  {task.status === "analyzing_issue" && "Phase 1: Analyzing Issue Requirements..."}
                  {task.status === "analyzing_repo" && "Phase 2: Inspecting Repository Structure..."}
                  {task.status === "planning" && "Phase 3: Formulating Structured Plan (Gemini 3.5)..."}
                  {task.status === "queued" && "Queued: Initializing Agent..."}
                </span>
                <h3 className="text-sm font-semibold text-[#E7E9F2] mt-0.5">
                  Analyzing code context & generating actionable implementation plan
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2E260F] text-[#E3A73B] text-[11px] font-mono border border-[#E3A73B]/30">
              <Clock className="w-3 h-3 animate-spin" />
              <span>In Progress</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-4 bg-[#12141C] rounded w-3/4" />
            <div className="h-3 bg-[#12141C] rounded w-1/2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D] space-y-2">
              <div className="h-3 bg-[#242838] rounded w-1/3" />
              <div className="h-6 bg-[#242838]/60 rounded" />
            </div>
            <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D] space-y-2">
              <div className="h-3 bg-[#242838] rounded w-1/3" />
              <div className="h-6 bg-[#242838]/60 rounded" />
            </div>
          </div>

          <div className="p-3 bg-[#12141C]/60 rounded-lg border border-[#2B2F3D] text-xs font-mono text-[#8D91A6] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4CB782]" />
            <span>Human Approval Gate will activate here once the plan is formulated.</span>
          </div>
        </div>
      );
    }

    if (isCancelled) {
      return (
        <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-6 space-y-3 text-center">
          <Ban className="w-8 h-8 text-[#8D91A6] mx-auto opacity-70" />
          <h3 className="text-sm font-semibold text-[#E7E9F2]">Task Execution Cancelled</h3>
          <p className="text-xs text-[#8D91A6]">
            This agent run was cancelled by user. Click <strong>Restart</strong> above to run this task again.
          </p>
        </div>
      );
    }

    if (isFailed) {
      return (
        <div className="bg-[#1A1D28] rounded-[10px] border border-[#E0594A]/40 p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#E0594A]">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-sm font-bold">Planning Phase Failed</h3>
          </div>
          <p className="text-xs text-[#8D91A6]">
            {task.error_message || "An unexpected error occurred during plan generation."}
          </p>
        </div>
      );
    }

    return null;
  }

  // 3-segment risk indicator (Section 3.4)
  const renderRiskBar = () => {
    const risk = plan.risk || "medium";
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-[#8D91A6] uppercase tracking-wider">
          Risk:
        </span>
        <div className="flex items-center gap-1">
          <div
            className={`w-3.5 h-2 rounded-[2px] ${risk === "low"
              ? "bg-[#4CB782]"
              : risk === "medium"
                ? "bg-[#E3A73B]"
                : "bg-[#E0594A]"
              }`}
          />
          <div
            className={`w-3.5 h-2 rounded-[2px] ${risk === "medium"
              ? "bg-[#E3A73B]"
              : risk === "high"
                ? "bg-[#E0594A]"
                : "bg-[#2B2F3D]"
              }`}
          />
          <div
            className={`w-3.5 h-2 rounded-[2px] ${risk === "high" ? "bg-[#E0594A]" : "bg-[#2B2F3D]"
              }`}
          />
        </div>
        <span
          className={`text-xs font-mono font-semibold lowercase ${risk === "low"
            ? "text-[#4CB782]"
            : risk === "medium"
              ? "text-[#E3A73B]"
              : "text-[#E0594A]"
            }`}
        >
          {risk}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Main Plan Card */}
      <div className={`bg-[#1A1D28] rounded-[10px] border p-5 space-y-5 transition ${isAwaitingApproval ? "border-[#E3A73B]/80 shadow-lg shadow-[#E3A73B]/5" : "border-[#2B2F3D]"
        }`}>
        {/* Header & Risk */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2F3D]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5E6275]">
                Implementation Plan
              </span>
              {isAwaitingApproval && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2E260F] text-[#E3A73B] border border-[#E3A73B]/40 animate-pulse">
                  Awaiting Your Decision
                </span>
              )}
              {["implementing", "testing", "debugging", "pr_creating"].includes(task.status) && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/40">
                  ✓ Plan Approved
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-[#E7E9F2] mt-0.5">
              {plan.summary}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {renderRiskBar()}
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="p-1.5 rounded bg-[#242838] hover:bg-[#2B2F3D] text-[#8D91A6] hover:text-[#E7E9F2] transition text-xs font-mono flex items-center gap-1 cursor-pointer"
              title="Toggle JSON view"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showRawJson ? (
          <pre className="p-4 rounded bg-[#12141C] border border-[#2B2F3D] text-[11px] font-mono text-[#4CB782] overflow-x-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        ) : (
          <>
            {/* Files List with Diff Rails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Files to Modify */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#8D91A6] mb-2">
                  <FileEdit className="w-3.5 h-3.5 text-[#E3A73B]" />
                  <span>Files to modify ({plan.files_to_modify.length})</span>
                </div>
                {plan.files_to_modify.length === 0 ? (
                  <p className="text-xs text-[#5E6275] italic">None</p>
                ) : (
                  <div className="space-y-1.5">
                    {plan.files_to_modify.map((f) => (
                      <div
                        key={f}
                        className="diff-rail-active pl-3 py-1.5 pr-2 bg-[#12141C] rounded-r-[6px] text-xs font-mono text-[#E7E9F2] border border-[#2B2F3D] border-l-0 truncate"
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Files to Create */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#8D91A6] mb-2">
                  <FilePlus className="w-3.5 h-3.5 text-[#4CB782]" />
                  <span>Files to create ({plan.files_to_create.length})</span>
                </div>
                {plan.files_to_create.length === 0 ? (
                  <p className="text-xs text-[#5E6275] italic">None</p>
                ) : (
                  <div className="space-y-1.5">
                    {plan.files_to_create.map((f) => (
                      <div
                        key={f}
                        className="diff-rail-add pl-3 py-1.5 pr-2 bg-[#12141C] rounded-r-[6px] text-xs font-mono text-[#E7E9F2] border border-[#2B2F3D] border-l-0 truncate"
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Implementation Steps */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#8D91A6] mb-2.5">
                <ListOrdered className="w-3.5 h-3.5 text-[#6C9BFF]" />
                <span>Steps ({plan.steps.length})</span>
              </div>
              <ol className="space-y-2">
                {plan.steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="diff-rail-neutral pl-3 py-2 pr-3 bg-[#12141C] rounded-r-[6px] text-xs text-[#E7E9F2] border border-[#2B2F3D] border-l-0 flex items-start gap-2.5 leading-relaxed"
                  >
                    <span className="font-mono text-[#8D91A6] text-[11px] shrink-0">
                      {idx + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>

      {/* Human Approval Gate (Section 3.5 — Loudest Element) */}
      {isAwaitingApproval && (
        <div className="p-5 bg-[#242838] border-2 border-[#E3A73B] rounded-[10px] shadow-modal space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#E3A73B]">
                Human Decision Required
              </span>
              <h4 className="text-sm font-bold text-[#E7E9F2] mt-0.5">
                Review this implementation plan before the Coding Agent writes any code.
              </h4>
            </div>
          </div>

          {/* Action error banner */}
          {actionError && (
            <div className="p-3 bg-[#2E1D1B] border border-[#E0594A]/50 rounded-[8px] text-xs text-[#E0594A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* In-place feedback textarea when Reject is clicked */}
          {showRejectInput && (
            <div className="space-y-2 pt-2 border-t border-[#3A3F52]">
              <label htmlFor="plan-revision-feedback" className="block text-xs font-medium text-[#E0594A]">
                Apa yang perlu diubah dari plan ini?
              </label>
              <textarea
                id="plan-revision-feedback"
                rows={3}
                placeholder="Misal: Gunakan helper auth yang sudah ada di src/utils/auth.ts daripada membuat file baru..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full bg-[#12141C] border border-[#E0594A]/60 rounded-[8px] p-3 text-xs text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#E0594A]"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-1.5 rounded-[8px] text-xs text-[#8D91A6] hover:text-[#E7E9F2] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!feedbackText.trim() || isSubmitting}
                  className="px-4 py-1.5 rounded-[8px] bg-[#E0594A] hover:bg-[#E0594A]/90 text-[#12141C] font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Kirim Revisi Plan</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Action Buttons (Section 3.5) */}
          {!showRejectInput && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-[8px] border border-[#E0594A] text-[#E0594A] hover:bg-[#2E1D1B] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span> Reject & give feedback</span>
              </button>

              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-[8px] bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-[#4CB782]/10 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#12141C]" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3] text-[#12141C]" />
                )}
                <span> Approve plan</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
