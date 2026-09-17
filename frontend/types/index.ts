/**
 * Nexora AI — Frontend TypeScript Types
 * Mirrors backend Pydantic models & Supabase schema.
 */

export type TaskStatus =
  | "queued"
  | "analyzing_issue"
  | "analyzing_repo"
  | "planning"
  | "awaiting_approval"
  | "implementing"
  | "testing"
  | "debugging"
  | "pr_creating"
  | "pr_created"
  | "merged"
  | "pr_closed"
  | "failed"
  | "needs_human_help"
  | "cancelled";

export type AgentType = "planner" | "coder" | "tester" | "debugger";
export type RunStatus = "running" | "completed" | "failed" | "cancelled";
export type ToolStatus = "success" | "error" | "timeout";
export type ApprovalDecision = "approved" | "rejected";
export type PlanRisk = "low" | "medium" | "high";

export interface ImplementationPlan {
  summary: string;
  risk: PlanRisk;
  files_to_modify: string[];
  files_to_create: string[];
  steps: string[];
}

export interface TaskAttachment {
  name: string;
  mime_type: string;
  size_bytes: number;
  data_base64: string;
  is_image: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  issue_number: number;
  issue_title: string;
  issue_body?: string;
  target_files?: string[] | null;
  focus_hints?: string | null;
  attachments?: TaskAttachment[] | null;
  base_commit_sha?: string | null;
  code_changes?: {
    modified_files?: { path: string; content: string }[];
    created_files?: { path: string; content: string }[];
  } | null;
  security_report?: SecurityReport | null;
  status: TaskStatus;
  plan_json?: ImplementationPlan | null;
  pr_url?: string | null;
  branch_name?: string | null;
  error_message?: string | null;
  iteration_count: number;
  created_at: string;
  updated_at: string;
}

export interface SecurityIssue {
  rule_name: string;
  file_path: string;
  line_number: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "SECRET_LEAK" | "VULNERABILITY" | "LINTER";
  snippet: string;
  description: string;
}

export interface SecurityReport {
  passed: boolean;
  scanned_files_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  summary: string;
  issues: SecurityIssue[];
}

export interface ConnectedAccount {
  provider: "github" | "gitlab";
  connected: boolean;
  username?: string | null;
  avatar_url?: string | null;
  name?: string | null;
  url?: string | null;
}

export interface AuthStatusResponse {
  github: ConnectedAccount;
  gitlab: ConnectedAccount;
}

export interface TaskDiffLine {
  type: "add" | "del" | "neutral";
  old_line?: number | null;
  new_line?: number | null;
  content: string;
}

export interface TaskDiffFile {
  path: string;
  status: "modified" | "created" | "deleted";
  old_content?: string | null;
  new_content: string;
  additions: number;
  deletions: number;
  diff_lines: TaskDiffLine[];
}

export interface TaskDiffResponse {
  task_id: string;
  total_files: number;
  total_additions: number;
  total_deletions: number;
  files: TaskDiffFile[];
}

export interface GitCommit {
  sha: string;
  short_sha: string;
  message: string;
  author_name: string;
  author_date?: string | null;
  parents?: string[];
  url?: string | null;
}

export interface Project {
  id: string;
  name: string;
  repository_full_name: string;
  github_installation_id?: number | null;
  git_provider?: string;
  default_branch: string;
  branch_prefix?: string;
  pr_title_template?: string;
  pr_draft_mode?: boolean;
  auto_link_issue?: boolean;
  custom_test_command?: string;
  max_debug_iterations?: number;
  approval_mode?: "strict" | "low_risk_auto";
  created_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  labels: string[];
  created_at?: string | null;
}

export interface GitHubRepo {
  full_name: string;
  description?: string | null;
  default_branch: string;
  language?: string | null;
  private: boolean;
}

export interface AgentRun {
  id: string;
  task_id: string;
  agent_type: AgentType;
  status: RunStatus;
  token_usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total?: number;
  } | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export interface ToolCall {
  id: string;
  agent_run_id: string;
  tool_name: string;
  arguments?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  status: ToolStatus;
  execution_ms?: number | null;
  created_at: string;
}

export interface Approval {
  id: string;
  task_id: string;
  decision: ApprovalDecision;
  feedback_text?: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  comment_text: string;
  is_intervention: boolean;
  task_status_at?: string | null;
  created_at: string;
}

export interface ServiceStatus {
  supabase: boolean;
  gemini: boolean;
  github: boolean;
}

export interface EvaluationMetricItem {
  title: string;
  value: string;
  target: string;
  is_positive: boolean;
  description: string;
  raw_value: number;
}

export interface TaskPerformanceRecord {
  task_id: string;
  issue_number: number;
  issue_title: string;
  project_name: string;
  repository_full_name: string;
  status: string;
  risk: string;
  duration_seconds: number;
  duration_formatted: string;
  debug_iterations: number;
  token_usage_total: number;
  estimated_cost_usd: number;
  security_passed: boolean;
  plan_rejected_count: number;
  created_at: string;
  pr_url?: string | null;
}

export interface EvaluationMetricsResponse {
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
  failed_tasks: number;
  total_tokens_used: number;
  estimated_cost_usd: number;
  metrics: EvaluationMetricItem[];
  status_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  recent_tasks: TaskPerformanceRecord[];
  window: string;
}

export interface TaskFullDetails {
  task: Task;
  runs: AgentRun[];
  tool_calls: Record<string, ToolCall[]>;
  comments: TaskComment[];
}

