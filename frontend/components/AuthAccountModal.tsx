"use client";

import React, { useState, useEffect } from "react";
import { AuthStatusResponse, ConnectedAccount } from "@/types";
import { getAuthStatus, connectGitToken, disconnectGitProvider } from "@/lib/api";
import {
  KeyRound,
  ShieldCheck,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
  Lock,
} from "lucide-react";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function GitlabIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M22.65 14.39L20.61 8.1a.75.75 0 0 0-1.43 0l-2.04 6.29H6.86L4.82 8.1a.75.75 0 0 0-1.43 0L1.35 14.39a1.5 1.5 0 0 0 .54 1.68l10.11 7.36a1.5 1.5 0 0 0 1.76 0l10.11-7.36a1.5 1.5 0 0 0 .54-1.68z" />
    </svg>
  );
}

interface AuthAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthUpdated?: () => void;
}

export function AuthAccountModal({
  isOpen,
  onClose,
  onAuthUpdated,
}: AuthAccountModalProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"github" | "gitlab">("github");
  const [githubToken, setGithubToken] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [gitlabUrl, setGitlabUrl] = useState("https://gitlab.com");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const status = await getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      console.error("Failed to fetch auth status:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim()) {
      setErrorMessage("Masukkan GitHub Personal Access Token terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const tokenVal = githubToken.trim();
      const res = await connectGitToken({
        provider: "github",
        token: tokenVal,
      });
      sessionStorage.setItem("nexora_gh_token", tokenVal);
      setSuccessMessage(`Berhasil terhubung ke GitHub sebagai @${res.username}!`);
      setGithubToken("");
      await fetchStatus();
      onAuthUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menghubungkan akun GitHub. Pastikan token valid.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGitlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitlabToken.trim()) {
      setErrorMessage("Masukkan GitLab Personal Access Token terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const tokenVal = gitlabToken.trim();
      const urlVal = gitlabUrl.trim();
      const res = await connectGitToken({
        provider: "gitlab",
        token: tokenVal,
        gitlab_url: urlVal,
      });
      sessionStorage.setItem("nexora_gl_token", tokenVal);
      sessionStorage.setItem("nexora_gl_url", urlVal);
      setSuccessMessage(`Berhasil terhubung ke GitLab sebagai @${res.username}!`);
      setGitlabToken("");
      await fetchStatus();
      onAuthUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menghubungkan akun GitLab. Pastikan token & URL valid.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (provider: "github" | "gitlab") => {
    try {
      await disconnectGitProvider(provider);
      if (provider === "github") {
        sessionStorage.removeItem("nexora_gh_token");
      } else {
        sessionStorage.removeItem("nexora_gl_token");
        sessionStorage.removeItem("nexora_gl_url");
      }
      await fetchStatus();
      setSuccessMessage(`Akun ${provider.toUpperCase()} berhasil diputuskan.`);
      onAuthUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memutuskan akun.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1A1D28] border border-[#2B2F3D] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#2B2F3D] flex items-center justify-between bg-[#12141C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6C9BFF]/10 border border-[#6C9BFF]/30 flex items-center justify-center text-[#6C9BFF]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-[#E7E9F2]">
                Git Provider Authentication & Login
              </h3>
              <p className="text-[11px] text-[#8D91A6]">
                Kelola kredensial runtime tanpa menyimpan hardcoded token di kode
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8D91A6] hover:text-[#E7E9F2] hover:bg-[#242838] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="flex border-b border-[#2B2F3D] bg-[#12141C]/50 px-4 pt-2 gap-2">
          <button
            onClick={() => {
              setActiveTab("github");
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === "github"
                ? "bg-[#1A1D28] text-[#6C9BFF] border-t border-x border-[#2B2F3D]"
                : "text-[#8D91A6] hover:text-[#E7E9F2]"
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
            {authStatus?.github.connected && (
              <span className="w-2 h-2 rounded-full bg-[#4CB782]" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("gitlab");
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === "gitlab"
                ? "bg-[#1A1D28] text-[#FC6D26] border-t border-x border-[#2B2F3D]"
                : "text-[#8D91A6] hover:text-[#E7E9F2]"
            }`}
          >
            <GitlabIcon className="w-3.5 h-3.5" />
            <span>GitLab</span>
            {authStatus?.gitlab.connected && (
              <span className="w-2 h-2 rounded-full bg-[#4CB782]" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 space-y-4">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-[#2E181B] border border-[#EB5757]/40 rounded-lg text-xs text-[#EB5757] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-[#1B2B23] border border-[#4CB782]/40 rounded-lg text-xs text-[#4CB782] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* GITHUB TAB */}
          {activeTab === "github" && (
            <div className="space-y-4">
              {authStatus?.github.connected ? (
                <div className="p-4 bg-[#12141C] border border-[#2B2F3D] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {authStatus.github.avatar_url ? (
                      <img
                        src={authStatus.github.avatar_url}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-[#2B2F3D]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#242838] flex items-center justify-center text-[#6C9BFF]">
                        <GithubIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#E7E9F2]">
                          {authStatus.github.name || authStatus.github.username}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30">
                          Connected
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#8D91A6]">
                        @{authStatus.github.username}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDisconnect("github")}
                    className="px-3 py-1.5 rounded-lg bg-[#2E181B] hover:bg-[#3d1f23] border border-[#EB5757]/40 text-xs font-semibold text-[#EB5757] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-[#12141C]/60 border border-[#2B2F3D] rounded-lg text-xs text-[#8D91A6] flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-[#6C9BFF] shrink-0" />
                  <span>
                    Hubungkan akun GitHub Anda menggunakan Personal Access Token (repo, workflow, read:user). Token tersimpan aman di memory runtime tanpa di-commit.
                  </span>
                </div>
              )}

              <form onSubmit={handleConnectGithub} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E7E9F2] mb-1">
                    {authStatus?.github.connected ? "Ganti GitHub Token" : "GitHub Personal Access Token"}
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_... atau github_pat_..."
                    className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user,workflow"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#6C9BFF] hover:underline flex items-center gap-1"
                  >
                    Buat token di GitHub <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#6C9BFF] hover:bg-[#5A8AEB] text-black font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{authStatus?.github.connected ? "Update Token" : "Hubungkan GitHub"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* GITLAB TAB */}
          {activeTab === "gitlab" && (
            <div className="space-y-4">
              {authStatus?.gitlab.connected ? (
                <div className="p-4 bg-[#12141C] border border-[#2B2F3D] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {authStatus.gitlab.avatar_url ? (
                      <img
                        src={authStatus.gitlab.avatar_url}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-[#2B2F3D]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#242838] flex items-center justify-center text-[#FC6D26]">
                        <GitlabIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#E7E9F2]">
                          {authStatus.gitlab.name || authStatus.gitlab.username}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30">
                          Connected
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#8D91A6]">
                        @{authStatus.gitlab.username}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDisconnect("gitlab")}
                    className="px-3 py-1.5 rounded-lg bg-[#2E181B] hover:bg-[#3d1f23] border border-[#EB5757]/40 text-xs font-semibold text-[#EB5757] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-[#12141C]/60 border border-[#2B2F3D] rounded-lg text-xs text-[#8D91A6] flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-[#FC6D26] shrink-0" />
                  <span>
                    Hubungkan akun GitLab (gitlab.com atau Self-Hosted GitLab) menggunakan Personal Access Token (api, read_user, write_repository).
                  </span>
                </div>
              )}

              <form onSubmit={handleConnectGitlab} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E7E9F2] mb-1">
                    GitLab Instance URL
                  </label>
                  <input
                    type="url"
                    value={gitlabUrl}
                    onChange={(e) => setGitlabUrl(e.target.value)}
                    placeholder="https://gitlab.com"
                    className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#FC6D26]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E7E9F2] mb-1">
                    {authStatus?.gitlab.connected ? "Ganti GitLab Token" : "GitLab Personal Access Token"}
                  </label>
                  <input
                    type="password"
                    value={gitlabToken}
                    onChange={(e) => setGitlabToken(e.target.value)}
                    placeholder="glpat-..."
                    className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-lg px-3 py-2 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#FC6D26]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://gitlab.com/-/user_settings/personal_access_tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#FC6D26] hover:underline flex items-center gap-1"
                  >
                    Buat token di GitLab <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#FC6D26] hover:bg-[#E25C1D] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{authStatus?.gitlab.connected ? "Update Token" : "Hubungkan GitLab"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
