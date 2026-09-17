"""
Nexora AI — Tasks Router & Multi-Provider Orchestrator

Handles the core agent state machine pipeline with support for both GitHub and GitLab:
1. Issue & Repository Analysis (`analyzing_issue`, `analyzing_repo`)
2. Structured Plan Generation (`planning` -> `awaiting_approval`)
3. Human Approval Gate (`/approve`, `/reject`)
4. Coding Agent Code Generation (`implementing`)
5. Isolated Sandbox Test Execution (`testing`)
6. Auto-Debug Fix-Test Loop (`debugging` <= 3 iterations)
7. Pull Request (GitHub) or Merge Request (GitLab) Creation (`pr_creating` -> `pr_created`)

Additional features:
- Cancel & Restart task controls
- Human Review / Comment system with intervention capability
- Token-optimized context management for Gemini API
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse

import difflib
from app.config import get_settings
from app.models.schemas import (
    AgentRunResponse,
    ApprovalCreate,
    ApprovalResponse,
    ImplementationPlan,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskDiffFile,
    TaskDiffLine,
    TaskDiffResponse,
    SecurityReport,
    TaskResponse,
    TaskSummary,
    ToolCallResponse,
    TaskFullDetails,
)
from app.services import (
    coder_service,
    debugger_service,
    event_stream,
    gemini_service,
    git_provider,
    sandbox_service,
    security_service,
    supabase_client,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

# Files/directories to exclude from repo context (saves tokens)
EXCLUDED_PATTERNS = {
    "node_modules", ".git", ".next", ".nuxt", "__pycache__", ".venv", "venv",
    "dist", "build", ".cache", "coverage", ".idea", ".vscode",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Pipfile.lock",
    "poetry.lock", ".DS_Store", "Thumbs.db",
}

EXCLUDED_EXTENSIONS = {
    ".lock", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff",
    ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".tar", ".gz",
    ".pdf", ".min.js", ".min.css", ".map",
}


# ============================================================
# Token Budget Helpers
# ============================================================

def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English/code."""
    return len(text) // 4


def _filter_file_tree(files: list[dict], issue_title: str = "") -> list[dict]:
    """
    Filter file tree to exclude noise and prioritize relevant files.
    Returns filtered list sorted by relevance to the issue.
    """
    filtered = []
    for f in files:
        path = f.get("path", "")
        basename = path.split("/")[-1] if "/" in path else path

        # Skip excluded directories and files
        if any(exc in path.split("/") for exc in EXCLUDED_PATTERNS):
            continue
        if any(path.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
            continue

        filtered.append(f)

    # Sort by relevance: files whose names match issue keywords come first
    if issue_title:
        keywords = set(re.findall(r'\w+', issue_title.lower()))
        keywords -= {"the", "a", "an", "is", "to", "for", "and", "or", "in", "of", "add", "fix", "update"}

        def relevance(f: dict) -> int:
            path_lower = f.get("path", "").lower()
            return sum(1 for kw in keywords if kw in path_lower)

        filtered.sort(key=relevance, reverse=True)

    return filtered


def _truncate_to_budget(text: str, max_tokens: int) -> str:
    """Truncate text to fit within token budget."""
    estimated = _estimate_tokens(text)
    if estimated <= max_tokens:
        return text
    # Keep roughly max_tokens * 4 characters
    max_chars = max_tokens * 4
    truncated = text[:max_chars]
    truncated += "\n\n... [context truncated to fit token budget] ..."
    return truncated


# ============================================================
# Cancellation & Intervention Checks
# ============================================================

def _is_cancelled(task_id: str) -> bool:
    """Check if a task has been cancelled."""
    task = supabase_client.get_task(task_id)
    return task is not None and task.get("status") == "cancelled"


def _check_intervention(task_id: str) -> Optional[dict]:
    """Check if there's a pending human intervention comment."""
    return supabase_client.has_pending_intervention(task_id)


# ============================================================
# Task CRUD
# ============================================================

@router.post("", response_model=TaskResponse, status_code=201)
@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreate, background_tasks: BackgroundTasks):
    """
    Start a new agent run for an issue.
    Creates task with status 'queued' and launches the asynchronous pipeline.
    """
    data = body.model_dump()
    task = supabase_client.create_task(data)

    # Broadcast queued event to SSE listeners
    event_stream.broadcast_task_event(task["id"], "status", {"status": "queued", "task": task})

    # Launch background agent pipeline
    background_tasks.add_task(run_agent_pipeline, task["id"])
    return task


