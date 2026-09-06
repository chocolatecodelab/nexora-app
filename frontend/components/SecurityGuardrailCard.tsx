"use client";

import React, { useState, useEffect } from "react";
import { SecurityReport } from "@/types";
import { getTaskSecurityReport } from "@/lib/api";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
} from "lucide-react";

interface SecurityGuardrailCardProps {
  taskId: string;
}

export function SecurityGuardrailCard({ taskId }: SecurityGuardrailCardProps) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadReport = async () => {
    if (!taskId) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getTaskSecurityReport(taskId);
      setReport(data);
    } catch (err) {
      console.warn("Security report not available yet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [taskId]);

  if (isLoading) {
    return (
      <div className="p-16 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6C9BFF]" />
        <p className="text-xs text-[#8D91A6]">Menjalankan Pre-Flight Security & Secret Leak Scanner...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-12 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center text-xs text-[#8D91A6]">
        Tidak dapat memuat laporan keamanan.
      </div>
    );
  }

  return (
    <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-5">
      {/* Header & Status Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2B2F3D] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              report.passed
                ? "bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/40"
                : "bg-[#2E181B] text-[#EB5757] border border-[#EB5757]/40"
            }`}
          >
            {report.passed ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-bold text-[#E7E9F2]">
                Pre-Flight Security & Secret Guardrail
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  report.passed
                    ? "bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30"
                    : "bg-[#2E181B] text-[#EB5757] border border-[#EB5757]/30"
                }`}
              >
                {report.passed ? "PASSED • CLEAN SCAN" : "SECURITY ALERT"}
              </span>
            </div>
            <p className="text-xs text-[#8D91A6] mt-0.5">{report.summary}</p>
          </div>
        </div>

        <button
          onClick={loadReport}
          className="px-3 py-1.5 rounded-lg bg-[#12141C] hover:bg-[#242838] border border-[#2B2F3D] text-xs text-[#8D91A6] hover:text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-scan</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
          <span className="text-[10px] font-mono text-[#8D91A6] block">Scanned Files</span>
          <span className="text-lg font-bold font-mono text-[#E7E9F2] mt-0.5 block">
            {report.scanned_files_count} files
          </span>
        </div>

        <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
          <span className="text-[10px] font-mono text-[#8D91A6] block">Critical Secret Leaks</span>
          <span
            className={`text-lg font-bold font-mono mt-0.5 block ${
              report.critical_count > 0 ? "text-[#EB5757]" : "text-[#4CB782]"
            }`}
          >
            {report.critical_count}
          </span>
        </div>

        <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
          <span className="text-[10px] font-mono text-[#8D91A6] block">High Vulnerabilities</span>
          <span
            className={`text-lg font-bold font-mono mt-0.5 block ${
              report.high_count > 0 ? "text-[#E3A73B]" : "text-[#4CB782]"
            }`}
          >
            {report.high_count}
          </span>
        </div>

        <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
          <span className="text-[10px] font-mono text-[#8D91A6] block">Medium / Quality Notices</span>
          <span className="text-lg font-bold font-mono text-[#8D91A6] mt-0.5 block">
            {report.medium_count}
          </span>
        </div>
      </div>

      {/* Detected Issues List or Clean Certificate Banner */}
      {report.issues.length === 0 ? (
        <div className="p-6 bg-[#1B2B23]/40 border border-[#4CB782]/30 rounded-lg text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#4CB782] shrink-0" />
          <div>
            <span className="font-bold text-[#E7E9F2] block">
              100% Zero-Leak Quality Gate Passed
            </span>
            <span className="text-[#8D91A6]">
              Tidak ada token GitHub, GitLab, Gemini API key, AWS credential, maupun pola SQL Injection berbahaya yang ditemukan di seluruh file kode yang dihasilkan.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#E7E9F2]">Audit Findings & Policy Violations</h4>
          <div className="divide-y divide-[#2B2F3D] border border-[#2B2F3D] rounded-lg overflow-hidden">
            {report.issues.map((issue, idx) => (
              <div key={idx} className="p-3.5 bg-[#12141C]/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        issue.severity === "CRITICAL"
                          ? "bg-[#2E181B] text-[#EB5757] border border-[#EB5757]/40"
                          : issue.severity === "HIGH"
                          ? "bg-[#2E260F] text-[#E3A73B] border border-[#E3A73B]/40"
                          : "bg-[#242838] text-[#8D91A6]"
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <span className="font-semibold text-[#E7E9F2]">{issue.rule_name}</span>
                  </div>

                  <span className="font-mono text-[10px] text-[#8D91A6]">
                    {issue.file_path}:{issue.line_number}
                  </span>
                </div>

                <p className="text-[11px] text-[#8D91A6]">{issue.description}</p>

                <div className="p-2 bg-[#0E1017] rounded border border-[#2B2F3D] font-mono text-[10px] text-[#EB5757] break-all">
                  <code>{issue.snippet}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
