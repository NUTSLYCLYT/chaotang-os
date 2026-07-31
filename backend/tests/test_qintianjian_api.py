from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import configure_auth_db
from app.main import app
from app.qintianjian import storage


@pytest.fixture
def client(tmp_path, monkeypatch):
    configure_auth_db(tmp_path / "auth.sqlite3")
    monkeypatch.setattr(storage, "_DEFAULT_DB_PATH", tmp_path / "qintian.sqlite3")
    try:
        with TestClient(app) as value:
            yield value
    finally:
        configure_auth_db(None)


def _register(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "six-or-more",
        },
    )
    return {"Authorization": f"Bearer {response.json()['session_id']}"}


def _payload(review_at: str | None = None) -> dict:
    return {
        "idempotency_key": "forecast-001",
        "subject": {
            "kind": "DRAFT",
            "id": "draft-1",
            "title": "开放试点",
            "content": "先做一城试点，再按信号复核。",
        },
        "question": "未来九十天是否适合扩大试点？",
        "evidence_refs": [
            {
                "id": "e-1",
                "summary": "试点转化率",
                "source": "用户提供",
                "as_of": "2026-07-30T00:00:00+00:00",
            }
        ],
        "review_at": review_at or "2026-08-30T00:00:00+00:00",
    }


def _provider_result() -> dict:
    return {
        "judgment": "先维持试点，不立即扩大。",
        "confidence": "MEDIUM",
        "confidence_basis": "仅有一条内部证据，仍需观察。",
        "scenarios": [
            {
                "kind": "OPTIMISTIC",
                "summary": "转化率稳定上升。",
                "impact": "具备扩大条件。",
                "time_window": "90 天",
                "counterfactual": "若成本同步上升则不扩大。",
                "probability_interval": {"lower": 0.55, "upper": 0.7},
            },
            {
                "kind": "BASELINE",
                "summary": "转化率保持当前区间。",
                "impact": "继续试点。",
                "time_window": "90 天",
                "counterfactual": "若转化率突破阈值则提前复核。",
                "probability_interval": None,
            },
            {
                "kind": "PESSIMISTIC",
                "summary": "成本上升且转化率下滑。",
                "impact": "停止扩大。",
                "time_window": "90 天",
                "counterfactual": "若成本回落则重新推演。",
                "probability_interval": {"lower": 0.1, "upper": 0.25},
            },
        ],
        "assumptions": [
            {"statement": "供给稳定", "critical": True},
            {"statement": "试点口径不变", "critical": False},
        ],
        "triggers": [
            {
                "signal": "转化率",
                "threshold": "连续两周低于 20%",
                "window": "14 天",
            }
        ],
        "human_signoff_required": True,
    }


def test_forecast_is_idempotent_owner_scoped_and_lists_pending_triggers(client, monkeypatch):
    from app.api import qintianjian as api

    calls = []
    monkeypatch.setattr(
        api,
        "get_forecast_provider",
        lambda: lambda payload: calls.append(payload) or _provider_result(),
    )
    owner = _register(client, "owner")
    other = _register(client, "other")

    first = client.post("/api/v1/qintianjian/forecasts", headers=owner, json=_payload())
    second = client.post("/api/v1/qintianjian/forecasts", headers=owner, json=_payload())

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(calls) == 1
    body = first.json()
    assert body["status"] == "COMPLETED"
    assert body["methodology_version"] == "qintianjian-v1"
    assert [item["kind"] for item in body["scenarios"]] == [
        "OPTIMISTIC",
        "BASELINE",
        "PESSIMISTIC",
    ]
    assert all(item["probability_interval"] is None for item in body["scenarios"])
    assert "不构成正式执行" in body["disclaimer"]

    own_list = client.get("/api/v1/qintianjian/forecasts", headers=owner)
    assert [item["id"] for item in own_list.json()["items"]] == [body["id"]]
    assert (
        client.get(f"/api/v1/qintianjian/forecasts/{body['id']}", headers=other).status_code == 404
    )
    pending = client.get("/api/v1/qintianjian/triggers/pending", headers=owner)
    assert pending.status_code == 200
    assert pending.json()["items"][0]["forecast_id"] == body["id"]


def test_review_is_append_only_and_does_not_mutate_forecast(client, monkeypatch):
    from app.api import qintianjian as api

    monkeypatch.setattr(api, "get_forecast_provider", lambda: lambda _: _provider_result())
    headers = _register(client, "reviewer")
    forecast = client.post("/api/v1/qintianjian/forecasts", headers=headers, json=_payload()).json()

    review = client.post(
        f"/api/v1/qintianjian/forecasts/{forecast['id']}/reviews",
        headers=headers,
        json={
            "trigger_id": forecast["triggers"][0]["id"],
            "decision": "INVALIDATE",
            "observation": "转化率连续两周低于 20%",
            "judgment_invalidated": True,
        },
    )

    assert review.status_code == 201
    assert review.json()["decision"] == "INVALIDATE"
    assert review.json()["judgment_invalidated"] is True
    unchanged = client.get(
        f"/api/v1/qintianjian/forecasts/{forecast['id']}", headers=headers
    ).json()
    assert unchanged["status"] == "COMPLETED"
    assert unchanged["reviews"][0]["id"] == review.json()["id"]
    assert unchanged["triggers"][0]["status"] == "REVIEWED"
    assert client.get("/api/v1/qintianjian/triggers/pending", headers=headers).json() == {
        "items": []
    }