@router.get("", response_model=list[TaskSummary])
@router.get("/", response_model=list[TaskSummary])
async def list_tasks(project_id: Optional[str] = None):
    """List all tasks, optionally filtered by project."""
    tasks = supabase_client.list_tasks(project_id)
    return tasks


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a specific task and its associated logs."""
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    supabase_client.delete_task(task_id)
    return {"message": f"Task {task_id} deleted successfully"}


@router.delete("")
@router.delete("/")
async def clear_task_history(project_id: Optional[str] = None):
    """Clear all finished/stale tasks from history cascading to child tables and memory store."""
    deleted_count = supabase_client.clear_task_history(project_id)
    return {"message": "All task history cleared", "deleted_count": deleted_count}


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Poll current task status, plan, PR/MR URL, and iteration count."""
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Live synchronization with GitHub/GitLab for PR status changes
    if task.get("status") == "pr_created" and task.get("pr_url"):
        try:
            import re
            pr_url = task["pr_url"]
            match = re.search(r"/(?:pull|merge_requests)/(\d+)", pr_url)
            if match:
                pr_num = int(match.group(1))
                proj = supabase_client.get_project(task["project_id"])
                if proj:
                    repo_name = proj["repository_full_name"]
                    remote_status = await git_provider.get_pr_or_mr_status(
                        repo_full_name=repo_name,
                        pr_number=pr_num,
                        project=proj,
                    )
                    if remote_status.get("state") == "merged":
                        task = supabase_client.update_task(task_id, {"status": "merged"})
                    elif remote_status.get("state") == "closed":
                        task = supabase_client.update_task(task_id, {"status": "pr_closed"})
        except Exception as exc:
            logger.debug("Remote PR status check skipped: %s", exc)

    return task


@router.get("/{task_id}/full", response_model=TaskFullDetails)
async def get_task_full_details(task_id: str):
    """
    High-performance aggregated endpoint.
    Returns task, runs, all tool calls per run, and comments in a single round-trip,
    eliminating the N+1 polling and waterfall overhead.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    runs = supabase_client.list_agent_runs(task_id)
    tool_calls_map = {}
    for run in runs:
        tool_calls_map[run["id"]] = supabase_client.list_tool_calls(run["id"])

    comments = supabase_client.list_task_comments(task_id)

    return {
        "task": task,
        "runs": runs,
        "tool_calls": tool_calls_map,
        "comments": comments,
    }


@router.get("/{task_id}/stream")
async def stream_task_events(task_id: str, request: Request):
    """
    Server-Sent Events (SSE) live event stream for a specific task.
    Streams real-time status transitions, agent runs, tool calls, and test outputs.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return StreamingResponse(
        event_stream.event_generator(task_id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# Human Approval Gate (PRD Section 5.1 & 7.5)
# ============================================================

@router.post("/{task_id}/approve", response_model=ApprovalResponse)
async def approve_task(task_id: str, background_tasks: BackgroundTasks):
    """
    Approve the implementation plan.
    Transitions task to 'implementing' and kicks off Coding Agent + Sandbox tests.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "awaiting_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Task is not awaiting approval (current status: {task['status']})",
        )

    # Record the approval decision in Supabase
    approval = supabase_client.create_approval({
        "task_id": task_id,
        "decision": "approved",
    })

    # Update task status to implementing
    supabase_client.update_task(task_id, {"status": "implementing"})
    event_stream.broadcast_task_event(task_id, "status", {"status": "implementing"})

    # Launch coding + testing execution phase in background
    background_tasks.add_task(run_coding_phase, task_id)

    return approval


@router.post("/{task_id}/reject", response_model=ApprovalResponse)
async def reject_task(task_id: str, body: ApprovalCreate, background_tasks: BackgroundTasks):
    """
    Reject the implementation plan with feedback.
    The Planning Agent will revise the plan incorporating human feedback.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] != "awaiting_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Task is not awaiting approval (current status: {task['status']})",
        )

    approval = supabase_client.create_approval({
        "task_id": task_id,
        "decision": "rejected",
        "feedback_text": body.feedback_text,
    })

    supabase_client.update_task(task_id, {"status": "planning"})
    event_stream.broadcast_task_event(task_id, "status", {"status": "planning", "feedback": body.feedback_text})

    # Re-run planning with feedback
    background_tasks.add_task(
        run_planning_phase, task_id, feedback=body.feedback_text
    )

    return approval


# ============================================================
# Cancel & Restart Controls
# ============================================================

