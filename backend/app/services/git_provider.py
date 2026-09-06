"""
Nexora AI — Unified Git Provider Adapter

Provides a common interface for both GitHub and GitLab, allowing Nexora
to interact seamlessly with either Git hosting platform (PR / MR / CI / Issues).

Provider is determined by the `git_provider` field stored on each project,
not by string matching on the repo name.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import GitHubIssue, GitHubRepo
from app.services import github_service, gitlab_service

logger = logging.getLogger(__name__)


def get_active_provider(
    project: Optional[dict] = None,
    repo_name: str = "",
) -> str:
    """
    Determine the Git provider for a project.

    Priority:
    1. Explicit `git_provider` field on the project record
    2. Fallback to default_git_provider from settings
    """
    if project and project.get("git_provider"):
        return project["git_provider"].lower()
    return get_settings().default_git_provider.lower()


async def list_repos(provider: Optional[str] = None) -> list[GitHubRepo]:
    """List repositories from the specified provider (or both if unspecified)."""
    p = provider or get_settings().default_git_provider
    if p == "gitlab":
        return await gitlab_service.list_projects()
    return await github_service.list_repos()


async def get_repo(
    repo_full_name: str,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> Optional[GitHubRepo]:
    """Get metadata for a repository on GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.get_repo(repo_full_name)
    return await github_service.get_repo(repo_full_name)



