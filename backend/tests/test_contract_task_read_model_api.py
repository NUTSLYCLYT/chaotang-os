from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.contract_task_support import (
    seed_contract_task,
    seed_delivery,
    seed_final_memorial,
)


def _client(monkeypatch, isolated_session_local, tmp_path, *, user_id: int = 7):
    from web import deps
    from web.main import app
    from web.routers import contracts as contracts_router
    from web.schemas.auth import CurrentUser

    monkeypatch.setattr(
        contracts_router,
        "get_contract_session_factory",
        lambda: isolated_session_local,
    )
    monkeypatch.setattr(
        contracts_router,
        "get_contract_storage_root",
        lambda: tmp_path,
    )
    app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=user_id,
        username=f"user-{user_id}",
        role="user",
        tenant_slug="tenant-7",
        tenant_id=7,
    )
    return TestClient(app, raise_server_exceptions=False), app


def test_read_model_endpoint_is_typed_in_openapi() -> None:
    from web.main import app

    document = app.openapi()
    operation = document["paths"][
        "/api/contracts/tasks/{task_id}/read-model"
    ]["get"]
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]

    assert "ContractTaskReadModelV1" in schema["$ref"]


def test_read_model_endpoint_returns_owned_task(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        seed_contract_task(db, task_id="task-api-owned")
        db.commit()

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.get(
            "/api/contracts/tasks/task-api-owned/read-model"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["task"]["task_id"] == "task-api-owned"


def test_read_model_endpoint_hides_another_users_task(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        seed_contract_task(
            db,
            task_id="task-api-other",
            user_id="another-user",
        )
        db.commit()

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.get(
            "/api/contracts/tasks/task-api-other/read-model"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


@pytest.mark.parametrize("action", ["adopt", "approve", "archive", "reject"])
def test_contract_final_decision_requires_server_decide_action_before_any_write(
    action,
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import EmperorDecision, ShiguanArchive

    task_id = f"task-api-gate-{action}"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, _ = seed_final_memorial(db, task_id=task.id)
        content_hash = final.content_hash
        db.commit()

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": action,
                "reason": "缺少交付物时不得形成正式裁决",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "DECIDE" in response.json()["error"]
    with isolated_session_local() as db:
        assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 0
        assert db.query(ShiguanArchive).filter_by(task_id=task_id).count() == 0


def test_contract_final_decision_preserves_ready_delivery_happy_path(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import EmperorDecision, ShiguanArchive

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-gate-ready"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path / "artifacts",
            task_id=task.id,
            final=final,
            pack=pack,
        )
        content_hash = final.content_hash
        db.commit()

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": "approve",
                "reason": "三件套可下载后形成正式裁决",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "archived"
    with isolated_session_local() as db:
        assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 1
        assert db.query(ShiguanArchive).filter_by(task_id=task_id).count() == 1
