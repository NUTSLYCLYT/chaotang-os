"""HTTP contract tests for local user authentication."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth import configure_auth_db
from app.main import app


@pytest.fixture
def client(tmp_path):
    """Use one isolated authentication database for each HTTP test."""

    configure_auth_db(tmp_path / "auth.sqlite3")
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        configure_auth_db(None)


def test_register_login_me_and_logout(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={"username": "court", "email": "Court@Example.com", "password": "six-or-more"},
    )

    assert registration.status_code == 201
    assert registration.json()["user"] == {
        "id": registration.json()["user"]["id"],
        "username": "court",
        "email": "court@example.com",
    }
    session_id = registration.json()["session_id"]
    headers = {"Authorization": f"Bearer {session_id}"}

    username_login = client.post(
        "/api/v1/auth/login", json={"identifier": "court", "password": "six-or-more"}
    )
    assert username_login.status_code == 200
    email_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "COURT@EXAMPLE.COM", "password": "six-or-more"},
    )
    assert email_login.status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_login_does_not_distinguish_unknown_account_from_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "court", "email": "court@example.com", "password": "six-or-more"},
    )

    unknown = client.post(
        "/api/v1/auth/login", json={"identifier": "missing", "password": "six-or-more"}
    )
    wrong = client.post(
        "/api/v1/auth/login", json={"identifier": "court", "password": "wrong-pass"}
    )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json() == {"message": "invalid credentials"}


def test_rejects_unrecognized_fields_and_malformed_bearer_credentials(client):
    invalid_request = client.post(
        "/api/v1/auth/register",
        json={
            "username": "court",
            "email": "court@example.com",
            "password": "six-or-more",
            "session_id": "not-accepted",
        },
    )

    assert invalid_request.status_code == 422
    missing = client.get("/api/v1/auth/me")
    malformed = client.get("/api/v1/auth/me", headers={"Authorization": "Basic session"})
    assert missing.status_code == malformed.status_code == 401
    assert missing.json() == malformed.json() == {"message": "invalid credentials"}


def test_public_health_and_protected_route_source_contract():
    """Keep the public health exception and every current owner boundary explicit."""

    backend_root = Path(__file__).resolve().parents[1]
    main_source = (backend_root / "app" / "main.py").read_text(encoding="utf-8")
    decrees_source = (backend_root / "app" / "api" / "decrees.py").read_text(encoding="utf-8")
    shiguan_source = (backend_root / "app" / "api" / "shiguan.py").read_text(encoding="utf-8")

    assert '@app.get("/health", response_model=HealthResponse)' in main_source
    health_block = main_source.split("def health", 1)[1].split("app.include_router", 1)[0]
    assert "CurrentUser" not in health_block
    assert "from app.api.auth import CurrentUser" in decrees_source
    assert "from app.api.auth import CurrentUser" in shiguan_source
    assert "current_user: CurrentUser" in decrees_source
    for handler in (
        "create_archive",
        "get_archive",
        "list_archives",
        "update_review_status",
        "update_archive_decision",
        "get_statistics",
        "recall",
    ):
        handler_block = shiguan_source.split(f"def {handler}", 1)[1].split("\n\ndef ", 1)[0]
        assert "current_user: CurrentUser" in handler_block
