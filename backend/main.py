"""
Nexora AI — FastAPI Application Entry Point

Main application setup with:
- CORS middleware (for Next.js frontend)
- Router registration (projects, tasks)
- Health check & service status endpoints
- Structured logging

Run with: uvicorn main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.schemas import HealthResponse, ServiceStatus
from app.routers import auth, evaluation, projects, tasks
from app.services import gemini_service, github_service, supabase_client

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nexora")


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("=" * 60)
    logger.info("  Nexora AI — Agent Engine starting")
    logger.info("  Environment : %s", settings.app_env)
    logger.info("  CORS Origins: %s", settings.cors_origin_list)
    logger.info("  Supabase    : %s", "configured" if settings.supabase_url else "NOT configured (using in-memory)")
    logger.info("  Gemini API  : %s", "configured" if settings.gemini_api_key else "NOT configured")
    logger.info("  GitHub Token: %s", "configured" if settings.github_token else "NOT configured")
    logger.info("=" * 60)
    yield
    logger.info("Nexora AI shutting down.")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
settings = get_settings()

app = FastAPI(
    title=settings.app_title,
    description="Nexora — AI Agentic Software Engineering Platform. "
                "From GitHub Issue to Pull Request.",
    version=settings.app_version,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(evaluation.router)
app.include_router(projects.router)
app.include_router(tasks.router)


# ---------------------------------------------------------------------------
# Root & Health Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to Nexora AI — Agent Engine",
        "docs_url": "/docs",
        "version": settings.app_version,
        "status": "online",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(
        status="ok",
        service="Nexora API",
        version=settings.app_version,
        environment=settings.app_env,
    )


@app.get("/status", response_model=ServiceStatus, tags=["Health"])
def service_status():
    """Check the connection status of all external services."""
    return ServiceStatus(
        supabase=supabase_client.is_connected(),
        gemini=gemini_service.is_connected(),
        github=github_service.is_connected(),
    )
