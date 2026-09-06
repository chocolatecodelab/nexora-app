"""
Nexora AI — Git Provider Authentication & OAuth Router

Handles dynamic login, OAuth 2.0 flows, and secure token management for GitHub & GitLab.
Eliminates hardcoded API tokens by allowing runtime user-based authentication.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.models.schemas import AuthStatusResponse, ConnectedAccount, ConnectTokenRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory runtime token cache (allows updating token dynamically without restarting server)
_RUNTIME_TOKENS: dict[str, str] = {}
_RUNTIME_GITLAB_URL: Optional[str] = None


def get_active_github_token() -> Optional[str]:
    """Retrieve active GitHub token (strictly runtime user-provided token from login session)."""
    return _RUNTIME_TOKENS.get("github")


def get_active_gitlab_token() -> Optional[str]:
    """Retrieve active GitLab token (strictly runtime user-provided token from login session)."""
    return _RUNTIME_TOKENS.get("gitlab")


def get_active_gitlab_url() -> str:
    """Retrieve active GitLab instance URL."""
    if _RUNTIME_GITLAB_URL:
        return _RUNTIME_GITLAB_URL
    return get_settings().gitlab_url.rstrip("/")


@router.get("/me", response_model=AuthStatusResponse)
async def get_auth_status():
    """
    Get current authentication and profile status for GitHub and GitLab accounts.
    """
    gh_token = get_active_github_token()
    gl_token = get_active_gitlab_token()
    gl_url = get_active_gitlab_url()

    # 1. Check GitHub
    github_account = ConnectedAccount(provider="github", connected=False)
    if gh_token:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {gh_token}",
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "Nexora-AI-Agent/1.0",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    github_account = ConnectedAccount(
                        provider="github",
                        connected=True,
                        username=data.get("login"),
                        name=data.get("name") or data.get("login"),
                        avatar_url=data.get("avatar_url"),
                        url=data.get("html_url"),
                    )
        except Exception as exc:
            logger.warning("Failed to fetch GitHub user info: %s", exc)

    # 2. Check GitLab
    gitlab_account = ConnectedAccount(provider="gitlab", connected=False)
    if gl_token:
        try:
            api_url = f"{gl_url}/api/v4"
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    f"{api_url}/user",
                    headers={"PRIVATE-TOKEN": gl_token},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    gitlab_account = ConnectedAccount(
                        provider="gitlab",
                        connected=True,
                        username=data.get("username"),
                        name=data.get("name") or data.get("username"),
                        avatar_url=data.get("avatar_url"),
                        url=data.get("web_url"),
                    )
        except Exception as exc:
            logger.warning("Failed to fetch GitLab user info: %s", exc)

    return AuthStatusResponse(github=github_account, gitlab=gitlab_account)


@router.post("/connect-token", response_model=ConnectedAccount)
async def connect_token(body: ConnectTokenRequest):
    """
    Securely connect a GitHub PAT or GitLab PAT dynamically from the UI.
    Validates token before saving into runtime session memory.
    """
    provider = body.provider.lower()
    token = body.token.strip().strip('"').strip("'")

    if not token:
        raise HTTPException(status_code=400, detail="Token cannot be empty")

    if provider == "github":
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "Nexora-AI-Agent/1.0",
                    },
                )
                if resp.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid GitHub Personal Access Token")
                data = resp.json()
                _RUNTIME_TOKENS["github"] = token

                return ConnectedAccount(
                    provider="github",
                    connected=True,
                    username=data.get("login"),
                    name=data.get("name") or data.get("login"),
                    avatar_url=data.get("avatar_url"),
                    url=data.get("html_url"),
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"GitHub connection failed: {exc}")

    elif provider == "gitlab":
        gl_url = (body.gitlab_url or get_active_gitlab_url()).rstrip("/")
        global _RUNTIME_GITLAB_URL
        _RUNTIME_GITLAB_URL = gl_url

        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{gl_url}/api/v4/user",
                    headers={"PRIVATE-TOKEN": token},
                )
                if resp.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid GitLab Personal Access Token")
                data = resp.json()
                _RUNTIME_TOKENS["gitlab"] = token

                return ConnectedAccount(
                    provider="gitlab",
                    connected=True,
                    username=data.get("username"),
                    name=data.get("name") or data.get("username"),
                    avatar_url=data.get("avatar_url"),
                    url=data.get("web_url"),
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"GitLab connection failed: {exc}")

    else:
        raise HTTPException(status_code=400, detail="Unsupported git provider")


@router.post("/disconnect")
async def disconnect_provider(provider: str = Query(..., description="github or gitlab")):
    """
    Disconnect provider and remove token from active runtime session.
    """
    p = provider.lower()
    if p in _RUNTIME_TOKENS:
        del _RUNTIME_TOKENS[p]
    return {"status": "disconnected", "provider": p}
