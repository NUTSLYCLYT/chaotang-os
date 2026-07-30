from __future__ import annotations

from fastapi.testclient import TestClient

import app.api.decrees as decrees_api
from app.auth import configure_auth_db, create_session, create_user
from app.main import app


def test_decree_without_current_ready_draft_is_blocked_before_graph(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("gate-user", "gate@example.com", "six-or-more")
    calls = 0

    def provider():
        nonlocal calls
        calls += 1
        raise AssertionError("graph must not be built")

    monkeypatch.setattr(decrees_api, "get_chancellor_graph", provider)
    try:
        response = TestClient(app).post(
            "/api/v1/decrees/chancellor",
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
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
    assert calls == 0
