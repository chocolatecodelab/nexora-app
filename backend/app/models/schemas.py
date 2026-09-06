"""
Nexora AI — Pydantic Schemas

Defines request/response models for the API layer. These schemas mirror the
Supabase data model (Section 8 of the PRD) and enforce structured contracts
between frontend, backend, and agent services.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# Enums — matching Supabase ENUM types
# ============================================================

class TaskStatus(str, enum.Enum):
    QUEUED = "queued"
    ANALYZING_ISSUE = "analyzing_issue"
    ANALYZING_REPO = "analyzing_repo"
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    IMPLEMENTING = "implementing"
    TESTING = "testing"
    DEBUGGING = "debugging"
    PR_CREATING = "pr_creating"
    PR_CREATED = "pr_created"
    MERGED = "merged"
    PR_CLOSED = "pr_closed"
    FAILED = "failed"
    NEEDS_HUMAN_HELP = "needs_human_help"
    CANCELLED = "cancelled"


class AgentType(str, enum.Enum):
    PLANNER = "planner"
    CODER = "coder"
    TESTER = "tester"
    DEBUGGER = "debugger"


class RunStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ToolCallStatus(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"


class ApprovalDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class PlanRisk(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ============================================================
# Implementation Plan (structured JSON output from Planner)
# ============================================================

class ImplementationPlan(BaseModel):
    """Structured plan output from the Planning Agent — PRD Section 7.5."""
    summary: str = Field(..., description="High-level summary of the proposed changes")
    risk: PlanRisk = Field(..., description="Risk assessment: low, medium, or high")
    files_to_modify: list[str] = Field(default_factory=list, description="Existing files to change")
    files_to_create: list[str] = Field(default_factory=list, description="New files to create")
    steps: list[str] = Field(..., description="Ordered implementation steps")


# ============================================================
# Project schemas
# ============================================================

class ProjectCreate(BaseModel):
    name: str
    repository_full_name: str  # e.g. "user/repo"
    github_installation_id: Optional[int] = None
    git_provider: str = "github"  # "github" or "gitlab"
    default_branch: str = "main"
    branch_prefix: str = "nexora/issue-"
    pr_title_template: str = "[Nexora AI] {issue_title}"
    pr_draft_mode: bool = False
    auto_link_issue: bool = True
    custom_test_command: str = "npm test"
    max_debug_iterations: int = 3
    approval_mode: str = "strict"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    default_branch: Optional[str] = None
    branch_prefix: Optional[str] = None
    pr_title_template: Optional[str] = None
    pr_draft_mode: Optional[bool] = None
    auto_link_issue: Optional[bool] = None
    custom_test_command: Optional[str] = None
    max_debug_iterations: Optional[int] = None
    approval_mode: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    repository_full_name: str
    github_installation_id: Optional[int] = None
    git_provider: str = "github"
    default_branch: str = "main"
    branch_prefix: str = "nexora/issue-"
    pr_title_template: str = "[Nexora AI] {issue_title}"
    pr_draft_mode: bool = False
    auto_link_issue: bool = True
    custom_test_command: str = "npm test"
    max_debug_iterations: int = 3
    approval_mode: str = "strict"
    created_at: datetime


class CreateBranchRequest(BaseModel):
    branch_name: str
    base_branch: Optional[str] = "main"


# ============================================================
# Task schemas
class TaskAttachment(BaseModel):
    name: str
    mime_type: str
    size_bytes: int
    data_base64: str
    is_image: bool = False


class TaskCreate(BaseModel):
    """Request body for POST /api/tasks — start an agent run."""
    project_id: str
    issue_number: int
    issue_title: str
    issue_body: Optional[str] = None
    target_files: Optional[list[str]] = None  # Specific files targeted by developer
    focus_hints: Optional[str] = None   # Developer hints or focus area (e.g. specific function)
    attachments: Optional[list[TaskAttachment]] = None  # Multimodal screenshot / doc attachments


class GitCommit(BaseModel):
    """Commit info from repository history."""
    sha: str
    short_sha: str
    message: str
    author_name: str
    author_date: Optional[str] = None
    parents: list[str] = []
    url: Optional[str] = None


class TaskDiffLine(BaseModel):
    type: str  # "add", "del", "neutral"
    old_line: Optional[int] = None
    new_line: Optional[int] = None
    content: str


class TaskDiffFile(BaseModel):
    path: str
    status: str  # "modified", "created", "deleted"
    old_content: Optional[str] = None
    new_content: str
    additions: int = 0
    deletions: int = 0
    diff_lines: list[TaskDiffLine] = []


class TaskDiffResponse(BaseModel):
    task_id: str
    total_files: int
    total_additions: int
    total_deletions: int
    files: list[TaskDiffFile]


class SecurityIssue(BaseModel):
    rule_name: str
    file_path: str
    line_number: int
    severity: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    category: str  # "SECRET_LEAK", "VULNERABILITY", "LINTER"
    snippet: str
    description: str


class SecurityReport(BaseModel):
    passed: bool
    scanned_files_count: int
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    summary: str
    issues: list[SecurityIssue] = []


class ConnectedAccount(BaseModel):
    provider: str  # "github" or "gitlab"
    connected: bool
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    name: Optional[str] = None
    url: Optional[str] = None


class AuthStatusResponse(BaseModel):
    github: ConnectedAccount
    gitlab: ConnectedAccount


class ConnectTokenRequest(BaseModel):
    provider: str  # "github" or "gitlab"
    token: str
    gitlab_url: Optional[str] = None


class TaskResponse(BaseModel):
    """Response for GET /api/tasks/{id} — polling status."""
    id: str
    project_id: str
    issue_number: int
    issue_title: str
    issue_body: Optional[str] = None
    target_files: Optional[list[str]] = None
    focus_hints: Optional[str] = None
    base_commit_sha: Optional[str] = None  # Checkpoint commit SHA before task changes
    code_changes: Optional[dict] = None     # Concrete file modifications
    security_report: Optional[SecurityReport] = None  # Pre-flight security & leak audit
    attachments: Optional[list[TaskAttachment]] = None  # Uploaded multimodal screenshots / docs
    status: TaskStatus
    plan_json: Optional[ImplementationPlan] = None
    pr_url: Optional[str] = None
    branch_name: Optional[str] = None
    error_message: Optional[str] = None
    iteration_count: int = 0
    created_at: datetime
    updated_at: datetime

class TaskSummary(BaseModel):
    """Lightweight task info for listing."""
    id: str
    issue_number: int
    issue_title: str
    status: TaskStatus
    created_at: datetime


# ============================================================
# Approval schemas
# ============================================================

class ApprovalCreate(BaseModel):
    """Request body for POST /api/tasks/{id}/approve or /reject."""
    decision: ApprovalDecision
    feedback_text: Optional[str] = None

class ApprovalResponse(BaseModel):
    id: str
    task_id: str
    decision: ApprovalDecision
    feedback_text: Optional[str] = None
    created_at: datetime


# ============================================================
# Agent Run schemas
# ============================================================

class AgentRunResponse(BaseModel):
    id: str
    task_id: str
    agent_type: AgentType
    status: RunStatus
    token_usage: Optional[dict] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


# ============================================================
# Tool Call schemas
# ============================================================

class ToolCallResponse(BaseModel):
    id: str
    agent_run_id: str
    tool_name: str
    arguments: Optional[dict] = None
    result: Optional[dict] = None
    status: ToolCallStatus
    execution_ms: Optional[int] = None
    created_at: datetime


# ============================================================
# Task Comments / Human Review schemas
# ============================================================

class TaskCommentCreate(BaseModel):
    """Request body for adding a review comment to a running task."""
    comment_text: str
    is_intervention: bool = False  # If True, agent should pause and reconsider

class TaskCommentResponse(BaseModel):
    id: str
    task_id: str
    comment_text: str
    is_intervention: bool = False
    task_status_at: Optional[str] = None  # Task status when comment was posted
    created_at: datetime


# ============================================================
# GitHub-related schemas (for frontend display)
# ============================================================

class CreateIssueRequest(BaseModel):
    title: str
    body: Optional[str] = ""
    labels: Optional[list[str]] = Field(default_factory=lambda: ["nexora-ai"])


class GitHubIssue(BaseModel):
    """Simplified GitHub issue representation."""
    number: int
    title: str
    body: Optional[str] = None
    state: str = "open"
    labels: list[str] = Field(default_factory=list)
    created_at: Optional[str] = None
    url: Optional[str] = None

class GitHubRepo(BaseModel):
    """Simplified GitHub repository representation."""
    full_name: str
    description: Optional[str] = None
    default_branch: str = "main"
    language: Optional[str] = None
    private: bool = False


# ============================================================
# Health / Status
# ============================================================

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "Nexora API"
    version: str = "0.1.0"
    environment: str = "development"

class ServiceStatus(BaseModel):
    """Status of each connected external service."""
    supabase: bool = False
    gemini: bool = False
    github: bool = False


# ============================================================
# Evaluation & Analytics Metrics schemas (PRD Phase 12)
# ============================================================

class EvaluationMetricItem(BaseModel):
    title: str
    value: str
    target: str
    is_positive: bool = True
    description: str
    raw_value: float = 0.0


class TaskPerformanceRecord(BaseModel):
    task_id: str
    issue_number: int
    issue_title: str
    project_name: str
    repository_full_name: str
    status: str
    risk: str = "low"
    duration_seconds: int = 0
    duration_formatted: str = "0s"
    debug_iterations: int = 0
    token_usage_total: int = 0
    estimated_cost_usd: float = 0.0
    security_passed: bool = True
    plan_rejected_count: int = 0
    created_at: str
    pr_url: Optional[str] = None


class EvaluationMetricsResponse(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    active_tasks: int = 0
    failed_tasks: int = 0
    total_tokens_used: int = 0
    estimated_cost_usd: float = 0.0
    metrics: list[EvaluationMetricItem] = []
    status_distribution: dict[str, int] = {}
    risk_distribution: dict[str, int] = {}
    recent_tasks: list[TaskPerformanceRecord] = []
    window: str = "All Time"

