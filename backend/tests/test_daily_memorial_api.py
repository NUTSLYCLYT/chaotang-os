
"""Authenticated HTTP contract for daily memorial draft review and confirmation."""

from __future__ import annotations

from datetime import UTC

import pytest
from fastapi.testclient import TestClient

import app.api.daily_memorial_drafts as memorial_api
from app.auth import configure_auth_db, create_session, create_user
from app.daily_memorial_drafts.models import (
    ConfirmDailyMemorialResponse,
    RunStatus,
)
from app.main import app
from app.shiguan.errors import ShiguanStorageError

client = TestClient(app)
LATEST_URL = "/api/v1/daily-memorial-drafts/latest"
DRAFT_ID = "a" * 32
FINGERPRINT = "b" * 64


@pytest.fixture(autouse=True)
def _auth(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("daily-owner", "daily@example.test", "six-or-more")
    client.headers["Authorization"] = f"Bearer {create_session(user.id)}"
    yield user
    client.headers.pop("Authorization", None)
    configure_auth_db(None)


def test_routes_require_authentication_before_storage(monkeypatch):
    monkeypatch.setattr(
        memorial_api.storage,
        "get_latest_run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("storage called")),
    )
    client.headers.pop("Authorization")
    assert client.get(LATEST_URL).status_code == 401
    assert client.post(
        f"/api/v1/daily-memorial-drafts/{DRAFT_ID}/confirm",
        json={"version": 1, "fingerprint": FINGERPRINT},
    ).status_code == 401


def test_latest_passes_only_authenticated_owner_and_has_no_side_effect(_auth, monkeypatch):
    calls = []

    def latest(owner_user_id):
        calls.append(owner_user_id)
        return None

    monkeypatch.setattr(memorial_api.storage, "get_latest_run", latest)
    response = client.get(LATEST_URL)
    assert response.status_code == 200
    assert response.json() is None
    assert calls == [_auth.id]


def test_confirm_passes_authenticated_owner_and_server_time(_auth, monkeypatch):
    calls = []

    def confirm(draft_id, request, *, owner_user_id, now):
        calls.append((draft_id, request.version, request.fingerprint, owner_user_id, now))
        return ConfirmDailyMemorialResponse(
            status=RunStatus.CONFIRMED,
            draft_id=draft_id,
            memorial_id="c" * 32,
        )

    monkeypatch.setattr(memorial_api.storage, "confirm_draft", confirm)
    response = client.post(
        f"/api/v1/daily-memorial-drafts/{DRAFT_ID}/confirm",
        json={"version": 1, "fingerprint": FINGERPRINT},
    )
    assert response.status_code == 200
    assert response.json()["memorial_id"] == "c" * 32
    assert calls[0][:4] == (DRAFT_ID, 1, FINGERPRINT, _auth.id)
    assert calls[0][4].tzinfo is UTC


@pytest.mark.parametrize("unsafe_id", ["../secret", "A" * 32, "a" * 31, "a" * 33])
def test_unsafe_draft_id_is_rejected_before_storage(unsafe_id, monkeypatch):
    monkeypatch.setattr(
        memorial_api.storage,
        "confirm_draft",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("storage called")),
    )
    response = client.post(
        f"/api/v1/daily-memorial-drafts/{unsafe_id}/confirm",
        json={"version": 1, "fingerprint": FINGERPRINT},
    )
    assert response.status_code == 404


def test_missing_cross_owner_conflict_and_storage_errors_are_fixed_and_sanitized(monkeypatch):
    error_cases = [
        (memorial_api.storage.DailyMemorialNotFoundError("owner/db/path"), 404),
        (memorial_api.storage.DailyMemorialConflictError("content/fingerprint"), 409),
        (ShiguanStorageError("SQL session prompt secret"), 503),
    ]
    bodies = []
    for error, status in error_cases:
        monkeypatch.setattr(
            memorial_api.storage,
            "confirm_draft",
            lambda *_args, _error=error, **_kwargs: (_ for _ in ()).throw(_error),
        )
        response = client.post(
            f"/api/v1/daily-memorial-drafts/{DRAFT_ID}/confirm",
            json={"version": 1, "fingerprint": FINGERPRINT},
        )
        assert response.status_code == status
        bodies.append(response.text)
    joined = " ".join(bodies)
    secrets = ["owner", "path", "content", "SQL", "session", "prompt"]
    assert not any(secret in joined for secret in secrets)


def test_confirm_request_is_strict_and_lowercase_fingerprint_only(monkeypatch):
    monkeypatch.setattr(
        memorial_api.storage,
        "confirm_draft",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("storage called")),
    )
    for payload in [
        {"version": 0, "fingerprint": FINGERPRINT},
        {"version": 1, "fingerprint": FINGERPRINT.upper()},
        {"version": 1, "fingerprint": FINGERPRINT, "owner_user_id": "attacker"},
    ]:
        assert client.post(
            f"/api/v1/daily-memorial-drafts/{DRAFT_ID}/confirm", json=payload
        ).status_code == 422


def test_daily_storage_handler_does_not_override_shiguan_storage_handler():
    assert app.exception_handlers[ShiguanStorageError].__module__ == "app.api.shiguan"
    assert (
        app.exception_handlers[memorial_api.storage.DailyMemorialStorageError].__module__
        == "app.api.daily_memorial_drafts"
    )
