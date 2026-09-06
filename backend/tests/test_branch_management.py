"""
Nexora AI — QA Test Suite: Git Branch Management & Remote Branch Creation
"""

from fastapi.testclient import TestClient
from main import app
from app.services import supabase_client, github_service, gitlab_service

client = TestClient(app)


def test_list_and_create_branches_api():
    """Verify listing branches and creating a new branch via REST API."""
    projects = supabase_client.list_projects()
    if not projects:
        proj = supabase_client.create_project({
            "name": "Branch Test Repo",
            "repository_full_name": "nexora-ai/branch-test",
            "git_provider": "github",
        })
        proj_id = proj["id"]
    else:
        proj_id = projects[0]["id"]

    # 1. Test GET /api/projects/{id}/branches
    resp = client.get(f"/api/projects/{proj_id}/branches")
    assert resp.status_code == 200
    branches = resp.json()
    assert isinstance(branches, list)
    assert len(branches) > 0

    # 2. Test POST /api/projects/{id}/branches
    create_resp = client.post(
        f"/api/projects/{proj_id}/branches",
        json={"branch_name": "dev", "base_branch": "main"}
    )
    assert create_resp.status_code == 201
    res_data = create_resp.json()
    assert res_data["status"] == "ok"
    assert res_data["branch"] == "dev"


def test_github_create_branch_fallback():
    """Verify github_service.create_branch fallback handles custom/missing base ref safely."""
    import asyncio
    loop = asyncio.get_event_loop()

    # Should safely return True or create from main/master
    result = loop.run_until_complete(
        github_service.create_branch(
            repo_full_name="nexora-ai/test-repo",
            branch_name="nexora/issue-999",
            ref="nonexistent-branch-name"
        )
    )
    assert result is True
