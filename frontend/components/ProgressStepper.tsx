"use client";

import React from "react";
import { Check, Ban, AlertCircle } from "lucide-react";
import { TaskStatus } from "@/types";

interface ProgressStepperProps {
  status: TaskStatus;
  iteration?: number;
  maxIterations?: number;
}

interface StepNode {
  key: string;
  label: string;
  statuses: TaskStatus[];
}

const STEPPER_NODES: StepNode[] = [
  {
    key: "analyzing",
    label: "Analyzing",
    statuses: ["analyzing_issue", "analyzing_repo"],
  },
  {
    key: "planning",
    label: "Planning",
    statuses: ["planning"],
  },
  {
    key: "approval",
    label: "Approval",
    statuses: ["awaiting_approval"],
  },
  {
    key: "implementing",
    label: "Implementing",
    statuses: ["implementing"],
  },
  {
    key: "testing",
    label: "Testing",
    statuses: ["testing", "debugging"],
  },
  {
    key: "pr",
    label: "PR",
    statuses: ["pr_creating"],
  },
  {
    key: "review",
    label: "Review",
    statuses: ["pr_created", "merged", "pr_closed"],
  },
];

const ORDERED_FLOW: TaskStatus[] = [
  "queued",
  "analyzing_issue",
  "analyzing_repo",
  "planning",
  "awaiting_approval",
  "implementing",
  "testing",
  "debugging",
  "pr_creating",
  "pr_created",
  "merged",
];

function getStatusDescription(status: TaskStatus, iteration?: number): string {
  switch (status) {
    case "queued":
      return "Task queued in Nexora agent runner...";
    case "analyzing_issue":
      return "Analyzing issue context, requirements, and scope...";
    case "analyzing_repo":
      return "Inspecting connected repository file tree and configurations...";
    case "planning":
      return "Planner formulating step-by-step resolution plan...";
    case "awaiting_approval":
      return "Implementation plan ready — awaiting your review & approval.";
    case "implementing":
      return "Coding agent generating atomic code modifications...";
    case "testing":
      return `Executing sandbox verification & test runner (Iteration ${iteration || 1}/3)...`;
    case "debugging":
      return `Debugging failure patterns & self-correcting (Iteration ${iteration || 1}/3)...`;
    case "pr_creating":
      return "Creating branch, committing & pushing changes, opening PR/MR...";
    case "pr_created":
      return "Pull Request published on remote Git provider! Ready for human code review & merge.";
    case "merged":
      return "Pull Request merged into target branch successfully! Task completed.";
    case "pr_closed":
      return "Pull Request closed / discarded.";
    case "failed":
      return "Task failed execution guardrails.";
    case "cancelled":
      return "Task was stopped by user.";
    default:
      return "Processing...";
  }
}

export function ProgressStepper({ status, iteration }: ProgressStepperProps) {
  const isCancelled = status === "cancelled";
  const isFailed = status === "failed" || status === "needs_human_help";
  const currentIndex = ORDERED_FLOW.indexOf(status);
  const statusDesc = getStatusDescription(status, iteration);

  return (
    <div className="w-full py-3 px-4 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] space-y-2.5">
      <div className="flex items-center justify-between relative">
        {STEPPER_NODES.map((node, index) => {
          const isCurrent = node.statuses.includes(status);
          const highestNodeStatusIdx = Math.max(
            ...node.statuses.map((s) => ORDERED_FLOW.indexOf(s)),
            -1
          );
          const isPassed = !isCancelled && highestNodeStatusIdx !== -1 && currentIndex > highestNodeStatusIdx;

          return (
            <React.Fragment key={node.key}>
              {/* Step Node */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                    isCancelled
                      ? "bg-[#12141C] border-[#5E6275] text-[#5E6275]"
                      : isPassed
                      ? "bg-[#1B2B23] border-[#4CB782] text-[#4CB782]"
                      : isCurrent
                      ? "bg-[#2E260F] border-[#E3A73B] text-[#E3A73B]"
                      : "bg-[#12141C] border-[#3A3F52] text-[#5E6275]"
                  }`}
                >
                  {isCancelled && isCurrent ? (
                    <Ban className="w-3.5 h-3.5 text-[#E0594A]" />
                  ) : isFailed && isCurrent ? (
                    <AlertCircle className="w-3.5 h-3.5 text-[#E0594A]" />
                  ) : isPassed ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#E3A73B] animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5E6275]" />
                  )}
                </div>

                <span
                  className={`text-[11px] font-mono mt-1.5 transition-colors ${
                    isCancelled
                      ? "text-[#5E6275]"
                      : isPassed
                      ? "text-[#4CB782]"
                      : isCurrent
                      ? "text-[#E3A73B] font-bold"
                      : "text-[#5E6275]"
                  }`}
                >
                  {node.label}
                </span>
              </div>

              {/* Connecting line between nodes */}
              {index < STEPPER_NODES.length - 1 && (
                <div
                  className={`flex-1 h-[1px] -mt-5 mx-1 transition-colors ${
                    isPassed ? "bg-[#4CB782]/40" : "bg-[#2B2F3D]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Dynamic Sub-Step Live Activity Banner */}
      <div className="pt-1.5 border-t border-[#2B2F3D]/60 flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8D91A6] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6C9BFF] animate-ping" />
          <span className="text-[#6C9BFF] font-bold">Activity:</span>
          <span className="text-[#E7E9F2]">{statusDesc}</span>
        </span>
      </div>
    </div>
  );
}
