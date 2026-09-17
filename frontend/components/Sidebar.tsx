"use client";

import React from "react";
import {
  LayoutDashboard,
  ListTodo,
  History,
  BarChart2,
  Settings as SettingsIcon,
  GitBranch,
  Cpu,
  Database,
  Bot,
  GitMerge,
  X,
} from "lucide-react";
import { ServiceStatus } from "@/types";

export type NavTab = "dashboard" | "tasks" | "history" | "evaluation" | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  serviceStatus: ServiceStatus;
  apiConnected: boolean;
  activeTasksCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  serviceStatus,
  apiConnected,
  activeTasksCount = 0,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "dashboard", label: "Agent Workspace", icon: LayoutDashboard },
    { id: "tasks", label: "Task History", icon: ListTodo, count: activeTasksCount },
    { id: "history", label: "Git Graph & Commits", icon: History },
    { id: "evaluation", label: "Evaluation & Analytics", icon: BarChart2 },
    { id: "settings", label: "Settings & Auth", icon: SettingsIcon },
  ];

  const renderContent = (isMobile: boolean = false) => (
    <div className="flex flex-col justify-between h-full min-h-screen">
      {/* Brand Header */}
      <div>
        <div className="px-6 py-5 border-b border-[#2B2F3D] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#242838] border border-[#3A3F52] flex items-center justify-center text-[#4CB782]">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold tracking-tight text-[#E7E9F2]">
                Nexora
              </h1>
              <p className="text-[11px] text-[#8D91A6] font-medium leading-none mt-0.5">
                AI software engineer
              </p>
            </div>
          </div>

          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8D91A6] hover:text-[#E7E9F2] hover:bg-[#242838] transition cursor-pointer md:hidden"
              aria-label="Tutup navigasi"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] uppercase font-semibold tracking-wider text-[#5E6275]">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobile && onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-[#242838] text-[#E7E9F2] border-l-2 border-[#6C9BFF]"
                    : "text-[#8D91A6] hover:bg-[#222633] hover:text-[#E7E9F2]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#6C9BFF]" : "text-[#8D91A6]"}`} />
                  <span>{item.label}</span>
                </div>

                {typeof item.count === "number" && item.count > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#2E260F] text-[#E3A73B] border border-[#E3A73B]/30">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-[#2B2F3D] bg-[#12141C]/50 text-xs">
        <div className="text-[10px] uppercase font-semibold tracking-wider text-[#5E6275] mb-2.5">
          Engine Status
        </div>

        <div className="space-y-2">
          {/* FastAPI Core */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-[#8D91A6]">
              <Cpu className="w-3.5 h-3.5 text-[#5E6275]" /> FastAPI
            </span>
            <span
              className={`font-mono text-[10px] flex items-center gap-1 ${
                apiConnected ? "text-[#4CB782]" : "text-[#E0594A]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiConnected ? "bg-[#4CB782]" : "bg-[#E0594A]"
                }`}
              />
              {apiConnected ? "online" : "offline"}
            </span>
          </div>

          {/* Supabase DB */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-[#8D91A6]">
              <Database className="w-3.5 h-3.5 text-[#5E6275]" /> Supabase
            </span>
            <span
              className={`font-mono text-[10px] flex items-center gap-1 ${
                serviceStatus.supabase ? "text-[#4CB782]" : "text-[#E3A73B]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serviceStatus.supabase ? "bg-[#4CB782]" : "bg-[#E3A73B]"
                }`}
              />
              {serviceStatus.supabase ? "connected" : "in-memory"}
            </span>
          </div>

          {/* Gemini AI */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-[#8D91A6]">
              <Bot className="w-3.5 h-3.5 text-[#5E6275]" /> Gemini 3.5 Flash
            </span>
            <span
              className={`font-mono text-[10px] flex items-center gap-1 ${
                serviceStatus.gemini ? "text-[#4CB782]" : "text-[#5E6275]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serviceStatus.gemini ? "bg-[#4CB782]" : "bg-[#5E6275]"
                }`}
              />
              {serviceStatus.gemini ? "ready" : "unconfigured"}
            </span>
          </div>

          {/* Git Providers */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-[#8D91A6]">
              <GitMerge className="w-3.5 h-3.5 text-[#5E6275]" /> GitHub / GitLab
            </span>
            <span
              className={`font-mono text-[10px] flex items-center gap-1 ${
                serviceStatus.github ? "text-[#4CB782]" : "text-[#5E6275]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serviceStatus.github ? "bg-[#4CB782]" : "bg-[#5E6275]"
                }`}
              />
              {serviceStatus.github ? "ready" : "unconfigured"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#1A1D28] border-r border-[#2B2F3D] flex-col justify-between min-h-screen sticky top-0 h-screen z-30">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer Navigation */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />

          {/* Drawer Body */}
          <aside className="relative z-50 w-72 bg-[#1A1D28] border-r border-[#2B2F3D] flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