@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    """
    Cancel a running task.
    Sets status to 'cancelled' and marks all running agent_runs as cancelled.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    terminal_statuses = {"pr_created", "failed", "cancelled"}
    if task["status"] in terminal_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Task is already in terminal state: {task['status']}",
        )

    supabase_client.update_task(task_id, {"status": "cancelled"})
    event_stream.broadcast_task_event(task_id, "status", {"status": "cancelled"})

    # Cancel all running agent runs
    runs = supabase_client.list_agent_runs(task_id)
    for run in runs:
        if run.get("status") == "running":
            supabase_client.update_agent_run(run["id"], {
                "status": "cancelled",
                "completed_at": supabase_client._now_iso(),
            })

    logger.info("Task %s cancelled by user", task_id)
    return {"status": "cancelled", "task_id": task_id}


@router.post("/{task_id}/restart", response_model=TaskResponse)
async def restart_task(task_id: str, background_tasks: BackgroundTasks):
    """
    Restart a task from scratch.
    Resets status to 'queued', clears plan/errors, and re-launches pipeline.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Reset task state
    supabase_client.update_task(task_id, {
        "status": "queued",
        "plan_json": None,
        "pr_url": None,
        "branch_name": None,
        "error_message": None,
        "iteration_count": 0,
    })
    event_stream.broadcast_task_event(task_id, "status", {"status": "queued"})

    # Re-launch pipeline
    background_tasks.add_task(run_agent_pipeline, task_id)

    updated_task = supabase_client.get_task(task_id)
    logger.info("Task %s restarted by user", task_id)
    return updated_task


@router.post("/{task_id}/revert")
async def revert_task_changes(task_id: str):
    """
    Open a Revert Pull Request (GitHub) or Merge Request (GitLab) to rollback task changes.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = supabase_client.get_project(task["project_id"])
    repo_name = project["repository_full_name"] if project else "nexora-ai/nexora-playground"

    res = await git_provider.create_revert_pr(
        repo_full_name=repo_name,
        task=task,
        project=project,
    )

    logger.info("Revert PR/MR created for task %s: %s", task_id, res.get("url"))
    return {
        "status": "revert_pr_created",
        "task_id": task_id,
        "revert_pr_url": res.get("url"),
        "type": res.get("type", "PR"),
    }


@router.post("/{task_id}/close-pr")
async def close_task_pr(task_id: str):
    """
    Close/Discard the PR or MR created for this task without merging.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = supabase_client.get_project(task["project_id"])
    repo_name = project["repository_full_name"] if project else "nexora-ai/nexora-playground"

    # Extract PR / MR number from pr_url (e.g. https://github.com/owner/repo/pull/12 -> 12)
    pr_num = 1
    if task.get("pr_url"):
        import re
        match = re.search(r'/(?:pull|merge_requests)/(\d+)', task["pr_url"])
        if match:
            pr_num = int(match.group(1))

    success = await git_provider.close_pr_or_mr(
        repo_full_name=repo_name,
        pr_number_or_iid=pr_num,
        project=project,
    )

    if success:
        supabase_client.update_task(task_id, {"status": "pr_closed"})
        event_stream.broadcast_task_event(task_id, "status", {"status": "pr_closed"})

    return {"status": "pr_closed" if success else "failed", "task_id": task_id}


