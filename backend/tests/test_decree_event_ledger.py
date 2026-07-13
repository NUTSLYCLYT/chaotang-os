"""TDD contract for the official decree event ledger.

All tests use isolated SQLite databases. They must never touch data/fengqun.db.
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from src.chancellor.decree_status import (
    build_decree_execution_status,
    record_timeline_event,
)
from src.chancellor.routing_service import ChancellorRoutingService
from src.db.models import DecisionTask, DecreeExecutionEvent
from src.execution.decree_dispatcher import enqueue_dispatch
from src.execution.outbox_worker import process_event
from web.main import app


def test_structured_event_envelope_is_persisted_and_exposed_in_status(
    isolated_session_local,
):
    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="task_event_envelope",
            user_id="user_event",
            raw_question="请核查一份高风险合同",
            status="edict_recorded",
            source_label="LIVE",
        )
    )
    ChancellorRoutingService().decide(
        db,
        task_id="task_event_envelope",
        confirmed_edict_text="请核查合同付款、违约和对外承诺风险",
        idempotency_key="route-event-envelope",
        source_label="LIVE",
    )

    event_id = record_timeline_event(
        db,
        task_id="task_event_envelope",
        stage="chancellor_routing",
        actor="chancellor",
        message="丞相完成参审部门选择。",
        event_type="routing.decided",
        trace_id="trace_event_envelope",
        source_label="LIVE",
        payload={"decision_id": "route_event_envelope", "participants": ["刑部"]},
        idempotency_key="routing.decided:route_event_envelope",
    )
    db.commit()

    row = db.query(DecreeExecutionEvent).filter_by(id=event_id).one()
    assert row.event_type == "routing.decided"
    assert row.trace_id == "trace_event_envelope"
    assert row.source_label == "LIVE"
    assert json.loads(row.payload_json) == {
        "decision_id": "route_event_envelope",
        "participants": ["刑部"],
    }
    assert row.idempotency_key == "routing.decided:route_event_envelope"

    status = build_decree_execution_status(db, "task_event_envelope")
    assert status is not None
    event = status.timeline[-1]
    assert event.event_type == "routing.decided"
    assert event.trace_id == "trace_event_envelope"
    assert event.source_label == "LIVE"
    assert event.payload["participants"] == ["刑部"]
    db.close()


def test_same_event_idempotency_key_replays_once_and_changed_payload_fails_closed(
    isolated_session_local,
):
    db = isolated_session_local()
    common = {
        "task_id": "task_event_idempotent",
        "stage": "executing",
        "actor": "worker",
        "message": "军机处开始派单。",
        "event_type": "dispatch.started",
        "trace_id": "trace_event_idempotent",
        "source_label": "MIXED",
        "idempotency_key": "dispatch.started:review_1",
    }

    first_id = record_timeline_event(db, payload={"review_id": "review_1"}, **common)
    db.commit()
    replay_id = record_timeline_event(db, payload={"review_id": "review_1"}, **common)
    db.commit()

    assert replay_id == first_id
    assert (
        db.query(DecreeExecutionEvent)
        .filter_by(
            task_id="task_event_idempotent",
            idempotency_key="dispatch.started:review_1",
        )
        .count()
        == 1
    )

    with pytest.raises(ValueError, match="idempotency key already binds"):
        record_timeline_event(db, payload={"review_id": "different"}, **common)
    db.close()


def test_legacy_event_table_self_heals_structured_ledger_columns(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-events.db'}")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE decree_execution_events (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    message TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    sequence INTEGER NOT NULL DEFAULT 0
                )
                """
            )
        )

    with Session(engine) as db:
        record_timeline_event(
            db,
            task_id="task_legacy_event",
            stage="department_reporting",
            actor="worker",
            message="各部回奏完成。",
            event_type="reports.completed",
            trace_id="trace_legacy_event",
            source_label="FALLBACK",
            payload={"swarm_run_id": "run_legacy"},
            idempotency_key="reports.completed:run_legacy",
        )
        db.commit()

        columns = {
            row[1] for row in db.execute(text("PRAGMA table_info(decree_execution_events)"))
        }
        assert {
            "event_type",
            "trace_id",
            "source_label",
            "payload_json",
            "idempotency_key",
        }.issubset(columns)
        stored = db.execute(
            text(
                "SELECT event_type, trace_id, source_label, payload_json "
                "FROM decree_execution_events WHERE task_id='task_legacy_event'"
            )
        ).one()
        assert stored[0:3] == (
            "reports.completed",
            "trace_legacy_event",
            "FALLBACK",
        )
        assert json.loads(stored[3]) == {"swarm_run_id": "run_legacy"}

    engine.dispose()


