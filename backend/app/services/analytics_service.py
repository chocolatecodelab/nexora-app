"""
Nexora AI — Analytics & Evaluation Service (PRD Phase 12 & Section 10.2)
Calculates real quantitative metrics, benchmark comparisons, and token economics.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from app.models.schemas import (
    EvaluationMetricItem,
    EvaluationMetricsResponse,
    TaskPerformanceRecord,
)
from app.services import supabase_client

logger = logging.getLogger("nexora.analytics")

# Blended token cost per 1M tokens (Gemini Flash baseline)
COST_PER_MILLION_TOKENS_USD = 0.15


def _format_duration(seconds: int) -> str:
    if seconds <= 0:
        return "0s"
    if seconds < 60:
        return f"{seconds}s"
    mins = seconds // 60
    secs = seconds % 60
    if secs > 0:
        return f"{mins}m {secs}s"
    return f"{mins}m"


def compute_evaluation_metrics(project_id: Optional[str] = None) -> EvaluationMetricsResponse:
    """
    Compute real-time quantitative verification metrics across tasks and agent runs.
    Zero-division safe and supports repository-level filtering.
    """
    all_projects = supabase_client.list_projects()
    project_map = {p["id"]: p for p in all_projects}

    tasks = supabase_client.list_tasks(project_id=project_id)
    total_tasks = len(tasks)

    # 1. Status & Risk breakdown
    status_distribution: dict[str, int] = {
        "queued": 0,
        "planning": 0,
        "awaiting_approval": 0,
        "implementing": 0,
        "testing": 0,
        "debugging": 0,
        "pr_created": 0,
        "failed": 0,
        "cancelled": 0,
        "needs_human_help": 0,
    }
    risk_distribution: dict[str, int] = {
        "low": 0,
        "medium": 0,
        "high": 0,
    }

    completed_tasks = 0
    active_tasks = 0
    failed_tasks = 0
    total_tokens = 0
    total_duration_sec = 0
    tasks_with_duration = 0
    total_iterations = 0
    tasks_with_iterations = 0
    tasks_pr_created = 0

    recent_records: list[TaskPerformanceRecord] = []

    for t in tasks:
        status = t.get("status", "queued")
        if status in status_distribution:
            status_distribution[status] += 1
        else:
            status_distribution[status] = status_distribution.get(status, 0) + 1

        if status in ("pr_created", "completed"):
            completed_tasks += 1
            tasks_pr_created += 1
        elif status in ("failed", "cancelled"):
            failed_tasks += 1
        else:
            active_tasks += 1

        # Risk breakdown from plan_json
        plan = t.get("plan_json") or {}
        risk = (plan.get("risk") or "low").lower()
        if risk in risk_distribution:
            risk_distribution[risk] += 1
        else:
            risk_distribution["low"] += 1

        # Iterations
        it_count = t.get("iteration_count", 0) or 0
        total_iterations += it_count
        if it_count > 0:
            tasks_with_iterations += 1

        # Duration
        created_at_str = t.get("created_at")
        updated_at_str = t.get("updated_at")
        dur_sec = 0
        if created_at_str and updated_at_str:
            try:
                c_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                u_dt = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
                diff = int((u_dt - c_dt).total_seconds())
                if diff > 0:
                    dur_sec = diff
                    total_duration_sec += diff
                    tasks_with_duration += 1
            except Exception:
                pass

        # Agent runs token usage & rejection tracking for this task
        task_id = t["id"]
        task_tokens = 0
        rejections = 0
        try:
            runs = supabase_client.list_agent_runs(task_id)
            for r in runs:
                tu = r.get("token_usage") or {}
                task_tokens += tu.get("total", 0) or tu.get("total_tokens", 0) or 0

            approvals = supabase_client.list_approvals(task_id)
            for a in approvals:
                if a.get("decision") == "rejected":
                    rejections += 1
        except Exception as exc:
            logger.debug("Error aggregating runs for task %s: %s", task_id, exc)

        total_tokens += task_tokens

        # Security status
        sec_report = t.get("security_report") or {}
        sec_passed = sec_report.get("passed", True)

        proj = project_map.get(t.get("project_id", ""), {})
        proj_name = proj.get("name", "Unknown Repository")
        repo_full_name = proj.get("repository_full_name", "nexora-ai/repo")

        recent_records.append(
            TaskPerformanceRecord(
                task_id=task_id,
                issue_number=t.get("issue_number", 0),
                issue_title=t.get("issue_title", "Untitled Task"),
                project_name=proj_name,
                repository_full_name=repo_full_name,
                status=status,
                risk=risk,
                duration_seconds=dur_sec,
                duration_formatted=_format_duration(dur_sec),
                debug_iterations=it_count,
                token_usage_total=task_tokens,
                estimated_cost_usd=round((task_tokens / 1_000_000) * COST_PER_MILLION_TOKENS_USD, 4),
                security_passed=sec_passed,
                plan_rejected_count=rejections,
                created_at=created_at_str or datetime.utcnow().isoformat(),
                pr_url=t.get("pr_url"),
            )
        )

    # 2. Compute PRD Metrik Benchmarks (PRD Section 10.2)
    # Plan Acceptance Rate (Target >70%)
    plan_acceptance_pct = 100.0
    if total_tasks > 0:
        total_rejections = sum(r.plan_rejected_count for r in recent_records)
        total_plans = total_tasks + total_rejections
        plan_acceptance_pct = max(0.0, round(((total_plans - total_rejections) / total_plans) * 100.0, 1))

    # Test Pass Rate (Target >70%)
    finished_count = completed_tasks + failed_tasks
    test_pass_pct = 100.0 if total_tasks == 0 else round((completed_tasks / max(1, finished_count)) * 100.0, 1)

    # PR Creation / Acceptance Rate (Target >60%)
    pr_rate_pct = 100.0 if total_tasks == 0 else round((tasks_pr_created / max(1, total_tasks)) * 100.0, 1)

    # Avg Debugging Iterations (Target <3)
    avg_iterations = 0.0 if total_tasks == 0 else round(total_iterations / max(1, total_tasks), 1)

    # Avg Completion Time (Target: Baseline)
    avg_sec = 0 if tasks_with_duration == 0 else int(total_duration_sec / tasks_with_duration)
    avg_time_str = _format_duration(avg_sec) if total_tasks > 0 else "0s"

    estimated_cost = round((total_tokens / 1_000_000) * COST_PER_MILLION_TOKENS_USD, 4)

    metrics_list: list[EvaluationMetricItem] = [
        EvaluationMetricItem(
            title="Plan acceptance rate",
            value=f"{plan_acceptance_pct}%",
            target="target >70%",
            is_positive=plan_acceptance_pct >= 70.0 or total_tasks == 0,
            description="Plans approved on first attempt without revision (PRD §10.2)",
            raw_value=plan_acceptance_pct,
        ),
        EvaluationMetricItem(
            title="Test pass rate",
            value=f"{test_pass_pct}%",
            target="target >70%",
            is_positive=test_pass_pct >= 70.0 or total_tasks == 0,
            description="Sandbox test suites passing within iteration limit (PRD §10.2)",
            raw_value=test_pass_pct,
        ),
        EvaluationMetricItem(
            title="PR acceptance rate",
            value=f"{pr_rate_pct}%",
            target="target >60%",
            is_positive=pr_rate_pct >= 60.0 or total_tasks == 0,
            description="Automated Pull Requests ready for human code review (PRD §10.2)",
            raw_value=pr_rate_pct,
        ),
        EvaluationMetricItem(
            title="Avg debugging iterations",
            value=f"{avg_iterations}",
            target="target <3",
            is_positive=avg_iterations < 3.0,
            description="Average fix-test loops needed per task run (PRD §10.2)",
            raw_value=avg_iterations,
        ),
        EvaluationMetricItem(
            title="Avg completion time",
            value=avg_time_str,
            target="baseline",
            is_positive=True,
            description="Average duration from issue trigger to PR creation (PRD §10.2)",
            raw_value=float(avg_sec),
        ),
    ]

    return EvaluationMetricsResponse(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        active_tasks=active_tasks,
        failed_tasks=failed_tasks,
        total_tokens_used=total_tokens,
        estimated_cost_usd=estimated_cost,
        metrics=metrics_list,
        status_distribution=status_distribution,
        risk_distribution=risk_distribution,
        recent_tasks=recent_records,
        window="All Time",
    )
