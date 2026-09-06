"use client";

import React from "react";
import {
  Clock,
  Search,
  FileCode,
  FileCheck2,
  Cpu,
  TestTube,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Task, TaskStatus } from "@/types";

interface TaskPipelineProps {
  task: Task;
  onOpenPlanReview: () => void;
}

interface StepConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  matchingStatuses: TaskStatus[];
}

const PIPELINE_STEPS: StepConfig[] = [
  {
    key: "queued",
    label: "Queued",
    icon: Clock,
    matchingStatuses: ["queued"],
  },
  {
    key: "analyzing",
    label: "Analyzing Issue & Repo",
    icon: Search,
    matchingStatuses: ["analyzing_issue", "analyzing_repo"],
  },
  {
    key: "planning",
    label: "Planning Agent",
    icon: FileCode,
    matchingStatuses: ["planning"],
  },
  {
    key: "approval",
    label: "Human Approval Gate",
    icon: FileCheck2,
    matchingStatuses: ["awaiting_approval"],
  },
  {
    key: "implementing",
    label: "Coding Agent",
    icon: Cpu,
    matchingStatuses: ["implementing"],
  },
  {
    key: "testing",
    label: "Sandbox Test & Debug",
    icon: TestTube,
    matchingStatuses: ["testing", "debugging"],
  },
  {
    key: "pr_created",
    label: "Pull Request",
    icon: GitPullRequest,
    matchingStatuses: ["pr_creating", "pr_created"],
  },
];

const ORDERED_STATUSES: TaskStatus[] = [
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
];

export function TaskPipeline({ task, onOpenPlanReview }: TaskPipelineProps) {
  const currentStatusIndex = ORDERED_STATUSES.indexOf(task.status);
  const isFailed = task.status === "failed";
  const isNeedsHelp = task.status === "needs_human_help";
  const isAwaitingApproval = task.status === "awaiting_approval";
  const isPrCreated = task.status === "pr_created";

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Task #{task.issue_number}
            </span>
            <h3 className="text-base font-bold text-white truncate max-w-md">
              {task.issue_title}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Task ID: <code className="text-slate-300 font-mono text-[11px]">{task.id}</code>
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {isAwaitingApproval && (
            <button
              onClick={onOpenPlanReview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold shadow-lg shadow-amber-500/20 animate-pulse transition cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Review & Approve Plan</span>
            </button>
          )}

          {isPrCreated && task.pr_url && (
            <a
              href={task.pr_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition"
            >
              <GitPullRequest className="w-4 h-4" />
              <span>View Pull Request</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {isFailed && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">
              <XCircle className="w-4 h-4" />
              <span>Execution Failed</span>
            </div>
          )}

          {isNeedsHelp && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
              <span>Needs Human Intervention</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Pipeline Progression */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = step.matchingStatuses.includes(task.status);
          const isPassed =
            currentStatusIndex >
            Math.max(...step.matchingStatuses.map((s) => ORDERED_STATUSES.indexOf(s)));

          let cardStyle = "bg-slate-900/60 border-slate-800 text-slate-500";
          let iconStyle = "text-slate-500 bg-slate-800/50";

          if (isPassed) {
            cardStyle = "bg-slate-900/90 border-emerald-500/30 text-emerald-300";
            iconStyle = "text-emerald-400 bg-emerald-500/10";
          } else if (isCurrent) {
            if (isAwaitingApproval) {
              cardStyle = "bg-amber-950/40 border-amber-500/50 text-amber-200 ring-2 ring-amber-500/30 animate-pulse";
              iconStyle = "text-amber-400 bg-amber-500/20";
            } else if (isFailed) {
              cardStyle = "bg-rose-950/40 border-rose-500/50 text-rose-200 ring-2 ring-rose-500/30";
              iconStyle = "text-rose-400 bg-rose-500/20";
            } else {
              cardStyle = "bg-blue-950/40 border-blue-500/50 text-blue-200 ring-2 ring-blue-500/30";
              iconStyle = "text-blue-400 bg-blue-500/20";
            }
          }

          return (
            <div
              key={step.key}
              className={`p-3.5 rounded-xl border flex flex-col items-center text-center transition ${cardStyle}`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[10px] font-mono text-slate-500">0{idx + 1}</span>
                {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isCurrent && !isPassed && (
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                )}
              </div>

              <div className={`p-2.5 rounded-xl mb-2 ${iconStyle}`}>
                <Icon className="w-4 h-4" />
              </div>

              <span className="text-xs font-semibold leading-tight line-clamp-2">
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Plan Preview Banner when awaiting approval */}
      {task.plan_json && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#6C9BFF]/10 text-[#6C9BFF] border border-[#6C9BFF]/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white">Generated Implementation Plan</h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    task.plan_json.risk === "high"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : task.plan_json.risk === "medium"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {task.plan_json.risk} Risk
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                {task.plan_json.summary}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPlanReview}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
          >
            Inspect Plan
          </button>
        </div>
      )}

      {/* Error / Alert notification */}
      {task.error_message && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Note / Error: </span>
            <span>{task.error_message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