@router.post("/{task_id}/merge-pr")
async def merge_task_pr(task_id: str):
    """
    Directly merge the Pull Request (GitHub) or Merge Request (GitLab) created for this task.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = supabase_client.get_project(task["project_id"])
    repo_name = project["repository_full_name"] if project else "nexora-ai/nexora-playground"

    pr_num = 1
    if task.get("pr_url"):
        import re
        match = re.search(r'/(?:pull|merge_requests)/(\d+)', task["pr_url"])
        if match:
            pr_num = int(match.group(1))

    commit_title = f"feat(nexora): merge #{pr_num} - {task.get('issue_title', '')}"
    merge_res = await git_provider.merge_pr_or_mr(
        repo_full_name=repo_name,
        pr_number_or_iid=pr_num,
        commit_title=commit_title,
        project=project,
    )

    if merge_res.get("merged"):
        supabase_client.update_task(task_id, {
            "status": "merged",
        })
        event_stream.broadcast_task_event(task_id, "status", {"status": "merged", "sha": merge_res.get("sha")})
        logger.info("Task %s PR #%d successfully merged on %s", task_id, pr_num, repo_name)
        return {
            "status": "merged",
            "task_id": task_id,
            "message": merge_res.get("message", "Merged successfully"),
            "sha": merge_res.get("sha"),
        }
    else:
        logger.error("Task %s PR #%d merge failed: %s", task_id, pr_num, merge_res.get("message"))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to merge PR on Git provider: {merge_res.get('message', 'Unknown error')}",
        )


def _generate_diff_lines(old_content: str, new_content: str) -> tuple[list[TaskDiffLine], int, int]:
    """Compute line-by-line diff between original and modified file contents."""
    old_lines = old_content.splitlines() if old_content else []
    new_lines = new_content.splitlines() if new_content else []

    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    diff_lines: list[TaskDiffLine] = []
    additions = 0
    deletions = 0

    old_idx = 1
    new_idx = 1

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for line in old_lines[i1:i2]:
                diff_lines.append(TaskDiffLine(type="neutral", old_line=old_idx, new_line=new_idx, content=line))
                old_idx += 1
                new_idx += 1
        elif tag == "delete":
            for line in old_lines[i1:i2]:
                diff_lines.append(TaskDiffLine(type="del", old_line=old_idx, new_line=None, content=line))
                old_idx += 1
                deletions += 1
        elif tag == "insert":
            for line in new_lines[j1:j2]:
                diff_lines.append(TaskDiffLine(type="add", old_line=None, new_line=new_idx, content=line))
                new_idx += 1
                additions += 1
        elif tag == "replace":
            for line in old_lines[i1:i2]:
                diff_lines.append(TaskDiffLine(type="del", old_line=old_idx, new_line=None, content=line))
                old_idx += 1
                deletions += 1
            for line in new_lines[j1:j2]:
                diff_lines.append(TaskDiffLine(type="add", old_line=None, new_line=new_idx, content=line))
                new_idx += 1
                additions += 1

    return diff_lines, additions, deletions


@router.get("/{task_id}/diff", response_model=TaskDiffResponse)
async def get_task_diff(task_id: str):
    """
    Get the structured side-by-side / unified code diff for all files modified by the task.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = supabase_client.get_project(task["project_id"])
    repo_name = project["repository_full_name"] if project else "nexora-ai/nexora-playground"

    code_changes = task.get("code_changes") or {}
    modified_files = code_changes.get("modified_files", [])
    created_files = code_changes.get("created_files", [])

    diff_files: list[TaskDiffFile] = []
    total_add = 0
    total_del = 0

    # If code_changes not present yet (e.g. during planning/approval), build proposed preview
    if not modified_files and not created_files and task.get("plan_json"):
        plan = task["plan_json"]
        for path in plan.get("files_to_modify", []):
            orig = await git_provider.read_file(repo_name, path, project=project) or "// Original content"
            proposed = orig + f"\n\n// [Nexora AI Proposed Changes according to plan: {plan.get('summary', '')}]"
            d_lines, a_cnt, d_cnt = _generate_diff_lines(orig, proposed)
            diff_files.append(TaskDiffFile(
                path=path,
                status="modified",
                old_content=orig,
                new_content=proposed,
                additions=a_cnt,
                deletions=d_cnt,
                diff_lines=d_lines,
            ))
            total_add += a_cnt
            total_del += d_cnt

        for path in plan.get("files_to_create", []):
            created_content = f"// [Nexora AI New File Created for #{task['issue_number']}]\nexport const ready = true;\n"
            d_lines, a_cnt, _ = _generate_diff_lines("", created_content)
            diff_files.append(TaskDiffFile(
                path=path,
                status="created",
                old_content="",
                new_content=created_content,
                additions=a_cnt,
                deletions=0,
                diff_lines=d_lines,
            ))
            total_add += a_cnt
    else:
        # Process actual modified files
        for f in modified_files:
            path = f["path"]
            new_content = f["content"]
            old_content = await git_provider.read_file(repo_name, path, project=project) or ""
            d_lines, a_cnt, d_cnt = _generate_diff_lines(old_content, new_content)
            diff_files.append(TaskDiffFile(
                path=path,
                status="modified",
                old_content=old_content,
                new_content=new_content,
                additions=a_cnt,
                deletions=d_cnt,
                diff_lines=d_lines,
            ))
            total_add += a_cnt
            total_del += d_cnt

        # Process actual created files
        for f in created_files:
            path = f["path"]
            new_content = f["content"]
            d_lines, a_cnt, _ = _generate_diff_lines("", new_content)
            diff_files.append(TaskDiffFile(
                path=path,
                status="created",
                old_content="",
                new_content=new_content,
                additions=a_cnt,
                deletions=0,
                diff_lines=d_lines,
            ))
            total_add += a_cnt

    return TaskDiffResponse(
        task_id=task_id,
        total_files=len(diff_files),
        total_additions=total_add,
        total_deletions=total_del,
        files=diff_files,
    )


