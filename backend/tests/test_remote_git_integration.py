import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app
from app.services import supabase_client, github_service, gitlab_service, git_provider

client = TestClient(app)


def test_create_project_issue_endpoint_github():
    """Verify POST /api/projects/{id}/issues creates an issue on GitHub."""
    proj = supabase_client.create_project({
        "name": "Issue Test Project",
        "repository_full_name": "owner/issue-repo",
        "git_provider": "github",
    })
    proj_id = proj["id"]

    try:
        with patch("app.services.github_service.create_issue", new_callable=AsyncMock) as mock_gh_issue:
            from app.models.schemas import GitHubIssue
            mock_gh_issue.return_value = GitHubIssue(
                number=42,
                title="Button misalignment on dashboard",
                body="Padding is too large on mobile screens.",
                state="open",
                labels=["nexora-ai", "bug"],
                url="https://github.com/owner/issue-repo/issues/42",
            )

            resp = client.post(
                f"/api/projects/{proj_id}/issues",
                json={
                    "title": "Button misalignment on dashboard",
                    "body": "Padding is too large on mobile screens.",
                    "labels": ["nexora-ai", "bug"],
                },
            )

            assert resp.status_code == 201
            data = resp.json()
            assert data["number"] == 42
            assert data["title"] == "Button misalignment on dashboard"
            assert data["url"] == "https://github.com/owner/issue-repo/issues/42"
            mock_gh_issue.assert_called_once()
    finally:
        c = supabase_client._get_supabase()
        if c:
            c.table("projects").delete().eq("id", proj_id).execute()


def test_create_project_issue_endpoint_gitlab():
    """Verify POST /api/projects/{id}/issues creates an issue on GitLab."""
    proj = supabase_client.create_project({
        "name": "GitLab Issue Test",
        "repository_full_name": "group/gitlab-issue-repo",
        "git_provider": "gitlab",
    })
    proj_id = proj["id"]

    try:
        with patch("app.services.gitlab_service.create_issue", new_callable=AsyncMock) as mock_gl_issue:
            from app.models.schemas import GitHubIssue
            mock_gl_issue.return_value = GitHubIssue(
                number=88,
                title="Add GitLab CI runner",
                body="Setup auto runner on merge.",
                state="open",
                labels=["nexora-ai", "ci"],
                url="https://gitlab.com/group/gitlab-issue-repo/-/issues/88",
            )

            resp = client.post(
                f"/api/projects/{proj_id}/issues",
                json={
                    "title": "Add GitLab CI runner",
                    "body": "Setup auto runner on merge.",
                    "labels": ["nexora-ai", "ci"],
                },
            )

            assert resp.status_code == 201
            data = resp.json()
            assert data["number"] == 88
            assert data["title"] == "Add GitLab CI runner"
            assert "gitlab.com" in data["url"]
            mock_gl_issue.assert_called_once()
    finally:
        c = supabase_client._get_supabase()
        if c:
            c.table("projects").delete().eq("id", proj_id).execute()


@pytest.mark.anyio
async def test_commit_and_push_changes_simulation():
    """Verify atomic commit_and_push_changes handles file list and fallback."""
    code_changes = {
        "modified_files": [{"path": "src/App.tsx", "content": "export const App = () => <div>Hello</div>;"}],
        "created_files": [{"path": "src/Button.tsx", "content": "export const Button = () => <button>Click</button>;"}],
    }

    # GitHub sandbox
    gh_res = await github_service.commit_and_push_changes("nexora-ai/sandbox-repo", "nexora/issue-1", code_changes)
    assert "files_count" in gh_res
    assert gh_res["files_count"] == 2

    # GitLab sandbox
    gl_res = await gitlab_service.commit_and_push_changes("nexora-ai/gitlab-sandbox", "nexora/issue-1", code_changes)
    assert "files_count" in gl_res
    assert gl_res["files_count"] == 2


def test_merge_task_pr_endpoint():
    """Verify POST /api/tasks/{task_id}/merge-pr calls merge_pr_or_mr and updates status."""
    proj = supabase_client.create_project({
        "name": "Merge Test Project",
        "repository_full_name": "owner/merge-repo",
        "git_provider": "github",
        "default_branch": "main",
    })
    proj_id = proj["id"]

    task = supabase_client.create_task({
        "project_id": proj_id,
        "issue_number": 5,
        "issue_title": "Fix navbar alignment",
        "status": "pr_created",
        "pr_url": "https://github.com/owner/merge-repo/pull/5",
        "branch_name": "nexora/issue-5",
    })
    task_id = task["id"]

    try:
        with patch("app.services.git_provider.merge_pr_or_mr", new_callable=AsyncMock) as mock_merge:
            mock_merge.return_value = {
                "merged": True,
                "message": "Pull Request successfully merged",
                "sha": "abc123merge",
            }

            resp = client.post(f"/api/tasks/{task_id}/merge-pr")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "merged"
            assert data["sha"] == "abc123merge"

            # Check DB updated
            updated_task = supabase_client.get_task(task_id)
            assert updated_task["status"] == "merged"
    finally:
        c = supabase_client._get_supabase()
        if c:
            c.table("tasks").delete().eq("id", task_id).execute()
            c.table("projects").delete().eq("id", proj_id).execute()
