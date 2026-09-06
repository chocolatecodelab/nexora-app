"""
Nexora AI — GitLab Service

Handles all interactions with the GitLab REST API (v4):
- Listing GitLab projects/repositories
- Fetching GitLab issues
- Reading repository file tree and raw files
- Creating branches, committing file modifications/creations
- Opening Merge Requests (MR)
- Polling GitLab CI/CD Pipeline status

Supports both GitLab SaaS (gitlab.com) and Self-Hosted GitLab instances.
"""

from __future__ import annotations

import logging
import urllib.parse
from typing import Optional

import httpx

from app.config import get_settings
from app.models.schemas import GitHubIssue, GitHubRepo

logger = logging.getLogger(__name__)

# Playground mock files for offline development with GitLab
PLAYGROUND_FILES = {
    "package.json": '{\n  "name": "nexora-gitlab-project",\n  "version": "1.0.0",\n  ".gitlab-ci.yml": "enabled"\n}',
    "src/models/user.ts": "export interface User {\n  id: string;\n  email: string;\n  name: string;\n  createdAt: Date;\n}",
    "src/auth/register.ts": "import { User } from '../models/user';\n\nexport async function registerUser(email: string, pass: string): Promise<User> {\n  return { id: 'u_123', email, name: 'User', createdAt: new Date() };\n}",
    "src/email/service.ts": "export async function sendEmail(to: string, subject: string, body: string) {\n  console.log(`[GitLab CI] Sending email to ${to}: ${subject}`);\n}",
    ".gitlab-ci.yml": "stages:\n  - test\n  - build\n\nunit_tests:\n  stage: test\n  image: node:20\n  script:\n    - npm install\n    - npm test\n",
}


def _get_api_url() -> str:
    """Get the GitLab API v4 root URL from settings or runtime auth."""
    from app.routers import auth
    base = auth.get_active_gitlab_url()
    return f"{base}/api/v4"


def _headers() -> dict:
    """Build auth headers for GitLab API requests."""
    from app.routers import auth
    token = auth.get_active_gitlab_token()
    headers = {
        "Accept": "application/json",
        "User-Agent": "Nexora-AI-Agent/1.0",
    }
    if token:
        headers["PRIVATE-TOKEN"] = token
    return headers


def is_connected() -> bool:
    """Check whether GitLab token is configured and valid."""
    from app.routers import auth
    token = auth.get_active_gitlab_token()
    if not token:
        return False
    try:
        api_url = _get_api_url()
        resp = httpx.get(f"{api_url}/user", headers=_headers(), timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


import urllib.parse

def _encode_project_path(project_path_or_id: str) -> str:
    """GitLab requires URL-encoded project paths in API endpoints (e.g. group/project -> group%2Fproject)."""
    return urllib.parse.quote(str(project_path_or_id), safe="")


# ============================================================
# Projects / Repositories
# ============================================================

async def list_projects() -> list[GitHubRepo]:
    """List projects accessible to the authenticated user on GitLab."""
    settings = get_settings()
    if not settings.gitlab_token:
        return [
            GitHubRepo(
                full_name="nexora-group/gitlab-sample-app",
                description="Sample GitLab project with .gitlab-ci.yml pipeline",
                default_branch="main",
                open_issues_count=3,
            )
        ]

    try:
        api_url = _get_api_url()
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects",
                params={"membership": "true", "order_by": "updated_at", "per_page": 30},
            )
            resp.raise_for_status()
            projects = []
            for p in resp.json():
                projects.append(
                    GitHubRepo(
                        full_name=p["path_with_namespace"],
                        description=p.get("description"),
                        default_branch=p.get("default_branch", "main"),
                        open_issues_count=p.get("open_issues_count", 0),
                    )
                )
            return projects
    except Exception as exc:
        logger.warning("GitLab list_projects fell back to sample: %s", exc)
        return [
            GitHubRepo(
                full_name="nexora-group/gitlab-sample-app",
                description="Sample GitLab project with .gitlab-ci.yml pipeline",
                default_branch="main",
                open_issues_count=3,
            )
        ]