@router.get("/{task_id}/security", response_model=SecurityReport)
async def get_task_security_report(task_id: str):
    """
    Get pre-flight security scan & secret leak audit report for the task.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    code_changes = task.get("code_changes") or {}
    report = security_service.scan_code_changes(code_changes)
    return report


# ============================================================
# Human Review / Comments
# ============================================================

@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def add_task_comment(task_id: str, body: TaskCommentCreate):
    """
    Add a review comment to a task.
    If is_intervention=True, the agent will pause at the next phase boundary.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = supabase_client.create_task_comment({
        "task_id": task_id,
        "comment_text": body.comment_text,
        "is_intervention": body.is_intervention,
        "task_status_at": task["status"],
    })

    if body.is_intervention:
        logger.info("Intervention comment posted on task %s — agent will pause at next phase", task_id)

    return comment


@router.get("/{task_id}/comments", response_model=list[TaskCommentResponse])
async def get_task_comments(task_id: str):
    """List all review comments for a task."""
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return supabase_client.list_task_comments(task_id)


# ============================================================
# Observability — Agent Runs & Tool Calls (PRD Section 10)
# ============================================================

@router.get("/{task_id}/runs", response_model=list[AgentRunResponse])
async def get_task_runs(task_id: str):
    """List all agent runs (planner, coder, tester, debugger) for a task."""
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    runs = supabase_client.list_agent_runs(task_id)
    return runs


@router.get("/{task_id}/runs/{run_id}/tool-calls", response_model=list[ToolCallResponse])
async def get_run_tool_calls(task_id: str, run_id: str):
    """List all tool calls (search_code, read_file, edit_file, run_test) for a run."""
    tool_calls = supabase_client.list_tool_calls(run_id)
    return tool_calls


# ============================================================
# Background Agent Pipeline Orchestrator
# ============================================================

async def run_agent_pipeline(task_id: str):
    """
    Main agent pipeline orchestrator.
    Step 1: Analyzing Issue & Repository (GitHub or GitLab)
    Step 2: Planning with Gemini 3.5 Flash -> awaiting_approval
    """
    try:
        # Check cancellation before starting
        if _is_cancelled(task_id):
            return

        supabase_client.update_task(task_id, {"status": "analyzing_issue"})
        event_stream.broadcast_task_event(task_id, "status", {"status": "analyzing_issue"})
        task = supabase_client.get_task(task_id)
        if not task:
            return

        logger.info("Pipeline started for task %s: %s", task_id, task["issue_title"])

        # Check cancellation
        if _is_cancelled(task_id):
            return

        # Check for human intervention
        intervention = _check_intervention(task_id)
        if intervention:
            supabase_client.update_task(task_id, {
                "status": "needs_human_help",
                "error_message": f"Human intervention: {intervention['comment_text']}",
            })
            event_stream.broadcast_task_event(task_id, "status", {
                "status": "needs_human_help",
                "error_message": f"Human intervention: {intervention['comment_text']}",
            })
            return

        # Phase 2: Analyzing repository (Selective Understanding & Targeted Scoping)
        supabase_client.update_task(task_id, {"status": "analyzing_repo"})
        event_stream.broadcast_task_event(task_id, "status", {"status": "analyzing_repo"})
        project = supabase_client.get_project(task["project_id"])
        repo_context = ""
        if project:
            repo_name = project["repository_full_name"]

            # Record initial commit SHA checkpoint
            try:
                recent_commits = await git_provider.list_commits(repo_name, limit=1, project=project)
                if recent_commits and len(recent_commits) > 0:
                    supabase_client.update_task(task_id, {"base_commit_sha": recent_commits[0]["sha"]})
            except Exception as exc:
                logger.warning("Could not record base_commit_sha for task %s: %s", task_id, exc)

            files = await git_provider.list_files(repo_name, project=project)

            # Filter and prioritize file tree
            filtered_files = _filter_file_tree(files, issue_title=task["issue_title"])
            file_list = "\n".join(f"- {f['path']}" for f in filtered_files[:50])  # Cap at 50 files
            repo_context = f"## Repository File Tree\n{file_list}"

            # If user specified target files, fetch and inject their full contents as priority context
            target_files = task.get("target_files") or []
            if target_files:
                target_contents = []
                for tf in target_files:
                    content = await git_provider.read_file(repo_name, tf, project=project)
                    if content:
                        target_contents.append(f"### File: {tf}\n```\n{content}\n```")
                if target_contents:
                    repo_context += f"\n\n## 🎯 Priority Targeted Files Content (Developer Specified)\n" + "\n\n".join(target_contents)

            # If developer provided focus hints, add them explicitly
            focus_hints = task.get("focus_hints")
            if focus_hints:
                repo_context += f"\n\n## 💡 Developer Focus & Scoping Hints\n{focus_hints}"

            # Truncate to token budget
            settings = get_settings()
            max_repo_tokens = settings.max_context_tokens // 2  # Reserve half for issue + plan prompt
            repo_context = _truncate_to_budget(repo_context, max_repo_tokens)

        # Check cancellation before planning
        if _is_cancelled(task_id):
            return

        # Phase 3: Planning Agent
        await run_planning_phase(task_id, repo_context=repo_context)

    except Exception as exc:
        logger.error("Pipeline failed for task %s: %s", task_id, exc)
        supabase_client.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc),
        })
        event_stream.broadcast_task_event(task_id, "status", {
            "status": "failed",
            "error_message": str(exc),
        })


