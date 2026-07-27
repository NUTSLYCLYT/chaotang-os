from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract_task_support import seed_contract_task


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