async def get_repo(project_path_or_id: str) -> Optional[GitHubRepo]:
    """Fetch details of a single project from GitLab."""
    settings = get_settings()
    if str(project_path_or_id).startswith("nexora-") or not settings.gitlab_token:
        return GitHubRepo(
            full_name=str(project_path_or_id),
            description="GitLab Sandbox Repository",
            default_branch="main",
            open_issues_count=0,
        )

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(f"{api_url}/projects/{encoded}")
            if resp.status_code == 200:
                p = resp.json()
                return GitHubRepo(
                    full_name=p["path_with_namespace"],
                    description=p.get("description"),
                    default_branch=p.get("default_branch", "main"),
                    open_issues_count=p.get("open_issues_count", 0),
                )
    except Exception as exc:
        logger.warning("GitLab get_repo(%s) failed: %s", project_path_or_id, exc)
    return None


# ============================================================
# Issues
# ============================================================

async def list_issues(project_path_or_id: str) -> list[GitHubIssue]:
    """Fetch open issues from a GitLab project."""
    settings = get_settings()
    if not settings.gitlab_token or project_path_or_id.startswith("nexora-"):
        return [
            GitHubIssue(
                number=101,
                title="Integrate GitLab CI/CD with automated test stages",
                body="Add a full multi-stage CI pipeline for linting, testing, and Docker build.",
                state="open",
                labels=["gitlab-ci", "enhancement"],
            ),
            GitHubIssue(
                number=102,
                title="Add secure webhook handler for Merge Request events",
                body="Listen to GitLab MR webhook events and automatically trigger code analysis.",
                state="open",
                labels=["backend", "webhook"],
            ),
        ]

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects/{encoded}/issues",
                params={"state": "opened", "per_page": 30},
            )
            resp.raise_for_status()
            issues = []
            for i in resp.json():
                issues.append(
                    GitHubIssue(
                        number=i["iid"],
                        title=i["title"],
                        body=i.get("description"),
                        state=i.get("state", "open"),
                        labels=i.get("labels", []),
                        created_at=i.get("created_at"),
                    )
                )
            return issues
    except Exception as exc:
        logger.warning("GitLab list_issues failed: %s", exc)
        return []


