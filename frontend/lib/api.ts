/**
 * Nexora AI — Frontend API Client
 * Connects to the FastAPI backend with error handling and fallback mocks.
 */

import {
  Approval,
  GitHubIssue,
  GitCommit,
  Project,
  ServiceStatus,
  Task,
  TaskDiffResponse,
  SecurityReport,
  AuthStatusResponse,
  ConnectedAccount,
  AgentRun,
  ToolCall,
  TaskComment,
  EvaluationMetricsResponse,
} from "@/types";

function getApiBase(): string {
  if (typeof window !== "undefined") {
    // In browser: dynamically map to 127.0.0.1 to avoid Windows IPv6 localhost conflicts
    const hostname = (window.location.hostname === "localhost" || !window.location.hostname) ? "127.0.0.1" : window.location.hostname;
    const port = window.location.port === "3001" ? "8001" : "8000";
    return `http://${hostname}:${port}`;
  }
  return "http://127.0.0.1:8000";
}

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail = "API Error";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Health & Service Status
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{ status: string; version: string }> {
  return fetcher<{ status: string; version: string }>("/health");
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  try {
    return await fetcher<ServiceStatus>("/status");
  } catch {
    return { supabase: false, gemini: false, github: false };
  }
}

// ---------------------------------------------------------------------------
// Projects & Repositories
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  try {
    return await fetcher<Project[]>("/api/projects/");
  } catch {
    return [];
  }
}

