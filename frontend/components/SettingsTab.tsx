"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Project } from "@/types";
import { updateProject, getProjectBranches, createProjectBranch } from "@/lib/api";
import {
  GitBranch,
  Shield,
  Terminal,
  Settings2,
  GitMerge,
  Check,
  Loader2,
  FolderGit2,
  FileCode2,
  Sliders,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  Play,
  Layers,
  KeyRound,
  Plus,
  AlertTriangle,
  RefreshCw,
  GitFork,
  X,
} from "lucide-react";

interface SettingsTabProps {
  projects: Project[];
  onProjectUpdated?: (updated: Project) => void;
  onOpenAuthModal?: () => void;
}

const TEST_COMMAND_PRESETS = [
  { label: "Node.js (Jest / Vitest)", cmd: "npm test" },
  { label: "Python (pytest)", cmd: "pytest" },
  { label: "PHP / Laravel (Pest / PHPUnit)", cmd: "php artisan test" },
  { label: "Go (go test)", cmd: "go test ./..." },
  { label: "Rust (cargo test)", cmd: "cargo test" },
];

export function SettingsTab({ projects, onProjectUpdated, onOpenAuthModal }: SettingsTabProps) {
  // Selected project for per-repo configuration
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ""
  );

  const activeProject = projects.find((p) => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null);

  // Form State
  const [defaultBranch, setDefaultBranch] = useState<string>("main");
  const [branchPrefix, setBranchPrefix] = useState<string>("nexora/issue-");
  const [prTitleTemplate, setPrTitleTemplate] = useState<string>("[Nexora AI] {issue_title}");
  const [prDraftMode, setPrDraftMode] = useState<boolean>(false);
  const [autoLinkIssue, setAutoLinkIssue] = useState<boolean>(true);
  const [customTestCommand, setCustomTestCommand] = useState<string>("npm test");
  const [maxDebugIterations, setMaxDebugIterations] = useState<number>(3);
  const [approvalMode, setApprovalMode] = useState<"strict" | "low_risk_auto">("strict");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Remote Branches Management State
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState("");
  const [newBranchBase, setNewBranchBase] = useState("main");
  const [branchActionFeedback, setBranchActionFeedback] = useState<string | null>(null);

  // Provider Accounts State
  const [provider, setProvider] = useState<"github" | "gitlab">("github");
  const [gitlabUrl, setGitlabUrl] = useState("https://gitlab.com");

  // Fetch branches for selected project
  const fetchBranches = useCallback(async (projId: string) => {
    setIsLoadingBranches(true);
    try {
      const list = await getProjectBranches(projId);
      setRemoteBranches(list);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    } finally {
      setIsLoadingBranches(false);
    }
  }, []);

  // Sync form and fetch branches when selected project changes
  useEffect(() => {
    if (activeProject) {
      setDefaultBranch(activeProject.default_branch || "main");
      setBranchPrefix(activeProject.branch_prefix || "nexora/issue-");
      setPrTitleTemplate(activeProject.pr_title_template || "[Nexora AI] {issue_title}");
      setPrDraftMode(Boolean(activeProject.pr_draft_mode));
      setAutoLinkIssue(activeProject.auto_link_issue !== false);
      setCustomTestCommand(activeProject.custom_test_command || "npm test");
      setMaxDebugIterations(activeProject.max_debug_iterations || 3);
      setApprovalMode(activeProject.approval_mode === "low_risk_auto" ? "low_risk_auto" : "strict");
      fetchBranches(activeProject.id);
    }
  }, [activeProject, fetchBranches]);

  // Quick Create Branch Action (e.g. create 'dev' from 'main')
  const handleQuickCreateBranch = async (branchName: string, base: string = "main") => {
    if (!activeProject || !branchName.trim()) return;
    setIsCreatingBranch(true);
    setBranchActionFeedback(null);
    try {
      await createProjectBranch(activeProject.id, branchName.trim(), base);
      await fetchBranches(activeProject.id);
      setDefaultBranch(branchName.trim());
      setBranchActionFeedback(`Berhasil membuat branch '${branchName.trim()}' dari '${base}' di remote repo!`);
      setTimeout(() => setBranchActionFeedback(null), 4000);
      setShowCreateBranchModal(false);
      setNewBranchInput("");
    } catch (err) {
      console.error("Failed to create branch:", err);
      alert(`Gagal membuat branch: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await updateProject(activeProject.id, {
        default_branch: defaultBranch.trim() || "main",
        branch_prefix: branchPrefix.trim() || "nexora/issue-",
        pr_title_template: prTitleTemplate.trim() || "[Nexora AI] {issue_title}",
        pr_draft_mode: prDraftMode,
        auto_link_issue: autoLinkIssue,
        custom_test_command: customTestCommand.trim() || "npm test",
        max_debug_iterations: maxDebugIterations,
        approval_mode: approvalMode,
      });

      if (onProjectUpdated) {
        onProjectUpdated(updated);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to save project settings:", err);
      alert(`Gagal menyimpan pengaturan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-[#2B2F3D]">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-[#6C9BFF]">
          Configuration & Automation Rules
        </span>
        <h2 className="font-heading text-xl font-bold text-[#E7E9F2] mt-0.5">
          Branch Strategy, PR/MR Rules & Custom Test Runners
        </h2>
        <p className="text-xs text-[#8D91A6] mt-0.5">
          Atur penamaan branch, format Pull Request/Merge Request, dan runner sandbox untuk masing-masing repository.
        </p>
      </div>

      {/* Target Project Selection */}
      <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-[#6C9BFF]" />
            <h3 className="text-sm font-semibold text-[#E7E9F2]">
              Select Repository to Configure
            </h3>
          </div>

          <span className="text-xs font-mono text-[#8D91A6]">
            {projects.length} connected repositories
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="p-4 bg-[#12141C] rounded-lg border border-[#2B2F3D] text-xs text-[#8D91A6]">
            No repositories connected yet. Connect a repository first from the Dashboard tab.
          </div>
        ) : (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3.5 py-2.5 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.git_provider === "gitlab" ? "🦊 GitLab: " : "🐙 GitHub: "}{p.repository_full_name} ({p.name})
              </option>
            ))}
          </select>
        )}
      </div>

      {activeProject && (
        <form onSubmit={handleSaveProjectSettings} className="space-y-6">
          {/* 1. Branch Strategy Panel */}
          <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2F3D]">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#4CB782]" />
                <h3 className="text-sm font-semibold text-[#E7E9F2]">
                  1. Branching Strategy & Target Branch
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchBranches(activeProject.id)}
                  disabled={isLoadingBranches}
                  className="px-2.5 py-1 rounded bg-[#12141C] hover:bg-[#242838] text-[#8D91A6] hover:text-[#E7E9F2] text-[11px] font-mono border border-[#2B2F3D] flex items-center gap-1 transition cursor-pointer"
                  title="Refresh branch list from remote repository"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBranches ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewBranchBase(defaultBranch || "main");
                    setShowCreateBranchModal(true);
                  }}
                  className="px-2.5 py-1 rounded bg-[#242838] hover:bg-[#2F3447] text-[#4CB782] text-[11px] font-mono font-medium border border-[#4CB782]/30 flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span> Create Branch</span>
                </button>
              </div>
            </div>

            {/* Branch Feedback Notification if any */}
            {branchActionFeedback && (
              <div className="p-3 rounded-lg bg-[#1B2B23] border border-[#4CB782]/40 text-[#4CB782] text-xs font-mono flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{branchActionFeedback}</span>
              </div>
            )}

            {/* Existing Remote Branches Badges */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8D91A6]">
                  Available Remote Branches ({remoteBranches.length}):
                </span>
                <span className="text-[10px] text-[#5E6275]">Klik branch untuk memilih sebagai Target Base</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 text-xs text-[#8D91A6] py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading remote branches...</span>
                  </div>
                ) : remoteBranches.length > 0 ? (
                  remoteBranches.map((br) => {
                    const isSelected = br === defaultBranch.trim();
                    return (
                      <button
                        key={br}
                        type="button"
                        onClick={() => setDefaultBranch(br)}
                        className={`px-2.5 py-1 rounded text-xs font-mono border flex items-center gap-1.5 transition cursor-pointer ${isSelected
                            ? "bg-[#1B2B23] text-[#4CB782] border-[#4CB782] font-bold shadow-sm"
                            : "bg-[#1A1D28] text-[#8D91A6] border-[#2B2F3D] hover:text-[#E7E9F2] hover:border-[#3A3F52]"
                          }`}
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>{br}</span>
                        {isSelected && <Check className="w-3 h-3 text-[#4CB782]" />}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-[#8D91A6] font-mono">No branches found.</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="block font-mono text-[#8D91A6] mb-1.5">
                  Base / Target Branch (tempat PR/MR akan diajukan)
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main, master, develop, staging"
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-[#E7E9F2] font-mono text-xs focus:outline-none focus:border-[#6C9BFF]"
                />
                <span className="text-[10px] text-[#5E6275] mt-1 block">
                  Branch tujuan merger (misal: `main` atau `dev`).
                </span>

                {/* Missing Branch Auto-Create Helper */}
                {!isLoadingBranches && remoteBranches.length > 0 && !remoteBranches.includes(defaultBranch.trim()) && defaultBranch.trim() && (
                  <div className="p-2.5 rounded-lg bg-[#2E2419] border border-[#E3A73B]/40 text-[#E3A73B] text-[11px] flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#E3A73B]" />
                      <span>Branch <code>{defaultBranch}</code> belum ada di repo.</span>
                    </div>
                    <button
                      type="button"
                      disabled={isCreatingBranch}
                      onClick={() => handleQuickCreateBranch(defaultBranch.trim(), remoteBranches[0] || "main")}
                      className="px-2.5 py-1 rounded bg-[#E3A73B] hover:bg-[#E3A73B]/90 text-[#12141C] font-bold text-[10px] transition cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isCreatingBranch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      <span>Buat '{defaultBranch}' Sekarang</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-mono text-[#8D91A6] mb-1.5">
                  Branch Prefix Pattern
                </label>
                <input
                  type="text"
                  value={branchPrefix}
                  onChange={(e) => setBranchPrefix(e.target.value)}
                  placeholder="nexora/issue-, feat/issue-, fix/"
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-[#E7E9F2] font-mono text-xs focus:outline-none focus:border-[#6C9BFF]"
                />
                <span className="text-[10px] text-[#5E6275] mt-1 block">
                  Hasil nama branch kerja agen: <code className="text-[#4CB782]">{branchPrefix}42</code>
                </span>
              </div>
            </div>
          </div>

          {/* 2. Pull Request & Merge Request Template Panel */}
          <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#2B2F3D]">
              <GitPullRequest className="w-4 h-4 text-[#6C9BFF]" />
              <h3 className="text-sm font-semibold text-[#E7E9F2]">
                2. Pull Request (GitHub) & Merge Request (GitLab) Rules
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-mono text-[#8D91A6] mb-1.5">
                  PR / MR Title Template
                </label>
                <input
                  type="text"
                  value={prTitleTemplate}
                  onChange={(e) => setPrTitleTemplate(e.target.value)}
                  placeholder="[Nexora AI] {issue_title} (closes #{issue_number})"
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-[#E7E9F2] font-mono text-xs focus:outline-none focus:border-[#6C9BFF]"
                />
                <span className="text-[10px] text-[#5E6275] mt-1 block">
                  Variabel tersedia: <code className="text-[#6C9BFF]">{`{issue_title}`}</code>, <code className="text-[#6C9BFF]">{`{issue_number}`}</code>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#12141C] border border-[#2B2F3D] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prDraftMode}
                    onChange={(e) => setPrDraftMode(e.target.checked)}
                    className="rounded border-[#2B2F3D] text-[#6C9BFF] focus:ring-[#6C9BFF] bg-[#1A1D28] cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-[#E7E9F2] block">Draft PR / WIP MR Mode</span>
                    <span className="text-[10px] text-[#8D91A6]">
                      Buka PR sebagai draft agar CI/CD tidak auto-deploy sebelum di-review.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#12141C] border border-[#2B2F3D] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoLinkIssue}
                    onChange={(e) => setAutoLinkIssue(e.target.checked)}
                    className="rounded border-[#2B2F3D] text-[#4CB782] focus:ring-[#4CB782] bg-[#1A1D28] cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-[#E7E9F2] block">Auto-Close Issue on Merge</span>
                    <span className="text-[10px] text-[#8D91A6]">
                      Menyertakan tag <code className="text-[#4CB782]">Closes #issue</code> agar issue otomatis ditutup.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Sandbox Runner & Debug Iterations Panel */}
          <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#2B2F3D]">
              <Terminal className="w-4 h-4 text-[#E3A73B]" />
              <h3 className="text-sm font-semibold text-[#E7E9F2]">
                3. Sandbox Test Runner & Auto-Debug Limits
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-mono text-[#8D91A6] mb-1.5">
                  Custom Test Command (Runner Perintah Tes)
                </label>
                <input
                  type="text"
                  value={customTestCommand}
                  onChange={(e) => setCustomTestCommand(e.target.value)}
                  placeholder="e.g. npm test, pytest, php artisan test, go test ./..."
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-[#E7E9F2] font-mono text-xs focus:outline-none focus:border-[#6C9BFF]"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="text-[10px] text-[#5E6275] mr-1">Presets:</span>
                  {TEST_COMMAND_PRESETS.map((preset) => (
                    <button
                      key={preset.cmd}
                      type="button"
                      onClick={() => setCustomTestCommand(preset.cmd)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${customTestCommand === preset.cmd
                          ? "bg-[#2E260F] text-[#E3A73B] border border-[#E3A73B]/40 font-bold"
                          : "bg-[#12141C] text-[#8D91A6] hover:text-[#E7E9F2] border border-[#2B2F3D]"
                        }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block font-mono text-[#8D91A6] mb-1.5">
                    Max Auto-Debug Iterations ({maxDebugIterations}x attempts)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={maxDebugIterations}
                    onChange={(e) => setMaxDebugIterations(Number(e.target.value))}
                    className="w-full accent-[#E3A73B] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#5E6275]">
                    <span>1 (Fast)</span>
                    <span>3 (Standard)</span>
                    <span>5 (Thorough)</span>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[#8D91A6] mb-1.5">
                    Human Approval Policy
                  </label>
                  <select
                    value={approvalMode}
                    onChange={(e) => setApprovalMode(e.target.value as "strict" | "low_risk_auto")}
                    className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] cursor-pointer"
                  >
                    <option value="strict">Strict (Wajib persetujuan manusia untuk semua plan)</option>
                    <option value="low_risk_auto">Auto-Approve Low Risk (Hanya minta approval jika medium/high)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button Bar */}
          <div className="flex items-center justify-between p-4 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D]">
            <div className="text-xs text-[#8D91A6]">
              {saveSuccess ? (
                <span className="text-[#4CB782] font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" /> Pengaturan repository berhasil disimpan!
                </span>
              ) : (
                <span>Pengaturan akan langsung diterapkan pada eksekusi agen berikutnya.</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-[8px] bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              <span>Simpan Pengaturan Repository</span>
            </button>
          </div>
        </form>
      )}

      {/* Global Provider Integration Tab */}
      <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2F3D]">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#6C9BFF]" />
            <h3 className="text-sm font-semibold text-[#E7E9F2]">
              Git Provider Accounts Status
            </h3>
          </div>
          <div className="flex bg-[#12141C] p-1 rounded-lg border border-[#2B2F3D]">
            <button
              onClick={() => setProvider("github")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${provider === "github"
                  ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
                }`}
            >
              GitHub (PR)
            </button>
            <button
              onClick={() => setProvider("gitlab")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${provider === "gitlab"
                  ? "bg-[#242838] text-[#FC6D26] border border-[#FC6D26]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
                }`}
            >
              GitLab (MR & CI/CD)
            </button>
          </div>
        </div>

        {provider === "gitlab" ? (
          <div className="p-3 bg-[#FC6D26]/10 border border-[#FC6D26]/30 rounded-lg text-xs text-[#E7E9F2] flex items-center justify-between flex-wrap gap-2">
            <div>
              <strong>GitLab CI/CD Live:</strong> Token & GitLab URL aktif dan dapat diubah tanpa hardcoding.
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-3 py-1 bg-[#FC6D26] hover:bg-[#E25C1D] text-white text-xs font-semibold rounded-md flex items-center gap-1 transition cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Ganti GitLab Token</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 bg-[#6C9BFF]/10 border border-[#6C9BFF]/30 rounded-lg text-xs text-[#E7E9F2] flex items-center justify-between flex-wrap gap-2">
            <div>
              <strong>GitHub Integration Live:</strong> Token & Permissions terhubung secara aman di runtime session.
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-3 py-1 bg-[#6C9BFF] hover:bg-[#5A8AEB] text-black text-xs font-semibold rounded-md flex items-center gap-1 transition cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Ganti GitHub Token</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create New Branch Modal */}
      {showCreateBranchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowCreateBranchModal(false)}
        >
          <div
            className="bg-[#1A1D28] border border-[#2B2F3D] rounded-[12px] p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2B2F3D] pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#4CB782]" />
                <h3 className="font-bold text-sm text-[#E7E9F2]">Create New Git Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBranchModal(false)}
                className="p-1 rounded hover:bg-[#242838] text-[#8D91A6] hover:text-[#E7E9F2] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8D91A6]">
              Cabang baru akan langsung dibuat di remote repository ({activeProject?.repository_full_name}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-mono text-[#8D91A6] mb-1">New Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dev, develop, staging, feat/new-api"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#4CB782]"
                />
              </div>

              <div>
                <label className="block font-mono text-[#8D91A6] mb-1">Branch Origin / Base Source</label>
                <select
                  value={newBranchBase}
                  onChange={(e) => setNewBranchBase(e.target.value)}
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#4CB782] cursor-pointer"
                >
                  {remoteBranches.map((b) => (
                    <option key={b} value={b}>
                      from {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2B2F3D]">
              <button
                type="button"
                onClick={() => setShowCreateBranchModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-[#8D91A6] hover:text-[#E7E9F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingBranch || !newBranchInput.trim()}
                onClick={() => handleQuickCreateBranch(newBranchInput, newBranchBase)}
                className="px-4 py-2 rounded-lg bg-[#4CB782] text-[#12141C] text-xs font-bold flex items-center gap-1.5 transition hover:bg-[#4CB782]/90 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isCreatingBranch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Create Branch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
