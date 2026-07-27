from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.contract_task_support import (
    seed_contract_task,
    seed_delivery,
    seed_exact_review,
    seed_final_memorial,
)


def _client(
    monkeypatch,
    isolated_session_local,
    tmp_path,
    *,
    user_id: int = 7,
    tenant_id: int = 7,
):
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
        tenant_slug=f"tenant-{tenant_id}",
        tenant_id=tenant_id,
    )
    return TestClient(app, raise_server_exceptions=False), app


def _seed_exact_review(db, task):
    return seed_exact_review(
        db,
        task_id=task.id,
        tenant_id=task.tenant_id,
    )


def _decision_state(db, task_id: str) -> dict[str, object]:
    from src.db.models import (
        CourtLoopRun,
        CourtReview,
        DecisionTask,
        DecreeExecutionEvent,
        EmperorDecision,
        FinalMemorial,
        OutboxEvent,
        ShiguanArchive,
    )

    def rows(model) -> tuple[tuple[object, ...], ...]:
        columns = tuple(column.name for column in model.__table__.columns)
        return tuple(
            tuple(getattr(row, column) for column in columns)
            for row in db.query(model)
            .filter_by(task_id=task_id)
            .order_by(model.id.asc())
            .all()
        )

    task = db.get(DecisionTask, task_id)
    task_columns = tuple(column.name for column in DecisionTask.__table__.columns)
    return {
        "task": (
            tuple(getattr(task, column) for column in task_columns)
            if task is not None
            else None
        ),
        "finals": rows(FinalMemorial),
        "decisions": rows(EmperorDecision),
        "archives": rows(ShiguanArchive),
        "reviews": rows(CourtReview),
        "loops": rows(CourtLoopRun),
        "outbox": rows(OutboxEvent),
        "decree_events": rows(DecreeExecutionEvent),
    }


def test_read_model_endpoint_is_typed_in_openapi() -> None:
    from web.main import app

    document = app.openapi()
    operation = document["paths"][
        "/api/contracts/tasks/{task_id}/read-model"
    ]["get"]
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]

    assert "ContractTaskReadModelV1" in schema["$ref"]
    read_model_schema = document["components"]["schemas"]["ContractTaskReadModelV1"]
    bound_pack_ref = read_model_schema["properties"]["review_pack"]["anyOf"][0]["$ref"]
    assert bound_pack_ref.endswith("/MissionBoundContractReviewPackV1")
    bound_pack_schema = document["components"]["schemas"][
        "MissionBoundContractReviewPackV1"
    ]
    assert {
        "mission_revision",
        "mission_content_digest",
    } <= set(bound_pack_schema["required"])


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
        final, _ = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        _seed_exact_review(db, task)
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

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
        assert _decision_state(db, task_id) == before