@pytest.mark.parametrize(
    ("passed", "expected_task_status", "expected_quality_event"),
    [
        (True, "awaiting_decision", "quality.passed"),
        (False, "awaiting_evidence", "quality.blocked"),
    ],
)
def test_council_worker_records_dispatch_reports_and_quality_gate_events(
    isolated_session_local,
    passed,
    expected_task_status,
    expected_quality_event,
):
    from src.db.models import CourtReview

    db = isolated_session_local()
    now = "2026-07-14T00:00:00+00:00"
    task_id = f"task_quality_{str(passed).lower()}"
    review_id = f"review_quality_{str(passed).lower()}"
    run_id = f"run_quality_{str(passed).lower()}"
    db.add(
        DecisionTask(
            id=task_id,
            user_id="user_quality",
            raw_question="请形成一份可裁决奏折",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json=json.dumps({"recommended_departments": ["刑部"]}),
        )
    )
    db.add(
        CourtReview(
            id=review_id,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json="{}",
            created_at=now,
            updated_at=now,
        )
    )
    event_id = enqueue_dispatch(
        db,
        task_id=task_id,
        decision_id=f"decision_{task_id}",
        event_type="route.council",
    )
    db.commit()

    fake_result = {
        "swarm_run": {
            "id": run_id,
            "task_id": task_id,
            "review_id": review_id,
            "source_label": "LIVE_SWARM",
            "route_plan": {"selected_swarms": []},
        },
        "quality_result": {
            "id": f"quality_{task_id}",
            "passed": passed,
            "blocking_reasons": [] if passed else ["missing_required_evidence"],
            "warnings": [],
        },
    }

    def attach_candidate(session, target_review_id, _result):
        target = session.query(CourtReview).filter_by(id=target_review_id).one()
        target.memorial_json = json.dumps(
            {"title": "会审候选奏折", "summary": "各部回奏已经完成。"},
            ensure_ascii=False,
        )

    with patch(
        "src.swarm_execution_loop.run_swarm_execution_loop",
        return_value=fake_result,
    ), patch("src.swarm_persistence.persist_swarm_execution_result"), patch(
        "src.swarm_persistence.attach_swarm_result_to_review",
        side_effect=attach_candidate,
    ):
        result = process_event(db, event_id)

    assert result["status"] == "completed"
    assert db.query(DecisionTask).filter_by(id=task_id).one().status == expected_task_status
    rows = (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=task_id)
        .order_by(DecreeExecutionEvent.sequence)
        .all()
    )
    assert [row.event_type for row in rows] == [
        "dispatch.started",
        "reports.completed",
        expected_quality_event,
        "memorial.formalized" if passed else "memorial.blocked",
    ]
    assert all(row.trace_id == review_id for row in rows)
    assert all(row.source_label == "LIVE" for row in rows)
    assert json.loads(rows[1].payload_json)["swarm_run_id"] == run_id
    quality_payload = json.loads(rows[2].payload_json)
    assert quality_payload["passed"] is passed
    assert quality_payload["task_status"] == expected_task_status
    db.close()


def test_confirm_edict_records_chancellor_routing_event(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "这份股权对赌合同是否可以签字并对外承诺？"},
    ).json()["data"]

    with patch("web.routers.shangshufang.dispatch_after_commit"):
        confirmed = client.post(
            "/api/shangshufang/confirm-edict",
            json={
                "task_id": draft["task_id"],
                "confirmed": True,
                "idempotency_key": "confirm-routing-ledger",
            },
        ).json()["data"]

    db = isolated_session_local()
    rows = (
        db.query(DecreeExecutionEvent)
        .filter_by(task_id=draft["task_id"])
        .order_by(DecreeExecutionEvent.sequence)
        .all()
    )
    routing = next(row for row in rows if row.event_type == "routing.decided")
    payload = json.loads(routing.payload_json)
    assert routing.trace_id == confirmed["review_id"]
    assert routing.source_label == confirmed["route_decision"]["source_label"]
    assert payload["decision_id"] == confirmed["route_decision"]["decision_id"]
    assert payload["mode"] == "council"
    assert payload["participants"]
    db.close()