async def run_planning_phase(
    task_id: str,
    repo_context: str = "",
    feedback: str | None = None,
):
    """Generate or revise structured implementation plan using Gemini."""
    if _is_cancelled(task_id):
        return

    supabase_client.update_task(task_id, {"status": "planning"})
    event_stream.broadcast_task_event(task_id, "status", {"status": "planning"})
    task = supabase_client.get_task(task_id)
    if not task:
        return

    run = supabase_client.create_agent_run({
        "task_id": task_id,
        "agent_type": "planner",
    })

    try:
        plan = await gemini_service.generate_plan(
            issue_title=task["issue_title"],
            issue_body=task.get("issue_body", ""),
            repo_context=repo_context,
            feedback=feedback,
            attachments=task.get("attachments"),
        )

        if _is_cancelled(task_id):
            supabase_client.update_agent_run(run["id"], {
                "status": "cancelled",
                "completed_at": supabase_client._now_iso(),
            })
            return

        if plan:
            supabase_client.update_task(task_id, {
                "status": "awaiting_approval",
                "plan_json": plan.model_dump(),
            })
            supabase_client.update_agent_run(run["id"], {
                "status": "completed",
                "completed_at": supabase_client._now_iso(),
            })
            event_stream.broadcast_task_event(task_id, "plan_ready", {
                "status": "awaiting_approval",
                "plan": plan.model_dump(),
            })
            logger.info("Plan generated for task %s — awaiting human approval", task_id)
        else:
            supabase_client.update_task(task_id, {
                "status": "failed",
                "error_message": "Planning agent failed to generate a plan",
            })
            supabase_client.update_agent_run(run["id"], {
                "status": "failed",
                "error_message": "Plan generation returned None",
            })
            event_stream.broadcast_task_event(task_id, "status", {
                "status": "failed",
                "error_message": "Planning agent failed to generate a plan",
            })

    except Exception as exc:
        logger.error("Planning phase failed: %s", exc)
        supabase_client.update_task(task_id, {
            "status": "failed",
            "error_message": str(exc),
        })
        supabase_client.update_agent_run(run["id"], {
            "status": "failed",
            "error_message": str(exc),
        })
        event_stream.broadcast_task_event(task_id, "status", {
            "status": "failed",
            "error_message": str(exc),
        })


