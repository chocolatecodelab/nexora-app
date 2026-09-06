"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { TaskComment } from "@/types";

interface TaskCommentPanelProps {
  taskId: string;
  comments: TaskComment[];
  onAddComment: (commentText: string, isIntervention: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function TaskCommentPanel({
  taskId,
  comments,
  onAddComment,
  isLoading = false,
}: TaskCommentPanelProps) {
  const [commentText, setCommentText] = useState("");
  const [isIntervention, setIsIntervention] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddComment(commentText.trim(), isIntervention);
      setCommentText("");
      setIsIntervention(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] overflow-hidden flex flex-col">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-[#12141C] border-b border-[#2B2F3D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#6C9BFF]" />
          <span className="text-xs font-mono font-semibold text-[#E7E9F2]">
            Human Review & Live Intervention Trail
          </span>
        </div>

        <span className="text-[11px] font-mono text-[#8D91A6]">
          {comments.length} comments
        </span>
      </div>

      {/* Comments List */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto flex-1">
        {comments.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-[#5E6275] space-y-1">
            <p>No human reviews or comments on this task yet.</p>
            <p className="text-[11px] text-[#8D91A6]/80">
              You can post guidance or trigger an immediate pause if the agent is off-track.
            </p>
          </div>
        ) : (
          comments.map((c) => {
            const timeStr = new Date(c.created_at).toLocaleTimeString();
            const dateStr = new Date(c.created_at).toLocaleDateString();

            return (
              <div
                key={c.id}
                className={`p-3 rounded-lg border text-xs font-mono space-y-1.5 transition ${
                  c.is_intervention
                    ? "bg-[#2E1D1B] border-[#E0594A]/60 shadow-sm"
                    : "bg-[#12141C] border-[#2B2F3D]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    {c.is_intervention ? (
                      <span className="px-2 py-0.5 rounded bg-[#E0594A]/20 text-[#E0594A] border border-[#E0594A]/40 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> INTERVENTION
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#242838] text-[#6C9BFF] border border-[#3A3F52] font-semibold">
                        HUMAN REVIEW
                      </span>
                    )}

                    {c.task_status_at && (
                      <span className="text-[#8D91A6]">
                        at status: <strong className="text-[#E7E9F2]">{c.task_status_at}</strong>
                      </span>
                    )}
                  </div>

                  <span className="text-[#5E6275] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {dateStr} {timeStr}
                  </span>
                </div>

                <p className="text-[#E7E9F2] text-xs leading-relaxed whitespace-pre-wrap">
                  {c.comment_text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#12141C] border-t border-[#2B2F3D] space-y-2.5">
        <textarea
          rows={2}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Berikan instruksi tambahan, catatan arsitektur, atau review untuk agen..."
          className="w-full bg-[#1A1D28] border border-[#2B2F3D] rounded-[8px] p-2.5 text-xs text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-[#8D91A6] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isIntervention}
              onChange={(e) => setIsIntervention(e.target.checked)}
              className="rounded border-[#2B2F3D] text-[#E0594A] focus:ring-[#E0594A] bg-[#1A1D28] cursor-pointer"
            />
            <span className={isIntervention ? "text-[#E0594A] font-bold" : ""}>
              ⚠️ Intervene & Pause Agent at Next Step
            </span>
          </label>

          <button
            type="submit"
            disabled={!commentText.trim() || isSubmitting}
            className={`px-4 py-1.5 rounded-[8px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50 ${
              isIntervention
                ? "bg-[#E0594A] hover:bg-[#E0594A]/90 text-[#12141C]"
                : "bg-[#6C9BFF] hover:bg-[#6C9BFF]/90 text-[#12141C]"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isIntervention ? "Send Intervention" : "Post Review"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
