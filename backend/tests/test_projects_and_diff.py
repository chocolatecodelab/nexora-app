import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from app.services import supabase_client

client = TestClient(app)


def test_projects_crud_and_configuration():
    # 1. Create project with unique name
    unique_suffix = uuid.uuid4().hex[:6]
    proj_payload = {
        "name": f"QA Test Project {unique_suffix}",
        "repository_full_name": f"nexora-ai/qa-repo-{unique_suffix}",
        "default_branch": "main",
        "git_provider": "github",
        "branch_prefix": "qa/task-",
        "custom_test_command": "npm test -- --coverage",
        "max_debug_iterations": 4,
    }
    create_resp = client.post("/api/projects", json=proj_payload)
    assert create_resp.status_code == 201
    proj_data = create_resp.json()
    proj_id = proj_data["id"]

    try:
        assert proj_data["branch_prefix"] == "qa/task-"
        assert proj_data["max_debug_iterations"] == 4

        # 2. List projects
        list_resp = client.get("/api/projects")
        assert list_resp.status_code == 200
        projects = list_resp.json()
        assert any(p["id"] == proj_id for p in projects)

        # 3. Patch project configuration
        patch_resp = client.patch(
            f"/api/projects/{proj_id}",
            json={
                "branch_prefix": "feat/nexora-",
                "custom_test_command": "pytest -v",
                "max_debug_iterations": 5,
            },
        )
        assert patch_resp.status_code == 200
        updated = patch_resp.json()
        assert updated["branch_prefix"] == "feat/nexora-"
        assert updated["custom_test_command"] == "pytest -v"
        assert updated["max_debug_iterations"] == 5

        # 4. List commits for project
        commits_resp = client.get(f"/api/projects/{proj_id}/commits")
        assert commits_resp.status_code == 200
        commits = commits_resp.json()
        assert isinstance(commits, list)
        if commits:
            assert "sha" in commits[0]
            assert "parents" in commits[0]
    finally:
        # Automated Teardown
        c = supabase_client._get_supabase()
        if c:
            c.table("projects").delete().eq("id", proj_id).execute()


def test_tasks_lifecycle_diff_and_security():
    # 1. Create a project first
    unique_suffix = uuid.uuid4().hex[:6]
    proj = client.post(
        "/api/projects",
        json={
            "name": f"Diff Test Project {unique_suffix}",
            "repository_full_name": f"nexora-ai/diff-repo-{unique_suffix}",
        },
    ).json()
    proj_id = proj["id"]

    try:
        # 2. Create a task with background pipeline mocked
        with patch("app.routers.tasks.run_agent_pipeline") as mock_pipeline:
            task_resp = client.post(
                "/api/tasks",
                json={
                    "project_id": proj["id"],
                    "issue_number": 42,
                    "issue_title": "Fix user auth token expiration",
                    "issue_body": "Token should expire after 24 hours.",
                    "target_files": ["src/auth.ts"],
                },
            )
        assert task_resp.status_code == 201
        task = task_resp.json()
        task_id = task["id"]
        assert task["status"] == "queued"
        assert task["target_files"] == ["src/auth.ts"]

        # 3. Inject mock plan and code_changes into task to test Diff & Security
        supabase_client.update_task(
            task_id,
            {
                "status": "pr_created",
                "plan_json": {
                    "summary": "Update token TTL",
                    "risk": "low",
                    "files_to_modify": ["src/auth.ts"],
                    "files_to_create": ["src/auth.test.ts"],
                    "steps": ["Step 1", "Step 2"],
                },
                "code_changes": {
                    "modified_files": [
                        {
                            "path": "src/auth.ts",
                            "content": "export const TOKEN_EXPIRY = 86400;\nexport function verify() { return true; }\n",
                        }
                    ],
                    "created_files": [
                        {
                            "path": "src/auth.test.ts",
                            "content": "import { verify } from './auth';\ntest('verify', () => expect(verify()).toBe(true));\n",
                        }
                    ],
                },
            },
        )

        # 4. Test GET /api/tasks/{task_id}/diff with mocked git_provider read_file
        from unittest.mock import AsyncMock
        with patch("app.services.git_provider.read_file", new_callable=AsyncMock) as mock_read:
            mock_read.return_value = "export const TOKEN_EXPIRY = 3600;\nexport function verify() { return false; }\n"
            diff_resp = client.get(f"/api/tasks/{task_id}/diff")
            assert diff_resp.status_code == 200
            diff_data = diff_resp.json()
            assert diff_data["task_id"] == task_id
            assert diff_data["total_files"] == 2
            assert diff_data["total_additions"] > 0
            assert len(diff_data["files"]) == 2

        # 5. Test GET /api/tasks/{task_id}/security
        sec_resp = client.get(f"/api/tasks/{task_id}/security")
        assert sec_resp.status_code == 200
        sec_data = sec_resp.json()
        assert sec_data["passed"] is True
        assert sec_data["critical_count"] == 0
        assert sec_data["scanned_files_count"] == 2

        # 6. Test Review Comments & Intervention
        comment_resp = client.post(
            f"/api/tasks/{task_id}/comments",
            json={
                "comment_text": "Please make sure refresh tokens are also covered.",
                "is_intervention": True,
            },
        )
        assert comment_resp.status_code == 201
        c_data = comment_resp.json()
        assert c_data["is_intervention"] is True

        comments_list = client.get(f"/api/tasks/{task_id}/comments").json()
        assert len(comments_list) >= 1

        # 6.5 Test Aggregated Task Details (QA-PERF-001)
        full_resp = client.get(f"/api/tasks/{task_id}/full")
        assert full_resp.status_code == 200
        full_data = full_resp.json()
        assert "task" in full_data
        assert full_data["task"]["id"] == task_id
        assert "runs" in full_data
        assert "tool_calls" in full_data
        assert "comments" in full_data
        assert len(full_data["comments"]) >= 1

        # 7. Test Close PR & Revert endpoints with mocked git_provider
        with patch("app.services.git_provider.close_pr_or_mr", new_callable=AsyncMock) as mock_close:
            mock_close.return_value = True
            close_resp = client.post(f"/api/tasks/{task_id}/close-pr")
            assert close_resp.status_code == 200

        with patch("app.services.git_provider.create_revert_pr", new_callable=AsyncMock) as mock_revert:
            mock_revert.return_value = {"url": "https://github.com/owner/repo/pull/99", "type": "PR"}
            revert_resp = client.post(f"/api/tasks/{task_id}/revert")
            assert revert_resp.status_code == 200

        # 8. Test Cascading Clear Task History (QA-FUNC-003)
        clear_resp = client.delete(f"/api/tasks?project_id={proj_id}")
        assert clear_resp.status_code == 200
        assert "deleted_count" in clear_resp.json()
    finally:
        # Automated Teardown
        c = supabase_client._get_supabase()
        if c:
            c.table("projects").delete().eq("id", proj_id).execute()
