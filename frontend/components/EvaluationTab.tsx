"use client";

import React, { useState, useEffect } from "react";
import { Project, EvaluationMetricsResponse, TaskPerformanceRecord } from "@/types";
import { getEvaluationMetrics } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  RefreshCw,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  GitPullRequest,
  Zap,
  Activity,
} from "lucide-react";

const COST_PER_MILLION_TOKENS_USD = 0.15;

interface EvaluationTabProps {
  projects?: Project[];
}

export function EvaluationTab({ projects = [] }: EvaluationTabProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [metricsData, setMetricsData] = useState<EvaluationMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadMetrics = async (projId: string, showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await getEvaluationMetrics(projId || undefined);
      setMetricsData(data);
    } catch (err) {
      console.warn("Failed to load evaluation metrics:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics(selectedProjectId);
  }, [selectedProjectId]);

  const handleRefresh = () => {
    loadMetrics(selectedProjectId, true);
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    pr_created: { bg: "bg-[#1B2B23]", text: "text-[#4CB782]", border: "border-[#4CB782]/30" },
    completed: { bg: "bg-[#1B2B23]", text: "text-[#4CB782]", border: "border-[#4CB782]/30" },
    implementing: { bg: "bg-[#242838]", text: "text-[#6C9BFF]", border: "border-[#6C9BFF]/30" },
    testing: { bg: "bg-[#2E260F]", text: "text-[#E3A73B]", border: "border-[#E3A73B]/30" },
    debugging: { bg: "bg-[#2E260F]", text: "text-[#E3A73B]", border: "border-[#E3A73B]/30" },
    planning: { bg: "bg-[#242838]", text: "text-[#6C9BFF]", border: "border-[#6C9BFF]/30" },
    awaiting_approval: { bg: "bg-[#2E260F]", text: "text-[#E3A73B]", border: "border-[#E3A73B]/30" },
    failed: { bg: "bg-[#2E181B]", text: "text-[#EB5757]", border: "border-[#EB5757]/30" },
    cancelled: { bg: "bg-[#1A1D28]", text: "text-[#8D91A6]", border: "border-[#2B2F3D]" },
    queued: { bg: "bg-[#1A1D28]", text: "text-[#8D91A6]", border: "border-[#2B2F3D]" },
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header & Repository Filter */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2B2F3D] flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#6C9BFF] flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#6C9BFF]" />
              Quantitative Verification
            </span>
            {/* <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30">
              PRD §10.2 & §16
            </span> */}
          </div>
          <h2 className="font-heading text-xl font-bold text-[#E7E9F2] mt-0.5">
            Agent Evaluation & Analytics Dashboard
          </h2>
          <p className="text-xs text-[#8D91A6] mt-0.5">
            Real-time audit performance metrics, benchmark scorecards, and token economics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Repository Filter Dropdown */}
          <div className="flex items-center gap-2 bg-[#1A1D28] px-3 py-1.5 rounded-[8px] border border-[#2B2F3D]">
            <Filter className="w-3.5 h-3.5 text-[#8D91A6]" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Filter berdasarkan repositori"
              className="bg-transparent text-xs text-[#E7E9F2] focus:outline-none cursor-pointer pr-2"
            >
              <option value="" className="bg-[#1A1D28] text-[#E7E9F2]">
                All Connected Repositories
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1A1D28] text-[#E7E9F2]">
                  {p.name} ({p.repository_full_name})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-[#1A1D28] hover:bg-[#242838] border border-[#2B2F3D] rounded-[8px] text-xs font-semibold text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6C9BFF] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-20 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#6C9BFF]" />
          <p className="text-xs text-[#8D91A6]">Calculating quantitative evaluation metrics from audit logs...</p>
        </div>
      ) : metricsData ? (
        <>
          {/* Top Operational Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6]">Total Tasks</span>
              <div className="text-xl font-bold font-mono text-[#E7E9F2]">
                {metricsData.total_tasks}
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6]">Completed / PRs</span>
              <div className="text-xl font-bold font-mono text-[#4CB782]">
                {metricsData.completed_tasks}
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6]">Active Runs</span>
              <div className="text-xl font-bold font-mono text-[#6C9BFF]">
                {metricsData.active_tasks}
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6]">Failed / Cancelled</span>
              <div className="text-xl font-bold font-mono text-[#EB5757]">
                {metricsData.failed_tasks}
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6] flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#E3A73B]" /> Total Tokens
              </span>
              <div className="text-xl font-bold font-mono text-[#E3A73B]">
                {metricsData.total_tokens_used >= 1_000_000
                  ? `${(metricsData.total_tokens_used / 1_000_000).toFixed(2)}M`
                  : metricsData.total_tokens_used >= 1_000
                    ? `${(metricsData.total_tokens_used / 1_000).toFixed(1)}k`
                    : metricsData.total_tokens_used}
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1D28] rounded-[8px] border border-[#2B2F3D] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[#8D91A6] flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#4CB782]" /> Est. Cost
              </span>
              <div className="text-xl font-bold font-mono text-[#4CB782]">
                ${metricsData.estimated_cost_usd.toFixed(4)}
              </div>
            </div>
          </div>

          {/* PRD Benchmark Metric Cards Grid (5 Core PRD Metrics) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8D91A6]">
                PRD Target Benchmarks vs Actual Performance
              </h3>
              <span className="text-[11px] font-mono text-[#5E6275]">
                Evaluated against PRD Section 10.2 targets
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {metricsData.metrics.map((m) => (
                <div
                  key={m.title}
                  className="p-4 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] flex flex-col justify-between space-y-3 hover:border-[#3A3F52] transition"
                >
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8D91A6]">
                      {m.title}
                    </span>
                    <div className="font-heading text-2xl font-bold text-[#E7E9F2] mt-1.5 font-mono">
                      {m.value}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#2B2F3D] flex items-center justify-between text-xs font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.is_positive
                        ? "bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30"
                        : "bg-[#2E1D1B] text-[#E0594A] border border-[#E0594A]/30"
                        }`}
                    >
                      {m.target}
                    </span>
                    <span className="text-[10px] text-[#5E6275] truncate max-w-[90px]" title={m.description}>
                      {m.description.slice(0, 18)}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution Breakdowns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status Breakdown */}
            <div className="p-5 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#2B2F3D]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#E7E9F2] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#6C9BFF]" />
                  Task Lifecycle Status Distribution
                </h4>
                <span className="text-[11px] font-mono text-[#8D91A6]">
                  {metricsData.total_tasks} Total
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {Object.entries(metricsData.status_distribution)
                  .filter(([_, count]) => count > 0 || ["queued", "planning", "implementing", "pr_created"].includes(_))
                  .map(([statusKey, count]) => {
                    const pct = metricsData.total_tasks > 0 ? (count / metricsData.total_tasks) * 100 : 0;
                    const style = statusColors[statusKey] || statusColors.queued;
                    return (
                      <div key={statusKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="capitalize text-[#8D91A6] flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${style.text.replace("text-", "bg-")}`} />
                            {statusKey.replace("_", " ")}
                          </span>
                          <span className="text-[#E7E9F2] font-semibold">
                            {count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#12141C] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${statusKey === "pr_created" || statusKey === "completed"
                              ? "bg-[#4CB782]"
                              : statusKey === "failed"
                                ? "bg-[#EB5757]"
                                : "bg-[#6C9BFF]"
                              }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Risk Breakdown & Token Economics */}
            <div className="p-5 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#2B2F3D]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#E7E9F2] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#E3A73B]" />
                    Task Risk & AI Cost Efficiency
                  </h4>
                  <span className="text-[11px] font-mono text-[#4CB782]">
                    Gemini 3.5 Flash / Pro
                  </span>
                </div>

                <div className="space-y-2 pt-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8D91A6]">Low Risk Tasks:</span>
                    <span className="text-[#4CB782] font-bold">
                      {metricsData.risk_distribution.low || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8D91A6]">Medium Risk Tasks:</span>
                    <span className="text-[#E3A73B] font-bold">
                      {metricsData.risk_distribution.medium || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8D91A6]">High Risk Tasks:</span>
                    <span className="text-[#EB5757] font-bold">
                      {metricsData.risk_distribution.high || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#12141C] rounded-[8px] border border-[#2B2F3D] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8D91A6]">Token Cost Efficiency:</span>
                  <span className="text-[#4CB782] font-mono font-semibold">
                    ~${COST_PER_MILLION_TOKENS_USD}/1M tokens
                  </span>
                </div>
                <p className="text-[11px] text-[#5E6275] leading-normal">
                  Model routing dynamically executes lightweight repository understanding with fast tier and coding with strong tier to minimize inference costs.
                </p>
              </div>
            </div>
          </div>

          {/* Task Performance Audit Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8D91A6]">
                Recent Task Performance Audit Log ({metricsData.recent_tasks.length})
              </h3>
              <span className="text-[11px] font-mono text-[#5E6275]">
                Individual runtime, iterations, tokens, and security audits
              </span>
            </div>

            {metricsData.recent_tasks.length === 0 ? (
              <div className="p-12 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center space-y-2">
                <BarChart3 className="w-6 h-6 mx-auto text-[#5E6275]" />
                <h4 className="text-xs font-bold text-[#E7E9F2]">Belum Ada Riwayat Eksekusi Task</h4>
                <p className="text-xs text-[#8D91A6]">
                  Jalankan task pertama dari Agent Workspace untuk melihat metrik performa nyata.
                </p>
              </div>
            ) : (
              <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#12141C]/60 text-[#8D91A6] font-mono text-[11px] uppercase border-b border-[#2B2F3D]">
                      <tr>
                        <th className="px-4 py-3">Task / Issue</th>
                        <th className="px-4 py-3">Repository</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Debug Loops</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Tokens / Cost</th>
                        <th className="px-4 py-3">Security</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2F3D]/60 font-mono">
                      {metricsData.recent_tasks.map((record) => {
                        const style = statusColors[record.status] || statusColors.queued;
                        return (
                          <tr key={record.task_id} className="hover:bg-[#242838]/40 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[#6C9BFF] font-bold">#{record.issue_number}</span>
                                <span className="font-sans font-medium text-[#E7E9F2] truncate max-w-[200px]" title={record.issue_title}>
                                  {record.issue_title}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-[#8D91A6] truncate max-w-[140px]" title={record.repository_full_name}>
                              {record.repository_full_name}
                            </td>

                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                                {record.status.replace("_", " ")}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`text-[11px] font-semibold capitalize ${record.risk === "high"
                                  ? "text-[#EB5757]"
                                  : record.risk === "medium"
                                    ? "text-[#E3A73B]"
                                    : "text-[#4CB782]"
                                  }`}
                              >
                                {record.risk}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-[#E7E9F2]">
                              {record.debug_iterations} / 3
                            </td>

                            <td className="px-4 py-3 text-[#8D91A6]">
                              {record.duration_formatted}
                            </td>

                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                <div className="text-[#E7E9F2]">{record.token_usage_total.toLocaleString()}</div>
                                <div className="text-[10px] text-[#4CB782]">${record.estimated_cost_usd.toFixed(4)}</div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {record.security_passed ? (
                                <span className="text-[#4CB782] flex items-center gap-1 text-[11px]">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Clean
                                </span>
                              ) : (
                                <span className="text-[#EB5757] flex items-center gap-1 text-[11px]">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Alert
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {record.pr_url ? (
                                <a
                                  href={record.pr_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#4CB782] hover:underline flex items-center justify-end gap-1 font-semibold"
                                >
                                  <GitPullRequest className="w-3.5 h-3.5" /> PR <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-[#5E6275]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