async def create_issue(
    project_path_or_id: str,
    title: str,
    description: str = "",
    labels: Optional[list[str]] = None,
) -> Optional[GitHubIssue]:
    """
    Create a new issue in the GitLab project.
    """
    settings = get_settings()
    base_url = settings.gitlab_url.rstrip("/")
    final_labels = labels if labels is not None else ["nexora-ai"]

    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        import random
        from datetime import datetime, timezone
        simulated_iid = random.randint(100, 999)
        return GitHubIssue(
            number=simulated_iid,
            title=title,
            body=description,
            state="open",
            labels=final_labels,
            created_at=datetime.now(timezone.utc).isoformat(),
            url=f"{base_url}/{project_path_or_id}/-/issues/{simulated_iid}",
        )

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=12) as client:
            resp = await client.post(
                f"{api_url}/projects/{encoded}/issues",
                json={
                    "title": title,
                    "description": description,
                    "labels": ",".join(final_labels),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Created real GitLab issue !%d for %s", data["iid"], project_path_or_id)
            return GitHubIssue(
                number=data["iid"],
                title=data["title"],
                body=data.get("description"),
                state=data.get("state", "opened"),
                labels=data.get("labels", []),
                created_at=data.get("created_at"),
                url=data.get("web_url"),
            )
    except Exception as exc:
        logger.error("GitLab create_issue(%s) failed: %s", project_path_or_id, exc)
        return None


# ============================================================
# Repository Understanding Tools (GitLab Tree & Files)
# ============================================================

async def list_files(project_path_or_id: str, path: str = "") -> list[dict]:
    """List directory contents at a given path in the GitLab project."""
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return [
            {"name": "package.json", "path": "package.json", "type": "file", "size": 120},
            {"name": ".gitlab-ci.yml", "path": ".gitlab-ci.yml", "type": "file", "size": 150},
            {"name": "src", "path": "src", "type": "dir", "size": 0},
            {"name": "src/models/user.ts", "path": "src/models/user.ts", "type": "file", "size": 120},
            {"name": "src/auth/register.ts", "path": "src/auth/register.ts", "type": "file", "size": 250},
            {"name": "src/email/service.ts", "path": "src/email/service.ts", "type": "file", "size": 180},
        ]

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        params = {"recursive": "false", "per_page": 100}
        if path:
            params["path"] = path

        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects/{encoded}/repository/tree",
                params=params,
            )
            resp.raise_for_status()
            items = resp.json()
            return [
                {
                    "name": item["name"],
                    "path": item["path"],
                    "type": "dir" if item["type"] == "tree" else "file",
                    "size": 0,
                }
                for item in items
            ]
    except Exception as exc:
        logger.warning("GitLab list_files fell back to sandbox: %s", exc)
        return []


import time

_file_cache: dict[str, tuple[float, str]] = {}


async def read_file(project_path_or_id: str, file_path: str, ref: str = "main") -> Optional[str]:
    """Read raw content of a file in the GitLab project with in-memory TTL caching."""
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return PLAYGROUND_FILES.get(
            file_path,
            f"// GitLab Playground File: {file_path}\nexport const ready = true;\n",
        )

    cache_key = f"{project_path_or_id}:{file_path}:{ref}"
    now = time.time()
    if cache_key in _file_cache:
        cached_ts, cached_content = _file_cache[cache_key]
        if now - cached_ts < 300:  # 5 minutes TTL
            return cached_content

    try:
        api_url = _get_api_url()
        encoded_project = _encode_project_path(project_path_or_id)
        encoded_file = urllib.parse.quote(file_path, safe="")
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects/{encoded_project}/repository/files/{encoded_file}/raw",
                params={"ref": ref},
            )
            resp.raise_for_status()
            content = resp.text
            _file_cache[cache_key] = (now, content)
            return content
    except Exception as exc:
        logger.warning("GitLab read_file fell back to sandbox: %s", exc)
        return None


# ============================================================
# Branch & Merge Request Creation (GitLab CI/CD Integration)
# ============================================================

async def list_branches(project_path_or_id: str) -> list[str]:
    """List branch names in a GitLab repository."""
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return ["main", "dev", "staging"]

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(f"{api_url}/projects/{encoded}/repository/branches", params={"per_page": 50})
            if resp.status_code == 200:
                return [b["name"] for b in resp.json()]
    except Exception as exc:
        logger.warning("GitLab list_branches failed: %s", exc)
    return ["main"]


async def create_branch(project_path_or_id: str, branch_name: str, ref: str = "main") -> bool:
    """Create a new branch in a GitLab repository with automatic fallback if base ref does not exist."""
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return True

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.post(
                f"{api_url}/projects/{encoded}/repository/branches",
                json={"branch": branch_name, "ref": ref},
            )
            if resp.status_code in (200, 201):
                return True
            # Fallback to main/master if custom ref fails
            if ref not in ("main", "master"):
                logger.info("GitLab ref '%s' failed, retrying with 'main'...", ref)
                resp_fallback = await client.post(
                    f"{api_url}/projects/{encoded}/repository/branches",
                    json={"branch": branch_name, "ref": "main"},
                )
                return resp_fallback.status_code in (200, 201)
            return False
    except Exception as exc:
        logger.warning("GitLab create_branch failed: %s", exc)
        return False


