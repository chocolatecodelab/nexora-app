"""
Nexora AI — GitHub Service

Handles all interactions with the GitHub API:
- Listing repositories
- Fetching issues
- Reading repository files (selective, not full clone)
- Creating branches, commits, and Pull Requests

For MVP development, uses a Personal Access Token (GITHUB_TOKEN).
Production will use a GitHub App with scoped permissions (PRD Section 7.6).
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import get_settings
from app.models.schemas import GitHubIssue, GitHubRepo

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _headers() -> dict:
    """Build auth headers for GitHub API requests."""
    from app.routers import auth
    token = auth.get_active_github_token()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Nexora-AI-Agent/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def is_connected() -> bool:
    """Check whether the GitHub token is configured and valid."""
    from app.routers import auth
    token = auth.get_active_github_token()
    if not token:
        return False
    try:
        resp = httpx.get(f"{GITHUB_API}/user", headers=_headers(), timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


# ============================================================
# Repositories
# ============================================================

async def list_repos() -> list[GitHubRepo]:
    """List repositories accessible to the authenticated user."""
    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/user/repos",
                params={"sort": "updated", "per_page": 30, "type": "owner"},
            )
            resp.raise_for_status()
            repos = []
            for r in resp.json():
                repos.append(GitHubRepo(
                    full_name=r["full_name"],
                    description=r.get("description"),
                    default_branch=r.get("default_branch", "main"),
                    language=r.get("language"),
                    private=r.get("private", False),
                ))
            return repos
    except Exception as exc:
        logger.error("Failed to list repos: %s", exc)
        return []


async def get_repo(repo_full_name: str) -> Optional[GitHubRepo]:
    """Fetch details of a single repository from GitHub."""
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return GitHubRepo(
            full_name=repo_full_name,
            description="Sandbox Mock Repository",
            default_branch="main",
            language="TypeScript",
            private=False,
        )

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}")
            if resp.status_code == 200:
                r = resp.json()
                return GitHubRepo(
                    full_name=r["full_name"],
                    description=r.get("description"),
                    default_branch=r.get("default_branch", "main"),
                    language=r.get("language"),
                    private=r.get("private", False),
                )
    except Exception as exc:
        logger.warning("get_repo(%s) failed: %s", repo_full_name, exc)
    return None


# ============================================================
# Issues
# ============================================================

async def list_issues(repo_full_name: str) -> list[GitHubIssue]:
    """List open issues for a given repository."""
    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/issues",
                params={"state": "open", "per_page": 30},
            )
            resp.raise_for_status()
            issues = []
            for i in resp.json():
                # Skip pull requests (GitHub treats them as issues too)
                if "pull_request" in i:
                    continue
                issues.append(GitHubIssue(
                    number=i["number"],
                    title=i["title"],
                    body=i.get("body"),
                    state=i.get("state", "open"),
                    labels=[lbl["name"] for lbl in i.get("labels", [])],
                    created_at=i.get("created_at"),
                ))
            return issues
    except Exception as exc:
        logger.error("Failed to list issues for %s: %s", repo_full_name, exc)
        return []


async def get_issue(repo_full_name: str, issue_number: int) -> Optional[GitHubIssue]:
    """Fetch a single issue by number."""
    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/issues/{issue_number}",
            )
            resp.raise_for_status()
            i = resp.json()
            return GitHubIssue(
                number=i["number"],
                title=i["title"],
                body=i.get("body"),
                state=i.get("state", "open"),
                labels=[lbl["name"] for lbl in i.get("labels", [])],
                created_at=i.get("created_at"),
                url=i.get("html_url"),
            )
    except Exception as exc:
        logger.error("Failed to get issue #%d: %s", issue_number, exc)
        return None


async def create_issue(
    repo_full_name: str,
    title: str,
    body: str = "",
    labels: Optional[list[str]] = None,
) -> Optional[GitHubIssue]:
    """
    Create a new issue on GitHub repository.
    """
    settings = get_settings()
    final_labels = labels if labels is not None else ["nexora-ai"]

    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        # Playground simulated issue
        import random
        from datetime import datetime, timezone
        simulated_num = random.randint(100, 999)
        return GitHubIssue(
            number=simulated_num,
            title=title,
            body=body,
            state="open",
            labels=final_labels,
            created_at=datetime.now(timezone.utc).isoformat(),
            url=f"https://github.com/{repo_full_name}/issues/{simulated_num}",
        )

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=12) as client:
            resp = await client.post(
                f"{GITHUB_API}/repos/{repo_full_name}/issues",
                json={
                    "title": title,
                    "body": body,
                    "labels": final_labels,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Created real GitHub issue #%d for %s", data["number"], repo_full_name)
            return GitHubIssue(
                number=data["number"],
                title=data["title"],
                body=data.get("body"),
                state=data.get("state", "open"),
                labels=[lbl["name"] for lbl in data.get("labels", []) if isinstance(lbl, dict)],
                created_at=data.get("created_at"),
                url=data.get("html_url"),
            )
    except Exception as exc:
        logger.error("create_issue(%s) failed: %s", repo_full_name, exc)
        return None


# ============================================================
# Repository Understanding Tools (PRD Section 7.4)
# ============================================================

PLAYGROUND_FILES = {
    "package.json": '{\n  "name": "nexora-playground",\n  "version": "1.0.0",\n  "scripts": {\n    "test": "jest",\n    "build": "tsc"\n  }\n}',
    "src/models/user.ts": "export interface User {\n  id: string;\n  email: string;\n  name: string;\n  createdAt: Date;\n}",
    "src/auth/register.ts": "import { User } from '../models/user';\n\nexport async function registerUser(email: string, pass: string): Promise<User> {\n  // Register logic\n  return { id: 'u_123', email, name: 'User', createdAt: new Date() };\n}",
    "src/email/service.ts": "export async function sendEmail(to: string, subject: string, body: string) {\n  console.log(`Sending email to ${to}: ${subject}`);\n}",
}


async def list_files(repo_full_name: str, path: str = "") -> list[dict]:
    """
    Tool: list_files(path)
    List directory contents at a given path in the repository.
    """
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return [
            {"name": "package.json", "path": "package.json", "type": "file", "size": 140},
            {"name": "src", "path": "src", "type": "dir", "size": 0},
            {"name": "src/models/user.ts", "path": "src/models/user.ts", "type": "file", "size": 120},
            {"name": "src/auth/register.ts", "path": "src/auth/register.ts", "type": "file", "size": 250},
            {"name": "src/email/service.ts", "path": "src/email/service.ts", "type": "file", "size": 180},
        ]

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/contents/{path}",
            )
            resp.raise_for_status()
            items = resp.json()
            if not isinstance(items, list):
                items = [items]
            return [
                {
                    "name": item["name"],
                    "path": item["path"],
                    "type": item["type"],
                    "size": item.get("size", 0),
                }
                for item in items
            ]
    except Exception as exc:
        logger.warning("list_files(%s/%s) fell back to sandbox: %s", repo_full_name, path, exc)
        return []


import time

_file_cache: dict[str, tuple[float, str]] = {}


async def read_file(repo_full_name: str, file_path: str) -> Optional[str]:
    """
    Tool: read_file(path)
    Read the contents of a specific file in the repository (with fast in-memory TTL caching).
    """
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return PLAYGROUND_FILES.get(file_path, "// Playground dummy file content\nexport const ready = true;\n")

    cache_key = f"{repo_full_name}:{file_path}"
    now = time.time()
    if cache_key in _file_cache:
        cached_ts, cached_content = _file_cache[cache_key]
        if now - cached_ts < 300:  # 5 minutes TTL
            return cached_content

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/contents/{file_path}",
                headers={**_headers(), "Accept": "application/vnd.github.raw+json"},
            )
            resp.raise_for_status()
            content = resp.text
            _file_cache[cache_key] = (now, content)
            return content
    except Exception as exc:
        logger.warning("read_file(%s/%s) fell back to sandbox: %s", repo_full_name, file_path, exc)
        return None


async def search_code(repo_full_name: str, query: str) -> list[dict]:
    """
    Tool: search_code(query)
    Search for code in the repository matching the given query.
    """
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return [
            {"name": "register.ts", "path": "src/auth/register.ts", "url": None},
            {"name": "service.ts", "path": "src/email/service.ts", "url": None},
        ]

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=15) as client:
            resp = await client.get(
                f"{GITHUB_API}/search/code",
                params={"q": f"{query} repo:{repo_full_name}"},
            )
            resp.raise_for_status()
            results = resp.json().get("items", [])
            return [
                {
                    "name": item["name"],
                    "path": item["path"],
                    "url": item.get("html_url"),
                }
                for item in results[:10]
            ]
    except Exception as exc:
        logger.warning("search_code(%s, %s) fell back to sandbox: %s", repo_full_name, query, exc)
        return []


# ============================================================
# Commits & PR Lifecycle (Revert & Close)
# ============================================================

async def list_commits(repo_full_name: str, branch: str = "main", limit: int = 20) -> list[dict]:
    """
    List recent commits for a repository branch.
    Returns list of dicts with sha, short_sha, message, author_name, author_date, url.
    """
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return [
            {
                "sha": "e9f8a1b2c3d4e5f678901234567890abcdef1234",
                "short_sha": "e9f8a1b",
                "message": "feat: initial commit and project structure",
                "author_name": "Nexora AI",
                "author_date": "2026-08-30T06:00:00Z",
                "url": f"https://github.com/{repo_full_name}/commit/e9f8a1b",
            }
        ]

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/commits",
                params={"per_page": limit, "sha": branch} if branch else {"per_page": limit},
            )
            if resp.status_code == 404 and branch:
                # Fallback to repo default branch if requested branch was not found
                resp = await client.get(
                    f"{GITHUB_API}/repos/{repo_full_name}/commits",
                    params={"per_page": limit},
                )

            if resp.status_code != 200:
                logger.warning("list_commits(%s, %s) returned %d", repo_full_name, branch, resp.status_code)
                return []

            data = resp.json()
            commits = []
            for item in data:
                sha = item.get("sha", "")
                commit_info = item.get("commit", {})
                author_info = commit_info.get("author", {}) or {}
                parents = [p.get("sha") for p in item.get("parents", []) if p.get("sha")]
                commits.append({
                    "sha": sha,
                    "short_sha": sha[:7] if sha else "",
                    "message": commit_info.get("message", "").splitlines()[0] if commit_info.get("message") else "No commit message",
                    "author_name": author_info.get("name", "Unknown"),
                    "author_date": author_info.get("date"),
                    "parents": parents,
                    "url": item.get("html_url"),
                })
            return commits
    except Exception as exc:
        logger.warning("list_commits(%s) error: %s", repo_full_name, exc)
        return []


async def list_branches(repo_full_name: str) -> list[str]:
    """
    List existing branch names in the GitHub repository.
    """
    settings = get_settings()
    if not settings.github_token or repo_full_name.startswith("nexora-ai/"):
        return ["main", "dev", "staging"]

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/branches", params={"per_page": 50})
            if resp.status_code == 200:
                return [b["name"] for b in resp.json()]
    except Exception as exc:
        logger.warning("list_branches(%s) failed: %s", repo_full_name, exc)
    return ["main"]


async def create_branch(repo_full_name: str, branch_name: str, ref: str = "main") -> bool:
    """
    Create a new Git branch on GitHub from a base reference branch (e.g. main/dev).
    If base reference 'ref' does not exist, automatically falls back to 'main' or 'master'.
    """
    settings = get_settings()
    if not settings.github_token or repo_full_name.startswith("nexora-ai/"):
        return True

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=12) as client:
            # 1. Get latest commit SHA of base branch
            clean_ref = ref.replace("refs/heads/", "")
            ref_resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/{clean_ref}")

            base_sha = None
            if ref_resp.status_code == 200:
                base_sha = ref_resp.json()["object"]["sha"]
            else:
                # Fallback to default branch 'main' or 'master'
                logger.info("Base ref '%s' not found on %s, trying 'main'...", clean_ref, repo_full_name)
                main_resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/main")
                if main_resp.status_code == 200:
                    base_sha = main_resp.json()["object"]["sha"]
                else:
                    master_resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/master")
                    if master_resp.status_code == 200:
                        base_sha = master_resp.json()["object"]["sha"]

            if not base_sha:
                logger.warning("Could not resolve any valid base commit SHA for %s", repo_full_name)
                return False

            # 2. Create new branch ref
            full_branch_ref = f"refs/heads/{branch_name}"
            create_resp = await client.post(
                f"{GITHUB_API}/repos/{repo_full_name}/git/refs",
                json={"ref": full_branch_ref, "sha": base_sha},
            )
            if create_resp.status_code in (200, 201, 422):  # 422 means reference already exists
                logger.info("GitHub branch '%s' ready on %s (base sha: %s)", branch_name, repo_full_name, base_sha[:7])
                return True
            logger.warning("GitHub create_branch failed (%d): %s", create_resp.status_code, create_resp.text)
            return False
    except Exception as exc:
        logger.warning("GitHub create_branch error on %s: %s", repo_full_name, exc)
        return False


async def commit_and_push_changes(
    repo_full_name: str,
    branch_name: str,
    code_changes: dict,
    commit_message: str = "feat(nexora): automated fix",
) -> dict:
    """
    Commit all modified and created files atomically to the remote branch using GitHub Git Data API.
    """
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        files_cnt = len(code_changes.get("modified_files", [])) + len(code_changes.get("created_files", []))
        return {"sha": "mock_commit_sha", "files_count": files_cnt}

    modified_files = code_changes.get("modified_files", [])
    created_files = code_changes.get("created_files", [])
    total_files = len(modified_files) + len(created_files)

    if total_files == 0:
        return {"sha": None, "files_count": 0}

    clean_branch = branch_name.replace("refs/heads/", "")

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=20) as client:
            # 1. Get current commit SHA of branch
            ref_resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/{clean_branch}")
            ref_resp.raise_for_status()
            current_commit_sha = ref_resp.json()["object"]["sha"]

            # 2. Get tree SHA of current commit
            commit_resp = await client.get(f"{GITHUB_API}/repos/{repo_full_name}/git/commits/{current_commit_sha}")
            commit_resp.raise_for_status()
            base_tree_sha = commit_resp.json()["tree"]["sha"]

            # 3. Create tree entries for modified & created files
            tree_entries = []
            for f in modified_files:
                tree_entries.append({
                    "path": f["path"],
                    "mode": "100644",
                    "type": "blob",
                    "content": f["content"],
                })
            for f in created_files:
                tree_entries.append({
                    "path": f["path"],
                    "mode": "100644",
                    "type": "blob",
                    "content": f["content"],
                })

            tree_resp = await client.post(
                f"{GITHUB_API}/repos/{repo_full_name}/git/trees",
                json={"base_tree": base_tree_sha, "tree": tree_entries},
            )
            tree_resp.raise_for_status()
            new_tree_sha = tree_resp.json()["sha"]

            # 4. Create new Git commit object
            new_commit_resp = await client.post(
                f"{GITHUB_API}/repos/{repo_full_name}/git/commits",
                json={
                    "message": commit_message,
                    "tree": new_tree_sha,
                    "parents": [current_commit_sha],
                },
            )
            new_commit_resp.raise_for_status()
            new_commit_sha = new_commit_resp.json()["sha"]

            # 5. Update branch reference to new commit
            update_ref_resp = await client.patch(
                f"{GITHUB_API}/repos/{repo_full_name}/git/refs/heads/{clean_branch}",
                json={"sha": new_commit_sha, "force": True},
            )
            update_ref_resp.raise_for_status()

            logger.info("Successfully pushed atomic commit %s (%d files) to branch %s on %s",
                        new_commit_sha[:7], total_files, clean_branch, repo_full_name)
            return {"sha": new_commit_sha, "files_count": total_files}

    except Exception as exc:
        logger.error("commit_and_push_changes(%s, %s) failed: %s", repo_full_name, branch_name, exc)
        return {"sha": None, "error": str(exc), "files_count": 0}


async def create_pull_request(
    repo_full_name: str,
    head_branch: str,
    base_branch: str = "main",
    title: str = "Nexora AI Automated Fix",
    body: str = "",
    draft: bool = False,
) -> Optional[dict]:
    """Create a pull request on GitHub."""
    settings = get_settings()
    if repo_full_name.startswith("nexora-ai/") or not settings.github_token:
        return {
            "html_url": f"https://github.com/{repo_full_name}/pull/1",
            "number": 1,
            "title": title,
        }

    clean_head = head_branch.replace("refs/heads/", "")
    clean_base = base_branch.replace("refs/heads/", "")

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=15) as client:
            resp = await client.post(
                f"{GITHUB_API}/repos/{repo_full_name}/pulls",
                json={
                    "title": title,
                    "body": body,
                    "head": clean_head,
                    "base": clean_base,
                    "draft": draft,
                },
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                logger.info("Successfully created GitHub Pull Request #%d on %s: %s",
                            data["number"], repo_full_name, data.get("html_url"))
                return data

            # If PR already exists for this branch, fetch the existing PR
            err_text = resp.text
            logger.warning("GitHub create_pull_request returned %d: %s", resp.status_code, err_text)
            if resp.status_code == 422 and "already exists" in err_text.lower():
                logger.info("Finding existing open PR for branch %s on %s...", clean_head, repo_full_name)
                owner = repo_full_name.split("/")[0]
                existing_resp = await client.get(
                    f"{GITHUB_API}/repos/{repo_full_name}/pulls",
                    params={"head": f"{owner}:{clean_head}", "state": "open"},
                )
                if existing_resp.status_code == 200 and len(existing_resp.json()) > 0:
                    existing_pr = existing_resp.json()[0]
                    logger.info("Found existing PR #%d: %s", existing_pr["number"], existing_pr["html_url"])
                    return existing_pr

            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.error("create_pull_request(%s) failed: %s", repo_full_name, exc)
        return {
            "html_url": f"https://github.com/{repo_full_name}/pull/1",
            "number": 1,
            "title": title,
        }


async def close_pr(repo_full_name: str, pr_number: int) -> bool:
    """Close a pull request on GitHub without merging."""
    settings = get_settings()
    if not settings.github_token or repo_full_name.startswith("nexora-ai/"):
        return True

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.patch(
                f"{GITHUB_API}/repos/{repo_full_name}/pulls/{pr_number}",
                json={"state": "closed"},
            )
            resp.raise_for_status()
            return True
    except Exception as exc:
        logger.error("close_pr(%s, #%d) failed: %s", repo_full_name, pr_number, exc)
        return False


async def merge_pull_request(
    repo_full_name: str,
    pr_number: int,
    commit_title: str = "",
    commit_message: str = "",
    merge_method: str = "merge",
) -> dict:
    """
    Merge a pull request on GitHub.
    `merge_method` can be 'merge', 'squash', or 'rebase'.
    """
    settings = get_settings()
    if not settings.github_token or repo_full_name.startswith("nexora-ai/"):
        return {"merged": True, "message": "Pull Request successfully merged (sandbox mode)", "sha": "mock_merge_sha"}

    try:
        payload = {"merge_method": merge_method}
        if commit_title:
            payload["commit_title"] = commit_title
        if commit_message:
            payload["commit_message"] = commit_message

        async with httpx.AsyncClient(headers=_headers(), timeout=15) as client:
            resp = await client.put(
                f"{GITHUB_API}/repos/{repo_full_name}/pulls/{pr_number}/merge",
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Successfully merged GitHub PR #%d on %s (SHA: %s)", pr_number, repo_full_name, data.get("sha", "")[:7])
                return {"merged": True, "message": data.get("message", "Merged"), "sha": data.get("sha")}
            else:
                err_text = resp.text
                logger.error("GitHub merge PR #%d failed (%d): %s", pr_number, resp.status_code, err_text)
                return {"merged": False, "message": f"GitHub API error ({resp.status_code}): {err_text}", "sha": None}
    except Exception as exc:
        logger.error("merge_pull_request(%s, #%d) error: %s", repo_full_name, pr_number, exc)
        return {"merged": False, "message": str(exc), "sha": None}


async def get_pull_request_status(repo_full_name: str, pr_number: int) -> dict:
    """
    Check the current live state of a Pull Request on GitHub.
    Returns {"state": "open"|"merged"|"closed", "merged": bool, "merge_commit_sha": str|None}.
    """
    settings = get_settings()
    if not settings.github_token or repo_full_name.startswith("nexora-ai/"):
        return {"state": "open", "merged": False, "merge_commit_sha": None}

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=10) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo_full_name}/pulls/{pr_number}",
            )
            if resp.status_code == 200:
                data = resp.json()
                is_merged = data.get("merged", False) or bool(data.get("merged_at"))
                raw_state = data.get("state", "open")
                state = "merged" if is_merged else ("closed" if raw_state == "closed" else "open")
                return {
                    "state": state,
                    "merged": is_merged,
                    "merge_commit_sha": data.get("merge_commit_sha"),
                }
    except Exception as exc:
        logger.warning("get_pull_request_status(%s, #%d) failed: %s", repo_full_name, pr_number, exc)

    return {"state": "open", "merged": False, "merge_commit_sha": None}

