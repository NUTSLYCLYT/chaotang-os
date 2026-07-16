"""P2 telemetry is attached to canonical facts, not inferred at read time."""

from __future__ import annotations

import re

from src.observability import metrics_exporter


def _counter(stage: str) -> float:
    text = metrics_exporter.export()
    match = re.search(
        rf'^canonical_chain_events_total\{{stage="{stage}",status="completed"\}} ([0-9.]+)$',
        text,
        re.MULTILINE,
    )
    return float(match.group(1)) if match else 0.0


def test_decree_event_write_increments_canonical_counter(isolated_session_local):
    from src.chancellor.decree_status import record_timeline_event

    db = isolated_session_local()
    before = _counter("decree_execution_event_written")
    record_timeline_event(
        db,
        task_id="metric-event-task",
        stage="executing",
        actor="test",
        message="metric",
        source_label="LIVE",
    )
    assert _counter("decree_execution_event_written") == before
    db.commit()
    assert _counter("decree_execution_event_written") == before + 1
    db.close()


def test_outbox_completion_increments_only_on_real_consumption(isolated_session_local):
    from src.db.models import CourtReview, DecisionTask
    from src.execution.decree_dispatcher import enqueue_dispatch
    from src.execution.outbox_worker import process_event

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="metric-outbox-task",
            user_id="tester",
            raw_question="metric",
            status="edict_recorded",
            source_label="LIVE",
        )
    )
    db.add(
        CourtReview(
            id="metric-direct-review",
            task_id="metric-outbox-task",
            routing_plan_json='{"route":{"mode":"direct"}}',
            review_status="direct_completed",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"direct receipt"}',
            created_at="2026-07-16T00:00:00+00:00",
            updated_at="2026-07-16T00:00:00+00:00",
        )
    )
    db.commit()
    event_id = enqueue_dispatch(
        db,
        task_id="metric-outbox-task",
        decision_id="metric-decision",
        event_type="route.direct",
    )
    db.commit()

    before = _counter("outbox_consumed")
    assert process_event(db, event_id)["status"] == "completed"
    assert _counter("outbox_consumed") == before + 1
    assert process_event(db, event_id).get("skipped") is True
    assert _counter("outbox_consumed") == before + 1
    db.close()


def test_final_memorial_promotion_counts_once_on_idempotent_replay(
    isolated_session_local,
):
    from src.db.models import CourtReview
    from src.formal_memorial import formalize_memorial

    db = isolated_session_local()
    db.add(
        CourtReview(
            id="metric-review",
            task_id="metric-final-task",
            routing_plan_json="{}",
            review_status="complete",
            ministry_outputs_json="[]",
            conflict_summary_json="{}",
            memorial_json='{"title":"formal"}',
            created_at="2026-07-15T00:00:00+00:00",
            updated_at="2026-07-15T00:00:00+00:00",
        )
    )
    db.commit()
    result = {
        "swarm_run": {
            "id": "metric-swarm-run",
            "task_id": "metric-final-task",
            "review_id": "metric-review",
            "source_label": "LIVE_SWARM",
        },
        "quality_result": {"id": "metric-quality", "passed": True},
    }

    before = _counter("final_memorial_promoted")
    formalize_memorial(
        db,
        task_id="metric-final-task",
        review_id="metric-review",
        swarm_result=result,
    )
    assert _counter("final_memorial_promoted") == before
    db.commit()
    assert _counter("final_memorial_promoted") == before + 1
    formalize_memorial(
        db,
        task_id="metric-final-task",
        review_id="metric-review",
        swarm_result=result,
    )
    db.commit()
    assert _counter("final_memorial_promoted") == before + 1
    db.close()


def test_rolled_back_canonical_fact_is_not_counted(isolated_session_local):
    from src.chancellor.decree_status import record_timeline_event

    db = isolated_session_local()
    before = _counter("decree_execution_event_written")
    record_timeline_event(
        db,
        task_id="metric-rollback-task",
        stage="executing",
        actor="test",
        message="rollback",
        source_label="LIVE",
    )
    db.rollback()

    assert _counter("decree_execution_event_written") == before
    db.close()
