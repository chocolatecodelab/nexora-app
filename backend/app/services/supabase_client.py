"""
Nexora AI — Supabase Client Service

Handles all database operations against the Supabase PostgreSQL backend.
When SUPABASE_URL is not configured, falls back to an in-memory store
so the API can still run locally during early development.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory fallback store (development only — no Supabase required)
# ---------------------------------------------------------------------------
_memory_store: dict[str, list[dict]] = {
    "projects": [],
    "tasks": [],
    "agent_runs": [],
    "tool_calls": [],
    "approvals": [],
    "task_comments": [],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Supabase client singleton
# ---------------------------------------------------------------------------
_supabase_client = None


def _get_supabase():
    """Lazy-initialise and return the Supabase client, or None if unconfigured."""
    global _supabase_client
    settings = get_settings()

    if not settings.supabase_url or not settings.effective_supabase_key:
        return None

    if _supabase_client is None:
        try:
            from supabase import create_client
            _supabase_client = create_client(
                settings.supabase_url,
                settings.effective_supabase_key,
            )
            logger.info("Supabase client initialised successfully.")
        except Exception as exc:
            logger.warning("Failed to initialise Supabase client: %s", exc)
            return None

    return _supabase_client


def is_connected() -> bool:
    """Check whether Supabase is reachable."""
    client = _get_supabase()
    if client is None:
        return False
    try:
        client.table("projects").select("id").limit(1).execute()
        return True
    except Exception:
        return False


# ============================================================
# Projects CRUD
# ============================================================

def create_project(data: dict) -> dict:
    client = _get_supabase()
    if client:
        repo_name = data.get("repository_full_name")
        if repo_name:
            existing = client.table("projects").select("*").eq("repository_full_name", repo_name).execute()
            if existing.data and len(existing.data) > 0:
                return existing.data[0]
        try:
            result = client.table("projects").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as exc:
            logger.warning("Insert project exception (checking for duplicate): %s", exc)
            if repo_name:
                existing = client.table("projects").select("*").eq("repository_full_name", repo_name).execute()
                if existing.data and len(existing.data) > 0:
                    return existing.data[0]
            raise

    # In-memory fallback
    repo_name = data.get("repository_full_name")
    for p in _memory_store["projects"]:
        if p.get("repository_full_name") == repo_name:
            return p

    record = {
        "id": str(uuid4()),
        **data,
        "default_branch": data.get("default_branch", "main"),
        "git_provider": data.get("git_provider", "github"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    _memory_store["projects"].append(record)
    return record


def list_projects() -> list[dict]:
    client = _get_supabase()
    if client:
        result = client.table("projects").select("*").order("created_at", desc=True).execute()
        return result.data or []
    return _memory_store["projects"]


def get_project(project_id: str) -> Optional[dict]:
    client = _get_supabase()
    if client:
        result = client.table("projects").select("*").eq("id", project_id).single().execute()
        return result.data
    for p in _memory_store["projects"]:
        if p["id"] == project_id:
            return p
    return None


def update_project(project_id: str, updates: dict) -> Optional[dict]:
    client = _get_supabase()
    if client:
        result = client.table("projects").update(updates).eq("id", project_id).execute()
        return result.data[0] if result.data else None

    for p in _memory_store["projects"]:
        if p["id"] == project_id:
            p.update(updates)
            p["updated_at"] = _now_iso()
            return p
    return None


# ============================================================
# Tasks CRUD
# ============================================================

def create_task(data: dict) -> dict:
    client = _get_supabase()
    if client:
        try:
            result = client.table("tasks").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as exc:
            logger.warning("Supabase create_task insert warning (%s), retrying with safe fallback", exc)
            task_id = data.get("id") or str(uuid4())
            _memory_task_extras[task_id] = {k: v for k, v in data.items() if k in ("target_files", "focus_hints", "code_changes", "security_report", "attachments")}
            base_data = {
                "id": task_id,
                "project_id": data.get("project_id"),
                "issue_number": data.get("issue_number"),
                "issue_title": data.get("issue_title"),
                "issue_body": data.get("issue_body"),
            }
            try:
                res = client.table("tasks").insert(base_data).execute()
                out = res.data[0] if res.data else base_data
                out.update(_memory_task_extras[task_id])
                return out
            except Exception as e2:
                logger.error("Failed to insert task to Supabase: %s", e2)

    record = {
        "id": str(uuid4()),
        **data,
        "status": "queued",
        "plan_json": None,
        "pr_url": None,
        "branch_name": None,
        "error_message": None,
        "iteration_count": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    _memory_store["tasks"].append(record)
    return record


_memory_task_extras: dict[str, dict] = {}


def get_task(task_id: str) -> Optional[dict]:
    client = _get_supabase()
    if client:
        result = client.table("tasks").select("*").eq("id", task_id).single().execute()
        data = result.data
        if data and task_id in _memory_task_extras:
            data.update(_memory_task_extras[task_id])
        return data
    for t in _memory_store["tasks"]:
        if t["id"] == task_id:
            return t
    return None


def list_tasks(project_id: Optional[str] = None) -> list[dict]:
    client = _get_supabase()
    if client:
        try:
            query = client.table("tasks").select("*").order("created_at", desc=True)
            if project_id:
                query = query.eq("project_id", project_id)
            result = query.execute()
            tasks = result.data or []
            for t in tasks:
                if t["id"] in _memory_task_extras:
                    t.update(_memory_task_extras[t["id"]])
            return tasks
        except Exception as exc:
            logger.warning("Supabase list_tasks query error: %s", exc)
            return []

    tasks = _memory_store["tasks"]
    if project_id:
        tasks = [t for t in tasks if t["project_id"] == project_id]
    return tasks


def update_task(task_id: str, updates: dict) -> Optional[dict]:
    # Track extra/new columns in memory cache
    _memory_task_extras.setdefault(task_id, {}).update(updates)

    client = _get_supabase()
    if client:
        try:
            result = client.table("tasks").update(updates).eq("id", task_id).execute()
            data = result.data[0] if result.data else {}
            data.update(_memory_task_extras.get(task_id, {}))
            return data
        except Exception as exc:
            # Handle unmigrated remote DB schema cache gracefully
            logger.warning("Supabase update_task schema error: %s. Retrying with safe subset.", exc)
            safe_updates = {k: v for k, v in updates.items() if k not in ("code_changes", "security_report")}
            try:
                result = client.table("tasks").update(safe_updates).eq("id", task_id).execute()
                data = result.data[0] if result.data else {}
                data.update(_memory_task_extras.get(task_id, {}))
                return data
            except Exception as retry_exc:
                logger.error("Supabase update_task fallback failed: %s", retry_exc)

    for t in _memory_store["tasks"]:
        if t["id"] == task_id:
            t.update(updates)
            t["updated_at"] = _now_iso()
            return t
    return None


def delete_task(task_id: str) -> bool:
    client = _get_supabase()
    if client:
        try:
            client.table("task_comments").delete().eq("task_id", task_id).execute()
            client.table("approvals").delete().eq("task_id", task_id).execute()
            client.table("agent_runs").delete().eq("task_id", task_id).execute()
            client.table("tasks").delete().eq("id", task_id).execute()
            _memory_task_extras.pop(task_id, None)
            return True
        except Exception as exc:
            logger.warning("Supabase delete_task error: %s", exc)
            return False
    _memory_store["tasks"] = [t for t in _memory_store["tasks"] if t["id"] != task_id]
    _memory_task_extras.pop(task_id, None)
    return True


# ============================================================
# Agent Runs CRUD
# ============================================================

def create_agent_run(data: dict) -> dict:
    client = _get_supabase()
    if client:
        result = client.table("agent_runs").insert(data).execute()
        return result.data[0] if result.data else data

    record = {
        "id": str(uuid4()),
        **data,
        "status": "running",
        "token_usage": None,
        "error_message": None,
        "started_at": _now_iso(),
        "completed_at": None,
    }
    _memory_store["agent_runs"].append(record)
    return record


def list_agent_runs(task_id: str) -> list[dict]:
    client = _get_supabase()
    if client:
        result = (
            client.table("agent_runs")
            .select("*")
            .eq("task_id", task_id)
            .order("started_at")
            .execute()
        )
        return result.data or []
    return [r for r in _memory_store["agent_runs"] if r["task_id"] == task_id]


def update_agent_run(run_id: str, updates: dict) -> Optional[dict]:
    client = _get_supabase()
    if client:
        result = client.table("agent_runs").update(updates).eq("id", run_id).execute()
        return result.data[0] if result.data else None

    for r in _memory_store["agent_runs"]:
        if r["id"] == run_id:
            r.update(updates)
            return r
    return None


# ============================================================
# Tool Calls CRUD
# ============================================================

def create_tool_call(data: dict) -> dict:
    client = _get_supabase()
    if client:
        result = client.table("tool_calls").insert(data).execute()
        return result.data[0] if result.data else data

    record = {
        "id": str(uuid4()),
        **data,
        "created_at": _now_iso(),
    }
    _memory_store["tool_calls"].append(record)
    return record


def list_tool_calls(agent_run_id: str) -> list[dict]:
    client = _get_supabase()
    if client:
        result = (
            client.table("tool_calls")
            .select("*")
            .eq("agent_run_id", agent_run_id)
            .order("created_at")
            .execute()
        )
        return result.data or []
    return [tc for tc in _memory_store["tool_calls"] if tc["agent_run_id"] == agent_run_id]


# ============================================================
# Approvals CRUD
# ============================================================

def create_approval(data: dict) -> dict:
    client = _get_supabase()
    if client:
        result = client.table("approvals").insert(data).execute()
        return result.data[0] if result.data else data

    record = {
        "id": str(uuid4()),
        **data,
        "created_at": _now_iso(),
    }
    _memory_store["approvals"].append(record)
    return record


def list_approvals(task_id: str) -> list[dict]:
    client = _get_supabase()
    if client:
        result = (
            client.table("approvals")
            .select("*")
            .eq("task_id", task_id)
            .order("created_at")
            .execute()
        )
        return result.data or []
    return [a for a in _memory_store["approvals"] if a["task_id"] == task_id]


# ============================================================
# Task Comments / Human Review CRUD
# ============================================================

def create_task_comment(data: dict) -> dict:
    """Create a new comment/review on a task."""
    client = _get_supabase()
    if client:
        try:
            result = client.table("task_comments").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as exc:
            logger.warning("Failed to insert task_comment to Supabase: %s", exc)
            # Fall through to in-memory

    record = {
        "id": str(uuid4()),
        **data,
        "created_at": _now_iso(),
    }
    _memory_store["task_comments"].append(record)
    return record


def list_task_comments(task_id: str) -> list[dict]:
    """List all comments for a task, ordered by creation time."""
    client = _get_supabase()
    if client:
        try:
            result = (
                client.table("task_comments")
                .select("*")
                .eq("task_id", task_id)
                .order("created_at")
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.warning("Failed to list task_comments from Supabase: %s", exc)

    return [c for c in _memory_store["task_comments"] if c["task_id"] == task_id]


def has_pending_intervention(task_id: str) -> Optional[dict]:
    """
    Check if there is a recent intervention comment that hasn't been addressed.
    Returns the intervention comment dict, or None.
    """
    comments = list_task_comments(task_id)
    for comment in reversed(comments):
        if comment.get("is_intervention"):
            return comment
    return None
