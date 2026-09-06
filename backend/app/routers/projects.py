"""
Nexora AI — Projects Router

Endpoints for managing connected repositories (GitHub / GitLab) and fetching issues.
PRD Endpoints: /projects, /projects/{id}/issues, /projects/providers/status
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    CreateBranchRequest,
    CreateIssueRequest,
    GitCommit,
    GitHubIssue,
    GitHubRepo,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services import git_provider, github_service, gitlab_service, supabase_client

router = APIRouter(prefix="/api/projects", tags=["Projects"])


# ============================================================
# Repository Management
# ============================================================

@router.get("/", response_model=list[ProjectResponse])
async def get_projects():
    """List all connected repositories."""
    projects = supabase_client.list_projects()
    return projects


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate):
    """Connect a new GitHub or GitLab repository to Nexora after verifying its existence."""
    data = body.model_dump()
    repo_name = data.get("repository_full_name", "").strip()
    provider = data.get("git_provider", "github")

    # Verify repository exists on Git Provider
    repo_info = await git_provider.get_repo(repo_name, provider=provider)
    if not repo_info:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repo_name}' tidak ditemukan di {provider.title()}. Pastikan nama repositori tepat (contoh: owner/repo) dan akun memiliki hak akses.",
        )

    if repo_info.default_branch and not data.get("default_branch"):
        data["default_branch"] = repo_info.default_branch

    project = supabase_client.create_project(data)
    return project


@router.delete("/{project_id}", status_code=200)
async def delete_project(project_id: str):
    """Disconnect and remove a project from Nexora."""
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    c = supabase_client._get_supabase()
    if c:
        c.table("projects").delete().eq("id", project_id).execute()
    return {"status": "deleted", "id": project_id}


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a single connected project by ID."""
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate):
    """Update settings (branch prefix, PR templates, test command) for a connected project."""
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = body.model_dump(exclude_unset=True)
    updated = supabase_client.update_project(project_id, updates)
    return updated or project


# ============================================================
# Issues (fetched live or created on Git Provider: GitHub or GitLab)
# ============================================================

@router.get("/{project_id}/issues", response_model=list[GitHubIssue])
async def get_project_issues(project_id: str):
    """
    Fetch open issues from the repository associated with this project.
    Automatically resolves whether the project is on GitHub or GitLab.
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    issues = await git_provider.list_issues(repo_name, project=project)
    return issues


@router.post("/{project_id}/issues", response_model=GitHubIssue, status_code=201)
async def create_project_issue(project_id: str, body: CreateIssueRequest):
    """
    Create a new issue on the remote repository (GitHub or GitLab).
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    issue = await git_provider.create_issue(
        repo_full_name=repo_name,
        title=body.title,
        body=body.body or "",
        labels=body.labels,
        project=project,
    )
    if not issue:
        raise HTTPException(status_code=500, detail="Failed to create issue on remote Git provider")
    return issue


@router.get("/{project_id}/files")
async def get_project_files(project_id: str):
    """
    Fetch file tree from the connected repository for interactive file picking.
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    files = await git_provider.list_files(repo_name, project=project)
    return files


@router.get("/{project_id}/commits", response_model=list[GitCommit])
async def get_project_commits(
    project_id: str,
    branch: Optional[str] = Query(None, description="Branch to fetch commits from"),
    limit: int = Query(20, ge=1, le=100, description="Max commits to return"),
):
    """
    Fetch recent commit history for the project repository from GitHub or GitLab.
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    target_branch = branch or project.get("default_branch", "main")
    commits = await git_provider.list_commits(
        repo_full_name=repo_name,
        branch=target_branch,
        limit=limit,
        project=project,
    )
    return commits


@router.get("/{project_id}/branches", response_model=list[str])
async def get_project_branches(project_id: str):
    """
    List all branches existing in the remote repository (GitHub / GitLab).
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    branches = await git_provider.list_branches(repo_name, project=project)
    return branches


@router.post("/{project_id}/branches", status_code=201)
async def create_project_branch(project_id: str, body: CreateBranchRequest):
    """
    Create a new branch in the remote repository (e.g. create 'dev' from 'main').
    """
    project = supabase_client.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project["repository_full_name"]
    success = await git_provider.create_branch(
        repo_full_name=repo_name,
        branch_name=body.branch_name.strip(),
        ref=body.base_branch.strip() if body.base_branch else "main",
        project=project,
    )
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to create branch '{body.branch_name}' on remote repository")

    return {"status": "ok", "branch": body.branch_name.strip(), "base_branch": body.base_branch or "main"}


# ============================================================
# Repositories Discovery (for connecting new repos)
# ============================================================

@router.get("/discovery/repos", response_model=list[GitHubRepo])
async def list_available_repos(provider: Optional[str] = Query(None, description="github or gitlab")):
    """
    List repositories accessible to the user on GitHub or GitLab.
    Used by the frontend to populate the 'Connect Repository' modal.
    """
    repos = await git_provider.list_repos(provider=provider)
    return repos


@router.get("/providers/status")
async def get_git_providers_status():
    """Check connectivity status of GitHub and GitLab providers."""
    return {
        "github": github_service.is_connected(),
        "gitlab": gitlab_service.is_connected(),
    }
