"""P4.5f behavior tests for nullable, provenance-only core tenant lineage."""

from __future__ import annotations

import pytest

from src.chancellor.decree_status import record_timeline_event
from src.chancellor.routing_service import ChancellorRoutingService
from src.core_tenant_lineage import list_tenant_lineage_quarantine
from src.db.models import (
    ChancellorRouteDecision,
    CourtReview,
    DecisionTask,
    DecreeExecutionEvent,
    FinalMemorial,
    OutboxEvent,
)
from src.decision_task_kernel import create_decision_task
from src.execution.decree_dispatcher import enqueue_dispatch
from src.execution.outbox_worker import process_event
from src.formal_memorial import formalize_memorial


def _create_task(db, *, task_id: str, tenant_id: int | None) -> DecisionTask:
    return create_decision_task(
        db,
        task_id=task_id,
        tenant_id=tenant_id,
        user_id="tenant-owner",
        raw_question="请核查合同风险并形成可执行意见",
        refined_edict="核查合同风险",
        decision_type="general",
        status="edict_recorded",
        source_label="LIVE",
        risk_flags=[],
        known_facts=[],
        unknown_gaps=[],
        recommended_departments=["刑部"],
        draft_edict={"recommended_departments": ["刑部"]},
        now="2026-07-16T00:00:00+00:00",
    )


def test_task_route_outbox_timeline_and_formal_memorial_inherit_one_tenant(
    isolated_session_local,
):
    db = isolated_session_local()
    task = _create_task(db, task_id="task_tenant_chain", tenant_id=37)
    route = ChancellorRoutingService().decide(
        db,
        task_id=task.id,
        confirmed_edict_text=task.refined_edict or task.raw_question,
        idempotency_key="tenant-chain-route",
        source_label="LIVE",
    )
    outbox_id = enqueue_dispatch(
        db,
        task_id=task.id,
        decision_id=route.decision_id,
        event_type="route.council",
    )
    timeline_id = record_timeline_event(
        db,
        task_id=task.id,
        stage="chancellor_routing",
        actor="chancellor",
        message="路由完成。",
    )
    review = CourtReview(
        id="review_tenant_chain",
        tenant_id=task.tenant_id,
        task_id=task.id,
        routing_plan_json="{}",
        review_status="reviewing",
        ministry_outputs_json="[]",
        conflict_summary_json="[]",
        memorial_json='{"summary":"证据充分"}',
    )
    db.add(review)
    db.flush()
    memorial = formalize_memorial(
        db,
        task_id=task.id,
        review_id=review.id,
        swarm_result={
            "swarm_run": {
                "id": "run_tenant_chain",
                "task_id": task.id,
                "review_id": review.id,
                "source_label": "LIVE_SWARM",
            },
            "quality_result": {"id": "quality_tenant_chain", "passed": True},
        },
    )
    db.commit()

    assert db.get(DecisionTask, task.id).tenant_id == 37
    assert db.get(ChancellorRouteDecision, route.decision_id).tenant_id == 37
    assert db.get(OutboxEvent, outbox_id).tenant_id == 37
    assert db.get(DecreeExecutionEvent, timeline_id).tenant_id == 37
    assert db.get(FinalMemorial, memorial.id).tenant_id == 37
    db.close()


def test_unknown_lineage_remains_null_and_is_visible_in_quarantine(
    isolated_session_local,
):
    db = isolated_session_local()
    task = _create_task(db, task_id="task_tenant_unknown", tenant_id=None)
    review = CourtReview(
        id="review_tenant_unknown",
        tenant_id=None,
        task_id=task.id,
        routing_plan_json="{}",
        review_status="reviewing",
        ministry_outputs_json="[]",
        conflict_summary_json="[]",
    )
    db.add(review)
    db.commit()

    rows = list_tenant_lineage_quarantine(db, task_id=task.id)
    assert {(row["table"], row["row_id"]) for row in rows} == {
        ("decision_tasks", task.id),
        ("court_reviews", review.id),
    }
    assert {row["reason"] for row in rows} == {"tenant_context_unavailable"}
    db.close()


def test_worker_fails_closed_before_dispatch_when_known_lineage_conflicts(
    isolated_session_local,
):
    db = isolated_session_local()
    task = _create_task(db, task_id="task_tenant_conflict", tenant_id=7)
    db.add(
        CourtReview(
            id="review_tenant_conflict",
            tenant_id=7,
            task_id=task.id,
            routing_plan_json='{"route":{"mode":"direct"}}',
            review_status="direct_completed",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"direct receipt"}',
        )
    )
    event_id = enqueue_dispatch(
        db,
        task_id=task.id,
        decision_id="decision_tenant_conflict",
        event_type="route.direct",
    )
    db.commit()
    event = db.get(OutboxEvent, event_id)
    event.tenant_id = 8
    db.commit()

    result = process_event(db, event_id)

    assert result["status"] == "failed"
    assert "tenant lineage conflict" in result["error"]
    assert db.get(OutboxEvent, event_id).attempts == 1
    assert db.query(DecreeExecutionEvent).filter_by(task_id=task.id, event_type="dispatch.receipt_only").count() == 0
    db.close()


def test_timeline_idempotent_replay_rejects_two_known_tenant_values(
    isolated_session_local,
):
    db = isolated_session_local()
    task = _create_task(db, task_id="task_timeline_conflict", tenant_id=7)
    common = {
        "task_id": task.id,
        "stage": "executing",
        "actor": "worker",
        "message": "开始执行。",
        "idempotency_key": "timeline-tenant-conflict",
    }
    record_timeline_event(db, tenant_id=7, **common)
    db.commit()

    with pytest.raises(ValueError, match="tenant lineage conflict"):
        record_timeline_event(db, tenant_id=8, **common)
    db.close()