async def run_coding_phase(task_id: str):
    """
    Executes the approved plan:
    1. Coding Agent writes file edits/creations (`implementing`)
    2. Sandbox executes tests (`testing`)
    3. Auto-Debug Loop fixes test failures (`debugging` up to 3 iters)
    4. Opens Pull Request (GitHub) or Merge Request (GitLab) on green tests (`pr_created`)
    """
    if _is_cancelled(task_id):
        return

    task = supabase_client.get_task(task_id)
    if not task or not task.get("plan_json"):
        return

    plan = ImplementationPlan(**task["plan_json"])
    project = supabase_client.get_project(task["project_id"])
    repo_name = project["repository_full_name"] if project else "nexora-ai/nexora-playground"

    logger.info("Starting Coding Phase for task %s", task_id)

    # Check for intervention
    intervention = _check_intervention(task_id)
    if intervention:
        supabase_client.update_task(task_id, {
            "status": "needs_human_help",
            "error_message": f"Human intervention: {intervention['comment_text']}",
        })
        return

    # ------------------------------------------------------------
    # Step 1: Coding Agent
    # ------------------------------------------------------------
    supabase_client.update_task(task_id, {"status": "implementing"})
    event_stream.broadcast_task_event(task_id, "status", {"status": "implementing"})
    coder_run = supabase_client.create_agent_run({
        "task_id": task_id,
        "agent_type": "coder",
    })

    # Read existing file contents using git_provider (both from plan and developer target files)
    files_to_read = set(plan.files_to_modify)
    if task.get("target_files"):
        files_to_read.update(task["target_files"])

    existing_files = {}
    for fpath in files_to_read:
        content = await git_provider.read_file(repo_name, fpath, project=project)
        if content:
            existing_files[fpath] = content

    if _is_cancelled(task_id):
        supabase_client.update_agent_run(coder_run["id"], {
            "status": "cancelled",
            "completed_at": supabase_client._now_iso(),
        })
        return

    code_changes = await coder_service.implement_plan(
        task_id=task_id,
        run_id=coder_run["id"],
        issue_title=task["issue_title"],
        issue_body=task.get("issue_body", ""),
        plan=plan,
        existing_files=existing_files,
        attachments=task.get("attachments"),
    )

    security_report = security_service.scan_code_changes(code_changes)
    supabase_client.update_task(task_id, {
        "code_changes": code_changes,
        "security_report": security_report.model_dump(),
    })
    event_stream.broadcast_task_event(task_id, "code_ready", {
        "status": "implementing",
        "modified_count": len(code_changes.get("modified_files", [])),
        "created_count": len(code_changes.get("created_files", [])),
    })

    if not security_report.passed:
        logger.warning("Task %s pre-flight security guardrail alert: %s", task_id, security_report.summary)

    supabase_client.update_agent_run(coder_run["id"], {
        "status": "completed",
        "completed_at": supabase_client._now_iso(),
    })

    # ------------------------------------------------------------
    # Step 2: Testing & Auto-Debug Loop (Configurable Runner & Iterations)
    # ------------------------------------------------------------
    custom_test_cmd = project.get("custom_test_command", "npm test") if project else "npm test"
    max_iterations = project.get("max_debug_iterations", 3) if project else 3
    iteration = 1
    all_tests_passed = False

    while iteration <= max_iterations:
        # Check cancellation before each iteration
        if _is_cancelled(task_id):
            return

        # Check for intervention
        intervention = _check_intervention(task_id)
        if intervention:
            supabase_client.update_task(task_id, {
                "status": "needs_human_help",
                "error_message": f"Human intervention: {intervention['comment_text']}",
            })
            event_stream.broadcast_task_event(task_id, "status", {
                "status": "needs_human_help",
                "error_message": f"Human intervention: {intervention['comment_text']}",
            })
            return

        # Testing
        supabase_client.update_task(task_id, {
            "status": "testing",
            "iteration_count": iteration,
        })
        event_stream.broadcast_task_event(task_id, "status", {
            "status": "testing",
            "iteration": iteration,
        })
        tester_run = supabase_client.create_agent_run({
            "task_id": task_id,
            "agent_type": "tester",
        })

        test_result = await sandbox_service.run_tests(
            task_id=task_id,
            run_id=tester_run["id"],
            iteration=iteration,
            command=custom_test_cmd,
        )

        supabase_client.update_agent_run(tester_run["id"], {
            "status": "completed" if test_result.passed else "failed",
            "completed_at": supabase_client._now_iso(),
        })
        event_stream.broadcast_task_event(task_id, "test_result", {
            "iteration": iteration,
            "passed": test_result.passed,
            "exit_code": test_result.exit_code,
            "tests_passed": test_result.tests_passed,
            "tests_failed": test_result.tests_failed,
        })

        if test_result.passed:
            all_tests_passed = True
            break

        # Debugging (if tests failed and iterations remain)
        if iteration < max_iterations:
            if _is_cancelled(task_id):
                return

            supabase_client.update_task(task_id, {"status": "debugging"})
            event_stream.broadcast_task_event(task_id, "status", {
                "status": "debugging",
                "iteration": iteration,
            })
            debugger_run = supabase_client.create_agent_run({
                "task_id": task_id,
                "agent_type": "debugger",
            })

            current_files = {**existing_files}
            for f in code_changes.get("modified_files", []):
                current_files[f["path"]] = f["content"]
            for f in code_changes.get("created_files", []):
                current_files[f["path"]] = f["content"]

            debug_fix = await debugger_service.diagnose_and_fix(
                task_id=task_id,
                run_id=debugger_run["id"],
                test_output=test_result.output,
                current_files=current_files,
            )

            # Synchronize debugger patched files into code_changes
            patched_files = debug_fix.get("patched_files", [])
            if patched_files:
                modified_map = {f["path"]: f for f in code_changes.get("modified_files", [])}
                created_map = {f["path"]: f for f in code_changes.get("created_files", [])}

                for pf in patched_files:
                    path = pf["path"]
                    if path in modified_map:
                        modified_map[path]["content"] = pf["content"]
                        if "diff_blocks" in pf:
                            modified_map[path]["diff_blocks"] = pf["diff_blocks"]
                    elif path in created_map:
                        created_map[path]["content"] = pf["content"]
                    else:
                        modified_map[path] = {
                            "path": path,
                            "content": pf["content"],
                            "diff_blocks": pf.get("diff_blocks", []),
                        }

                code_changes["modified_files"] = list(modified_map.values())
                code_changes["created_files"] = list(created_map.values())

                # Re-scan security guardrail on patched code
                security_report = security_service.scan_code_changes(code_changes)

                # Persist updated code_changes to database
                supabase_client.update_task(task_id, {
                    "code_changes": code_changes,
                    "security_report": security_report.model_dump(),
                })

                # Broadcast live code_ready event
                event_stream.broadcast_task_event(task_id, "code_ready", {
                    "status": "debugging",
                    "iteration": iteration,
                    "modified_count": len(code_changes.get("modified_files", [])),
                    "created_count": len(code_changes.get("created_files", [])),
                })

            supabase_client.update_agent_run(debugger_run["id"], {
                "status": "completed",
                "completed_at": supabase_client._now_iso(),
            })

        iteration += 1

    # ------------------------------------------------------------
    # Step 3: Final Resolution & Pull/Merge Request Creation
    # ------------------------------------------------------------
    if _is_cancelled(task_id):
        return

    if all_tests_passed:
        supabase_client.update_task(task_id, {"status": "pr_creating"})
        event_stream.broadcast_task_event(task_id, "status", {"status": "pr_creating"})
        await asyncio.sleep(1.2)

        # Dynamic Branch Naming & Base Branch
        branch_prefix = project.get("branch_prefix", "nexora/issue-") if project else "nexora/issue-"
        branch_name = f"{branch_prefix}{task['issue_number']}"
        target_branch = project.get("default_branch", "main") if project else "main"

        # Dynamic PR/MR Title & Draft Status
        title_template = project.get("pr_title_template", "[Nexora AI] {issue_title}") if project else "[Nexora AI] {issue_title}"
        pr_title = title_template.replace("{issue_title}", task["issue_title"]).replace("{issue_number}", str(task["issue_number"]))
        is_draft = project.get("pr_draft_mode", False) if project else False
        if is_draft and not pr_title.startswith(("[Draft]", "Draft:", "WIP:")):
            pr_title = f"[Draft] {pr_title}"

        # Auto-Close Linking
        auto_close = project.get("auto_link_issue", True) if project else True
        close_tag = f"\n\nCloses #{task['issue_number']}" if auto_close else ""

        description = (
            f"## 🤖 Nexora AI — Automated Resolution\n\n"
            f"### 📋 Summary\n{plan.summary}\n\n"
            f"### 🛡️ Risk Assessment & Verification\n"
            f"- **Risk Level**: `{plan.risk.upper()}`\n"
            f"- **Sandbox Runner**: `{custom_test_cmd}` (100% Passed)\n\n"
            f"### 📝 Implementation Steps\n" + "\n".join(f"{i+1}. {s}" for i, s in enumerate(plan.steps)) +
            close_tag
        )

        # 1. Ensure source branch exists
        await git_provider.create_branch(repo_name, branch_name, ref=target_branch, project=project)

        # 2. Push generated code changes to the remote branch
        commit_msg = f"feat(nexora): resolve #{task['issue_number']} - {task['issue_title']}"
        commit_res = await git_provider.commit_and_push_changes(
            repo_full_name=repo_name,
            branch_name=branch_name,
            code_changes=code_changes,
            commit_message=commit_msg,
            project=project,
        )
        logger.info("Committed changes for task %s to branch %s: %s", task_id, branch_name, commit_res)

        # 3. Create Pull Request (GitHub) or Merge Request (GitLab)
        res = await git_provider.create_pr_or_mr(
            repo_full_name=repo_name,
            source_branch=branch_name,
            target_branch=target_branch,
            title=pr_title,
            description=description,
            project=project,
        )

        pr_url = res["url"]
        supabase_client.update_task(task_id, {
            "status": "pr_created",
            "branch_name": branch_name,
            "pr_url": pr_url,
        })
        event_stream.broadcast_task_event(task_id, "pr_created", {
            "status": "pr_created",
            "branch_name": branch_name,
            "pr_url": pr_url,
        })
        logger.info("PR/MR created for task %s: %s (%s)", task_id, pr_url, branch_name)

    else:
        supabase_client.update_task(task_id, {
            "status": "needs_human_help",
            "error_message": f"Agent stopped after {max_iterations} attempts. Automated tests did not achieve 100% pass rate.",
        })
        event_stream.broadcast_task_event(task_id, "status", {
            "status": "needs_human_help",
            "error_message": f"Agent stopped after {max_iterations} attempts. Automated tests did not achieve 100% pass rate.",
        })
        logger.warning("Task %s stopped and requested human help", task_id)