def test_contract_recheck_requires_server_refresh_review_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = "task-api-recheck-gate"
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
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": "recheck",
                "reason": "server 未开放复审动作时不得改变 review 状态",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "REFRESH_REVIEW" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_swarm_deepen_requires_server_refresh_review_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = "task-api-swarm-deepen-gate"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        task.status = "task_cancelled"
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/swarm-deepen"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "REFRESH_REVIEW" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_edict_return_is_not_authorized_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = "task-api-edict-return-gate"
    with isolated_session_local() as db:
        seed_contract_task(db, task_id=task_id)
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            "/api/shangshufang/edict-return",
            json={"taskId": task_id, "command": "legacy write"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "not authorized for contract tasks" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


@pytest.mark.parametrize("action", ["request_evidence", "followup"])
def test_contract_evidence_action_requires_server_decide_before_any_write(
    action,
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = f"task-api-evidence-gate-{action}"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, _ = seed_final_memorial(db, task_id=task.id)
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": action,
                "reason": "服务端未开放 DECIDE 时不得退回补证",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "DECIDE" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_cancel_is_not_authorized_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = "task-api-cancel-gate"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        seed_final_memorial(db, task_id=task.id)
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": "cancel",
                "reason": "合同任务没有服务端 cancel authority",
                "human_confirmed": True,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "not authorized" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


@pytest.mark.parametrize(
    "action",
    [
        "adopt",
        "approve",
        "archive",
        "reject",
        "request_evidence",
        "followup",
        "recheck",
        "cancel",
    ],
)
def test_scope_only_contract_task_cannot_bypass_server_actions(
    action,
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview, DecisionTask
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = f"task-api-scope-only-{action}"
    with isolated_session_local() as db:
        task = DecisionTask(
            id=task_id,
            tenant_id=7,
            user_id="7",
            raw_question="仅有 legacy contract_scope 的合同任务",
            status="awaiting_decision",
            source_label="LIVE",
            contract_scope_json='{"schema_version":"ContractIntakeV1"}',
        )
        review = CourtReview(
            id=f"review-{task_id}",
            tenant_id=7,
            task_id=task_id,
            review_status="awaiting_decision",
        )
        db.add_all([task, review])
        db.commit()
        before = _decision_state(db, task_id)

        with pytest.raises(ValueError, match="not allowed|not authorized"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=review,
                action=action,
                reason="scope-only task 必须服从 server allowed_actions",
                human_confirmed=True,
                expected_content_hash=None,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_brief_decision_requires_server_decide_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview

    task_id = "task-api-brief-gate"
    review_id = f"review-{task_id}"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, _ = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=task.tenant_id,
                task_id=task.id,
                review_status="awaiting_decision",
            )
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/briefs/{review_id}/decision/advance",
            json={
                "decision": "issue_decree",
                "reason": "brief 入口不得绕过交付门",
                "manualConfirmation": True,
                "expectedFinalMemorialContentHash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "DECIDE" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_brief_decision_requires_tenant_and_user_ownership(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview

    task_id = "task-api-brief-other-tenant"
    review_id = f"review-{task_id}"
    with isolated_session_local() as db:
        task = seed_contract_task(
            db,
            task_id=task_id,
            tenant_id=8,
            user_id="7",
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=task.tenant_id,
                task_id=task.id,
                review_status="awaiting_decision",
            )
        )
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(
        monkeypatch,
        isolated_session_local,
        tmp_path,
        user_id=7,
        tenant_id=7,
    )
    try:
        response = client.post(
            f"/api/shangshufang/briefs/{review_id}/decision/advance",
            json={
                "decision": "issue_decree",
                "reason": "跨租户不得裁决",
                "manualConfirmation": True,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


@pytest.mark.parametrize(
    ("task_user_id", "task_tenant_id"),
    [
        ("another-user", 7),
        ("7", 8),
    ],
)
def test_contract_task_decision_requires_user_and_tenant_ownership(
    task_user_id,
    task_tenant_id,
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    task_id = f"task-api-owner-{task_user_id}-{task_tenant_id}"
    with isolated_session_local() as db:
        task = seed_contract_task(
            db,
            task_id=task_id,
            user_id=task_user_id,
            tenant_id=task_tenant_id,
        )
        final, _ = seed_final_memorial(
            db,
            task_id=task.id,
            tenant_id=task_tenant_id,
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(
        monkeypatch,
        isolated_session_local,
        tmp_path,
        user_id=7,
        tenant_id=7,
    )
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": "approve",
                "reason": "任务必须同时匹配 user 与 tenant",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_contract_brief_decision_rejects_cross_tenant_review_before_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-brief-cross-tenant-review"
    review_id = f"review-{task_id}"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, pack = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        seed_delivery(
            db,
            storage_root=tmp_path / "artifacts",
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.add(
            CourtReview(
                id=review_id,
                tenant_id=8,
                task_id=task.id,
                review_status="awaiting_decision",
            )
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/briefs/{review_id}/decision/advance",
            json={
                "decision": "issue_decree",
                "reason": "跨租户 review 不得进入共享 writer",
                "manualConfirmation": True,
                "expectedFinalMemorialContentHash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_legacy_memorial_caller_rejects_missing_exact_persisted_review(
    monkeypatch,
    isolated_session_local,
) -> None:
    import importlib
    from types import SimpleNamespace

    from src.db.models import DecisionTask
    from web.routers import chaotang as chaotang_router
    from web.schemas.auth import CurrentUser
    from web.schemas.chaotang import ReviewRequest

    task_id = "task-api-legacy-review-required"
    run_id = f"swarm-{task_id}"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        db.commit()
        before = _decision_state(db, task_id)

    monkeypatch.setattr(
        chaotang_router,
        "_observe_legacy_endpoint",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        chaotang_router,
        "load_run",
        lambda _run_id: SimpleNamespace(
            final_output={},
            task_input="审查采购合同",
        ),
    )
    monkeypatch.setattr(
        chaotang_router,
        "resolve_memorial_task_id",
        lambda _db, *, memorial_id: (task_id, None),
    )
    monkeypatch.setattr(
        chaotang_router,
        "get_owned_decision_task",
        lambda db, *, task_id, requester_id, requester_tenant_id: (
            db.get(DecisionTask, task_id),
            None,
        ),
    )
    db_engine_module = importlib.import_module("src.db.engine")
    monkeypatch.setattr(db_engine_module, "SessionLocal", isolated_session_local)

    response = chaotang_router.memorial_review(
        run_id,
        ReviewRequest(action="approve", comment="缺 review 不得裁决"),
        CurrentUser(
            user_id=7,
            username="user-7",
            role="user",
            tenant_slug="tenant-7",
            tenant_id=7,
        ),
    )

    assert response.status_code == 409
    assert "lineage" in response.body.decode("utf-8")
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_shared_writer_rejects_review_outside_exact_final_lineage(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-review-lineage-gate"
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
        unrelated_review = CourtReview(
            id=f"review-unrelated-{task_id}",
            tenant_id=task.tenant_id,
            task_id=task.id,
            review_status="awaiting_decision",
        )
        db.add(unrelated_review)
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

        with pytest.raises(ValueError, match="lineage"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=unrelated_review,
                action="approve",
                reason="不得修改非 exact final 的 review",
                human_confirmed=True,
                expected_content_hash=content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_shared_writer_requires_exact_review_to_exist(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-review-required"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, pack = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        seed_delivery(
            db,
            storage_root=tmp_path / "artifacts",
            task_id=task.id,
            final=final,
            pack=pack,
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

        with pytest.raises(ValueError, match="lineage"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=None,
                action="approve",
                reason="合同裁决必须绑定真实 CourtReview",
                human_confirmed=True,
                expected_content_hash=content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_shared_writer_rejects_transient_exact_review_before_any_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import CourtReview
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-transient-review"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, pack = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        seed_delivery(
            db,
            storage_root=tmp_path / "artifacts",
            task_id=task.id,
            final=final,
            pack=pack,
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)
        transient_review = CourtReview(
            id=final.review_id,
            tenant_id=task.tenant_id,
            task_id=task.id,
            review_status="awaiting_decision",
        )

        with pytest.raises(ValueError, match="persisted|lineage"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=transient_review,
                action="approve",
                reason="调用方对象不能替代持久化 CourtReview",
                human_confirmed=True,
                expected_content_hash=content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_cross_tenant_final_fails_before_evidence_lock_or_write(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-cross-tenant-final"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        final, _ = seed_final_memorial(
            db,
            task_id=task.id,
            tenant_id=8,
            seed_review=False,
        )
        review = seed_exact_review(
            db,
            task_id=task.id,
            tenant_id=task.tenant_id,
            review_id=final.review_id,
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

        def unexpected_lock(*_args, **_kwargs):
            raise AssertionError("evidence lock reached before ownership validation")

        monkeypatch.setattr(
            "src.execution.decree_dispatcher.lock_evidence_rework_task",
            unexpected_lock,
        )
        with pytest.raises(ValueError, match="ownership|lineage"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=review,
                action="request_evidence",
                reason="跨租户 final 不得触发补证写链",
                human_confirmed=True,
                expected_content_hash=content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_decision_state_snapshot_captures_all_decision_ledgers(
    isolated_session_local,
) -> None:
    from src.db.models import (
        CourtLoopRun,
        CourtReview,
        DecreeExecutionEvent,
        OutboxEvent,
    )

    task_id = "task-api-zero-write-snapshot"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        review = CourtReview(
            id=f"review-{task_id}",
            tenant_id=task.tenant_id,
            task_id=task.id,
            review_status="awaiting_decision",
        )
        loop = CourtLoopRun(
            id=f"loop-{task_id}",
            task_id=task.id,
            loop_id="decision",
            status="awaiting_decision",
            input_json="{}",
            output_json=None,
        )
        outbox = OutboxEvent(
            id=f"outbox-{task_id}",
            tenant_id=task.tenant_id,
            task_id=task.id,
            decision_id=f"decision-{task_id}",
            event_type="decision.test",
            status="pending",
        )
        decree_event = DecreeExecutionEvent(
            id=f"event-{task_id}",
            tenant_id=task.tenant_id,
            task_id=task.id,
            stage="decision",
            actor="test",
            message="before",
            source_label="LIVE",
        )
        db.add_all([review, loop, outbox, decree_event])
        db.commit()
        before = _decision_state(db, task_id)

        review.review_status = "archived"
        review.updated_at = "2026-07-27T01:00:00Z"
        loop.status = "completed"
        loop.output_json = '{"mutated":true}'
        loop.updated_at = "2026-07-27T01:00:00Z"
        outbox.status = "completed"
        outbox.updated_at = "2026-07-27T01:00:00Z"
        decree_event.message = "after"
        db.flush()

        assert _decision_state(db, task_id) != before


def test_pack_only_contract_candidate_is_blocked_at_shared_writer(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from src.db.models import DecisionTask
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-pack-only-writer-gate"
    with isolated_session_local() as db:
        task = DecisionTask(
            id=task_id,
            tenant_id=7,
            user_id="7",
            raw_question="pack-only 合同任务",
            refined_edict="不得绕过统一裁决门",
            status="reviewing",
            source_label="LIVE",
        )
        db.add(task)
        db.flush()
        final, _ = seed_final_memorial(db, task_id=task_id)
        review = _seed_exact_review(db, task)
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

        with pytest.raises(ValueError, match="DECIDE"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=review,
                action="approve",
                reason="pack-only 不得走 legacy 写入口",
                human_confirmed=True,
                expected_content_hash=content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


@pytest.mark.parametrize(
    ("case_id", "malformed_payload"),
    [
        ("truncated_marker", '{"contract_review":'),
        ("single_quote_marker", "{'contract_review':"),
        ("unicode_escaped_marker", r'{"\u0063ontract_review":'),
        ("generic_truncated_object", "{"),
    ],
)
def test_malformed_pack_marker_cannot_downgrade_to_legacy_writer(
    monkeypatch,
    isolated_session_local,
    tmp_path,
    case_id,
    malformed_payload,
) -> None:
    import hashlib

    from src.db.models import CourtReview, DecisionTask, FinalMemorial
    from web.routers.shangshufang import _execute_final_memorial_decision

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = f"task-api-malformed-pack-writer-gate-{case_id}"
    with isolated_session_local() as db:
        task = DecisionTask(
            id=task_id,
            tenant_id=7,
            user_id="7",
            raw_question="malformed pack-only 合同任务",
            status="awaiting_decision",
            source_label="LIVE",
        )
        review = CourtReview(
            id=f"review-{task_id}",
            tenant_id=7,
            task_id=task_id,
            review_status="awaiting_decision",
        )
        final = FinalMemorial(
            id=f"final-{task_id}",
            tenant_id=7,
            task_id=task_id,
            review_id=review.id,
            swarm_run_id=f"swarm-{task_id}",
            quality_result_id=f"quality-{task_id}",
            status="ready_for_decision",
            source_label="LIVE",
            memorial_json=malformed_payload,
            content_hash=hashlib.sha256(
                malformed_payload.encode("utf-8")
            ).hexdigest(),
            version=1,
            is_current=True,
        )
        db.add_all([task, review, final])
        db.commit()
        before = _decision_state(db, task_id)

        with pytest.raises(ValueError, match="DECIDE|lineage|contract"):
            _execute_final_memorial_decision(
                db,
                task=task,
                review=review,
                action="approve",
                reason="malformed pack 不得降级为 legacy",
                human_confirmed=True,
                expected_content_hash=final.content_hash,
                actor_user_id="7",
            )
        db.rollback()

    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


def test_revise_verdict_cannot_be_approved_and_archived(
    monkeypatch,
    isolated_session_local,
    tmp_path,
) -> None:
    from tests.contract_task_support import contract_review_pack

    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    task_id = "task-api-revise-verdict"
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id=task_id)
        pack = contract_review_pack(
            task.id,
            verdict="REVISE_BEFORE_PROCEED",
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        _seed_exact_review(db, task)
        seed_delivery(
            db,
            storage_root=tmp_path / "artifacts",
            task_id=task.id,
            final=final,
            pack=pack,
        )
        content_hash = final.content_hash
        db.commit()
        before = _decision_state(db, task_id)

    client, app = _client(monkeypatch, isolated_session_local, tmp_path)
    try:
        response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": "approve",
                "reason": "修订前不得批准",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "DECIDE" in response.json()["error"]
    with isolated_session_local() as db:
        assert _decision_state(db, task_id) == before


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
        _seed_exact_review(db, task)
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
