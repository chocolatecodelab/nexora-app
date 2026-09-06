"use client";

import React, { useState } from "react";
import {
  Terminal,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Code,
  Layers,
  Sparkles,
} from "lucide-react";
import { AgentRun, ToolCall } from "@/types";

interface ToolLogViewerProps {
  runs: AgentRun[];
  toolCalls: Record<string, ToolCall[]>;
}

export function ToolLogViewer({ runs, toolCalls }: ToolLogViewerProps) {
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCalls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Aggregate total tokens and count
  const totalTokens = runs.reduce(
    (acc, r) => acc + (r.token_usage?.total || 0),
    0
  );

  const totalToolCalls = Object.values(toolCalls).reduce(
    (acc, list) => acc + list.length,
    0
  );

  return (
    <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] overflow-hidden">
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-[#12141C] border-b border-[#2B2F3D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#8D91A6]" />
          <span className="text-xs font-mono font-semibold text-[#E7E9F2]">
            Live Tool Log & Audit Trail
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[#8D91A6]">
          {totalTokens > 0 && (
            <span className="flex items-center gap-1 text-[#E3A73B]">
              <Coins className="w-3.5 h-3.5" />
              <span>{totalTokens.toLocaleString()} tokens</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-[#6C9BFF]">
            <Layers className="w-3.5 h-3.5" />
            <span>{totalToolCalls} tool invocations</span>
          </span>
          <span>{runs.length} phases</span>
        </div>
      </div>

      {/* Log Body */}
      {runs.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-[#5E6275] space-y-2">
          <Sparkles className="w-6 h-6 mx-auto text-[#5E6275] animate-pulse" />
          <p>No agent runs recorded yet. Logs will stream here during execution.</p>
        </div>
      ) : (
        <div className="p-3 space-y-4 max-h-[550px] overflow-y-auto">
          {runs.map((run) => {
            const calls = toolCalls[run.id] || [];
            const isRunning = run.status === "running";
            const runDuration = run.completed_at && run.started_at
              ? `${Math.max(1, Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000))}s`
              : isRunning
              ? "running..."
              : null;

            return (
              <div key={run.id} className="space-y-2 bg-[#12141C]/40 rounded-lg p-2.5 border border-[#2B2F3D]">
                {/* Run Phase Header */}
                <div className="flex items-center justify-between text-[11px] font-mono pb-2 border-b border-[#2B2F3D]/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#242838] text-[#E3A73B] border border-[#3A3F52]">
                      {run.agent_type}
                    </span>
                    <span className="text-[#5E6275]">
                      id: {run.id.slice(0, 8)}
                    </span>
                    {runDuration && (
                      <span className="text-[#8D91A6] flex items-center gap-1 text-[10px]">
                        <Clock className="w-2.5 h-2.5" /> {runDuration}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {run.token_usage?.total && (
                      <span className="text-[#E3A73B] text-[10px] flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" /> {run.token_usage.total} tok
                      </span>
                    )}

                    {run.status === "completed" ? (
                      <span className="text-[#4CB782] flex items-center gap-1 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> completed
                      </span>
                    ) : run.status === "running" ? (
                      <span className="text-[#E3A73B] flex items-center gap-1 font-semibold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E3A73B] animate-pulse" /> executing...
                      </span>
                    ) : (
                      <span className="text-[#E0594A] flex items-center gap-1 font-semibold text-[10px]">
                        <AlertCircle className="w-3 h-3" /> {run.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Individual Tool Calls Rows */}
                {calls.length === 0 ? (
                  <div className="px-3 py-1.5 text-[11px] font-mono text-[#5E6275] italic">
                    {isRunning ? "┃ Agent is analyzing and formulating response..." : "┃ No tool calls logged in this phase"}
                  </div>
                ) : (
                  <div className="space-y-1 pt-1">
                    {calls.map((tc) => {
                      const isSuccess = tc.status === "success";
                      const isExpanded = !!expandedCalls[tc.id];
                      const railClass = isSuccess ? "diff-rail-add" : "diff-rail-remove";
                      const timeStr = new Date(tc.created_at).toLocaleTimeString();

                      return (
                        <div key={tc.id} className="space-y-1">
                          <div
                            onClick={() => toggleExpand(tc.id)}
                            className={`${railClass} pl-2 py-1.5 pr-2 bg-[#12141C] hover:bg-[#1A1D28] rounded-r-[4px] border border-[#2B2F3D] border-l-0 text-[11px] font-mono flex items-center justify-between gap-3 cursor-pointer transition`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-[#8D91A6] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-[#8D91A6] shrink-0" />
                              )}
                              <span className="text-[#5E6275] shrink-0 text-[10px]">
                                {timeStr}
                              </span>
                              <span className="text-[#6C9BFF] font-semibold">
                                {tc.tool_name}
                              </span>
                              {tc.arguments && (
                                <span className="text-[#8D91A6] truncate text-[10px]">
                                  {JSON.stringify(tc.arguments).slice(0, 50)}...
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 text-[#5E6275]">
                              {tc.execution_ms && (
                                <span className="flex items-center gap-1 text-[10px]">
                                  <Clock className="w-2.5 h-2.5" />
                                  {tc.execution_ms}ms
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  isSuccess ? "text-[#4CB782]" : "text-[#E0594A]"
                                }`}
                              >
                                {isSuccess ? "✓" : "✕"}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Arguments & Result View */}
                          {isExpanded && (
                            <div className="ml-4 p-2.5 bg-[#0D0F17] rounded border border-[#2B2F3D] text-[10px] font-mono space-y-2 animate-in fade-in duration-150">
                              {tc.arguments && (
                                <div>
                                  <span className="text-[#8D91A6] uppercase font-bold text-[9px] block mb-0.5">
                                    Arguments
                                  </span>
                                  <pre className="text-[#6C9BFF] overflow-x-auto p-1.5 rounded bg-[#12141C]">
                                    {JSON.stringify(tc.arguments, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {tc.result && (
                                <div>
                                  <span className="text-[#8D91A6] uppercase font-bold text-[9px] block mb-0.5">
                                    Result
                                  </span>
                                  <pre className="text-[#4CB782] overflow-x-auto p-1.5 rounded bg-[#12141C]">
                                    {JSON.stringify(tc.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