async def commit_and_push_changes(
    project_path_or_id: str,
    branch_name: str,
    code_changes: dict,
    commit_message: str = "feat(nexora): automated fix",
) -> dict:
    """
    Commit all modified and created files atomically to the remote branch using GitLab Commits API.
    """
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        files_cnt = len(code_changes.get("modified_files", [])) + len(code_changes.get("created_files", []))
        return {"sha": "mock_gitlab_sha", "files_count": files_cnt}

    modified_files = code_changes.get("modified_files", [])
    created_files = code_changes.get("created_files", [])
    total_files = len(modified_files) + len(created_files)

    if total_files == 0:
        return {"sha": None, "files_count": 0}

    actions = []
    for f in modified_files:
        actions.append({
            "action": "update",
            "file_path": f["path"],
            "content": f["content"],
        })
    for f in created_files:
        actions.append({
            "action": "create",
            "file_path": f["path"],
            "content": f["content"],
        })

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=20) as client:
            resp = await client.post(
                f"{api_url}/projects/{encoded}/repository/commits",
                json={
                    "branch": branch_name,
                    "commit_message": commit_message,
                    "actions": actions,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Successfully pushed atomic commit %s (%d files) to branch %s on GitLab %s",
                        data.get("id", "")[:7], total_files, branch_name, project_path_or_id)
            return {"sha": data.get("id"), "files_count": total_files}
    except Exception as exc:
        logger.error("GitLab commit_and_push_changes(%s, %s) failed: %s", project_path_or_id, branch_name, exc)
        return {"sha": None, "error": str(exc), "files_count": 0}


async def create_merge_request(
    project_path_or_id: str,
    source_branch: str,
    target_branch: str = "main",
    title: str = "Nexora AI automated fix",
    description: str = "",
) -> Optional[dict]:
    """
    Open a Merge Request (MR) in GitLab.
    Returns dictionary with merge request URL and IID.
    """
    settings = get_settings()
    base_url = settings.gitlab_url.rstrip("/")

    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        mr_iid = 12
        mr_url = f"{base_url}/{project_path_or_id}/-/merge_requests/{mr_iid}"
        return {
            "id": 999,
            "iid": mr_iid,
            "web_url": mr_url,
            "title": title,
            "source_branch": source_branch,
            "target_branch": target_branch,
        }

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        payload = {
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
            "description": description,
            "remove_source_branch": True,
        }
        async with httpx.AsyncClient(headers=_headers(), timeout=15) as client:
            resp = await client.post(
                f"{api_url}/projects/{encoded}/merge_requests",
                json=payload,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return {
                    "id": data["id"],
                    "iid": data["iid"],
                    "web_url": data["web_url"],
                    "title": data["title"],
                    "source_branch": data["source_branch"],
                    "target_branch": data["target_branch"],
                }

            # If MR already exists, fetch it
            if resp.status_code in (409, 422):
                list_resp = await client.get(
                    f"{api_url}/projects/{encoded}/merge_requests",
                    params={"source_branch": source_branch, "state": "opened"},
                )
                if list_resp.status_code == 200 and len(list_resp.json()) > 0:
                    data = list_resp.json()[0]
                    return {
                        "id": data["id"],
                        "iid": data["iid"],
                        "web_url": data["web_url"],
                        "title": data["title"],
                        "source_branch": data["source_branch"],
                        "target_branch": data["target_branch"],
                    }

            resp.raise_for_status()
            data = resp.json()
            return {
                "id": data["id"],
                "iid": data["iid"],
                "web_url": data["web_url"],
                "title": data["title"],
                "source_branch": data["source_branch"],
                "target_branch": data["target_branch"],
            }
    except Exception as exc:
        logger.error("GitLab create_merge_request failed: %s", exc)
        return None


# ============================================================
# GitLab Commits & MR Lifecycle (Revert & Close)
# ============================================================

async def list_commits(project_path_or_id: str, branch: str = "main", limit: int = 20) -> list[dict]:
    """
    List recent commits for a GitLab repository branch.
    Returns list of dicts with sha, short_sha, message, author_name, author_date, url.
    """
    settings = get_settings()
    base_url = settings.gitlab_url.rstrip("/")

    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return [
            {
                "sha": "g1a2b3c4d5e6f78901234567890abcdef1234567",
                "short_sha": "g1a2b3c",
                "message": "feat: initial commit from GitLab CI",
                "author_name": "GitLab CI",
                "author_date": "2026-08-30T06:00:00Z",
                "url": f"{base_url}/{project_path_or_id}/-/commit/g1a2b3c",
            }
        ]

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects/{encoded}/repository/commits",
                params={"ref_name": branch, "per_page": limit},
            )
            resp.raise_for_status()
            data = resp.json()

            commits = []
            for item in data:
                sha = item.get("id", "")
                commits.append({
                    "sha": sha,
                    "short_sha": item.get("short_id", sha[:7]),
                    "message": item.get("title", "No commit message"),
                    "author_name": item.get("author_name", "Unknown"),
                    "author_date": item.get("authored_date") or item.get("created_at"),
                    "parents": item.get("parent_ids", []),
                    "url": item.get("web_url"),
                })
            return commits
    except Exception as exc:
        logger.error("GitLab list_commits(%s) failed: %s", project_path_or_id, exc)
        return []


async def close_mr(project_path_or_id: str, mr_iid: int) -> bool:
    """Close a merge request on GitLab without merging."""
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return True

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.put(
                f"{api_url}/projects/{encoded}/merge_requests/{mr_iid}",
                json={"state_event": "close"},
            )
            resp.raise_for_status()
            return True
    except Exception as exc:
        logger.error("GitLab close_mr(%s, !%d) failed: %s", project_path_or_id, mr_iid, exc)
        return False


async def merge_merge_request(
    project_path_or_id: str,
    mr_iid: int,
    commit_message: str = "",
    should_remove_source_branch: bool = True,
) -> dict:
    """
    Accept and merge a Merge Request on GitLab.
    """
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return {"merged": True, "message": "GitLab MR successfully merged (sandbox mode)", "sha": "mock_gl_merge_sha"}

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        payload = {"should_remove_source_branch": should_remove_source_branch}
        if commit_message:
            payload["merge_commit_message"] = commit_message

        async with httpx.AsyncClient(headers=_headers(), timeout=15) as client:
            resp = await client.put(
                f"{api_url}/projects/{encoded}/merge_requests/{mr_iid}/merge",
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Successfully merged GitLab MR !%d on %s", mr_iid, project_path_or_id)
                return {"merged": True, "message": "Merge Request accepted and merged", "sha": data.get("merge_commit_sha")}
            else:
                err_text = resp.text
                logger.error("GitLab merge MR !%d failed (%d): %s", mr_iid, resp.status_code, err_text)
                return {"merged": False, "message": f"GitLab API error ({resp.status_code}): {err_text}", "sha": None}
    except Exception as exc:
        logger.error("merge_merge_request(%s, !%d) error: %s", project_path_or_id, mr_iid, exc)
        return {"merged": False, "message": str(exc), "sha": None}


async def get_merge_request_status(project_path_or_id: str, mr_iid: int) -> dict:
    """
    Check the current live state of a Merge Request on GitLab.
    Returns {"state": "open"|"merged"|"closed", "merged": bool, "merge_commit_sha": str|None}.
    """
    settings = get_settings()
    if not settings.gitlab_token or str(project_path_or_id).startswith("nexora-"):
        return {"state": "open", "merged": False, "merge_commit_sha": None}

    try:
        api_url = _get_api_url()
        encoded = _encode_project_path(project_path_or_id)
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{api_url}/projects/{encoded}/merge_requests/{mr_iid}",
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_state = data.get("state", "opened")
                is_merged = raw_state == "merged"
                state = "merged" if is_merged else ("closed" if raw_state == "closed" else "open")
                return {
                    "state": state,
                    "merged": is_merged,
                    "merge_commit_sha": data.get("merge_commit_sha"),
                }
    except Exception as exc:
        logger.warning("get_merge_request_status(%s, !%d) failed: %s", project_path_or_id, mr_iid, exc)

    return {"state": "open", "merged": False, "merge_commit_sha": None}