def test_due_trigger_filter_and_authentication(client, monkeypatch):
    from app.api import qintianjian as api

    monkeypatch.setattr(api, "get_forecast_provider", lambda: lambda _: _provider_result())
    headers = _register(client, "due")
    due_at = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    client.post(
        "/api/v1/qintianjian/forecasts",
        headers=headers,
        json=_payload(review_at=due_at),
    )

    assert client.get("/api/v1/qintianjian/triggers/pending").status_code == 401
    pending = client.get("/api/v1/qintianjian/triggers/pending", headers=headers)
    assert len(pending.json()["items"]) == 1
    assert pending.json()["items"][0]["is_due"] is True
    assert pending.json()["items"][0]["subject"]["id"] == "draft-1"
    assert pending.json()["items"][0]["context_ref"] == {
        "kind": "DRAFT",
        "id": "draft-1",
    }


def test_provider_unavailability_is_sanitized_and_persists_nothing(client, monkeypatch):
    from app.api import qintianjian as api
    from app.qintianjian.provider import QintianProviderUnavailable

    def unavailable(_):
        raise QintianProviderUnavailable("secret prompt at https://provider.invalid")

    monkeypatch.setattr(api, "get_forecast_provider", lambda: unavailable)
    headers = _register(client, "offline")
    response = client.post("/api/v1/qintianjian/forecasts", headers=headers, json=_payload())

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "钦天监暂时无法完成推演，请稍后再试",
    }
    assert "provider.invalid" not in response.text
    assert client.get("/api/v1/qintianjian/forecasts", headers=headers).json() == {"items": []}


def test_consult_is_authenticated_non_persistent_and_sanitized(client, monkeypatch):
    from app.api import qintianjian as api
    from app.qintianjian.provider import QintianProviderUnavailable

    headers = _register(client, "consult")
    monkeypatch.setattr(api, "get_consult_provider", lambda: lambda _: "先看触发信号。")
    ok = client.post(
        "/api/v1/qintianjian/consult",
        headers=headers,
        json={"messages": [{"role": "user", "content": "现在该怎么看？"}]},
    )
    assert ok.json() == {
        "status": "ok",
        "consultant": "钦天监",
        "reply": "先看触发信号。",
    }
    assert client.get("/api/v1/qintianjian/forecasts", headers=headers).json() == {"items": []}

    monkeypatch.setattr(
        api,
        "get_consult_provider",
        lambda: lambda _: (_ for _ in ()).throw(QintianProviderUnavailable("secret")),
    )
    failed = client.post(
        "/api/v1/qintianjian/consult",
        headers=headers,
        json={"messages": [{"role": "user", "content": "再问一次"}]},
    )
    assert failed.status_code == 502
    assert failed.json()["reason"] == "model_unavailable"
    assert "secret" not in failed.text


def test_same_idempotency_key_with_different_payload_is_conflict(client, monkeypatch):
    from app.api import qintianjian as api

    calls = []
    monkeypatch.setattr(
        api,
        "get_forecast_provider",
        lambda: lambda payload: calls.append(payload) or _provider_result(),
    )
    headers = _register(client, "idempotent")
    assert (
        client.post("/api/v1/qintianjian/forecasts", headers=headers, json=_payload()).status_code
        == 201
    )
    changed = _payload()
    changed["question"] = "同一 key 的另一问题"

    conflict = client.post("/api/v1/qintianjian/forecasts", headers=headers, json=changed)

    assert conflict.status_code == 409
    assert conflict.json()["reason"] == "idempotency_conflict"
    assert len(calls) == 1


def test_reply_subject_uses_owner_scoped_server_snapshot(client, monkeypatch):
    from app.api import qintianjian as api
    from app.qintianjian.models import Subject

    captured = []
    monkeypatch.setattr(
        api,
        "resolve_reply_subject",
        lambda reference_id, owner_user_id: Subject(
            kind="REPLY",
            id=reference_id,
            title="史馆标题",
            content=f"史馆不可变正文:{owner_user_id}",
        ),
    )
    monkeypatch.setattr(
        api,
        "get_forecast_provider",
        lambda: lambda payload: captured.append(payload) or _provider_result(),
    )
    headers = _register(client, "reply-owner")
    payload = _payload()
    payload["subject"] = {
        "kind": "REPLY",
        "id": "reply-1",
        "title": "攻击者标题",
        "content": "攻击者伪造正文",
    }

    response = client.post("/api/v1/qintianjian/forecasts", headers=headers, json=payload)

    assert response.status_code == 201
    assert response.json()["subject"]["title"] == "史馆标题"
    assert "攻击者" not in str(captured)


def test_review_must_name_a_trigger_owned_by_the_forecast(client, monkeypatch):
    from app.api import qintianjian as api

    monkeypatch.setattr(api, "get_forecast_provider", lambda: lambda _: _provider_result())
    headers = _register(client, "trigger-review")
    forecast = client.post("/api/v1/qintianjian/forecasts", headers=headers, json=_payload()).json()

    response = client.post(
        f"/api/v1/qintianjian/forecasts/{forecast['id']}/reviews",
        headers=headers,
        json={
            "trigger_id": "unknown",
            "decision": "KEEP",
            "observation": "没有观察到变化",
            "judgment_invalidated": False,
        },
    )

    assert response.status_code == 404
    assert response.json()["reason"] == "trigger_not_found"
