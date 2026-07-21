"""REQ-005：旧版本或错误 digest 可确认必须失败——version+digest 绑定、409 冲突。"""

from __future__ import annotations

import pytest

from src.contracts.mission_confirmation import MissionConfirmationConflict, confirm_mission


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


def test_router_returns_http_409_on_conflict() -> None:
    from fastapi.testclient import TestClient

    from web.main import app

    client = TestClient(app)

    draft_body = {
        "mission_contract_id": "mission-confirm-test-1",
        "task_id": "task-confirm-test-1",
        "revision": 1,
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "goal": {"user_intent": "test", "biggest_concern": "test"},
        "constraints": [],
        "prohibited_actions": [],
        "desired_outcome": {"required_artifacts": ["PDF"]},
        "content_digest": "0" * 64,
        "created_at": "2026-07-21T00:00:00+00:00",
    }
    draft_resp = client.post("/api/contracts/mission/draft", json=draft_body)
    assert draft_resp.status_code == 200

    confirm_resp = client.post(
        "/api/contracts/mission/mission-confirm-test-1/confirm",
        json={"revision": 999, "content_digest": "f" * 64},
    )
    assert confirm_resp.status_code == 409
