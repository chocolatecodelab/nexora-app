"use client";

import React from "react";
import { CheckCircle2, Database, Cpu, GitBranch, KeyRound, UserCheck } from "lucide-react";
import { ServiceStatus, AuthStatusResponse } from "@/types";

interface NavbarProps {
  status: ServiceStatus;
  apiConnected: boolean;
  authStatus?: AuthStatusResponse | null;
  onOpenAuthModal?: () => void;
}

export function Navbar({ status, apiConnected, authStatus, onOpenAuthModal }: NavbarProps) {
  const hasGitAuth = authStatus?.github.connected || authStatus?.gitlab.connected;
  const connectedUser = authStatus?.github.connected
    ? { provider: "GitHub", username: authStatus.github.username, avatar: authStatus.github.avatar_url }
    : authStatus?.gitlab.connected
    ? { provider: "GitLab", username: authStatus.gitlab.username, avatar: authStatus.gitlab.avatar_url }
    : null;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-[#2B2F3D] px-6 py-3.5 bg-[#12141C]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#242838] border border-[#3A3F52]">
            <GitBranch className="w-5 h-5 text-[#4CB782]" />
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#12141C]"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#E7E9F2] font-heading">
                Nexora <span className="text-[#6C9BFF]">AI</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-full bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30">
                v1.1 Live
              </span>
            </div>
            <p className="text-xs text-[#8D91A6] hidden sm:block">
              Autonomous AI Software Engineering Workstation
            </p>
          </div>
        </div>

        {/* Live Service Status Indicators & Dynamic Git Provider Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* FastAPI Core */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12141C] border border-[#2B2F3D] text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#8D91A6]" />
            <span className="text-[#8D91A6] font-medium hidden md:inline">API</span>
            {apiConnected ? (
              <span className="flex items-center gap-1 text-[#4CB782] font-medium text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4CB782]"></span> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#E0594A] font-medium text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E0594A]"></span> Offline
              </span>
            )}
          </div>

          {/* Gemini AI */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12141C] border border-[#2B2F3D] text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#6C9BFF]" />
            <span className="text-[#8D91A6] font-medium hidden md:inline">Gemini</span>
            {status.gemini ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4CB782]" />
            ) : (
              <span className="text-[11px] text-[#E3A73B] font-mono">Connected</span>
            )}
          </div>

          {/* Dynamic Git Provider Auth Account Button */}
          {hasGitAuth && connectedUser ? (
            <button
              onClick={onOpenAuthModal}
              title={`Connected as @${connectedUser.username} (${connectedUser.provider}). Click to manage or disconnect.`}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1B2B23] border border-[#4CB782]/40 hover:border-[#4CB782] text-xs transition cursor-pointer"
            >
              {connectedUser.avatar ? (
                <img
                  src={connectedUser.avatar}
                  alt={connectedUser.username || "avatar"}
                  className="w-4 h-4 rounded-full border border-[#4CB782]/50 object-cover"
                />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-[#4CB782]" />
              )}
              <div className="flex items-center gap-1 text-left font-mono">
                <span className="text-[11px] text-[#4CB782] font-semibold">
                  @{connectedUser.username}
                </span>
                <span className="text-[9px] text-[#8D91A6] hidden lg:inline">
                  ({connectedUser.provider})
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              title="No Git token connected. Click to log in to GitHub or GitLab."
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2E260F] border border-[#E3A73B]/50 hover:border-[#E3A73B] text-xs text-[#E3A73B] font-medium transition cursor-pointer animate-pulse hover:animate-none"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#E3A73B]" />
              <span className="font-mono text-[11px] font-bold">Connect Git Account</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
