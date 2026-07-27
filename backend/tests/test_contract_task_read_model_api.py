from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.contract_task_support import (
    seed_contract_task,
    seed_delivery,
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
    from src.db.models import CourtReview

    review = CourtReview(
        id=f"review-{task.id}",
        tenant_id=task.tenant_id,
        task_id=task.id,
        review_status="awaiting_decision",
    )
    db.add(review)
    db.flush()
    return review


def _decision_state(db, task_id: str) -> dict[str, object]:
    from src.db.models import (
        CourtLoopRun,
        CourtReview,
        DecisionTask,
        EmperorDecision,
        FinalMemorial,
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
    }


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
        final, _ = seed_final_memorial(db, task_id=task.id)
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
        final, pack = seed_final_memorial(db, task_id=task.id)
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


def test_decision_state_snapshot_captures_review_and_loop_mutations(
    isolated_session_local,
) -> None:
    from src.db.models import CourtLoopRun, CourtReview

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
        db.add_all([review, loop])
        db.commit()
        before = _decision_state(db, task_id)

        review.review_status = "archived"
        review.updated_at = "2026-07-27T01:00:00Z"
        loop.status = "completed"
        loop.output_json = '{"mutated":true}'
        loop.updated_at = "2026-07-27T01:00:00Z"
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
