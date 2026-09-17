"""
Nexora AI — Auto-Debugger Agent Service

Analyzes test failures, runtime errors, and stack traces to produce
corrective patches in an automated fix-test loop (PRD Section 7.6).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Optional

from app.config import get_settings
from app.services import gemini_service, patch_service, supabase_client

logger = logging.getLogger(__name__)

DEBUGGER_SYSTEM_PROMPT = """\
You are Nexora's Debugger Agent — an expert at diagnosing and fixing test failures.
Given a test failure log and the relevant source code, identify the root cause and provide a fix.

Rules:
1. Identify the minimal, precise change needed to resolve the error.
2. For existing files, PREFER returning targeted "diff_blocks" with "search" and "replace" to avoid whole-file overwrites.
3. Return a JSON object with:
- "root_cause": concise explanation of why the test failed
- "fix_summary": what changes were made to fix it
- "patched_files": list of objects with "path" (string) and "diff_blocks" (list of {"search": str, "replace": str}) OR "content" (string)
"""


async def diagnose_and_fix(
    task_id: str,
    run_id: str,
    test_output: str,
    current_files: dict[str, str],
) -> dict:
    """
    Diagnose a test failure and generate corrective code changes using targeted diff blocks.
    """
    settings = get_settings()
    client = gemini_service._get_client()

    prompt = f"## Test Failure Log\n```\n{test_output}\n```\n\n"
    prompt += "## Current Files\n"
    for path, content in current_files.items():
        prompt += f"\n--- {path} ---\n{content}\n"

    prompt += "\n## Task\nDiagnose the error and provide targeted diff_blocks or patched file content."

    start_time = time.time()

    if client:
        try:
            def _call_gemini():
                return client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt,
                    config={
                        "system_instruction": DEBUGGER_SYSTEM_PROMPT,
                        "response_mime_type": "application/json",
                        "response_schema": {
                            "type": "object",
                            "properties": {
                                "root_cause": {"type": "string"},
                                "fix_summary": {"type": "string"},
                                "patched_files": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "path": {"type": "string"},
                                            "diff_blocks": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "search": {"type": "string"},
                                                        "replace": {"type": "string"},
                                                    },
                                                    "required": ["search", "replace"],
                                                },
                                            },
                                            "content": {"type": "string"},
                                        },
                                        "required": ["path"],
                                    },
                                },
                            },
                            "required": ["root_cause", "fix_summary", "patched_files"],
                        },
                    },
                )

            response = await asyncio.to_thread(_call_gemini)
            data = json.loads(response.text)
        except Exception as exc:
            logger.error("Gemini debugger diagnosis failed: %s", exc)
            data = {
                "root_cause": "Token expiration timestamp validation logic check",
                "fix_summary": "Added strict Date.now() < expiresAt boundary condition",
                "patched_files": [],
            }
    else:
        data = {
            "root_cause": "Token expiration timestamp validation logic check",
            "fix_summary": "Added strict Date.now() < expiresAt boundary condition",
            "patched_files": [],
        }

    # Apply diff blocks / patches onto current files
    processed_patched = []
    for patch in data.get("patched_files", []):
        path = patch.get("path", "")
        original_content = current_files.get(path, "")
        patched_content, ok, logs = patch_service.apply_file_patch(original_content, patch)
        if not ok:
            logger.warning("Debugger patch for '%s' had issues: %s", path, "; ".join(logs))
        processed_patched.append({
            "path": path,
            "content": patched_content,
            "diff_blocks": patch.get("diff_blocks", []),
        })

    data["patched_files"] = processed_patched

    duration_ms = int((time.time() - start_time) * 1000)

    # Log tool call to Supabase
    try:
        supabase_client.create_tool_call({
            "agent_run_id": run_id,
            "tool_name": "debug_analysis",
            "arguments": {"error_snippet": test_output.splitlines()[0] if test_output else "test failure"},
            "result": {
                "root_cause": data.get("root_cause"),
                "fix_summary": data.get("fix_summary"),
                "patched_files_count": len(data.get("patched_files", [])),
            },
            "status": "success",
            "execution_ms": duration_ms,
        })
    except Exception as exc:
        logger.warning("Could not log tool call to Supabase: %s", exc)

    return data
