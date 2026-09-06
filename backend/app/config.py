"""
Nexora AI — Application Configuration

Loads settings from environment variables (.env file) using pydantic-settings.
All secrets (API keys, tokens) are kept in .env and never committed to Git.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application ---
    app_env: str = "development"
    app_title: str = "Nexora API"
    app_version: str = "0.1.0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Gemini API ---
    gemini_api_key: str = ""

    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_secret_key: str = ""
    supabase_publishable_key: str = ""

    # --- GitHub ---
    github_token: str = ""
    github_app_id: str = ""
    github_private_key: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    # --- GitLab ---
    gitlab_url: str = "https://gitlab.com"
    gitlab_token: str = ""
    default_git_provider: str = "github"

    # --- Agent ---
    max_debug_iterations: int = 3
    max_context_tokens: int = 6000  # Token budget per Gemini call (raise for paid tier)

    @property
    def effective_supabase_key(self) -> str:
        """Return the service role / secret key for backend database operations."""
        return self.supabase_service_role_key or self.supabase_secret_key or self.supabase_publishable_key

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


def get_settings() -> Settings:
    """Return settings loaded from .env file (always fresh)."""
    return Settings()
