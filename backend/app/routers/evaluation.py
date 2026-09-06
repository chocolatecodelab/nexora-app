"""
Nexora AI — Evaluation & Analytics Router (PRD Phase 12 & Section 10.2)
Exposes quantitative metrics, benchmark scorecards, and token economics.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import EvaluationMetricsResponse, TaskPerformanceRecord
from app.services import analytics_service, supabase_client

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation & Analytics"])


@router.get("/metrics", response_model=EvaluationMetricsResponse)
async def get_evaluation_metrics(
    project_id: Optional[str] = Query(None, description="Optional filter by project ID")
):
    """
    Get aggregated quantitative evaluation metrics, benchmark comparison against PRD targets,
    status distribution, and recent task performance logs.
    """
    try:
        metrics = analytics_service.compute_evaluation_metrics(project_id=project_id)
        return metrics
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate evaluation metrics: {str(exc)}",
        )


@router.get("/tasks/{task_id}/metrics", response_model=TaskPerformanceRecord)
async def get_single_task_metrics(task_id: str):
    """
    Get quantitative performance and token metrics for a single task run.
    """
    task = supabase_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    metrics_response = analytics_service.compute_evaluation_metrics()
    for item in metrics_response.recent_tasks:
        if item.task_id == task_id:
            return item

    # Fallback if not found in list
    return TaskPerformanceRecord(
        task_id=task_id,
        issue_number=task.get("issue_number", 0),
        issue_title=task.get("issue_title", "Untitled Task"),
        project_name="Repository",
        repository_full_name="nexora-ai/repo",
        status=task.get("status", "queued"),
        created_at=task.get("created_at", ""),
    )
