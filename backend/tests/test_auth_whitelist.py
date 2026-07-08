from __future__ import annotations

from fastapi.testclient import TestClient

import web.deps as deps
from web.main import app


def test_root_whitelist_does_not_cover_all_api_paths():
    assert deps._is_whitelisted("/") is True
    assert deps._is_whitelisted("/api/health") is True
    assert deps._is_whitelisted("/api/auth/session") is True
    assert deps._is_whitelisted("/api/chaotang/throne/overview") is False
    assert deps._is_whitelisted("/api/runs") is False


def test_protected_chaotang_api_requires_token(monkeypatch):
    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    app.dependency_overrides.pop(deps.get_current_user, None)

    with TestClient(app) as client:
        response = client.get("/api/chaotang/throne/overview")

    assert response.status_code == 401
    assert response.json()["detail"] == "未登录，请先认证"
