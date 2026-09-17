"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Project,
  GitHubIssue,
  Task,
  AgentRun,
  ToolCall,
  TaskComment,
  ServiceStatus,
} from "@/types";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressStepper } from "@/components/ProgressStepper";
import { ImplementationPlanCard } from "@/components/ImplementationPlanCard";
import { ToolLogViewer } from "@/components/ToolLogViewer";
import { TaskCommentPanel } from "@/components/TaskCommentPanel";
import { EvaluationTab } from "@/components/EvaluationTab";
import { SettingsTab } from "@/components/SettingsTab";
import { CommitHistoryTab } from "@/components/CommitHistoryTab";
import { CodeDiffViewer } from "@/components/CodeDiffViewer";
import { SecurityGuardrailCard } from "@/components/SecurityGuardrailCard";
import { AuthAccountModal } from "@/components/AuthAccountModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Toast, ToastMessage, ToastType } from "@/components/Toast";
import {
  checkHealth,
  getServiceStatus,
  getAuthStatus,
  connectGitToken,
  getProjects,
  createProject,
  getProjectIssues,
  createProjectIssue,
  getProjectFiles,
  getProjectBranches,
  createProjectBranch,
  listDiscoveryRepos,
  createTask,
  getTask,
  listTasks,
  deleteTask,
  clearTaskHistory,
  approveTask,
  rejectTask,
  cancelTask,
  restartTask,
  revertTaskPR,
  closeTaskPR,
  mergeTaskPR,
  addTaskComment,
  getTaskComments,
  getTaskRuns,
  getRunToolCalls,
  getTaskStreamUrl,
  getTaskFull,
} from "@/lib/api";
import {
  AuthStatusResponse,
  TaskAttachment,
} from "@/types";
import {
  Play,
  Loader2,
  FolderGit2,
  GitPullRequest,
  GitMerge,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Plus,
  AlertTriangle,
  FileCode2,
  Terminal,
  Clock,
  Tag,
  CheckCircle2,
  Ban,
  RotateCcw,
  MessageSquare,
  AlertCircle,
  Target,
  Crosshair,
  FileCheck,
  Search,
  FileText,
  CheckSquare,
  Square,
  X,
  XCircle,
  History,
  KeyRound,
  ShieldCheck,
  Paperclip,
  Image as ImageIcon,
  UploadCloud,
  File as FileIcon,
  Trash2,
  Menu,
} from "lucide-react";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    supabase: false,
    gemini: false,
    github: false,
  });
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Projects & Issues
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);

  // Target Files & Context Scoping State (Selective Understanding)
  const [projectFiles, setProjectFiles] = useState<{ path: string }[]>([]);
  const [selectedTargetFiles, setSelectedTargetFiles] = useState<string[]>([]);
  const [focusHints, setFocusHints] = useState<string>("");
  const [showFilePickerModal, setShowFilePickerModal] = useState<boolean>(false);
  const [filePickerSearch, setFilePickerSearch] = useState<string>("");

  // Multimodal Attachments State (Images & Supplemental Documents)
  const [uploadedAttachments, setUploadedAttachments] = useState<TaskAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [previewModalImage, setPreviewModalImage] = useState<{ src: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tasks & Observability
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeTaskViewTab, setActiveTaskViewTab] = useState<"plan" | "diff" | "security" | "logs" | "comments">("plan");
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [toolCalls, setToolCalls] = useState<Record<string, ToolCall[]>>({});
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);

  // Action Loading States
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBaseBranch, setSelectedBaseBranch] = useState<string>("");
  const [isSyncingGit, setIsSyncingGit] = useState<boolean>(false);
  const [isStartingAgent, setIsStartingAgent] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [revertResult, setRevertResult] = useState<string | null>(null);
  const [isClosingPR, setIsClosingPR] = useState(false);
  const [isMergingPR, setIsMergingPR] = useState(false);

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectProvider, setConnectProvider] = useState<"github" | "gitlab">("github");
  const [discoveryRepos, setDiscoveryRepos] = useState<{ full_name: string; description?: string }[]>([]);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [newRepoFullName, setNewRepoFullName] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [isSubmittingRepo, setIsSubmittingRepo] = useState(false);

  // Custom Issue Modal
  const [showCustomIssueModal, setShowCustomIssueModal] = useState(false);
  const [customIssueTitle, setCustomIssueTitle] = useState("");
  const [customIssueBody, setCustomIssueBody] = useState("");
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);

  // Task History Management & Filter
  const [taskHistoryFilter, setTaskHistoryFilter] = useState<"all" | "active" | "completed" | "failed">("all");
  const [isClearingTasks, setIsClearingTasks] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Modern UI Feedback: Non-blocking Toast & Confirmation Modal
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ id: String(Date.now()), type, message });
  }, []);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmLabel?: string; cancelLabel?: string; isDestructive?: boolean }
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
      isDestructive: options?.isDestructive,
      onConfirm: () => {
        setConfirmState(null);
        onConfirm();
      },
    });
  };

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load & Background Reconnect Poll
  useEffect(() => {
    async function refreshEngine() {
      try {
        await checkHealth();
        setApiConnected(true);
        const status = await getServiceStatus();
        setServiceStatus(status);
      } catch {
        setApiConnected(false);
      }
    }

    async function init() {
      await refreshEngine();

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab") as NavTab | null;
        if (tab && ["dashboard", "tasks", "history", "evaluation", "settings"].includes(tab)) {
          setCurrentTab(tab);
        }
      }

      // Fetch projects
      try {
        const projs = await getProjects();
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProject(projs[0]);
        } else {
          setSelectedProject(null);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }

      // Fetch Auth Status from backend
      try {
        const auth = await getAuthStatus();
        setAuthStatus(auth);
      } catch (err) {
        console.error("Failed to load auth status:", err);
      }

      // Fetch task history — strictly only resume activeTask if an in-progress pipeline is running!
      try {
        const tasks = await listTasks();
        setAllTasks(tasks);

        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const taskIdParam = params?.get("taskId");
        const viewTabParam = params?.get("viewTab") as "plan" | "diff" | "security" | "logs" | "comments" | null;

        if (viewTabParam && ["plan", "diff", "security", "logs", "comments"].includes(viewTabParam)) {
          setActiveTaskViewTab(viewTabParam);
        }

        if (taskIdParam) {
          const target = tasks.find((t) => t.id === taskIdParam);
          if (target) {
            setActiveTask(target);
            fetchTaskDetails(target.id);
          }
        } else {
          const inProgress = tasks.find((t) =>
            [
              "queued",
              "analyzing_issue",
              "analyzing_repo",
              "planning",
              "awaiting_approval",
              "implementing",
              "testing",
              "debugging",
              "pr_creating",
            ].includes(t.status)
          );
          setActiveTask(inProgress || null);
        }
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
    }

    init();

    // Automatic background reconnect timer (polls engine status every 3s)
    const statusTimer = setInterval(refreshEngine, 3000);
    return () => clearInterval(statusTimer);
  }, []);

  // Handler to clear workspace and return to fresh issue selection
  const handleResetWorkspace = () => {
    setActiveTask(null);
    setSelectedTargetFiles([]);
    setFocusHints("");
    setUploadedAttachments([]);
  };

  // Handler to delete a single task from history
  const handleDeleteTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    requestConfirm(
      "Hapus Task",
      "Yakin ingin menghapus task ini dari riwayat?",
      async () => {
        setDeletingTaskId(taskId);
        try {
          await deleteTask(taskId);
          setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
          if (activeTask?.id === taskId) {
            setActiveTask(null);
          }
          showToast("info", "Task berhasil dihapus dari riwayat.");
        } catch (err) {
          console.error("Failed to delete task:", err);
          showToast("error", `Gagal menghapus task: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setDeletingTaskId(null);
        }
      },
      { confirmLabel: "Hapus Task", isDestructive: true }
    );
  };

  // Handler to clear all task history
  const handleClearTaskHistory = () => {
    requestConfirm(
      "Hapus Seluruh Riwayat Task",
      "Apakah Anda yakin ingin membersihkan semua riwayat task, log eksekusi, dan rekaman agen dari database?",
      async () => {
        setIsClearingTasks(true);
        try {
          await clearTaskHistory();
          setAllTasks([]);
          setActiveTask(null);
          showToast("success", "Semua riwayat task berhasil dibersihkan!");
        } catch (err) {
          console.error("Failed to clear task history:", err);
          showToast("error", `Gagal membersihkan riwayat task: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsClearingTasks(false);
        }
      },
      { confirmLabel: "Hapus Semua", isDestructive: true }
    );
  };

  // 2. Fetch issues, project files & remote branches when selected repository changes
  const loadIssuesAndFiles = useCallback(async (proj?: Project | null) => {
    const targetProj = proj !== undefined ? proj : selectedProject;
    if (!targetProj) {
      setIssues([]);
      setSelectedIssue(null);
      setProjectFiles([]);
      setSelectedTargetFiles([]);
      setBranches([]);
      return;
    }

    setIsLoadingIssues(true);
    setIsLoadingFiles(true);

    try {
      const [iss, files, bList] = await Promise.all([
        getProjectIssues(targetProj.id),
        getProjectFiles(targetProj.id),
        getProjectBranches(targetProj.id),
      ]);
      setIssues(iss);
      setProjectFiles(files);
      setBranches(bList);
      if (iss.length > 0 && !selectedIssue) {
        setSelectedIssue(iss[0]);
      }
      if (bList.length > 0) {
        const def = targetProj.default_branch || "main";
        setSelectedBaseBranch((prev) => (prev && bList.includes(prev) ? prev : (bList.includes(def) ? def : bList[0])));
      }
    } catch (err) {
      console.error("Failed to load live project data from provider:", err);
    } finally {
      setIsLoadingIssues(false);
      setIsLoadingFiles(false);
    }
  }, [selectedProject, selectedIssue]);

  useEffect(() => {
    if (selectedProject) {
      loadIssuesAndFiles(selectedProject);
    }
  }, [selectedProject?.id]);

  // Reusable Live Sync from Git Provider (on demand via Refresh / Sync button)
  const handleSyncGit = async () => {
    if (!selectedProject) return;
    setIsSyncingGit(true);
    try {
      await loadIssuesAndFiles(selectedProject);
    } finally {
      setIsSyncingGit(false);
    }
  };

  // Load discovery repos when Connect Modal opens or provider changes
  useEffect(() => {
    if (!showConnectModal) return;
    async function loadDiscovery() {
      setIsLoadingDiscovery(true);
      try {
        const repos = await listDiscoveryRepos(connectProvider);
        setDiscoveryRepos(repos);
      } catch (err) {
        console.error("Failed to list discovery repos:", err);
      } finally {
        setIsLoadingDiscovery(false);
      }
    }
    loadDiscovery();
  }, [showConnectModal, connectProvider]);

  // 3. Fast single-request fetching for task details, observability logs & human comments
  const fetchTaskDetails = useCallback(async (taskId: string) => {
    try {
      const full = await getTaskFull(taskId);
      setActiveTask(full.task);

      // Update in allTasks list
      setAllTasks((prev) =>
        prev.map((t) => (t.id === full.task.id ? { ...t, ...full.task } : t))
      );

      setAgentRuns(full.runs || []);
      setToolCalls(full.tool_calls || {});
      setTaskComments(full.comments || []);
    } catch (err) {
      console.error("Task details fetch error:", err);
    }
  }, []);

  // 3b. SSE Real-Time Event Streaming
  const [isSseConnected, setIsSseConnected] = useState(false);

  useEffect(() => {
    if (!activeTask?.id) {
      setIsSseConnected(false);
      return;
    }

    const isProcessing = [
      "queued",
      "analyzing_issue",
      "analyzing_repo",
      "planning",
      "implementing",
      "testing",
      "debugging",
      "pr_creating",
    ].includes(activeTask.status);

    if (!isProcessing) {
      setIsSseConnected(false);
      return;
    }

    const streamUrl = getTaskStreamUrl(activeTask.id);
    const es = new EventSource(streamUrl);

    es.onopen = () => {
      setIsSseConnected(true);
    };

    es.addEventListener("init", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.task_id === activeTask.id) {
          setActiveTask((prev) => (prev ? { ...prev, ...data } : prev));
          setAllTasks((prev) =>
            prev.map((t) => (t.id === activeTask.id ? { ...t, ...data } : t))
          );
        }
      } catch (err) {
        console.error("SSE init parse error:", err);
      }
    });

    es.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data) {
          setActiveTask((prev) => (prev ? { ...prev, ...data } : prev));
          setAllTasks((prev) =>
            prev.map((t) => (t.id === activeTask.id ? { ...t, ...data } : t))
          );
          if (["awaiting_approval", "pr_created", "completed", "failed", "cancelled"].includes(data.status)) {
            fetchTaskDetails(activeTask.id);
          }
        }
      } catch (err) {
        console.error("SSE status parse error:", err);
      }
    });

    es.addEventListener("plan_ready", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.plan) {
          setActiveTask((prev) => (prev ? { ...prev, plan: data.plan } : prev));
        }
        fetchTaskDetails(activeTask.id);
      } catch (err) {
        console.error("SSE plan_ready parse error:", err);
      }
    });

    es.addEventListener("tool_call", () => {
      fetchTaskDetails(activeTask.id);
    });

    es.addEventListener("terminal_output", () => {
      fetchTaskDetails(activeTask.id);
    });

    es.addEventListener("pr_created", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data) {
          setActiveTask((prev) => (prev ? { ...prev, ...data, status: "pr_created" } : prev));
        }
        fetchTaskDetails(activeTask.id);
      } catch (err) {
        console.error("SSE pr_created error:", err);
      }
    });

    es.onerror = () => {
      setIsSseConnected(false);
    };

    return () => {
      es.close();
      setIsSseConnected(false);
    };
  }, [activeTask?.id, activeTask?.status, fetchTaskDetails]);

  // Smart Adaptive Polling for active task updates (fallback / heartbeat)
  useEffect(() => {
    if (!activeTask?.id) return;

    // Fetch once on task switch
    fetchTaskDetails(activeTask.id);

    // Only run continuous polling if agent is actively running in background
    const isProcessing = [
      "queued",
      "analyzing_issue",
      "analyzing_repo",
      "planning",
      "implementing",
      "testing",
      "debugging",
      "pr_creating",
    ].includes(activeTask.status);

    if (!isProcessing) return;

    // When SSE is connected, poll at a relaxed interval (6s); otherwise fallback to 2s
    const pollInterval = isSseConnected ? 6000 : 2000;
    const intervalId = setInterval(() => {
      fetchTaskDetails(activeTask.id);
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeTask?.id, activeTask?.status, isSseConnected, fetchTaskDetails]);

  // Auto-focus to Code Diff tab once PR is created or merged (unless explicitly requested via URL)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("viewTab")) return;
    }
    if (activeTask?.status === "pr_created" || activeTask?.status === "merged") {
      setActiveTaskViewTab("diff");
    }
  }, [activeTask?.status]);

  // File & Screenshot Attachment Handlers
  const processSelectedFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        showToast("error", `File "${file.name}" melebihi batas ukuran 10MB.`);
        return;
      }
      const reader = new FileReader();
      const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
      reader.onload = () => {
        const base64Data = reader.result as string;
        setUploadedAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            mime_type: file.type || (isImg ? "image/png" : "text/plain"),
            size_bytes: file.size,
            data_base64: base64Data,
            is_image: isImg,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (indexToRemove: number) => {
    setUploadedAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Clipboard Paste Support (Ctrl+V) for Instant Screenshot Uploads
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (currentTab !== "dashboard" || !e.clipboardData) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const items = Array.from(e.clipboardData.items);
      const files: File[] = [];
      items.forEach((item) => {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      });
      if (files.length > 0) {
        processSelectedFiles(files);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [currentTab]);

  // 4. Start Agent Action (with Target Files, Scoping Hints, and Multimodal Attachments)
  const handleStartAgent = async () => {
    if (!selectedProject || !selectedIssue) return;
    setIsStartingAgent(true);
    try {
      const task = await createTask({
        project_id: selectedProject.id,
        issue_number: selectedIssue.number,
        issue_title: selectedIssue.title,
        issue_body: selectedIssue.body || "",
        target_files: selectedTargetFiles.length > 0 ? selectedTargetFiles : undefined,
        focus_hints: focusHints.trim() || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      });
      setActiveTask(task);
      setAllTasks((prev) => [task, ...prev]);
      setActiveTaskViewTab("plan");
      showToast("success", `Agent berhasil dimulai untuk issue #${selectedIssue.number}!`);
    } catch (err) {
      console.error("Failed to start agent:", err);
      showToast("error", `Gagal memulai agent: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsStartingAgent(false);
    }
  };

  // 5. Cancel Task Action
  // 5. Cancel Task Action
  const handleCancelTask = () => {
    if (!activeTask) return;
    requestConfirm(
      "Batalkan Eksekusi Agent",
      "Apakah Anda yakin ingin membatalkan (cancel) eksekusi agent yang sedang berjalan?",
      async () => {
        setIsCancelling(true);
        try {
          await cancelTask(activeTask.id);
          fetchTaskDetails(activeTask.id);
          showToast("info", "Eksekusi agent berhasil dibatalkan.");
        } catch (err) {
          console.error("Failed to cancel task:", err);
          showToast("error", `Gagal membatalkan task: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsCancelling(false);
        }
      },
      { confirmLabel: "Batalkan Eksekusi", isDestructive: true }
    );
  };

  // 6. Restart Task Action
  const handleRestartTask = () => {
    if (!activeTask) return;
    requestConfirm(
      "Restart Task",
      "Apakah Anda ingin memulai ulang task ini dari fase perumusan rencana (planning) awal?",
      async () => {
        setIsRestarting(true);
        try {
          const updated = await restartTask(activeTask.id);
          setActiveTask(updated);
          setActiveTaskViewTab("plan");
          showToast("info", "Task berhasil di-restart ke fase planning.");
        } catch (err) {
          console.error("Failed to restart task:", err);
          showToast("error", `Gagal me-restart task: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsRestarting(false);
        }
      },
      { confirmLabel: "Mulai Ulang", isDestructive: false }
    );
  };

  // 6b. Revert PR Action
  const handleRevertPR = () => {
    if (!activeTask) return;
    requestConfirm(
      "Buat Revert Pull Request",
      `Apakah Anda yakin ingin membuka Revert PR untuk membatalkan perubahan task #${activeTask.issue_number}?`,
      async () => {
        setIsReverting(true);
        setRevertResult(null);
        try {
          const res = await revertTaskPR(activeTask.id);
          if (res.revert_pr_url) {
            setRevertResult(res.revert_pr_url);
          }
          showToast("success", "Revert PR berhasil dibuat di Git Provider!");
        } catch (err) {
          console.error("Failed to create revert PR:", err);
          showToast("error", `Gagal membuat Revert PR: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsReverting(false);
        }
      },
      { confirmLabel: "Buat Revert PR", isDestructive: true }
    );
  };

  // 6c. Close / Discard PR Action
  const handleClosePR = () => {
    if (!activeTask) return;
    requestConfirm(
      "Tutup Pull Request",
      `Apakah Anda yakin ingin menutup / membatalkan PR untuk task #${activeTask.issue_number} tanpa merger?`,
      async () => {
        setIsClosingPR(true);
        try {
          await closeTaskPR(activeTask.id);
          showToast("info", `PR untuk task #${activeTask.issue_number} berhasil ditutup di repository.`);
          const updated = await getTask(activeTask.id);
          setActiveTask(updated);
        } catch (err) {
          console.error("Failed to close PR:", err);
          showToast("error", `Gagal menutup PR: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsClosingPR(false);
        }
      },
      { confirmLabel: "Tutup PR", isDestructive: true }
    );
  };

  // 6d. Direct 1-Click Merge PR to Default Branch (Clean Emerald CTA)
  const handleMergePR = () => {
    if (!activeTask) return;
    const targetBranch = selectedProject?.default_branch || "main";
    requestConfirm(
      "Merge Pull Request",
      `Apakah Anda yakin ingin menggabungkan (Merge) Pull Request ini langsung ke branch '${targetBranch}'?`,
      async () => {
        setIsMergingPR(true);
        try {
          const res = await mergeTaskPR(activeTask.id);
          showToast("success", `Pull Request berhasil dimerge ke branch '${targetBranch}'! ${res.message || ""}`);
          const updated = await getTask(activeTask.id);
          setActiveTask(updated);
          fetchTaskDetails(activeTask.id);
        } catch (err) {
          console.error("Failed to merge PR:", err);
          showToast("error", `Gagal melakukan merge: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsMergingPR(false);
        }
      },
      { confirmLabel: "Merge Sekarang", isDestructive: false }
    );
  };

  // 6e. Start New Task / Work on Another Issue
  const handleStartNewTask = () => {
    setActiveTask(null);
    setSelectedTargetFiles([]);
    setFocusHints("");
    setUploadedAttachments([]);
    if (issues.length > 0) {
      setSelectedIssue(issues[0]);
    }
  };

  // 7. Add Review Comment / Intervention
  const handleAddComment = async (commentText: string, isIntervention: boolean) => {
    if (!activeTask) return;
    await addTaskComment(activeTask.id, {
      comment_text: commentText,
      is_intervention: isIntervention,
    });
    fetchTaskDetails(activeTask.id);
  };

  // 8. Connect Repo Action
  const handleConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoFullName.trim()) return;
    setIsSubmittingRepo(true);
    try {
      const name = newRepoName.trim() || newRepoFullName.split("/")[1] || newRepoFullName;
      const newProj = await createProject({
        name,
        repository_full_name: newRepoFullName.trim(),
        git_provider: connectProvider,
      });
      setProjects((prev) => [newProj, ...prev]);
      setSelectedProject(newProj);
      setShowConnectModal(false);
      setNewRepoFullName("");
      setNewRepoName("");
    } finally {
      setIsSubmittingRepo(false);
    }
  };

  // 9. Custom Issue Creation Action (Directly published to GitHub/GitLab repository)
  const handleCreateCustomIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !customIssueTitle.trim()) return;

    setIsCreatingIssue(true);
    try {
      const newIss = await createProjectIssue(selectedProject.id, {
        title: customIssueTitle.trim(),
        body: customIssueBody.trim() || "No additional description provided.",
        labels: ["nexora-ai", "custom-task"],
      });
      setIssues((prev) => [newIss, ...prev.filter((i) => i.number !== newIss.number)]);
      setSelectedIssue(newIss);
      setShowCustomIssueModal(false);
      setCustomIssueTitle("");
      setCustomIssueBody("");
      showToast("success", `Issue #${newIss.number} berhasil dibuat di repository!`);
    } catch (err) {
      console.error("Failed to create remote issue:", err);
      showToast("error", `Gagal membuat issue di repository: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreatingIssue(false);
    }
  };

  // 10. Approval & Rejection Actions
  const handleApprovePlan = async (taskId: string) => {
    await approveTask(taskId);
    fetchTaskDetails(taskId);
  };

  const handleRejectPlan = async (taskId: string, feedback: string) => {
    await rejectTask(taskId, feedback);
    fetchTaskDetails(taskId);
  };

  // Toggle file selection helper
  const toggleTargetFile = (path: string) => {
    setSelectedTargetFiles((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isGitLabRepo = selectedProject?.git_provider === "gitlab" || selectedProject?.repository_full_name.includes("gitlab") || selectedProject?.repository_full_name.includes("netgen");
  const isTaskRunning = Boolean(activeTask && ["queued", "analyzing_issue", "analyzing_repo", "planning", "awaiting_approval", "implementing", "testing", "debugging"].includes(activeTask.status));

  const filteredProjectFiles = projectFiles.filter((f) =>
    f.path.toLowerCase().includes(filePickerSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#12141C] text-[#E7E9F2] flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        serviceStatus={serviceStatus}
        apiConnected={apiConnected}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        activeTasksCount={allTasks.filter((t) => [
          "queued",
          "analyzing_issue",
          "analyzing_repo",
          "planning",
          "awaiting_approval",
          "implementing",
          "testing",
          "debugging",
          "pr_creating",
        ].includes(t.status)).length}
      />

      {/* Mobile Topbar */}
      <div className="md:hidden px-4 py-3 bg-[#1A1D28] border-b border-[#2B2F3D] flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="p-1.5 rounded-lg text-[#8D91A6] hover:text-[#E7E9F2] hover:bg-[#242838] transition border border-[#2B2F3D] cursor-pointer"
            aria-label="Buka navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#242838] border border-[#3A3F52] flex items-center justify-center text-[#4CB782]">
              <GitBranch className="w-3.5 h-3.5" />
            </div>
            <span className="font-heading font-bold text-sm text-[#E7E9F2]">Nexora</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border cursor-pointer ${
              authStatus?.github.connected || authStatus?.gitlab.connected
                ? "bg-[#1B2B23] border-[#4CB782]/40 text-[#4CB782]"
                : "bg-[#2E260F] border-[#E3A73B]/50 text-[#E3A73B]"
            }`}
          >
            <KeyRound className="w-3 h-3" />
            <span>{authStatus?.github.connected || authStatus?.gitlab.connected ? "Auth OK" : "Auth"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-[calc(100vh-53px)] md:h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="hidden md:flex px-8 py-4 border-b border-[#2B2F3D] bg-[#1A1D28] items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#8D91A6]">
              Autonomous Software Engineering System
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/30">
              v1.1 Live
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {/* Git Provider Dynamic Login / Account Badge */}
            <button
              onClick={() => setShowAuthModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition cursor-pointer border ${
                authStatus?.github.connected || authStatus?.gitlab.connected
                  ? "bg-[#1B2B23] border-[#4CB782]/40 hover:border-[#4CB782]"
                  : "bg-[#2E260F] border-[#E3A73B]/50 hover:border-[#E3A73B]"
              }`}
              title="Kelola Login & Token GitHub/GitLab tanpa hardcode"
            >
              <KeyRound className={`w-3.5 h-3.5 ${authStatus?.github.connected || authStatus?.gitlab.connected ? "text-[#4CB782]" : "text-[#E3A73B]"}`} />
              {authStatus?.github.connected || authStatus?.gitlab.connected ? (
                <span className="text-[#4CB782] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4CB782]" />
                  {authStatus.github.connected
                    ? `@${authStatus.github.username} (GitHub)`
                    : `@${authStatus.gitlab.username} (GitLab)`}
                </span>
              ) : (
                <span className="text-[#E3A73B] font-bold flex items-center gap-1.5 animate-pulse hover:animate-none">
                  <span className="w-2 h-2 rounded-full bg-[#E3A73B]" />
                  Connect Git Account
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#12141C] border border-[#2B2F3D] rounded-full text-[#8D91A6]">
              <span className="w-2 h-2 rounded-full bg-[#4CB782]" />
              <span>Provider: {isGitLabRepo ? "GitLab CI" : "GitHub Actions"}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Views */}
        <div className="p-4 md:p-8 flex-1">
          {/* ============================================================ */}
          {/* TAB 1: DASHBOARD                                             */}
          {/* ============================================================ */}
          {currentTab === "dashboard" && (
            <div className="space-y-6 max-w-7xl">
              {/* Repository & Issue Selection Panel */}
              <div className="bg-[#1A1D28] rounded-[10px] p-5 border border-[#2B2F3D] shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-[#2B2F3D]">
                  <div className="flex items-center gap-2.5">
                    <FolderGit2 className="w-4 h-4 text-[#6C9BFF]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#E7E9F2]">
                      Target Repository & Issue Selection
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncGit}
                      disabled={isSyncingGit || !selectedProject}
                      title="Sinkronisasi live repo (issues, branches, commits) langsung dari GitHub/GitLab"
                      className="px-3 py-1.5 rounded-[8px] bg-[#12141C] hover:bg-[#242838] border border-[#2B2F3D] text-xs font-medium text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#6C9BFF] ${isSyncingGit ? "animate-spin" : ""}`} />
                      <span>{isSyncingGit ? "Syncing..." : "Sync Live Git"}</span>
                    </button>

                    <button
                      onClick={() => setShowCustomIssueModal(true)}
                      className="px-3 py-1.5 rounded-[8px] bg-[#12141C] hover:bg-[#242838] border border-[#2B2F3D] text-xs font-medium text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E3A73B]" />
                      <span> Custom Issue</span>
                    </button>

                    <button
                      onClick={() => setShowConnectModal(true)}
                      className="px-3 py-1.5 rounded-[8px] bg-[#242838] hover:bg-[#2F3447] border border-[#3A3F52] text-xs font-medium text-[#E7E9F2] flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#4CB782]" />
                      <span>Connect Repo</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4">
                  {/* Column 1: Select Project Dropdown */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8D91A6] mb-1.5 flex items-center justify-between">
                      <span>Target Repository</span>
                      {selectedProject && (
                        <span className="text-[10px] text-[#4CB782] font-mono">● Live Connected</span>
                      )}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedProject?.id || ""}
                        onChange={(e) => {
                          const p = projects.find((proj) => proj.id === e.target.value);
                          if (p) setSelectedProject(p);
                        }}
                        disabled={projects.length === 0}
                        className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2.5 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] disabled:opacity-50 cursor-pointer"
                      >
                        {projects.length === 0 ? (
                          <option value="">No repositories connected (click + Connect Repo)</option>
                        ) : (
                          projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.git_provider === "gitlab" ? "🦊 GitLab: " : "🐙 GitHub: "}{p.repository_full_name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Column 2: Select Base Target Branch */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8D91A6] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-[#4CB782]" />
                        <span>Base Branch</span>
                      </span>
                      {branches.length > 0 && (
                        <span className="text-[10px] text-[#8D91A6] font-mono">{branches.length} branches</span>
                      )}
                    </label>
                    <div className="relative">
                      {branches.length > 0 ? (
                        <select
                          value={selectedBaseBranch}
                          onChange={(e) => setSelectedBaseBranch(e.target.value)}
                          className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2.5 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] cursor-pointer"
                        >
                          {branches.map((b) => (
                            <option key={b} value={b}>
                              {b} {b === selectedProject?.default_branch ? "(default)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={selectedBaseBranch || selectedProject?.default_branch || "main"}
                          onChange={(e) => setSelectedBaseBranch(e.target.value)}
                          placeholder="main"
                          className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2.5 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF]"
                        />
                      )}
                    </div>
                  </div>

                  {/* Column 3: Select Issue Dropdown */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8D91A6] mb-1.5 flex items-center justify-between">
                      <span>Target Issue</span>
                      {issues.length > 0 && (
                        <span className="text-[10px] text-[#6C9BFF] font-mono">{issues.length} open</span>
                      )}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedIssue?.number || ""}
                        onChange={(e) => {
                          const num = Number(e.target.value);
                          const iss = issues.find((i) => i.number === num);
                          if (iss) setSelectedIssue(iss);
                        }}
                        disabled={isLoadingIssues || issues.length === 0}
                        className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2.5 text-xs font-mono text-[#E7E9F2] focus:outline-none focus:border-[#6C9BFF] disabled:opacity-50 cursor-pointer"
                      >
                        {isLoadingIssues ? (
                          <option value="">Fetching live issues from provider...</option>
                        ) : issues.length === 0 ? (
                          <option value="">No open issues found (click + Custom Issue)</option>
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
                </div>

                {/* Selected Issue Preview & Target Files Scoping Banner */}
                {selectedIssue ? (
                  <div className="mt-4 space-y-3">
                    <div className="p-3.5 bg-[#12141C] rounded-[8px] border border-[#2B2F3D] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 max-w-3xl">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#6C9BFF]">
                            #{selectedIssue.number}
                          </span>
                          <h4 className="text-xs font-semibold text-[#E7E9F2]">
                            {selectedIssue.title}
                          </h4>
                          {selectedIssue.labels?.map((label) => (
                            <span
                              key={label}
                              className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-[#242838] text-[#8D91A6] border border-[#3A3F52]"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-[#8D91A6] line-clamp-1">
                          {selectedIssue.body}
                        </p>
                      </div>

                      <button
                        onClick={handleStartAgent}
                        disabled={isStartingAgent || isTaskRunning}
                        className="px-5 py-2.5 rounded-[8px] bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isStartingAgent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                        <span>Start Agent Workflow</span>
                      </button>
                    </div>

                    {/* Target Files & Context Scoping Box (Selective Understanding & Multimodal Attachments) */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        if (e.dataTransfer.files) processSelectedFiles(e.dataTransfer.files);
                      }}
                      className={`p-3.5 bg-[#12141C]/80 rounded-[8px] border transition space-y-3 ${isDraggingOver ? "border-[#6C9BFF] ring-2 ring-[#6C9BFF]/30 bg-[#1A2234]" : "border-[#2B2F3D]"
                        }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Crosshair className="w-3.5 h-3.5 text-[#6C9BFF]" />
                          <span className="text-xs font-mono font-bold text-[#E7E9F2]">
                            🎯 Target Files, Focus Scope & Multimodal Context (Optional)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Hidden File Input */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.txt,.log,.json,.md,.yaml,.yml,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                processSelectedFiles(e.target.files);
                              }
                            }}
                          />

                          {/* Attach Images & Files Button */}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded bg-[#242838] hover:bg-[#2F3447] text-[#E3A73B] text-[11px] font-mono font-medium border border-[#E3A73B]/30 flex items-center gap-1.5 transition cursor-pointer"
                            title="Upload screenshot bug, Figma mockup, atau file log referensi (Bisa juga Paste Ctrl+V langsung)"
                          >
                            <Paperclip className="w-3 h-3 text-[#E3A73B]" />
                            <span>+ Attach Images / Docs ({uploadedAttachments.length})</span>
                          </button>

                          {/* Pick Files from Repo */}
                          <button
                            type="button"
                            onClick={() => setShowFilePickerModal(true)}
                            className="px-2.5 py-1 rounded bg-[#242838] hover:bg-[#2F3447] text-[#6C9BFF] text-[11px] font-mono font-medium border border-[#6C9BFF]/30 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Target className="w-3 h-3 text-[#6C9BFF]" />
                            <span>+ Pick Files from Repo ({selectedTargetFiles.length})</span>
                          </button>
                        </div>
                      </div>

                      {/* Selected Target Files Badges */}
                      {selectedTargetFiles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-[#8D91A6] mr-1">Targeted Files:</span>
                          {selectedTargetFiles.map((file) => (
                            <span
                              key={file}
                              className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/40 flex items-center gap-1"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>{file}</span>
                              <button
                                type="button"
                                onClick={() => toggleTargetFile(file)}
                                className="hover:text-[#E0594A] ml-0.5 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSelectedTargetFiles([])}
                            className="text-[10px] font-mono text-[#8D91A6] hover:text-[#E0594A] underline ml-2 cursor-pointer"
                          >
                            Clear all
                          </button>
                        </div>
                      )}

                      {/* Uploaded Multimodal Attachments Preview Strip */}
                      {uploadedAttachments.length > 0 && (
                        <div className="p-2.5 bg-[#1A1D28] rounded-[6px] border border-[#2B2F3D] space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono text-[#8D91A6]">
                            <span className="flex items-center gap-1 text-[#E3A73B] font-bold">
                              <Paperclip className="w-3 h-3 text-[#E3A73B]" />
                              Multimodal Attachments ({uploadedAttachments.length}):
                            </span>
                            <button
                              type="button"
                              onClick={() => setUploadedAttachments([])}
                              className="text-[10px] text-[#8D91A6] hover:text-[#E0594A] underline cursor-pointer"
                            >
                              Clear all attachments
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {uploadedAttachments.map((att, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-2.5 py-1.5 bg-[#12141C] rounded-[6px] border border-[#2B2F3D] text-xs font-mono group"
                              >
                                {att.is_image ? (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: att.data_base64, name: att.name })}
                                    className="flex items-center gap-1.5 cursor-pointer hover:text-[#6C9BFF]"
                                    title="Click to view image preview"
                                  >
                                    <img
                                      src={att.data_base64}
                                      alt={att.name}
                                      className="w-5 h-5 rounded object-cover border border-[#3A3F52]"
                                    />
                                    <span className="text-[#E7E9F2] max-w-[130px] truncate">{att.name}</span>
                                    <span className="text-[10px] text-[#5E6275]">
                                      ({(att.size_bytes / 1024).toFixed(0)} KB)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <FileIcon className="w-3.5 h-3.5 text-[#6C9BFF]" />
                                    <span className="text-[#E7E9F2] max-w-[130px] truncate">{att.name}</span>
                                    <span className="text-[10px] text-[#5E6275]">
                                      ({(att.size_bytes / 1024).toFixed(0)} KB)
                                    </span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => removeAttachment(idx)}
                                  className="text-[#8D91A6] hover:text-[#E0594A] font-bold cursor-pointer ml-1"
                                  title="Remove attachment"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focus Hints Text Input */}
                      <div>
                        <input
                          type="text"
                          value={focusHints}
                          onChange={(e) => setFocusHints(e.target.value)}
                          placeholder="💡 Focus Hints (opsional): misal 'Fokus perbaiki fungsi verifyToken() dan edge-case expired token'"
                          className="w-full bg-[#1A1D28] border border-[#2B2F3D] rounded-md px-3 py-1.5 text-xs text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
                        />
                      </div>

                      {/* Drag and Drop Helper Hint */}
                      <div className="text-[10px] text-[#5E6275] flex items-center justify-between">
                        <span>💡 Drag & drop gambar/file atau tekan <strong>Ctrl+V</strong> untuk paste screenshot langsung.</span>
                        <span>Mendukung PNG, JPG, WebP, TXT, LOG, JSON, MD</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3.5 bg-[#12141C]/50 rounded-[8px] border border-[#2B2F3D] text-xs font-mono text-[#8D91A6] flex items-center justify-between">
                    <span>Repository ini belum memiliki open issue di provider.</span>
                    <button
                      onClick={() => setShowCustomIssueModal(true)}
                      className="text-xs font-bold text-[#E3A73B] hover:underline cursor-pointer"
                    >
                      + Buat Custom Issue untuk Agen →
                    </button>
                  </div>
                )}
              </div>

              {/* Active Task Progress Pipeline */}
              {activeTask && (
                <div className="space-y-6">
                  {/* Stepper + Cancel & Restart Action Bar */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <ProgressStepper
                          status={activeTask.status}
                          iteration={activeTask.iteration_count}
                          maxIterations={3}
                        />
                      </div>

                      {/* Cancel / Restart Quick Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isTaskRunning && (
                          <button
                            onClick={handleCancelTask}
                            disabled={isCancelling}
                            className="px-3.5 py-2 rounded-[8px] bg-[#2E1D1B] hover:bg-[#E0594A]/20 border border-[#E0594A]/60 text-[#E0594A] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                            title="Cancel running agent execution"
                          >
                            {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            <span>Stop / Cancel</span>
                          </button>
                        )}

                        {(!isTaskRunning || activeTask.status === "cancelled" || activeTask.status === "failed") && (
                          <button
                            onClick={handleRestartTask}
                            disabled={isRestarting}
                            className="px-3.5 py-2 rounded-[8px] bg-[#242838] hover:bg-[#2F3447] border border-[#6C9BFF]/40 text-[#6C9BFF] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                            title="Restart this task from beginning"
                          >
                            {isRestarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>Restart Task</span>
                          </button>
                        )}

                        <button
                          onClick={handleResetWorkspace}
                          className="px-3 py-2 rounded-[8px] bg-[#12141C] hover:bg-[#242838] border border-[#2B2F3D] text-[#8D91A6] hover:text-[#E7E9F2] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                          title="Bersihkan workspace untuk memilih issue lain atau mulai task baru"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#4CB782]" />
                          <span>New Task</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Task Scoping Info if present */}
                    {((activeTask.target_files && activeTask.target_files.length > 0) || activeTask.focus_hints || (activeTask.attachments && activeTask.attachments.length > 0)) && (
                      <div className="p-2.5 bg-[#12141C] border border-[#2B2F3D] rounded-lg text-xs font-mono flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          {activeTask.target_files && activeTask.target_files.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#6C9BFF] font-bold flex items-center gap-1">
                                <Crosshair className="w-3.5 h-3.5" /> Scope:
                              </span>
                              {activeTask.target_files.map((tf) => (
                                <span key={tf} className="px-2 py-0.5 rounded bg-[#1B2B23] text-[#4CB782] text-[10px] border border-[#4CB782]/30">
                                  {tf}
                                </span>
                              ))}
                            </div>
                          )}

                          {activeTask.focus_hints && (
                            <span className="text-[#8D91A6] text-[11px] truncate max-w-md">
                              💡 {activeTask.focus_hints}
                            </span>
                          )}
                        </div>

                        {activeTask.attachments && activeTask.attachments.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#E3A73B] font-bold flex items-center gap-1 text-[11px]">
                              <Paperclip className="w-3 h-3 text-[#E3A73B]" /> Attachments ({activeTask.attachments.length}):
                            </span>
                            {activeTask.attachments.map((att, aIdx) => (
                              <button
                                key={aIdx}
                                type="button"
                                onClick={() => att.is_image && setPreviewModalImage({ src: att.data_base64, name: att.name })}
                                className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 transition ${att.is_image
                                    ? "bg-[#242838] text-[#6C9BFF] border-[#6C9BFF]/30 hover:bg-[#2F3447] cursor-pointer"
                                    : "bg-[#1A1D28] text-[#8D91A6] border-[#2B2F3D]"
                                  }`}
                              >
                                {att.is_image ? <ImageIcon className="w-3 h-3" /> : <FileIcon className="w-3 h-3" />}
                                <span className="max-w-[100px] truncate">{att.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Merged Banner & Next Task Action */}
                  {activeTask.status === "merged" && (
                    <div className="p-4 bg-[#1B2B23] border border-[#4CB782]/40 rounded-[10px] space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#4CB782]/20 flex items-center justify-center border border-[#4CB782]/40 shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-[#4CB782]" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#E7E9F2] flex items-center gap-2">
                              <span>Pull Request Merged into {selectedProject?.default_branch || "main"}!</span>
                              <span className="px-2 py-0.5 rounded bg-[#4CB782]/20 text-[#4CB782] text-[10px] font-mono border border-[#4CB782]/30">
                                Completed
                              </span>
                            </div>
                            <div className="text-[11px] text-[#8D91A6] font-mono mt-0.5">
                              Branch <span className="text-[#4CB782]">{activeTask.branch_name}</span> has been merged. Repository is up-to-date.
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {activeTask.pr_url && (
                            <a
                              href={activeTask.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 bg-[#242838] hover:bg-[#2F3447] text-[#E7E9F2] border border-[#3A3F52] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View on {isGitLabRepo ? "GitLab" : "GitHub"}</span>
                            </a>
                          )}

                          <button
                            onClick={handleStartNewTask}
                            className="px-4 py-2 bg-[#6C9BFF] hover:bg-[#6C9BFF]/90 text-[#12141C] rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Work on Another Issue</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PR Created Banner & Safety Actions */}
                  {activeTask.status === "pr_created" && (
                    <div className="p-4 bg-[#1B2B23] border border-[#4CB782]/40 rounded-[10px] space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#4CB782]/20 flex items-center justify-center border border-[#4CB782]/40 shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-[#4CB782]" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#E7E9F2] flex items-center gap-2">
                              <span>{isGitLabRepo ? "GitLab Merge Request Created!" : "GitHub Pull Request Created!"}</span>
                              <span className="px-2 py-0.5 rounded bg-[#4CB782]/20 text-[#4CB782] text-[10px] font-mono border border-[#4CB782]/30">
                                Ready for Merge
                              </span>
                            </div>
                            <div className="text-[11px] text-[#8D91A6] font-mono mt-0.5">
                              Branch: <span className="text-[#4CB782]">{activeTask.branch_name}</span> • All sandbox tests verified.
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {activeTask.pr_url && (
                            <a
                              href={activeTask.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-2 bg-[#242838] hover:bg-[#2F3447] text-[#E7E9F2] border border-[#3A3F52] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                            >
                              {isGitLabRepo ? <GitMerge className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
                              <span>{isGitLabRepo ? "View on GitLab" : "View on GitHub"}</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                            </a>
                          )}

                          {/* Direct 1-Click Merge (Clean Emerald theme) */}
                          <button
                            onClick={handleMergePR}
                            disabled={isMergingPR}
                            title="Langsung gabungkan (Merge) PR ke branch utama"
                            className="px-4 py-2 bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {isMergingPR ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <GitMerge className="w-3.5 h-3.5" />
                            )}
                            <span>{isMergingPR ? "Merging..." : "Merge to Main"}</span>
                          </button>

                          <button
                            onClick={handleRevertPR}
                            disabled={isReverting}
                            title="Buat Revert PR otomatis di GitHub/GitLab"
                            className="px-3 py-2 bg-[#1A1D28] hover:bg-[#242838] border border-[#E3A73B]/40 text-[#E3A73B] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            {isReverting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>Revert PR</span>
                          </button>

                          <button
                            onClick={handleClosePR}
                            disabled={isClosingPR}
                            title="Tutup PR tanpa merger"
                            className="px-3 py-2 bg-[#1A1D28] hover:bg-[#2E181B] border border-[#EB5757]/40 text-[#EB5757] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            {isClosingPR ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Close PR</span>
                          </button>
                        </div>
                      </div>

                      {revertResult && (
                        <div className="p-2.5 bg-[#E3A73B]/10 border border-[#E3A73B]/30 rounded-lg text-xs text-[#E3A73B] flex items-center justify-between">
                          <span>↩️ Revert Pull Request telah dibuka!</span>
                          <a
                            href={revertResult}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold underline flex items-center gap-1"
                          >
                            Buka Revert PR <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Workspace Tabs: Plan vs Diff vs Logs vs Human Review */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2B2F3D] pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setActiveTaskViewTab("plan")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTaskViewTab === "plan"
                              ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                              : "text-[#8D91A6] hover:text-[#E7E9F2]"
                            }`}
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                          <span>Implementation Plan</span>
                        </button>

                        <button
                          onClick={() => setActiveTaskViewTab("diff")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTaskViewTab === "diff"
                              ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                              : "text-[#8D91A6] hover:text-[#E7E9F2]"
                            }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-[#4CB782]" />
                          <span>Code Diff</span>
                        </button>

                        <button
                          onClick={() => setActiveTaskViewTab("security")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTaskViewTab === "security"
                              ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                              : "text-[#8D91A6] hover:text-[#E7E9F2]"
                            }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#4CB782]" />
                          <span>Security Guardrail</span>
                        </button>

                        <button
                          onClick={() => setActiveTaskViewTab("logs")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTaskViewTab === "logs"
                              ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                              : "text-[#8D91A6] hover:text-[#E7E9F2]"
                            }`}
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Live Tool Log & Audit Trail</span>
                          {isSseConnected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4CB782] animate-pulse ml-0.5" title="Live SSE Connected" />
                          )}
                        </button>

                        <button
                          onClick={() => setActiveTaskViewTab("comments")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTaskViewTab === "comments"
                              ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                              : "text-[#8D91A6] hover:text-[#E7E9F2]"
                            }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Review & Interventions ({taskComments.length})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono text-[#5E6275]">
                        <StatusBadge status={activeTask.status} />
                        <span>Task ID: {activeTask.id.slice(0, 8)}...</span>
                      </div>
                    </div>

                    {/* View 1: Implementation Plan Card */}
                    {activeTaskViewTab === "plan" && (
                      <ImplementationPlanCard
                        task={activeTask}
                        onApprove={handleApprovePlan}
                        onReject={handleRejectPlan}
                      />
                    )}

                    {/* View 2: Side-by-Side Visual Code Diff Viewer */}
                    {activeTaskViewTab === "diff" && (
                      <CodeDiffViewer taskId={activeTask.id} />
                    )}

                    {/* View 3: Pre-Flight Security & Secret Leak Guardrail */}
                    {activeTaskViewTab === "security" && (
                      <SecurityGuardrailCard taskId={activeTask.id} />
                    )}

                    {/* View 4: Live Tool Calls Log */}
                    {activeTaskViewTab === "logs" && (
                      <ToolLogViewer runs={agentRuns} toolCalls={toolCalls} isLiveStreaming={isSseConnected} />
                    )}

                    {/* View 5: Human Review & Intervention Comments */}
                    {activeTaskViewTab === "comments" && (
                      <TaskCommentPanel
                        taskId={activeTask.id}
                        comments={taskComments}
                        onAddComment={handleAddComment}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: TASKS (Page 6: Task Progress View)                    */}
          {/* ============================================================ */}
          {currentTab === "tasks" && (() => {
            const runningList = allTasks.filter((t) =>
              [
                "queued",
                "analyzing_issue",
                "analyzing_repo",
                "planning",
                "awaiting_approval",
                "implementing",
                "testing",
                "debugging",
                "pr_creating",
              ].includes(t.status)
            );
            const completedList = allTasks.filter((t) =>
              ["pr_created", "merged", "pr_closed"].includes(t.status)
            );
            const failedList = allTasks.filter((t) =>
              ["failed", "cancelled", "needs_human_help"].includes(t.status)
            );

            const displayTasks = allTasks.filter((t) => {
              if (taskHistoryFilter === "active") return runningList.some((r) => r.id === t.id);
              if (taskHistoryFilter === "completed") return completedList.some((c) => c.id === t.id);
              if (taskHistoryFilter === "failed") return failedList.some((f) => f.id === t.id);
              return true;
            });

            return (
              <div className="space-y-5 max-w-5xl">
                <div className="pb-3 border-b border-[#2B2F3D] flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-[#E7E9F2]">
                      Agent Runs & Task History
                    </h2>
                    <p className="text-xs text-[#8D91A6]">
                      Riwayat task dan workflow yang pernah dieksekusi oleh Nexora.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {allTasks.length > 0 && (
                      <button
                        onClick={handleClearTaskHistory}
                        disabled={isClearingTasks}
                        className="px-3 py-1.5 rounded-[8px] bg-[#2E1D1B] hover:bg-[#E0594A]/20 border border-[#E0594A]/50 text-xs font-medium text-[#E0594A] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Hapus semua riwayat task yang tersimpan di database"
                      >
                        {isClearingTasks ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Hapus Riwayat</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setTaskHistoryFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition cursor-pointer ${
                      taskHistoryFilter === "all"
                        ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/40"
                        : "bg-[#12141C] text-[#8D91A6] border border-[#2B2F3D] hover:text-[#E7E9F2]"
                    }`}
                  >
                    Semua ({allTasks.length})
                  </button>
                  <button
                    onClick={() => setTaskHistoryFilter("active")}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition cursor-pointer ${
                      taskHistoryFilter === "active"
                        ? "bg-[#242838] text-[#4CB782] border border-[#4CB782]/40"
                        : "bg-[#12141C] text-[#8D91A6] border border-[#2B2F3D] hover:text-[#E7E9F2]"
                    }`}
                  >
                    Berjalan ({runningList.length})
                  </button>
                  <button
                    onClick={() => setTaskHistoryFilter("completed")}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition cursor-pointer ${
                      taskHistoryFilter === "completed"
                        ? "bg-[#242838] text-[#4CB782] border border-[#4CB782]/40"
                        : "bg-[#12141C] text-[#8D91A6] border border-[#2B2F3D] hover:text-[#E7E9F2]"
                    }`}
                  >
                    Selesai / PR ({completedList.length})
                  </button>
                  <button
                    onClick={() => setTaskHistoryFilter("failed")}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition cursor-pointer ${
                      taskHistoryFilter === "failed"
                        ? "bg-[#242838] text-[#E0594A] border border-[#E0594A]/40"
                        : "bg-[#12141C] text-[#8D91A6] border border-[#2B2F3D] hover:text-[#E7E9F2]"
                    }`}
                  >
                    Batal / Gagal ({failedList.length})
                  </button>
                </div>

                {displayTasks.length === 0 ? (
                  <div className="p-8 text-center bg-[#1A1D28] rounded-[10px] border border-[#2B2F3D] text-xs text-[#5E6275]">
                    {allTasks.length === 0
                      ? "Belum ada riwayat task. Pilih issue di Agent Workspace lalu klik Mulai Agen."
                      : "Tidak ada task dengan filter yang dipilih."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveTask(t);
                          setCurrentTab("dashboard");
                        }}
                        className="group diff-rail-neutral pl-3 py-3 pr-4 bg-[#1A1D28] rounded-r-[6px] border border-[#2B2F3D] border-l-0 flex items-center justify-between hover:bg-[#242838] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs font-bold text-[#6C9BFF] shrink-0">
                            #{t.issue_number}
                          </span>
                          <span className="text-xs font-semibold text-[#E7E9F2] truncate">
                            {t.issue_title}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <StatusBadge status={t.status} />
                          <span className="text-[11px] font-mono text-[#5E6275]">
                            {new Date(t.created_at).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={(e) => handleDeleteTask(t.id, e)}
                            disabled={deletingTaskId === t.id}
                            className="p-1 rounded text-[#5E6275] hover:text-[#E0594A] hover:bg-[#2E1D1B] transition cursor-pointer disabled:opacity-50"
                            title="Hapus task ini dari riwayat"
                          >
                            {deletingTaskId === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ============================================================ */}
          {/* TAB 3: COMMITS & HISTORY (Time-Travel & Audit Explorer)      */}
          {/* ============================================================ */}
          {currentTab === "history" && <CommitHistoryTab projects={projects} />}

          {/* ============================================================ */}
          {/* TAB 4: EVALUATION (PRD Section 10.2: Evaluation & Analytics)  */}
          {/* ============================================================ */}
          {currentTab === "evaluation" && <EvaluationTab projects={projects} />}

          {/* ============================================================ */}
          {/* TAB 5: SETTINGS (Page 8: Platform Configuration)             */}
          {/* ============================================================ */}
          {currentTab === "settings" && (
            <SettingsTab
              projects={projects}
              onOpenAuthModal={() => setShowAuthModal(true)}
              onProjectUpdated={(updated) => {
                setProjects((prev) =>
                  prev.map((p) => (p.id === updated.id ? updated : p))
                );
                if (selectedProject?.id === updated.id) {
                  setSelectedProject(updated);
                }
              }}
            />
          )}
        </div>
      </main>

      {/* Target Files Interactive Picker Modal */}
      {showFilePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#1A1D28] max-w-xl w-full rounded-[10px] p-6 shadow-modal border border-[#3A3F52] space-y-4 flex flex-col max-h-[85vh]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#6C9BFF]">
                  Target Context Scoping
                </span>
                <span className="text-xs font-mono text-[#8D91A6]">
                  {selectedTargetFiles.length} selected
                </span>
              </div>
              <h3 className="font-heading text-base font-bold text-[#E7E9F2] mt-0.5">
                Pick Target Files from {selectedProject?.repository_full_name}
              </h3>
              <p className="text-xs text-[#8D91A6] mt-0.5">
                Pilih file spesifik yang ingin dijadikan fokus analisis dan perbaikan oleh agen.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#5E6275]" />
              <input
                type="text"
                placeholder="Filter files by path (e.g. auth, user, component, test)..."
                value={filePickerSearch}
                onChange={(e) => setFilePickerSearch(e.target.value)}
                className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] pl-9 pr-3.5 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
              />
            </div>

            {/* Files List with Checkboxes */}
            <div className="flex-1 overflow-y-auto max-h-72 space-y-1 bg-[#12141C] p-2.5 rounded-lg border border-[#2B2F3D]">
              {isLoadingFiles ? (
                <div className="p-6 text-center text-xs text-[#8D91A6] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading repository file tree...</span>
                </div>
              ) : filteredProjectFiles.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-[#5E6275]">
                  No files matching search filter.
                </div>
              ) : (
                filteredProjectFiles.map((file) => {
                  const isChecked = selectedTargetFiles.includes(file.path);
                  return (
                    <div
                      key={file.path}
                      onClick={() => toggleTargetFile(file.path)}
                      className={`px-2.5 py-1.5 rounded text-xs font-mono flex items-center justify-between cursor-pointer transition ${isChecked
                          ? "bg-[#1B2B23] text-[#4CB782] border border-[#4CB782]/40"
                          : "text-[#E7E9F2] hover:bg-[#242838]"
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#4CB782] shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-[#5E6275] shrink-0" />
                        )}
                        <span className="truncate">{file.path}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#2B2F3D]">
              <button
                type="button"
                onClick={() => setSelectedTargetFiles([])}
                className="text-xs font-mono text-[#8D91A6] hover:text-[#E7E9F2] cursor-pointer"
              >
                Deselect All
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilePickerModal(false)}
                  className="px-4 py-2 rounded-[8px] bg-[#6C9BFF] text-[#12141C] text-xs font-bold transition hover:bg-[#6C9BFF]/90 cursor-pointer shadow-sm"
                >
                  Done ({selectedTargetFiles.length} Files)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Repo Modal (Multi-Provider with live Discovery) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#1A1D28] max-w-lg w-full rounded-[10px] p-6 shadow-modal border border-[#3A3F52] space-y-4">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#5E6275]">
                Repository Connection
              </span>
              <h3 className="font-heading text-base font-bold text-[#E7E9F2] mt-0.5">
                Connect Repository from Git Provider
              </h3>
              <p className="text-xs text-[#8D91A6] mt-0.5">
                Pilih repository dari akun GitHub atau GitLab Anda.
              </p>
            </div>

            {/* Provider Switcher */}
            <div className="flex bg-[#12141C] p-1 rounded-lg border border-[#2B2F3D]">
              <button
                type="button"
                onClick={() => setConnectProvider("github")}
                className={`flex-1 py-1.5 text-xs rounded-md font-semibold transition cursor-pointer ${connectProvider === "github"
                    ? "bg-[#242838] text-[#6C9BFF] border border-[#6C9BFF]/30"
                    : "text-[#8D91A6] hover:text-[#E7E9F2]"
                  }`}
              >
                GitHub Account
              </button>
              <button
                type="button"
                onClick={() => setConnectProvider("gitlab")}
                className={`flex-1 py-1.5 text-xs rounded-md font-semibold transition cursor-pointer ${connectProvider === "gitlab"
                    ? "bg-[#242838] text-[#FC6D26] border border-[#FC6D26]/30"
                    : "text-[#8D91A6] hover:text-[#E7E9F2]"
                  }`}
              >
                GitLab Account
              </button>
            </div>

            {/* Accessible Repos Quick-Select */}
            <div>
              <label className="block text-[11px] font-mono text-[#8D91A6] mb-1.5">
                Quick-Select Accessible {connectProvider === "github" ? "GitHub" : "GitLab"} Repositories:
              </label>
              {isLoadingDiscovery ? (
                <div className="p-3 bg-[#12141C] rounded-lg border border-[#2B2F3D] flex items-center justify-center gap-2 text-xs text-[#8D91A6]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching repositories...</span>
                </div>
              ) : discoveryRepos.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1 bg-[#12141C] p-2 rounded-lg border border-[#2B2F3D]">
                  {discoveryRepos.map((repo) => (
                    <button
                      key={repo.full_name}
                      type="button"
                      onClick={() => {
                        setNewRepoFullName(repo.full_name);
                        setNewRepoName(repo.full_name.split("/")[1] || repo.full_name);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-xs font-mono text-[#E7E9F2] hover:bg-[#242838] hover:text-[#6C9BFF] transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{repo.full_name}</span>
                      <span className="text-[10px] text-[#5E6275] shrink-0">select</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#5E6275] italic">
                  No repositories found automatically. Type manually below.
                </p>
              )}
            </div>

            <form onSubmit={handleConnectRepo} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-mono text-[#8D91A6] mb-1">
                  Repository Full Name (owner/repo) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. chocolatecodelab/bias-ristek-app"
                  value={newRepoFullName}
                  onChange={(e) => setNewRepoFullName(e.target.value)}
                  required
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8D91A6] mb-1">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bias Ristek Platform"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2B2F3D]">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded-[8px] text-xs text-[#8D91A6] hover:text-[#E7E9F2] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepo}
                  className="px-4 py-2 rounded-[8px] bg-[#4CB782] text-[#12141C] text-xs font-bold flex items-center gap-1.5 transition hover:bg-[#4CB782]/90 cursor-pointer shadow-sm"
                >
                  {isSubmittingRepo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Connect Repository</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Issue Modal (with Target Files & Focus Hints) */}
      {showCustomIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#1A1D28] max-w-md w-full rounded-[10px] p-6 shadow-modal border border-[#3A3F52] space-y-4">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#E3A73B]">
                Quick Agent Task
              </span>
              <h3 className="font-heading text-base font-bold text-[#E7E9F2] mt-0.5">
                Create Custom Issue for Agent
              </h3>
              <p className="text-xs text-[#8D91A6] mt-0.5">
                Beri instruksi perbaikan atau penambahan fitur langsung kepada agen.
              </p>
            </div>

            <form onSubmit={handleCreateCustomIssue} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#8D91A6] mb-1">
                  Issue Title / Task *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Add health check endpoint with database ping"
                  value={customIssueTitle}
                  onChange={(e) => setCustomIssueTitle(e.target.value)}
                  required
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8D91A6] mb-1">
                  Detailed Description & Requirements
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the expected behavior, edge-cases, and relevant files..."
                  value={customIssueBody}
                  onChange={(e) => setCustomIssueBody(e.target.value)}
                  className="w-full bg-[#12141C] border border-[#2B2F3D] rounded-[8px] px-3.5 py-2 text-xs font-mono text-[#E7E9F2] placeholder-[#5E6275] focus:outline-none focus:border-[#6C9BFF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2B2F3D]">
                <button
                  type="button"
                  onClick={() => setShowCustomIssueModal(false)}
                  className="px-3 py-1.5 rounded-[8px] text-xs text-[#8D91A6] hover:text-[#E7E9F2] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingIssue || !customIssueTitle.trim()}
                  className="px-4 py-2 rounded-[8px] bg-[#6C9BFF] text-[#12141C] text-xs font-bold flex items-center gap-1.5 transition hover:bg-[#6C9BFF]/90 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingIssue ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing to {isGitLabRepo ? "GitLab" : "GitHub"}...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create & Select Issue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Git Provider Dynamic Auth / Token Management Modal */}
      <AuthAccountModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthUpdated={async () => {
          try {
            const auth = await getAuthStatus();
            setAuthStatus(auth);
            const projs = await getProjects();
            setProjects(projs);
          } catch (err) {
            console.error("Failed to refresh data after auth update:", err);
          }
        }}
      />

      {/* Multimodal Image Preview Lightbox Modal */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="bg-[#1A1D28] max-w-4xl max-h-[90vh] rounded-[10px] p-4 border border-[#3A3F52] shadow-2xl flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2B2F3D] pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#6C9BFF]" />
                <span className="text-xs font-mono font-bold text-[#E7E9F2] truncate max-w-md">
                  {previewModalImage.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1 rounded hover:bg-[#242838] text-[#8D91A6] hover:text-[#E7E9F2] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-[#12141C] rounded-[6px] p-2">
              <img
                src={previewModalImage.src}
                alt={previewModalImage.name}
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking Modern Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Developer-Palette In-App Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          isDestructive={confirmState.isDestructive}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