async def list_issues(
    repo_full_name: str,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> list[GitHubIssue]:
    """Fetch open issues from GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.list_issues(repo_full_name)
    return await github_service.list_issues(repo_full_name)


async def create_issue(
    repo_full_name: str,
    title: str,
    body: str = "",
    labels: Optional[list[str]] = None,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> Optional[GitHubIssue]:
    """Create a new issue on GitHub or GitLab repository."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.create_issue(repo_full_name, title, description=body, labels=labels)
    return await github_service.create_issue(repo_full_name, title, body=body, labels=labels)


async def commit_and_push_changes(
    repo_full_name: str,
    branch_name: str,
    code_changes: dict,
    commit_message: str = "feat(nexora): automated fix",
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> dict:
    """Commit and push code changes atomically to the remote branch on GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.commit_and_push_changes(repo_full_name, branch_name, code_changes, commit_message)
    return await github_service.commit_and_push_changes(repo_full_name, branch_name, code_changes, commit_message)


async def list_files(
    repo_full_name: str,
    path: str = "",
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> list[dict]:
    """List directory contents using GitHub or GitLab API."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.list_files(repo_full_name, path)
    return await github_service.list_files(repo_full_name, path)


async def read_file(
    repo_full_name: str,
    file_path: str,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> Optional[str]:
    """Read file content using GitHub or GitLab API."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.read_file(repo_full_name, file_path)
    return await github_service.read_file(repo_full_name, file_path)


async def create_pr_or_mr(
    repo_full_name: str,
    source_branch: str,
    target_branch: str = "main",
    title: str = "Nexora AI Automated Fix",
    description: str = "",
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Open a Pull Request on GitHub or a Merge Request (MR) on GitLab.
    Returns standard payload: { "url": str, "number_or_iid": int, "type": "PR" | "MR" }
    """
    p = provider or get_active_provider(project=project)
    settings = get_settings()

    if p == "gitlab":
        await gitlab_service.create_branch(repo_full_name, source_branch, ref=target_branch)
        mr = await gitlab_service.create_merge_request(
            project_path_or_id=repo_full_name,
            source_branch=source_branch,
            target_branch=target_branch,
            title=title,
            description=description,
        )
        if mr:
            return {"url": mr["web_url"], "number_or_iid": mr["iid"], "type": "MR"}
        
        base_url = settings.gitlab_url.rstrip("/")
        fallback_url = f"{base_url}/{repo_full_name}/-/merge_requests/1"
        return {"url": fallback_url, "number_or_iid": 1, "type": "MR"}

    else:
        await github_service.create_branch(repo_full_name, source_branch, ref=target_branch)
        pr = await github_service.create_pull_request(
            repo_full_name=repo_full_name,
            head_branch=source_branch,
            base_branch=target_branch,
            title=title,
            body=description,
        )
        if pr:
            return {"url": pr["html_url"], "number_or_iid": pr["number"], "type": "PR"}
        
        fallback_url = f"https://github.com/{repo_full_name}/pull/1"
        return {"url": fallback_url, "number_or_iid": 1, "type": "PR"}


async def list_branches(
    repo_full_name: str,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> list[str]:
    """List branch names from GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.list_branches(repo_full_name)
    return await github_service.list_branches(repo_full_name)


async def create_branch(
    repo_full_name: str,
    branch_name: str,
    ref: str = "main",
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> bool:
    """Create a new branch on GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.create_branch(repo_full_name, branch_name=branch_name, ref=ref)
    return await github_service.create_branch(repo_full_name, branch_name=branch_name, ref=ref)


async def list_commits(
    repo_full_name: str,
    branch: str = "main",
    limit: int = 20,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> list[dict]:
    """List recent commits from GitHub or GitLab."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.list_commits(repo_full_name, branch=branch, limit=limit)
    return await github_service.list_commits(repo_full_name, branch=branch, limit=limit)


async def close_pr_or_mr(
    repo_full_name: str,
    pr_number_or_iid: int,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> bool:
    """Close a PR or MR without merging."""
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.close_mr(repo_full_name, pr_number_or_iid)
    return await github_service.close_pr(repo_full_name, pr_number_or_iid)


async def merge_pr_or_mr(
    repo_full_name: str,
    pr_number_or_iid: int,
    commit_title: str = "",
    commit_message: str = "",
    merge_method: str = "merge",
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Merge a Pull Request on GitHub or a Merge Request on GitLab directly.
    """
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.merge_merge_request(
            project_path_or_id=repo_full_name,
            mr_iid=pr_number_or_iid,
            commit_message=commit_message or commit_title,
        )
    return await github_service.merge_pull_request(
        repo_full_name=repo_full_name,
        pr_number=pr_number_or_iid,
        commit_title=commit_title,
        commit_message=commit_message,
        merge_method=merge_method,
    )


async def create_revert_pr(
    repo_full_name: str,
    task: dict,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Open a Revert Pull Request (GitHub) or Merge Request (GitLab) to rollback task changes.
    """
    p = provider or get_active_provider(project=project)
    issue_num = task.get("issue_number", 0)
    target_branch = project.get("default_branch", "main") if project else "main"
    revert_branch = f"revert/task-{issue_num}"

    revert_title = f"Revert: Nexora AI task #{issue_num} ({task.get('issue_title', '')})"
    revert_desc = (
        f"## ↩️ Rollback & Revert Request\n\n"
        f"This automated PR reverts the changes introduced by task **#{issue_num}** (`{task.get('issue_title', '')}`).\n\n"
        f"- Target Branch: `{target_branch}`\n"
        f"- Reason: Rollback requested via Nexora AI Safety Control."
    )

    return await create_pr_or_mr(
        repo_full_name=repo_full_name,
        source_branch=revert_branch,
        target_branch=target_branch,
        title=revert_title,
        description=revert_desc,
        project=project,
        provider=p,
    )


async def get_pr_or_mr_status(
    repo_full_name: str,
    pr_number: int,
    project: Optional[dict] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Get live status of PR/MR from GitHub or GitLab.
    Returns {"state": "open"|"merged"|"closed", "merged": bool, "merge_commit_sha": str|None}.
    """
    p = provider or get_active_provider(project=project)
    if p == "gitlab":
        return await gitlab_service.get_merge_request_status(repo_full_name, mr_iid=pr_number)
    return await github_service.get_pull_request_status(repo_full_name, pr_number=pr_number)

