"use client";

import React, { useState } from "react";
import {
  FolderGit2,
  AlertCircle,
  Play,
  Loader2,
  Tag,
  Plus,
  ArrowRight,
  Code2,
} from "lucide-react";
import { Project, GitHubIssue } from "@/types";

interface IssueSelectorProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, repo: string) => Promise<void>;
  issues: GitHubIssue[];
  selectedIssue: GitHubIssue | null;
  onSelectIssue: (issue: GitHubIssue) => void;
  onStartAgent: () => void;
  isLoading: boolean;
  isStarting: boolean;
}

export function IssueSelector({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  issues,
  selectedIssue,
  onSelectIssue,
  onStartAgent,
  isLoading,
  isStarting,
}: IssueSelectorProps) {
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoFullName, setNewRepoFullName] = useState("");
  const [isSubmittingRepo, setIsSubmittingRepo] = useState(false);

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoFullName.trim()) return;
    setIsSubmittingRepo(true);
    try {
      const name = newRepoName.trim() || newRepoFullName.split("/")[1] || newRepoFullName;
      await onCreateProject(name, newRepoFullName.trim());
      setShowNewRepoModal(false);
      setNewRepoName("");
      setNewRepoFullName("");
    } finally {
      setIsSubmittingRepo(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Target Repository & Issue</h2>
            <p className="text-xs text-slate-400">Select an open issue for Nexora AI to resolve</p>
          </div>
        </div>

        <button
          onClick={() => setShowNewRepoModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700/60"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect Repo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Project Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Repository
          </label>
          <select
            aria-label="Repository"
            value={selectedProject?.id || ""}
            onChange={(e) => {
              const proj = projects.find((p) => p.id === e.target.value);
              if (proj) onSelectProject(proj);
            }}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer"
          >
            {projects.length === 0 ? (
              <option value="">No repositories connected</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.repository_full_name} ({p.name})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Issue Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Open Issue
          </label>
          <select
            aria-label="Open Issue"
            value={selectedIssue?.number || ""}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              const iss = issues.find((i) => i.number === num);
              if (iss) onSelectIssue(iss);
            }}
            disabled={isLoading || issues.length === 0}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <option value="">Loading issues...</option>
            ) : issues.length === 0 ? (
              <option value="">No open issues found</option>
            ) : (
              issues.map((i) => (
                <option key={i.number} value={i.number}>
                  #{i.number} — {i.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Selected Issue Preview */}
      {selectedIssue && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-xs font-bold border border-blue-500/20">
                #{selectedIssue.number}
              </span>
              <h3 className="text-sm font-semibold text-slate-100">{selectedIssue.title}</h3>
            </div>
            {selectedIssue.labels && selectedIssue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedIssue.labels.map((lbl) => (
                  <span
                    key={lbl}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#1E293B] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {lbl}
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {selectedIssue.body || "No issue description provided."}
          </p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
          <Code2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Pipeline: Planning → Approval → Coding → Sandbox Test → PR</span>
        </div>

        <button
          onClick={onStartAgent}
          disabled={!selectedIssue || isStarting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Starting Agent...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Start Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* New Repo Modal */}
      {showNewRepoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel-glow max-w-md w-full rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-white mb-1">Connect GitHub Repository</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the GitHub repository name to connect with Nexora AI
            </p>

            <form onSubmit={handleCreateRepo} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Repository Full Name (owner/repo) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. facebook/react or octocat/Hello-World"
                  value={newRepoFullName}
                  onChange={(e) => setNewRepoFullName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Project Display Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Awesome Project"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewRepoModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepo}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {isSubmittingRepo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
