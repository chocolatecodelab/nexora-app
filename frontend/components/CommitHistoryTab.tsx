"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GitCommit, Project } from "@/types";
import { getProjectCommits, getProjectBranches } from "@/lib/api";
import {
  History,
  GitCommit as GitCommitIcon,
  GitBranch,
  FolderGit2,
  ExternalLink,
  Copy,
  Check,
  Search,
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
  Bot,
  GitMerge,
  GitPullRequest,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  RotateCcw,
  Tag,
  Share2,
} from "lucide-react";

interface CommitHistoryTabProps {
  projects: Project[];
}

const LANE_COLORS = [
  "#6C9BFF", // Lane 0: Main line (Blue)
  "#4CB782", // Lane 1: Feature / Agent branches (Green)
  "#E3A73B", // Lane 2: Reverts & Hotfixes (Amber)
  "#B57EDC", // Lane 3: Secondary branches (Purple)
  "#FF6B6B", // Lane 4: Experimental (Red)
];

interface GraphNode {
  commit: GitCommit;
  index: number;
  lane: number;
  isMerge: boolean;
  isHead: boolean;
  isNexora: boolean;
  parentIndices: number[];
}

export function CommitHistoryTab({ projects }: CommitHistoryTabProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ""
  );
  const [branch, setBranch] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ||
    (projects.length > 0 ? projects[0] : null);

  const loadBranches = async () => {
    if (!activeProject) return;
    setIsLoadingBranches(true);
    try {
      const bList = await getProjectBranches(activeProject.id);
      setBranches(bList);
      if (bList.length > 0) {
        if (!branch || !bList.includes(branch)) {
          setBranch(bList.includes(activeProject.default_branch) ? activeProject.default_branch : bList[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadCommits = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const data = await getProjectCommits(activeProject.id, branch || undefined, 50);
      setCommits(data);
      if (data.length > 0 && !selectedCommit) {
        setSelectedCommit(data[0]);
      }
    } catch (err) {
      console.error("Failed to load commits:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) {
      loadBranches();
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (activeProject) {
      loadCommits();
    }
  }, [activeProject?.id, branch]);

  const handleRefresh = () => {
    loadBranches();
    loadCommits();
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const filteredCommits = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.short_sha.toLowerCase().includes(q) ||
        c.sha.toLowerCase().includes(q)
    );
  }, [commits, searchQuery]);

  // Compute Git Graph Layout: assign lanes, detect merge points, resolve parent coordinates
  const graphNodes: GraphNode[] = useMemo(() => {
    const shaToIndex = new Map<string, number>();
    filteredCommits.forEach((c, idx) => {
      shaToIndex.set(c.sha, idx);
    });

    return filteredCommits.map((commit, idx) => {
      const parents = commit.parents || [];
      const parentIndices = parents
        .map((pSha) => shaToIndex.get(pSha))
        .filter((pIdx): pIdx is number => pIdx !== undefined);

      const isMerge = parents.length >= 2;
      const isHead = idx === 0;
      const isNexora =
        commit.author_name.toLowerCase().includes("nexora") ||
        commit.message.toLowerCase().includes("nexora") ||
        commit.message.toLowerCase().includes("[nexora ai]");

      // Lane assignment heuristic
      let lane = 0;
      if (commit.message.toLowerCase().startsWith("revert") || commit.message.toLowerCase().includes("rollback")) {
        lane = 2; // Revert lane
      } else if (isNexora || commit.message.toLowerCase().includes("feat") || commit.message.toLowerCase().includes("issue-")) {
        lane = 1; // Agent/Feature lane
      } else if (isMerge) {
        lane = 0; // Merge into main
      } else {
        lane = idx % 2 === 1 && !isHead ? 1 : 0;
      }

      return {
        commit,
        index: idx,
        lane,
        isMerge,
        isHead,
        isNexora,
        parentIndices,
      };
    });
  }, [filteredCommits]);

  const ROW_HEIGHT = 56;
  const LANE_WIDTH = 24;
  const GRAPH_PADDING_X = 20;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="pb-4 border-b border-[#2B2F3D] flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#6C9BFF]">
            Visual Git Topology & Audit Trail
          </span>
          <h2 className="font-heading text-xl font-bold text-[#E7E9F2] mt-0.5 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[#6C9BFF]" />
            Git Graph Timeline & Version Explorer
          </h2>
          <p className="text-xs text-[#8D91A6] mt-0.5">
            Visualisasi alur percabangan branch, titik merge commit, dan checkpoint versi kode secara interaktif.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex bg-[#12141C] p-1 rounded-lg border border-[#2B2F3D]">
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1.5 text-xs rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "graph"
                  ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Git Graph</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Commit List</span>
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading || !activeProject}
            className="px-3.5 py-2 rounded-lg bg-[#1A1D28] hover:bg-[#242838] border border-[#2B2F3D] text-xs text-[#E7E9F2] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6C9BFF] ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Repository & Branch Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#1A1D28] p-4 rounded-[10px] border border-[#2B2F3D]">
        <div>
          <label className="block text-[11px] font-mono text-[#8D91A6] mb-1.5 flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-[#6C9BFF]" /> Target Repository
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.git_provider === "gitlab" ? "🦊 " : "🐙 "}
                {p.repository_full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#8D91A6] mb-1.5 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[#4CB782]" />
            <span>Branch Focus</span>
            {branches.length > 0 && (
              <span className="text-[10px] text-[#4CB782] font-mono">({branches.length} remote branches)</span>
            )}
          </label>
          {branches.length > 0 ? (
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b} {b === activeProject?.default_branch ? "(default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main, master, develop"
              className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF]"
            />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#8D91A6] mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#E3A73B]" /> Search Commits / Author / SHA
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik commit message..."
            className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF]"
          />
        </div>
      </div>

      {/* Main Git Graph & Inspector Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Git Graph Visual Viewer (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#2B2F3D] flex items-center justify-between bg-[#12141C]/40">
            <div className="flex items-center gap-2">
              <GitCommitIcon className="w-4 h-4 text-[#6C9BFF]" />
              <h3 className="text-xs font-semibold text-[#E7E9F2]">
                Topology Graph ({filteredCommits.length} commits)
              </h3>
            </div>

            {/* Lane Legend */}
            <div className="flex items-center gap-3 text-[10px] font-mono text-[#8D91A6]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#6C9BFF]" /> main
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#4CB782]" /> agent-task
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#E3A73B]" /> revert
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-xs text-[#8D91A6] space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6C9BFF]" />
              <p>Membangun diagram topologi Git Graph...</p>
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="p-16 text-center text-xs text-[#8D91A6] space-y-2">
              <ShieldAlert className="w-6 h-6 mx-auto text-[#5E6275]" />
              <p>Tidak ada commit yang cocok dengan filter ini.</p>
            </div>
          ) : viewMode === "graph" ? (
            /* Visual SVG Git Graph Track */
            <div className="relative overflow-x-auto overflow-y-auto max-h-[600px] select-none">
              {/* SVG Background Connections */}
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: `${GRAPH_PADDING_X + 4 * LANE_WIDTH + 10}px`,
                  height: `${graphNodes.length * ROW_HEIGHT}px`,
                }}
              >
                {/* Draw Main trunk rail */}
                <line
                  x1={GRAPH_PADDING_X}
                  y1={ROW_HEIGHT / 2}
                  x2={GRAPH_PADDING_X}
                  y2={(graphNodes.length - 0.5) * ROW_HEIGHT}
                  stroke="#2B2F3D"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />

                {/* Draw connections between commit nodes */}
                {graphNodes.map((node) => {
                  const nodeX = GRAPH_PADDING_X + node.lane * LANE_WIDTH;
                  const nodeY = node.index * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const color = LANE_COLORS[node.lane % LANE_COLORS.length];

                  // Connect to next sequential commit if available
                  const nextNode = graphNodes[node.index + 1];
                  if (nextNode) {
                    const nextX = GRAPH_PADDING_X + nextNode.lane * LANE_WIDTH;
                    const nextY = (node.index + 1) * ROW_HEIGHT + ROW_HEIGHT / 2;

                    if (node.lane === nextNode.lane) {
                      return (
                        <line
                          key={`line-${node.index}-${nextNode.index}`}
                          x1={nodeX}
                          y1={nodeY}
                          x2={nextX}
                          y2={nextY}
                          stroke={color}
                          strokeWidth="2.5"
                          strokeOpacity="0.8"
                        />
                      );
                    } else {
                      // Smooth bezier curve for branch forks and merges
                      const cpY1 = nodeY + ROW_HEIGHT * 0.4;
                      const cpY2 = nextY - ROW_HEIGHT * 0.4;
                      return (
                        <path
                          key={`curve-${node.index}-${nextNode.index}`}
                          d={`M ${nodeX} ${nodeY} C ${nodeX} ${cpY1}, ${nextX} ${cpY2}, ${nextX} ${nextY}`}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeOpacity="0.8"
                        />
                      );
                    }
                  }
                  return null;
                })}
              </svg>

              {/* Rows with Interactive Graph Nodes & Commit Details */}
              <div className="relative z-10 divide-y divide-[#2B2F3D]/50">
                {graphNodes.map((node) => {
                  const isSelected = selectedCommit?.sha === node.commit.sha;
                  const color = LANE_COLORS[node.lane % LANE_COLORS.length];
                  const nodeX = GRAPH_PADDING_X + node.lane * LANE_WIDTH;

                  return (
                    <div
                      key={node.commit.sha || node.index}
                      onClick={() => setSelectedCommit(node.commit)}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className={`flex items-center px-4 hover:bg-[#242838]/70 transition cursor-pointer group ${
                        isSelected ? "bg-[#242838] border-l-2 border-[#6C9BFF]" : ""
                      }`}
                    >
                      {/* Left SVG Node Space */}
                      <div
                        className="relative shrink-0 flex items-center"
                        style={{ width: `${GRAPH_PADDING_X + 3 * LANE_WIDTH + 8}px` }}
                      >
                        <div
                          style={{
                            left: `${nodeX - 7}px`,
                            borderColor: color,
                            backgroundColor: isSelected ? color : "#1A1D28",
                          }}
                          className={`absolute w-3.5 h-3.5 rounded-full border-2 transition transform group-hover:scale-125 shadow-sm ${
                            node.isHead ? "ring-4 ring-[#6C9BFF]/30" : ""
                          }`}
                        >
                          {node.isMerge && (
                            <div className="w-1 h-1 rounded-full bg-white mx-auto my-auto mt-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Commit Row Content */}
                      <div className="flex items-center justify-between flex-1 min-w-0 pl-2 gap-3">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-semibold truncate ${
                                isSelected ? "text-[#6C9BFF]" : "text-[#E7E9F2]"
                              }`}
                            >
                              {node.commit.message}
                            </span>

                            {node.isHead && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#6C9BFF]/20 text-[#6C9BFF] border border-[#6C9BFF]/40">
                                HEAD
                              </span>
                            )}

                            {node.isNexora && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#4CB782]/15 text-[#4CB782] border border-[#4CB782]/30">
                                <Bot className="w-2.5 h-2.5" /> Nexora
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-[#8D91A6] font-mono">
                            <span className="truncate max-w-[120px]">{node.commit.author_name}</span>
                            {node.commit.author_date && (
                              <span>
                                {new Date(node.commit.author_date).toLocaleDateString("id-ID", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Short SHA */}
                        <span className="font-mono text-[11px] text-[#8D91A6] group-hover:text-[#6C9BFF] shrink-0 bg-[#12141C] px-2 py-0.5 rounded border border-[#2B2F3D]">
                          {node.commit.short_sha || node.commit.sha.slice(0, 7)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Classic Table View */
            <div className="divide-y divide-[#2B2F3D] max-h-[600px] overflow-y-auto">
              {filteredCommits.map((commit, idx) => (
                <div
                  key={commit.sha || idx}
                  onClick={() => setSelectedCommit(commit)}
                  className={`p-3.5 hover:bg-[#242838]/60 transition cursor-pointer flex items-center justify-between gap-4 ${
                    selectedCommit?.sha === commit.sha ? "bg-[#242838]" : ""
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[#E7E9F2] block truncate">
                      {commit.message}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-[#8D91A6]">
                      <span>{commit.author_name}</span>
                      {commit.author_date && (
                        <span>{new Date(commit.author_date).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-[#6C9BFF] bg-[#12141C] px-2 py-1 rounded border border-[#2B2F3D] shrink-0">
                    {commit.short_sha || commit.sha.slice(0, 7)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commit Details Inspector Panel (1 Column) */}
        <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2F3D]">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#4CB782]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E7E9F2]">
                  Commit Inspector
                </h3>
              </div>

              {selectedCommit && (
                <span className="text-[10px] font-mono text-[#8D91A6]">
                  Selected Node
                </span>
              )}
            </div>

            {selectedCommit ? (
              <div className="space-y-4 text-xs">
                {/* Commit Title */}
                <div>
                  <label className="text-[10px] uppercase font-semibold text-[#5E6275] block mb-1">
                    Commit Message
                  </label>
                  <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D] font-mono text-xs text-[#E7E9F2] break-words">
                    {selectedCommit.message}
                  </div>
                </div>

                {/* Commit SHA */}
                <div>
                  <label className="text-[10px] uppercase font-semibold text-[#5E6275] block mb-1">
                    Full Commit SHA
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#12141C] rounded-lg border border-[#2B2F3D] font-mono text-[11px] text-[#6C9BFF] flex-1 truncate select-all">
                      {selectedCommit.sha}
                    </div>
                    <button
                      onClick={() => handleCopySha(selectedCommit.sha)}
                      title="Salin SHA"
                      className="p-2 rounded-lg bg-[#242838] hover:bg-[#2F3447] text-[#E7E9F2] border border-[#3A3F52] transition cursor-pointer"
                    >
                      {copiedSha === selectedCommit.sha ? (
                        <Check className="w-4 h-4 text-[#4CB782]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#8D91A6]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Author & Timestamp */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
                    <span className="text-[10px] text-[#5E6275] block">Committed By</span>
                    <span className="text-xs font-semibold text-[#E7E9F2] truncate block mt-0.5">
                      {selectedCommit.author_name}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#12141C] rounded-lg border border-[#2B2F3D]">
                    <span className="text-[10px] text-[#5E6275] block">Date</span>
                    <span className="text-[11px] font-mono text-[#8D91A6] block mt-0.5">
                      {selectedCommit.author_date
                        ? new Date(selectedCommit.author_date).toLocaleDateString()
                        : "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Parent Commits */}
                {selectedCommit.parents && selectedCommit.parents.length > 0 && (
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-[#5E6275] block mb-1">
                      Parent Commits ({selectedCommit.parents.length})
                    </label>
                    <div className="space-y-1">
                      {selectedCommit.parents.map((pSha) => (
                        <div
                          key={pSha}
                          className="p-2 bg-[#12141C] rounded border border-[#2B2F3D] font-mono text-[10px] text-[#8D91A6] flex items-center justify-between"
                        >
                          <span>{pSha.slice(0, 10)}...</span>
                          <span className="text-[9px] text-[#5E6275]">parent</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#8D91A6]">
                Klik salah satu node di graph untuk memeriksa detail commit.
              </div>
            )}
          </div>

          {/* External Links & Actions */}
          {selectedCommit && selectedCommit.url && (
            <div className="pt-4 border-t border-[#2B2F3D]">
              <a
                href={selectedCommit.url}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-lg bg-[#242838] hover:bg-[#2F3447] border border-[#3A3F52] text-xs font-bold text-[#E7E9F2] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Lihat di {activeProject?.git_provider === "gitlab" ? "GitLab" : "GitHub"}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#6C9BFF]" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
