"use client";

import React from "react";
import { TaskStatus } from "@/types";

interface StatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  let text = status;
  let borderClass = "border-[#3A3F52]";
  let bgClass = "bg-[#1A1D28]";
  let textClass = "text-[#8D91A6]";
  let dotColor = "bg-[#5E6275]";
  let isPulsing = false;

  switch (status) {
    case "queued":
      text = "queued";
      borderClass = "border-[#3A3F52]";
      bgClass = "bg-[#1A1D28]";
      textClass = "text-[#8D91A6]";
      dotColor = "bg-[#5E6275]";
      break;

    case "analyzing_issue":
    case "analyzing_repo":
      text = status === "analyzing_issue" ? "analyzing_issue" : "analyzing_repo";
      borderClass = "border-[#E3A73B]/40";
      bgClass = "bg-[#2E260F]";
      textClass = "text-[#E3A73B]";
      dotColor = "bg-[#E3A73B]";
      isPulsing = true;
      break;

    case "planning":
      text = "planning";
      borderClass = "border-[#E3A73B]/40";
      bgClass = "bg-[#2E260F]";
      textClass = "text-[#E3A73B]";
      dotColor = "bg-[#E3A73B]";
      isPulsing = true;
      break;

    case "awaiting_approval":
      text = "awaiting_approval";
      borderClass = "border-[#E3A73B]";
      bgClass = "bg-[#2E260F]";
      textClass = "text-[#E3A73B] font-semibold";
      dotColor = "bg-[#E3A73B]";
      isPulsing = true;
      break;

    case "implementing":
      text = "implementing";
      borderClass = "border-[#E3A73B]/40";
      bgClass = "bg-[#2E260F]";
      textClass = "text-[#E3A73B]";
      dotColor = "bg-[#E3A73B]";
      isPulsing = true;
      break;

    case "testing":
    case "debugging":
      text = status === "testing" ? "testing" : "debugging";
      borderClass = "border-[#E3A73B]/40";
      bgClass = "bg-[#2E260F]";
      textClass = "text-[#E3A73B]";
      dotColor = "bg-[#E3A73B]";
      isPulsing = true;
      break;

    case "pr_creating":
    case "pr_created":
      text = status === "pr_creating" ? "pr_creating" : "pr_created";
      borderClass = "border-[#4CB782]/40";
      bgClass = "bg-[#1B2B23]";
      textClass = "text-[#4CB782]";
      dotColor = "bg-[#4CB782]";
      break;

    case "failed":
      text = "failed";
      borderClass = "border-[#E0594A]/40";
      bgClass = "bg-[#2E1D1B]";
      textClass = "text-[#E0594A]";
      dotColor = "bg-[#E0594A]";
      break;

    case "needs_human_help":
      text = "needs_human_help";
      borderClass = "border-[#E0594A]";
      bgClass = "bg-[#2E1D1B]";
      textClass = "text-[#E0594A]";
      dotColor = "bg-[#E0594A]";
      isPulsing = true;
      break;

    case "cancelled":
      text = "cancelled";
      borderClass = "border-[#5E6275]";
      bgClass = "bg-[#1A1D28]";
      textClass = "text-[#8D91A6]";
      dotColor = "bg-[#5E6275]";
      break;

    default:
      text = status;
      borderClass = "border-[#3A3F52]";
      bgClass = "bg-[#1A1D28]";
      textClass = "text-[#8D91A6]";
      dotColor = "bg-[#5E6275]";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono tracking-tight transition-colors ${borderClass} ${bgClass} ${textClass} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${
          isPulsing ? "animate-agent-pulse" : ""
        }`}
      />
      <span>{text}</span>
    </span>
  );
}
