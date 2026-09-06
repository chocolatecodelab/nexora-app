"""
Nexora AI — QA Test Suite: Authentication & Token Management Endpoints
Tests /api/auth/me, /api/auth/connect-token, /api/auth/disconnect, and edge-cases.
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_auth_status_endpoint():
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "github" in data
    assert "gitlab" in data
    assert "provider" in data["github"]
    assert "connected" in data["github"]
    assert "provider" in data["gitlab"]
    assert "connected" in data["gitlab"]


def test_connect_token_empty_fails():
    resp = client.post("/api/auth/connect-token", json={"provider": "github", "token": ""})
    assert resp.status_code == 400
    assert "cannot be empty" in resp.json()["detail"].lower()


def test_connect_token_unsupported_provider():
    resp = client.post("/api/auth/connect-token", json={"provider": "bitbucket", "token": "abc123456"})
    assert resp.status_code == 400
    assert "unsupported" in resp.json()["detail"].lower()


def test_disconnect_endpoint():
    resp = client.post("/api/auth/disconnect?provider=github")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "disconnected"
    assert data["provider"] == "github"
