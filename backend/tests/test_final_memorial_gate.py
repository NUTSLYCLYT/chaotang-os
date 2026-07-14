"""TDD contract for promoting a candidate review into one formal memorial."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from web.main import app


def _seed_candidate(
    db, *, task_id: str, source_label: str = "LIVE", user_id: str = "1"
):
    from src.db.models import CourtReview, DecisionTask

    review_id = f"review_{task_id}"
    db.add(
        DecisionTask(
            id=task_id,
            user_id=user_id,
            raw_question="请形成一份有证据、可裁决的正式奏折",
            status="awaiting_decision",
            source_label=source_label,
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="awaiting_decision",
            ministry_outputs_json='[{"department":"刑部","conclusion":"有条件通过"}]',
            conflict_summary_json="[]",
            memorial_json=json.dumps(
                {
                    "title": "合同会审正式奏折",
                    "summary": "证据充分，建议有条件通过。",
                    "recommendation": "adopt_with_conditions",
                },
                ensure_ascii=False,
            ),
            created_at="2026-07-14T00:00:00+00:00",
            updated_at="2026-07-14T00:00:00+00:00",
        )
    )
    db.commit()
    return review_id


def _swarm_result(
    *, task_id: str, review_id: str, source_label: str, passed: bool = True
):
    run_id = f"run_{task_id}"
    return {
        "swarm_run": {
            "id": run_id,
            "task_id": task_id,
            "review_id": review_id,
            "source_label": source_label,
        },
        "quality_result": {
            "id": f"quality_{task_id}",
            "passed": passed,
            "blocking_reasons": [] if passed else ["missing_required_evidence"],
            "warnings": [],
        },
    }


def test_live_quality_passed_candidate_is_formalized_once(isolated_session_local):
    from src.db.models import FinalMemorial
    from src.formal_memorial import formalize_memorial

    db = isolated_session_local()
    task_id = "task_formal_live"
    review_id = _seed_candidate(db, task_id=task_id)
    result = _swarm_result(
        task_id=task_id, review_id=review_id, source_label="LIVE_SWARM"
    )

    first = formalize_memorial(
        db, task_id=task_id, review_id=review_id, swarm_result=result
    )
    db.commit()
    replay = formalize_memorial(
        db, task_id=task_id, review_id=review_id, swarm_result=result
    )
    db.commit()

    assert replay.id == first.id
    assert db.query(FinalMemorial).filter_by(task_id=task_id).count() == 1
    stored = db.query(FinalMemorial).filter_by(task_id=task_id).one()
    assert stored.status == "ready_for_decision"
    assert stored.source_label == "LIVE_SWARM"
    assert stored.swarm_run_id == result["swarm_run"]["id"]
    assert json.loads(stored.memorial_json)["recommendation"] == "adopt_with_conditions"
    status_response = TestClient(app).get(
        f"/api/shangshufang/tasks/{task_id}/status"
    ).json()
    assert status_response["success"] is True, status_response
    status_payload = status_response["data"]
    assert status_payload["formal_memorial"]["id"] == stored.id
    assert status_payload["formal_memorial"]["status"] == "ready_for_decision"
    assert status_payload["formal_memorial"]["source_label"] == "LIVE_SWARM"
    home_payload = TestClient(app).get("/api/shangshufang/home").json()["data"]
    summary = next(
        item for item in home_payload["pending_decisions"] if item["task_id"] == task_id
    )
    assert summary["latest_memorial"]["source_label"] == "LIVE_SWARM"
    assert summary["latest_memorial"]["formal_memorial_id"] == stored.id
    db.close()


@pytest.mark.parametrize(
    ("source_label", "passed", "reason"),
    [
        ("LIVE", False, "quality_gate_failed"),
        ("FALLBACK", True, "non_adjudicable_source:FALLBACK"),
        ("DEMO", True, "non_adjudicable_source:DEMO"),
    ],
)
def test_failed_quality_or_synthetic_source_never_creates_formal_memorial(
    isolated_session_local, source_label, passed, reason
):
    from src.db.models import FinalMemorial
    from src.formal_memorial import FormalMemorialBlocked, formalize_memorial

    db = isolated_session_local()
    task_id = f"task_blocked_{source_label.lower()}_{str(passed).lower()}"
    review_id = _seed_candidate(db, task_id=task_id)
    result = _swarm_result(
        task_id=task_id,
        review_id=review_id,
        source_label=source_label,
        passed=passed,
    )

    with pytest.raises(FormalMemorialBlocked, match=reason):
        formalize_memorial(
            db, task_id=task_id, review_id=review_id, swarm_result=result
        )

    assert db.query(FinalMemorial).filter_by(task_id=task_id).count() == 0
    db.close()


def test_adopt_fails_closed_without_formal_memorial_and_archives_formal_snapshot(
    isolated_session_local,
):
    from src.db.models import DecreeExecutionEvent, EmperorDecision, ShiguanArchive
    from src.formal_memorial import formalize_memorial

    db = isolated_session_local()
    task_id = "task_decision_requires_formal"
    review_id = _seed_candidate(db, task_id=task_id)
    db.close()
    client = TestClient(app)

    blocked = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "adopt", "reason": "同意", "human_confirmed": True},
    )
    assert blocked.json()["success"] is False
    assert "正式奏折" in blocked.json()["error"]

    db = isolated_session_local()
    assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 0
    formalize_memorial(
        db,
        task_id=task_id,
        review_id=review_id,
        swarm_result=_swarm_result(
            task_id=task_id,
            review_id=review_id,
            source_label="LIVE_SWARM",
        ),
    )
    db.commit()
    db.close()

    unconfirmed = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "adopt", "reason": "尚未签字", "human_confirmed": False},
    )
    assert unconfirmed.json()["success"] is False
    assert "人工确认" in unconfirmed.json()["error"]
    db = isolated_session_local()
    assert db.query(EmperorDecision).filter_by(task_id=task_id).count() == 0
    db.close()

    adopted = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={"action": "adopt", "reason": "证据充分，同意", "human_confirmed": True},
    )
    assert adopted.json()["success"] is True
    assert adopted.json()["data"]["status"] == "archived"

    db = isolated_session_local()
    archive = db.query(ShiguanArchive).filter_by(task_id=task_id).one()
    assert archive.source_label == "LIVE_SWARM"
    assert json.loads(archive.final_memorial_json)["recommendation"] == "adopt_with_conditions"
    decision_event = (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id, event_type="decision.adopted")
        .one()
    )
    decision_payload = json.loads(decision_event.payload_json)
    assert decision_payload["formal_memorial_id"]
    assert decision_payload["archive_id"] == archive.id
    db.close()


@pytest.mark.parametrize(
    ("swarm_source", "expected_status", "expected_event", "formal_count"),
    [
        ("LIVE_SWARM", "awaiting_decision", "memorial.formalized", 1),
        ("FALLBACK", "awaiting_evidence", "memorial.blocked", 0),
    ],
)
def test_worker_uses_effective_quality_and_source_gate_before_formalizing(
    isolated_session_local,
    swarm_source,
    expected_status,
    expected_event,
    formal_count,
):
    from src.db.models import (
        CourtReview,
        DecisionTask,
        DecreeExecutionEvent,
        FinalMemorial,
    )
    from src.execution.decree_dispatcher import enqueue_dispatch
    from src.execution.outbox_worker import process_event

    db = isolated_session_local()
    task_id = f"task_worker_formal_{swarm_source.lower()}"
    review_id = _seed_candidate(db, task_id=task_id)
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    task.status = "edict_recorded"
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id=f"decision_{task_id}",
        event_type="route.council",
    )
    db.commit()
    result = _swarm_result(
        task_id=task_id,
        review_id=review_id,
        source_label=swarm_source,
    )
    result["swarm_run"]["route_plan"] = {"selected_swarms": []}

    def attach_candidate(session, target_review_id, _result):
        review = session.query(CourtReview).filter_by(id=target_review_id).one()
        review.review_status = "awaiting_decision"
        review.memorial_json = json.dumps(
            {
                "title": "军机处正式候选奏折",
                "summary": "各部已经完成证据回奏。",
                "recommendation": "adopt_with_conditions",
            },
            ensure_ascii=False,
        )

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop", return_value=result
    ), patch("src.swarm_persistence.persist_swarm_execution_result"), patch(
        "src.swarm_persistence.attach_swarm_result_to_review",
        side_effect=attach_candidate,
    ):
        processed = process_event(db, event_id)

    assert processed["status"] == "completed"
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == expected_status
    assert db.query(FinalMemorial).filter_by(task_id=task_id).count() == formal_count
    event_types = [
        row.event_type
        for row in db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id)
        .order_by(DecreeExecutionEvent.sequence)
        .all()
    ]
    assert expected_event in event_types
    assert ("quality.passed" in event_types) is (formal_count == 1)
    assert ("quality.blocked" in event_types) is (formal_count == 0)
    db.close()


def test_legacy_database_self_heals_missing_final_memorial_table(tmp_path):
    from src.db.models import CourtReview, DecisionTask, FinalMemorial
    from src.formal_memorial import formalize_memorial

    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-final-memorial.db'}")
    DecisionTask.__table__.create(engine)
    CourtReview.__table__.create(engine)
    with Session(engine) as db:
        review_id = _seed_candidate(db, task_id="task_legacy_formal")
        formalize_memorial(
            db,
            task_id="task_legacy_formal",
            review_id=review_id,
            swarm_result=_swarm_result(
                task_id="task_legacy_formal",
                review_id=review_id,
                source_label="LIVE_SWARM",
            ),
        )
        db.commit()

        assert "final_memorials" in inspect(engine).get_table_names()
        assert db.query(FinalMemorial).filter_by(task_id="task_legacy_formal").count() == 1
    engine.dispose()
