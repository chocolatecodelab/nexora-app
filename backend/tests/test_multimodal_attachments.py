"""
Nexora AI — QA Test Suite: Multimodal Attachments & Image Support
Tests image/document decoding, Part conversion, and task creation with multimodal attachments.
"""

import base64
from fastapi.testclient import TestClient
from main import app
from app.services import gemini_service, supabase_client

client = TestClient(app)


def test_prepare_multimodal_contents_with_image_and_doc():
    """Verify that images are converted to binary Part objects and docs are formatted in prompt."""
    prompt = "## Task\nFix UI button alignment"

    # 1. Mock 1x1 transparent PNG image
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    # 2. Mock log file
    log_content = "TypeError: Cannot read properties of undefined (reading 'token')\n  at verifyToken (auth.ts:42)"
    log_b64 = base64.b64encode(log_content.encode("utf-8")).decode("utf-8")

    attachments = [
        {
            "name": "screenshot_bug.png",
            "mime_type": "image/png",
            "size_bytes": 100,
            "data_base64": tiny_png_b64,
            "is_image": True,
        },
        {
            "name": "error_stack.log",
            "mime_type": "text/plain",
            "size_bytes": len(log_content),
            "data_base64": log_b64,
            "is_image": False,
        }
    ]

    contents = gemini_service._prepare_multimodal_contents(prompt, attachments)

    # First element should be text including prompt and log file
    assert len(contents) == 2  # [full_text, image_part]
    assert prompt in contents[0]
    assert "Attached Supplemental Reference File (error_stack.log)" in contents[0]
    assert "TypeError: Cannot read properties of undefined" in contents[0]

    # Second element should be Google GenAI Part object with image/png mime
    image_part = contents[1]
    assert hasattr(image_part, "inline_data") or hasattr(image_part, "text") or type(image_part).__name__ == "Part"


def test_task_creation_with_attachments():
    """Verify task creation endpoint accepts attachments payload."""
    projects = supabase_client.list_projects()
    if not projects:
        # Create a temp project
        proj = supabase_client.create_project({
            "name": "Multimodal Test Repo",
            "repository_full_name": "nexora-ai/multimodal-test",
            "git_provider": "github",
        })
        proj_id = proj["id"]
    else:
        proj_id = projects[0]["id"]

    task_payload = {
        "project_id": proj_id,
        "issue_number": 999,
        "issue_title": "Fix navbar alignment based on screenshot mockup",
        "issue_body": "Please make sure navbar matches the attached mockup exactly.",
        "target_files": ["frontend/components/Navbar.tsx"],
        "focus_hints": "Fix padding and flex alignment",
        "attachments": [
            {
                "name": "mockup.png",
                "mime_type": "image/png",
                "size_bytes": 100,
                "data_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "is_image": True,
            }
        ]
    }

    from unittest.mock import patch
    with patch("app.routers.tasks.run_agent_pipeline"):
        resp = client.post("/api/tasks/", json=task_payload)
        assert resp.status_code == 201
        created_task = resp.json()
        assert created_task["issue_number"] == 999
        assert created_task["status"] in ("queued", "analyzing_issue", "analyzing_repo", "planning", "awaiting_approval")

    # Clean up test task
    task_id = created_task["id"]
    client.post(f"/api/tasks/{task_id}/cancel")
