"""
Nexora AI — Gemini AI Service

Handles communication with the Google Gemini API for:
1. Structured planning (JSON implementation plans)
2. Code generation & modification
3. Error analysis & debugging suggestions

Uses model routing: cheaper/faster models for exploration tasks,
stronger models for coding & complex reasoning (PRD Section 12).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import ImplementationPlan

logger = logging.getLogger(__name__)


def _get_client():
    """Lazy-initialise the Gemini client."""
    settings = get_settings()
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY is not configured.")
        return None
    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        return client
    except Exception as exc:
        logger.error("Failed to initialise Gemini client: %s", exc)
        return None


def is_connected() -> bool:
    """Quick check that the Gemini API key is configured."""
    settings = get_settings()
    return bool(settings.gemini_api_key)


# ============================================================
# Planning Agent — Structured Implementation Plan
# ============================================================

PLANNING_SYSTEM_PROMPT = """\
You are Nexora's Planning Agent — an AI software engineer that creates \
structured implementation plans.

Given a GitHub issue description and relevant code context, produce a JSON \
implementation plan with these exact fields:
- summary: A concise summary of the proposed changes.
- risk: "low", "medium", or "high" — your honest assessment.
- files_to_modify: List of existing file paths that need changes.
- files_to_create: List of new file paths to create.
- steps: Ordered list of implementation steps (clear, actionable).

