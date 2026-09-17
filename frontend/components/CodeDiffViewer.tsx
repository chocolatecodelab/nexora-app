"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TaskDiffFile, TaskDiffResponse } from "@/types";
import { getTaskDiff } from "@/lib/api";
import {
  FileCode2,
  FilePlus,
  FileEdit,
  Columns2,
  Rows,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Minus,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";

interface CodeDiffViewerProps {
  taskId: string;
}

export function CodeDiffViewer({ taskId }: CodeDiffViewerProps) {
  const [diffData, setDiffData] = useState<TaskDiffResponse | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<"file" | "patch" | null>(null);

  const loadDiff = async () => {
    if (!taskId) {
      setDiffData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getTaskDiff(taskId);
      setDiffData(data);
      if (data.files.length > 0 && !selectedFilePath) {
        setSelectedFilePath(data.files[0].path);
      }
    } catch (err) {
      console.warn("Task diff not available yet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiff();
  }, [taskId]);

  const activeFile = useMemo(() => {
    if (!diffData || diffData.files.length === 0) return null;
    return diffData.files.find((f) => f.path === selectedFilePath) || diffData.files[0];
  }, [diffData, selectedFilePath]);

  const safeCopy = async (text: string): Promise<boolean> => {
    try {
      if (typeof window !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("navigator.clipboard failed, attempting fallback:", err);
    }

    try {
      if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        textArea.remove();
        return success;
      }
    } catch (fallbackErr) {
      console.error("Fallback clipboard copy failed:", fallbackErr);
    }
    return false;
  };

  const handleCopyNewContent = async () => {
    if (!activeFile) return;
    const ok = await safeCopy(activeFile.new_content);
    if (ok) {
      setCopiedType("file");
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleCopyRawPatch = async () => {
    if (!activeFile) return;
    const patch = activeFile.diff_lines
      .map((l) => {
        const prefix = l.type === "add" ? "+ " : l.type === "del" ? "- " : "  ";
        return `${prefix}${l.content}`;
      })
      .join("\n");
    const ok = await safeCopy(patch);
    if (ok) {
      setCopiedType("patch");
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  // Build paired rows for Side-by-Side (Split) View
  const splitRows = useMemo(() => {
    if (!activeFile) return [];
    const rows: {
      left?: { lineNum?: number | null; text: string; type: string };
      right?: { lineNum?: number | null; text: string; type: string };
    }[] = [];

    const lines = activeFile.diff_lines;
    let i = 0;
    while (i < lines.length) {
      const cur = lines[i];

      if (cur.type === "neutral") {
        rows.push({
          left: { lineNum: cur.old_line, text: cur.content, type: "neutral" },
          right: { lineNum: cur.new_line, text: cur.content, type: "neutral" },
        });
        i++;
      } else if (cur.type === "del") {
        // Look ahead to see if the next line is an addition (replacement)
        const next = lines[i + 1];
        if (next && next.type === "add") {
          rows.push({
            left: { lineNum: cur.old_line, text: cur.content, type: "del" },
            right: { lineNum: next.new_line, text: next.content, type: "add" },
          });
          i += 2;
        } else {
          rows.push({
            left: { lineNum: cur.old_line, text: cur.content, type: "del" },
            right: undefined,
          });
          i++;
        }
      } else if (cur.type === "add") {
        rows.push({
          left: undefined,
          right: { lineNum: cur.new_line, text: cur.content, type: "add" },
        });
        i++;
      } else {
        i++;
      }
    }

    return rows;
  }, [activeFile]);

  if (isLoading) {
    return (
      <div className="p-16 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6C9BFF]" />
        <p className="text-xs text-[#8D91A6]">Menghitung visual code diff...</p>
      </div>
    );
  }

  if (!diffData || diffData.files.length === 0) {
    return (
      <div className="p-16 bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-center space-y-2">
        <ShieldAlert className="w-6 h-6 mx-auto text-[#5E6275]" />
        <h4 className="text-xs font-bold text-[#E7E9F2]">Belum Ada Perubahan Kode</h4>
        <p className="text-xs text-[#8D91A6]">
          Diff visual akan otomatis muncul setelah agen coding mengeksekusi rencana perbaikan.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] overflow-hidden flex flex-col">
      {/* Top Header Controls */}
      <div className="p-4 border-b border-[#2B2F3D] flex items-center justify-between flex-wrap gap-3 bg-[#12141C]/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#6C9BFF]" />
            <span className="text-xs font-bold text-[#E7E9F2]">
              Files Changed ({diffData.total_files})
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30 font-semibold flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> {diffData.total_additions}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#2E181B] text-[#EB5757] border border-[#EB5757]/30 font-semibold flex items-center gap-0.5">
              <Minus className="w-3 h-3" /> {diffData.total_deletions}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Split vs Unified Toggle */}
          <div className="flex bg-[#12141C] p-1 rounded-lg border border-[#2B2F3D]">
            <button
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "split"
                  ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setViewMode("unified")}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "unified"
                  ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                  : "text-[#8D91A6] hover:text-[#E7E9F2]"
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
          </div>

          {/* Copy Actions */}
          <button
            onClick={handleCopyNewContent}
            title="Salin isi file kode baru yang dimodifikasi"
            className="px-3 py-1.5 rounded-lg bg-[#242838] hover:bg-[#2F3447] border border-[#3A3F52] text-xs font-semibold text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedType === "file" ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#4CB782]" />
                <span className="text-[#4CB782]">Copied File</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8D91A6]" />
                <span>Copy File</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyRawPatch}
            title="Salin raw git patch (diff)"
            className="px-3 py-1.5 rounded-lg bg-[#12141C] hover:bg-[#1f2230] border border-[#2B2F3D] text-xs font-semibold text-[#8D91A6] hover:text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedType === "patch" ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#4CB782]" />
                <span className="text-[#4CB782]">Copied Patch</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Patch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Diff Body: Sidebar + Editor */}
      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
        {/* Left: Files List Sidebar */}
        <div className="md:col-span-1 border-r border-[#2B2F3D] bg-[#12141C]/30 p-2 space-y-1 overflow-y-auto max-h-[600px]">
          <div className="px-2 py-1.5 text-[10px] uppercase font-semibold tracking-wider text-[#5E6275]">
            Modified Files
          </div>
          {diffData.files.map((file) => {
            const isSelected = activeFile?.path === file.path;
            return (
              <button
                key={file.path}
                onClick={() => setSelectedFilePath(file.path)}
                className={`w-full text-left p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-[#242838] border-l-2 border-[#6C9BFF] text-[#E7E9F2]"
                    : "hover:bg-[#1A1D28] text-[#8D91A6] hover:text-[#E7E9F2]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {file.status === "created" ? (
                    <FilePlus className="w-3.5 h-3.5 text-[#4CB782] shrink-0" />
                  ) : (
                    <FileEdit className="w-3.5 h-3.5 text-[#E3A73B] shrink-0" />
                  )}
                  <span className="text-xs font-mono truncate block" title={file.path}>
                    {file.path}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                  {file.additions > 0 && (
                    <span className="text-[#4CB782]">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-[#EB5757]">-{file.deletions}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Code Diff Viewport */}
        <div className="md:col-span-3 bg-[#0E1017] overflow-x-auto overflow-y-auto max-h-[600px] font-mono text-[11px] leading-relaxed select-text">
          {activeFile && (
            <div className="p-3 border-b border-[#2B2F3D] bg-[#12141C] flex items-center justify-between text-xs">
              <span className="font-mono text-[#E7E9F2] font-semibold flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#6C9BFF]" />
                {activeFile.path}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#242838] text-[#8D91A6] border border-[#2B2F3D]">
                {activeFile.status}
              </span>
            </div>
          )}

          {activeFile && viewMode === "split" ? (
            /* SIDE-BY-SIDE (SPLIT) VIEW */
            <div className="grid grid-cols-2 divide-x divide-[#2B2F3D] min-w-[600px]">
              {/* Left Column (Original) */}
              <div>
                <div className="px-3 py-1.5 bg-[#12141C]/80 border-b border-[#2B2F3D] text-[10px] font-bold text-[#8D91A6] uppercase tracking-wider">
                  Original (Before)
                </div>
                <div className="divide-y divide-[#1A1D28]/30">
                  {splitRows.map((row, idx) => {
                    const l = row.left;
                    if (!l) {
                      return (
                        <div
                          key={`left-empty-${idx}`}
                          className="flex items-center px-3 py-0.5 bg-[#12141C]/40 min-h-[22px]"
                        >
                          <span className="w-8 text-[10px] text-[#3A3F52] select-none">-</span>
                        </div>
                      );
                    }

                    const isDel = l.type === "del";
                    return (
                      <div
                        key={`left-${idx}`}
                        className={`flex items-start px-2 py-0.5 min-h-[22px] ${
                          isDel ? "bg-[#2E181B] text-[#EB5757]" : "text-[#B5B9CC]"
                        }`}
                      >
                        <span className="w-8 text-[10px] text-[#5E6275] select-none shrink-0 font-mono">
                          {l.lineNum || ""}
                        </span>
                        <span className="w-4 text-center select-none font-bold shrink-0">
                          {isDel ? "-" : " "}
                        </span>
                        <pre className="flex-1 whitespace-pre-wrap break-all font-mono pl-1">
                          {l.text || " "}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (Modified) */}
              <div>
                <div className="px-3 py-1.5 bg-[#12141C]/80 border-b border-[#2B2F3D] text-[10px] font-bold text-[#4CB782] uppercase tracking-wider">
                  Modified (Nexora Fix)
                </div>
                <div className="divide-y divide-[#1A1D28]/30">
                  {splitRows.map((row, idx) => {
                    const r = row.right;
                    if (!r) {
                      return (
                        <div
                          key={`right-empty-${idx}`}
                          className="flex items-center px-3 py-0.5 bg-[#12141C]/40 min-h-[22px]"
                        >
                          <span className="w-8 text-[10px] text-[#3A3F52] select-none">-</span>
                        </div>
                      );
                    }

                    const isAdd = r.type === "add";
                    return (
                      <div
                        key={`right-${idx}`}
                        className={`flex items-start px-2 py-0.5 min-h-[22px] ${
                          isAdd ? "bg-[#1B2B23] text-[#4CB782]" : "text-[#B5B9CC]"
                        }`}
                      >
                        <span className="w-8 text-[10px] text-[#5E6275] select-none shrink-0 font-mono">
                          {r.lineNum || ""}
                        </span>
                        <span className="w-4 text-center select-none font-bold shrink-0">
                          {isAdd ? "+" : " "}
                        </span>
                        <pre className="flex-1 whitespace-pre-wrap break-all font-mono pl-1">
                          {r.text || " "}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* UNIFIED VIEW */
            activeFile && (
              <div className="divide-y divide-[#1A1D28]/30">
                {activeFile.diff_lines.map((line, idx) => {
                  const isAdd = line.type === "add";
                  const isDel = line.type === "del";

                  return (
                    <div
                      key={idx}
                      className={`flex items-start px-2 py-0.5 min-h-[22px] ${
                        isAdd
                          ? "bg-[#1B2B23] text-[#4CB782]"
                          : isDel
                          ? "bg-[#2E181B] text-[#EB5757]"
                          : "text-[#B5B9CC]"
                      }`}
                    >
                      {/* Old Line # */}
                      <span className="w-8 text-[10px] text-[#5E6275] select-none shrink-0 font-mono text-right pr-2">
                        {line.old_line || ""}
                      </span>

                      {/* New Line # */}
                      <span className="w-8 text-[10px] text-[#5E6275] select-none shrink-0 font-mono text-right pr-2">
                        {line.new_line || ""}
                      </span>

                      {/* +/- Symbol */}
                      <span className="w-4 text-center select-none font-bold shrink-0">
                        {isAdd ? "+" : isDel ? "-" : " "}
                      </span>

                      {/* Line Text */}
                      <pre className="flex-1 whitespace-pre-wrap break-all font-mono pl-1">
                        {line.content || " "}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
