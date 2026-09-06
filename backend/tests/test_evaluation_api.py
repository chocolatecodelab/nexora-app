"""
Nexora AI — QA Test Suite: Evaluation Metrics & Quantitative Analytics Router
Tests PRD Phase 12 & Section 10.2 metrics calculations and zero-division resilience.
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_evaluation_metrics_empty_safe():
    """Verify metrics calculation when no tasks or projects exist."""
    resp = client.get("/api/evaluation/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tasks" in data
    assert "metrics" in data
    assert "status_distribution" in data
    assert "risk_distribution" in data
    assert "recent_tasks" in data
    assert len(data["metrics"]) == 5

    # Check that all 5 PRD metrics are present
    metric_titles = [m["title"] for m in data["metrics"]]
    assert "Plan acceptance rate" in metric_titles
    assert "Test pass rate" in metric_titles
    assert "PR acceptance rate" in metric_titles
    assert "Avg debugging iterations" in metric_titles
    assert "Avg completion time" in metric_titles


def test_evaluation_metrics_with_project_filter():
    """Verify metrics filtering with a project_id query parameter."""
    resp = client.get("/api/evaluation/metrics?project_id=non-existent-proj-id")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tasks"] == 0
    assert len(data["recent_tasks"]) == 0
