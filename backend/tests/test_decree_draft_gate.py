from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.decrees as decrees_api
from app.api.auth import require_current_user
from app.api.decree_jobs import get_decree_job_store
from app.auth import configure_auth_db, create_session, create_user
from app.decree_jobs import DecreeJobStore


def test_decree_without_current_ready_draft_is_blocked_before_graph(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("gate-user", "gate@example.com", "six-or-more")
    effects: list[str] = []

    def provider():
        effects.append("graph")
        raise AssertionError("graph must not be built")

    monkeypatch.setattr(decrees_api, "get_chancellor_graph", provider)
    monkeypatch.setattr(
        decrees_api,
        "get_execution_chancellor_agent",
        lambda **_kwargs: effects.append("agent"),
        raising=False,
    )
    monkeypatch.setattr(
        decrees_api,
        "build_accounting_report_session",
        lambda **_kwargs: effects.append("report"),
    )
    monkeypatch.setattr(
        decrees_api,
        "_StorageCaseLifecycleObserver",
        lambda *_args: effects.append("observer"),
    )
    monkeypatch.setattr(
        decrees_api,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: effects.append("archive"),
    )
    app = FastAPI()
    app.include_router(decrees_api.router)
    decrees_api.register_chancellor_exception_handlers(app)
    app.dependency_overrides[require_current_user] = lambda: user
    app.dependency_overrides[get_decree_job_store] = lambda: DecreeJobStore(
        tmp_path / "jobs.sqlite3"
    )
    try:
        response = TestClient(app).post(
            "/api/v1/decrees/chancellor",
            headers={
                "Authorization": f"Bearer {create_session(user.id)}",
                "Idempotency-Key": "missing-draft",
            },
            json={
                "decree_text": "伪造草案",
                "draft_version": 1,
                "draft_fingerprint": "a" * 64,
            },
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 409
    assert response.json() == {
        "status": "error",
        "reason": "draft_not_current",
        "message": "拟旨草案已失效，请重新拟旨后再下旨",
    }
    assert effects == []
