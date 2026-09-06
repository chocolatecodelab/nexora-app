"use client";

import React, { useState } from "react";
import {
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  ChevronDown,
  ChevronRight,
  Code2,
} from "lucide-react";
import { AgentRun, ToolCall } from "@/types";

interface ObservabilityLogsProps {
  runs: AgentRun[];
  toolCalls: Record<string, ToolCall[]>;
}

export function ObservabilityLogs({ runs, toolCalls }: ObservabilityLogsProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(
    runs[0]?.id || null
  );

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#6C9BFF]/10 text-[#6C9BFF] border border-[#6C9BFF]/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Observability & Audit Log</h3>
            <p className="text-xs text-slate-400">
              Transparent, measurable audit trail of every agent run & tool call
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">
            {runs.length} Agent Runs
          </span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
          <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No agent runs recorded yet.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Logs and tool calls will stream here when an agent is started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id;
            const calls = toolCalls[run.id] || [];

            return (
              <div
                key={run.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden transition"
              >
                {/* Run Header / Accordion Toggle */}
                <button
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-900/50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#6C9BFF] bg-[#6C9BFF]/10 px-2 py-0.5 rounded border border-[#6C9BFF]/20">
                        {run.agent_type}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        Run ID: <code className="text-slate-400 text-[11px]">{run.id.slice(0, 8)}...</code>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : run.status === "running" ? (
                      <span className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" /> Running
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400 text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                    )}

                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(run.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                </button>

                {/* Expanded Tool Calls View */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                        Tool Calls Audit Trail ({calls.length})
                      </span>
                      {run.token_usage && (
                        <div className="flex items-center gap-1 text-amber-400/90 font-mono text-[11px]">
                          <Coins className="w-3 h-3" />
                          <span>{run.token_usage.total || 0} tokens</span>
                        </div>
                      )}
                    </div>

                    {calls.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No tool calls recorded in this phase.</p>
                    ) : (
                      <div className="space-y-2">
                        {calls.map((tc) => (
                          <div
                            key={tc.id}
                            className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                                <span className="font-mono font-bold text-blue-300">
                                  {tc.tool_name}()
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                                {tc.execution_ms && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {tc.execution_ms}ms
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                                    tc.status === "success"
                                      ? "text-emerald-400 bg-emerald-500/10"
                                      : "text-rose-400 bg-rose-500/10"
                                  }`}
                                >
                                  {tc.status}
                                </span>
                              </div>
                            </div>

                            {/* Arguments Preview */}
                            {tc.arguments && (
                              <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/60 overflow-x-auto">
                                <span className="text-slate-500">args: </span>
                                {JSON.stringify(tc.arguments)}
                              </div>
                            )}
                          </div>
                        ))}
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
}
