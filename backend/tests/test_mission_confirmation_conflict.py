"""REQ-005：旧版本或错误 digest 可确认必须失败——version+digest 绑定、409 冲突。"""

from __future__ import annotations

import pytest

from src.contracts.mission_confirmation import MissionConfirmationConflict, confirm_mission
from src.db.models import CourtLoopRun, DecisionTask


def _draft_body(task_id: str = "task-confirm-test-1") -> dict:
    return {
        "mission_contract_id": task_id,
        "task_id": task_id,
        "revision": 1,
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "goal": {"user_intent": "test", "biggest_concern": "test"},
        "constraints": [],
        "prohibited_actions": [],
        "desired_outcome": {"required_artifacts": ["PDF", "DOCX", "JSON"]},
        "assumptions": ["test input is complete"],
        "budget_limit_minor": 100000,
        "deadline_at": "2026-12-31T00:00:00+00:00",
        "read_scope": ["contract:source:v1"],
        "plan_digest": "a" * 64,
        "content_digest": "0" * 64,
        "created_at": "2026-07-21T00:00:00+00:00",
    }


def _seed_task(
    isolated_session_local,
    task_id: str = "task-confirm-test-1",
    *,
    user_id: str = "1",
) -> None:
    with isolated_session_local() as db:
        db.add(
            DecisionTask(
                id=task_id,
                tenant_id=1,
                user_id=user_id,
                raw_question="test contract",
                status="awaiting_emperor_confirm",
                source_label="LIVE",
            )
        )
        db.commit()


def test_matching_revision_and_digest_confirms_without_error() -> None:
    confirm_mission(
        stored_revision=1,
        stored_digest="a" * 64,
        requested_revision=1,
        requested_digest="a" * 64,
    )


def test_stale_revision_raises_conflict() -> None:
    with pytest.raises(MissionConfirmationConflict) as exc_info:
        confirm_mission(
            stored_revision=2,
            stored_digest="a" * 64,
            requested_revision=1,
            requested_digest="a" * 64,
        )
    assert exc_info.value.stored_revision == 2
    assert exc_info.value.requested_revision == 1


def test_mismatched_digest_raises_conflict_even_with_correct_revision() -> None:
    with pytest.raises(MissionConfirmationConflict) as exc_info:
        confirm_mission(
            stored_revision=1,
            stored_digest="a" * 64,
            requested_revision=1,
            requested_digest="b" * 64,
        )
    assert exc_info.value.stored_digest == "a" * 64
    assert exc_info.value.requested_digest == "b" * 64


def test_router_returns_http_409_on_conflict(isolated_session_local) -> None:
    from fastapi.testclient import TestClient

    from web.main import app

    _seed_task(isolated_session_local)
    client = TestClient(app)
    draft_resp = client.post("/api/contracts/mission/draft", json=_draft_body())
    assert draft_resp.status_code == 200

    confirm_resp = client.post(
        "/api/contracts/mission/task-confirm-test-1/confirm",
        json={"revision": 999, "content_digest": "f" * 64},
    )
    assert confirm_resp.status_code == 409


def test_router_confirms_from_persisted_snapshot_after_process_store_reset(
    isolated_session_local,
) -> None:
    from fastapi.testclient import TestClient

    from web.main import app
    from web.routers import contracts

    _seed_task(isolated_session_local)
    client = TestClient(app)
    draft_resp = client.post("/api/contracts/mission/draft", json=_draft_body())
    assert draft_resp.status_code == 200

    contracts._MISSION_DRAFT_STORE.clear()
    contracts._MISSION_LINEAGE_STORE.clear()
    confirm_resp = client.post(
        "/api/contracts/mission/task-confirm-test-1/confirm",
        json={
            "revision": 1,
            "content_digest": draft_resp.json()["content_digest"],
        },
    )

    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["mission_status"] == "CONFIRMED"
    with isolated_session_local() as db:
        assert (
            db.query(CourtLoopRun)
            .filter_by(
                task_id="task-confirm-test-1",
                loop_id="contract-mission-v1",
                status="confirmed",
            )
            .count()
            == 1
        )


def test_router_rejects_a_mission_id_that_is_not_the_task_id(
    isolated_session_local,
) -> None:
    from fastapi.testclient import TestClient

    from web.main import app

    _seed_task(isolated_session_local)
    body = _draft_body()
    body["mission_contract_id"] = "mission-other"
    response = TestClient(app).post("/api/contracts/mission/draft", json=body)

    assert response.status_code == 409


def test_router_hides_a_task_owned_by_another_user(isolated_session_local) -> None:
    from fastapi.testclient import TestClient

    from web.main import app

    _seed_task(isolated_session_local, user_id="another-user")
    response = TestClient(app).post(
        "/api/contracts/mission/draft",
        json=_draft_body(),
    )

    assert response.status_code == 404