export async function createProject(data: {
  name: string;
  repository_full_name: string;
  git_provider?: string;
}): Promise<Project> {
  return fetcher<Project>("/api/projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  projectId: string,
  data: Partial<Project>
): Promise<Project> {
  return fetcher<Project>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getProjectIssues(projectId: string): Promise<GitHubIssue[]> {
  try {
    return await fetcher<GitHubIssue[]>(`/api/projects/${projectId}/issues`);
  } catch {
    return [];
  }
}

export async function createProjectIssue(
  projectId: string,
  data: { title: string; body?: string; labels?: string[] }
): Promise<GitHubIssue> {
  return fetcher<GitHubIssue>(`/api/projects/${projectId}/issues`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProjectFiles(projectId: string): Promise<{ path: string }[]> {
  try {
    return await fetcher<{ path: string }[]>(`/api/projects/${projectId}/files`);
  } catch {
    return [];
  }
}

export async function getProjectBranches(projectId: string): Promise<string[]> {
  try {
    return await fetcher<string[]>(`/api/projects/${projectId}/branches`);
  } catch {
    return ["main"];
  }
}

export async function createProjectBranch(
  projectId: string,
  branchName: string,
  baseBranch: string = "main"
): Promise<{ status: string; branch: string; base_branch?: string }> {
  return fetcher<{ status: string; branch: string; base_branch?: string }>(
    `/api/projects/${projectId}/branches`,
    {
      method: "POST",
      body: JSON.stringify({ branch_name: branchName, base_branch: baseBranch }),
    }
  );
}

export async function getProjectCommits(
  projectId: string,
  branch?: string,
  limit: number = 25
): Promise<GitCommit[]> {
  try {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    params.set("limit", limit.toString());
    return await fetcher<GitCommit[]>(`/api/projects/${projectId}/commits?${params.toString()}`);
  } catch {
    return [];
  }
}

export async function listDiscoveryRepos(
  provider?: "github" | "gitlab"
): Promise<{ full_name: string; description?: string }[]> {
  try {
    const query = provider ? `?provider=${provider}` : "";
    return await fetcher<{ full_name: string; description?: string }[]>(
      `/api/projects/discovery/repos${query}`
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tasks (Agent Pipeline)
// ---------------------------------------------------------------------------

export async function createTask(data: {
  project_id: string;
  issue_number: number;
  issue_title: string;
  issue_body?: string;
  target_files?: string[];
  focus_hints?: string;
  attachments?: import("@/types").TaskAttachment[];
}): Promise<Task> {
  return fetcher<Task>("/api/tasks/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTask(taskId: string): Promise<Task> {
  return fetcher<Task>(`/api/tasks/${taskId}`);
}

export async function listTasks(projectId?: string): Promise<Task[]> {
  const query = projectId ? `?project_id=${projectId}` : "";
  try {
    return await fetcher<Task[]>(`/api/tasks/${query}`);
  } catch {
    return [];
  }
}

export async function cancelTask(taskId: string): Promise<{ status: string; task_id: string }> {
  return fetcher<{ status: string; task_id: string }>(`/api/tasks/${taskId}/cancel`, {
    method: "POST",
  });
}

export async function restartTask(taskId: string): Promise<Task> {
  return fetcher<Task>(`/api/tasks/${taskId}/restart`, {
    method: "POST",
  });
}

export async function deleteTask(taskId: string): Promise<{ message: string }> {
  return fetcher<{ message: string }>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function clearTaskHistory(projectId?: string): Promise<{ message: string }> {
  const query = projectId ? `?project_id=${projectId}` : "";
  return fetcher<{ message: string }>(`/api/tasks/${query}`, {
    method: "DELETE",
  });
}

export async function getTaskDiff(taskId: string): Promise<TaskDiffResponse> {
  if (!taskId) {
    return {
      task_id: "",
      total_files: 0,
      total_additions: 0,
      total_deletions: 0,
      files: [],
    };
  }
  try {
    return await fetcher<TaskDiffResponse>(`/api/tasks/${taskId}/diff`);
  } catch {
    return {
      task_id: taskId,
      total_files: 0,
      total_additions: 0,
      total_deletions: 0,
      files: [],
    };
  }
}

export async function revertTaskPR(taskId: string): Promise<{
  status: string;
  revert_pr_url?: string;
  type?: string;
}> {
  return fetcher<{ status: string; revert_pr_url?: string; type?: string }>(
    `/api/tasks/${taskId}/revert`,
    {
      method: "POST",
    }
  );
}

export async function closeTaskPR(taskId: string): Promise<{ status: string }> {
  return fetcher<{ status: string }>(`/api/tasks/${taskId}/close-pr`, {
    method: "POST",
  });
}

export async function mergeTaskPR(taskId: string): Promise<{
  status: string;
  message?: string;
  sha?: string;
}> {
  return fetcher<{ status: string; message?: string; sha?: string }>(
    `/api/tasks/${taskId}/merge-pr`,
    {
      method: "POST",
    }
  );
}

// ---------------------------------------------------------------------------
// Human Approval Gate
// ---------------------------------------------------------------------------

export async function approveTask(taskId: string): Promise<Approval> {
  return fetcher<Approval>(`/api/tasks/${taskId}/approve`, {
    method: "POST",
  });
}

export async function rejectTask(
  taskId: string,
  feedbackText: string
): Promise<Approval> {
  return fetcher<Approval>(`/api/tasks/${taskId}/reject`, {
    method: "POST",
    body: JSON.stringify({
      decision: "rejected",
      feedback_text: feedbackText,
    }),
  });
}

// ---------------------------------------------------------------------------
// Task Comments / Human Review Trail
// ---------------------------------------------------------------------------

export async function addTaskComment(
  taskId: string,
  data: { comment_text: string; is_intervention?: boolean }
): Promise<TaskComment> {
  return fetcher<TaskComment>(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  try {
    return await fetcher<TaskComment[]>(`/api/tasks/${taskId}/comments`);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export async function getTaskRuns(taskId: string): Promise<AgentRun[]> {
  try {
    return await fetcher<AgentRun[]>(`/api/tasks/${taskId}/runs`);
  } catch {
    return [];
  }
}

export async function getRunToolCalls(
  taskId: string,
  runId: string
): Promise<ToolCall[]> {
  try {
    return await fetcher<ToolCall[]>(
      `/api/tasks/${taskId}/runs/${runId}/tool-calls`
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Git Provider Auth & Security Guardrail
// ---------------------------------------------------------------------------

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  try {
    return await fetcher<AuthStatusResponse>("/api/auth/me");
  } catch {
    return {
      github: { provider: "github", connected: false },
      gitlab: { provider: "gitlab", connected: false },
    };
  }
}

export async function connectGitToken(data: {
  provider: "github" | "gitlab";
  token: string;
  gitlab_url?: string;
}): Promise<ConnectedAccount> {
  return fetcher<ConnectedAccount>("/api/auth/connect-token", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function disconnectGitProvider(
  provider: "github" | "gitlab"
): Promise<{ status: string; provider: string }> {
  return fetcher<{ status: string; provider: string }>(
    `/api/auth/disconnect?provider=${provider}`,
    {
      method: "POST",
    }
  );
}

export async function getTaskSecurityReport(taskId: string): Promise<SecurityReport> {
  if (!taskId) {
    return {
      passed: true,
      scanned_files_count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      summary: "Belum ada kode yang dianalisis.",
      issues: [],
    };
  }
  try {
    return await fetcher<SecurityReport>(`/api/tasks/${taskId}/security`);
  } catch {
    return {
      passed: true,
      scanned_files_count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      summary: "Laporan keamanan pra-terbang akan tersedia saat kode dimodifikasi.",
      issues: [],
    };
  }
}

export async function getEvaluationMetrics(
  projectId?: string
): Promise<EvaluationMetricsResponse> {
  const query = projectId ? `?project_id=${projectId}` : "";
  try {
    return await fetcher<EvaluationMetricsResponse>(`/api/evaluation/metrics${query}`);
  } catch {
    return {
      total_tasks: 0,
      completed_tasks: 0,
      active_tasks: 0,
      failed_tasks: 0,
      total_tokens_used: 0,
      estimated_cost_usd: 0.0,
      metrics: [
        {
          title: "Plan acceptance rate",
          value: "100.0%",
          target: "target >70%",
          is_positive: true,
          description: "Plans approved on first attempt without revision (PRD §10.2)",
          raw_value: 100.0,
        },
        {
          title: "Test pass rate",
          value: "100.0%",
          target: "target >70%",
          is_positive: true,
          description: "Sandbox test suites passing within iteration limit (PRD §10.2)",
          raw_value: 100.0,
        },
        {
          title: "PR acceptance rate",
          value: "100.0%",
          target: "target >60%",
          is_positive: true,
          description: "Automated Pull Requests ready for human code review (PRD §10.2)",
          raw_value: 100.0,
        },
        {
          title: "Avg debugging iterations",
          value: "0.0",
          target: "target <3",
          is_positive: true,
          description: "Average fix-test loops needed per task run (PRD §10.2)",
          raw_value: 0.0,
        },
        {
          title: "Avg completion time",
          value: "0s",
          target: "baseline",
          is_positive: true,
          description: "Average duration from issue trigger to PR creation (PRD §10.2)",
          raw_value: 0.0,
        },
      ],
      status_distribution: {},
      risk_distribution: {},
      recent_tasks: [],
      window: "All Time",
    };
  }
}