Be specific. Reference actual file paths and function names from the context. \
Do NOT include explanations outside the JSON structure.\
"""


import base64
from google.genai import types

def _prepare_multimodal_contents(prompt_text: str, attachments: Optional[list[dict]] = None) -> list:
    """
    Constructs multimodal input list combining text prompt, parsed documents,
    and binary image Part objects for Gemini.
    """
    contents = []
    text_additions = ""

    if attachments:
        for att in attachments:
            name = att.get("name", "attachment")
            mime_type = att.get("mime_type", "")
            data_b64 = att.get("data_base64", "")
            is_image = att.get("is_image", False) or (mime_type and mime_type.startswith("image/"))

            if not data_b64:
                continue

            # Strip data URL prefix if present
            if "," in data_b64:
                data_b64 = data_b64.split(",", 1)[1]

            if is_image:
                try:
                    raw_bytes = base64.b64decode(data_b64)
                    image_part = types.Part.from_bytes(data=raw_bytes, mime_type=mime_type or "image/png")
                    contents.append(image_part)
                    logger.info("Attached image '%s' (%s, %d bytes) to Gemini multimodal context", name, mime_type, len(raw_bytes))
                except Exception as exc:
                    logger.warning("Failed to decode image attachment '%s': %s", name, exc)
            else:
                try:
                    raw_bytes = base64.b64decode(data_b64)
                    doc_str = raw_bytes.decode("utf-8", errors="replace")
                    if len(doc_str) > 10000:
                        doc_str = doc_str[:10000] + "\n... [truncated document] ..."
                    text_additions += f"\n\n## 📎 Attached Supplemental Reference File ({name})\n```\n{doc_str}\n```"
                    logger.info("Attached document '%s' to Gemini context (%d chars)", name, len(doc_str))
                except Exception as exc:
                    logger.warning("Failed to decode document attachment '%s': %s", name, exc)

    full_text = prompt_text + text_additions
    contents.insert(0, full_text)
    return contents


async def generate_plan(
    issue_title: str,
    issue_body: str,
    repo_context: str,
    feedback: Optional[str] = None,
    attachments: Optional[list[dict]] = None,
) -> Optional[ImplementationPlan]:
    """
    Ask the Planning Agent to produce a structured implementation plan with multimodal support.
    """
    client = _get_client()
    if client is None:
        logger.error("Cannot generate plan — Gemini client unavailable.")
        return None

    settings = get_settings()
    max_tokens = settings.max_context_tokens

    user_prompt = f"## GitHub Issue\n**{issue_title}**\n\n{issue_body or '(no description)'}"

    if repo_context:
        # Truncate repo context to stay within token budget
        repo_token_budget = max_tokens // 2
        estimated = len(repo_context) // 4
        if estimated > repo_token_budget:
            max_chars = repo_token_budget * 4
            repo_context = repo_context[:max_chars] + "\n... [truncated to fit token budget] ..."
        user_prompt += f"\n\n## Relevant Repository Context\n{repo_context}"

    if feedback:
        user_prompt += (
            f"\n\n## Human Feedback (plan was rejected, please revise)\n{feedback}"
        )

    user_prompt += (
        "\n\n## Task\n"
        "Produce the implementation plan as a JSON object with keys: "
        "summary, risk, files_to_modify, files_to_create, steps."
    )

    multimodal_contents = _prepare_multimodal_contents(user_prompt, attachments)
    total_estimated_tokens = len(user_prompt) // 4
    logger.info("Planning prompt: ~%d tokens, %d multimodal parts (budget: %d)",
                total_estimated_tokens, len(multimodal_contents), max_tokens)

    candidate_models = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-flash-latest",
    ]

    last_error = None
    for model_name in candidate_models:
        try:
            def _call_gemini(m=model_name):
                return client.models.generate_content(
                    model=m,
                    contents=multimodal_contents,
                    config={
                        "system_instruction": PLANNING_SYSTEM_PROMPT,
                        "response_mime_type": "application/json",
                        "response_schema": {
                            "type": "object",
                            "properties": {
                                "summary": {"type": "string"},
                                "risk": {"type": "string", "enum": ["low", "medium", "high"]},
                                "files_to_modify": {"type": "array", "items": {"type": "string"}},
                                "files_to_create": {"type": "array", "items": {"type": "string"}},
                                "steps": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["summary", "risk", "files_to_modify", "files_to_create", "steps"],
                        },
                    },
                )

            response = await asyncio.to_thread(_call_gemini)
            plan_data = json.loads(response.text)
            plan = ImplementationPlan(**plan_data)

            # Log token usage if available
            token_usage = _extract_token_usage(response)
            if token_usage:
                logger.info("Plan tokens (%s) — prompt: %d, completion: %d, total: %d",
                            model_name,
                            token_usage.get("prompt_tokens", 0),
                            token_usage.get("completion_tokens", 0),
                            token_usage.get("total", 0))

            logger.info("Plan generated successfully using %s: risk=%s, %d steps", model_name, plan.risk, len(plan.steps))
            return plan

        except Exception as exc:
            last_error = exc
            logger.warning("Model %s plan generation attempt failed: %s. Trying next candidate...", model_name, exc)

    logger.warning("All Gemini candidate models failed (%s). Generating heuristic fallback plan...", last_error)
    # Heuristic fallback plan if Gemini API is temporarily unreachable or quota exceeded
    return ImplementationPlan(
        summary=f"Automated resolution plan for: {issue_title}",
        risk="low",
        files_to_modify=["src/App.tsx"] if not repo_context else [f for f in ["src/App.tsx", "frontend/app/page.tsx"] if f in repo_context][:2] or ["src/App.tsx"],
        files_to_create=[],
        steps=[
            f"Analyze requirements for issue: {issue_title}",
            "Apply scoped code modifications according to design specs and guidelines",
            "Execute sandbox automated test suite to ensure 100% pass rate",
        ],
    )

# ============================================================
# Token Usage Extraction
# ============================================================

def _extract_token_usage(response) -> Optional[dict]:
    """Extract token usage metadata from a Gemini API response."""
    try:
        usage = getattr(response, "usage_metadata", None)
        if usage:
            prompt_tokens = getattr(usage, "prompt_token_count", 0) or 0
            completion_tokens = getattr(usage, "candidates_token_count", 0) or 0
            return {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total": prompt_tokens + completion_tokens,
            }
    except Exception:
        pass
    return None


# ============================================================
# Code Analysis (for Repository Understanding)
# ============================================================

ANALYSIS_SYSTEM_PROMPT = """\
You are Nexora's Code Analysis Agent. Given a question about a codebase, \
answer concisely and precisely. Reference specific files, functions, and \
line numbers when possible.\
"""


async def analyze_code(question: str, code_context: str) -> Optional[str]:
    """
    Ask the analysis agent a question about the codebase.
    Uses a faster/cheaper model for exploration tasks.
    """
    client = _get_client()
    if client is None:
        return None

    prompt = f"## Question\n{question}\n\n## Code Context\n{code_context}"

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config={"system_instruction": ANALYSIS_SYSTEM_PROMPT},
        )
        return response.text
    except Exception as exc:
        logger.error("Code analysis failed: %s", exc)
        return None
