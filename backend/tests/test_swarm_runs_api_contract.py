import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.db.models import CourtReview, DecisionTask, SwarmQualityResult, SwarmRun
from web.main import app


def test_swarm_run_brief_contract_reads_quality_result(isolated_session_local):
    db = isolated_session_local()
    try:
        db.add(
            SwarmQualityResult(
                id="quality-contract-1",
                swarm_run_id="swarm-contract-1",
                passed=True,
                blocking_reasons_json="[]",
                warnings_json=json.dumps(["manual review recommended"], ensure_ascii=False),
                revised_output_json=json.dumps(
                    {
                        "executive_summary": "Contract-ready brief",
                        "missing_evidence": ["signed quote"],
                        "recommended_next_action": "Ask for evidence",
                        "source_label": "FALLBACK",
                    },
                    ensure_ascii=False,
                ),
            )
        )
        db.commit()
    finally:
        db.close()

    response = TestClient(app).get("/api/swarm-runs/swarm-contract-1/brief")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["executive_summary"] == "Contract-ready brief"
    assert payload["data"]["missing_evidence"] == ["signed quote"]
    assert payload["data"]["source_label"] == "FALLBACK"


def test_swarm_run_retry_contract_reuses_existing_run_context(monkeypatch, isolated_session_local):
    db = isolated_session_local()
    try:
        db.add(
            SwarmRun(
                id="swarm-contract-retry",
                task_id="task-contract-retry",
                review_id="review-contract-retry",
                mode="standard",
                status="failed",
                source_label="FALLBACK",
                route_plan_json="{}",
            )
        )
        db.commit()
    finally:
        db.close()

    def fake_create_swarm_run(user, body):
        return {
            "success": True,
            "data": {
                "swarm_run": {
                    "id": "swarm-contract-retry-next",
                    "task_id": body.task_id,
                    "review_id": body.review_id,
                    "mode": body.mode,
                    "status": "running",
                    "source_label": "LIVE_SWARM",
                },
                "progress_url": "/api/swarm-runs/swarm-contract-retry-next/progress",
                "brief_url": "/api/swarm-runs/swarm-contract-retry-next/brief",
            },
            "error": None,
        }

    monkeypatch.setattr("web.routers.swarm_runs.create_swarm_run", fake_create_swarm_run)

    response = TestClient(app).post("/api/swarm-runs/swarm-contract-retry/retry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["swarm_run"]["task_id"] == "task-contract-retry"
    assert payload["data"]["swarm_run"]["review_id"] == "review-contract-retry"
    assert payload["data"]["progress_url"].endswith("/progress")


def test_swarm_run_retry_contract_reports_missing_run(isolated_session_local):
    response = TestClient(app).post("/api/swarm-runs/missing-run/retry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]


def test_swarm_run_create_rejects_cross_tenant_explicit_review_id(
    isolated_session_local,
    monkeypatch,
):
    from web import deps
    from web.schemas.auth import CurrentUser

    app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=1,
        username="tenant-two-user",
        role="user",
        tenant_slug="tenant-two",
        tenant_id=2,
    )
    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="swarm-explicit-review-attacker-task",
            tenant_id=2,
            user_id="1",
            raw_question="判断合同风险",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        DecisionTask(
            id="swarm-explicit-review-victim-task",
            tenant_id=1,
            user_id="1",
            raw_question="受害方任务",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id="swarm-explicit-review-victim-review",
            tenant_id=1,
            task_id="swarm-explicit-review-victim-task",
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"victim"}',
            created_at="2026-07-28T00:00:00+00:00",
            updated_at="2026-07-28T00:00:00+00:00",
        )
    )
    db.commit()
    db.close()

    with (
        patch("src.swarm_execution_loop.run_swarm_execution_loop") as run_swarm,
        patch("src.swarm_persistence.attach_swarm_result_to_review") as attach_review,
    ):
        response = TestClient(app).post(
            "/api/swarm-runs",
            json={
                "task_id": "swarm-explicit-review-attacker-task",
                "review_id": "swarm-explicit-review-victim-review",
                "mode": "standard",
            },
        )

    payload = response.json()
    assert payload["success"] is False
    assert "无权" in payload["error"] or "review" in payload["error"]
    run_swarm.assert_not_called()
    attach_review.assert_not_called()


def test_swarm_run_retry_rejects_cross_tenant_stored_review_id(
    isolated_session_local,
    monkeypatch,
):
    from web import deps
    from web.schemas.auth import CurrentUser

    app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=1,
        username="tenant-two-user",
        role="user",
        tenant_slug="tenant-two",
        tenant_id=2,
    )
    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="swarm-retry-attacker-task",
            tenant_id=2,
            user_id="1",
            raw_question="判断合同风险",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        DecisionTask(
            id="swarm-retry-victim-task",
            tenant_id=1,
            user_id="1",
            raw_question="受害方任务",
            status="edict_recorded",
            source_label="LIVE",
            draft_edict_json="{}",
        )
    )
    db.add(
        CourtReview(
            id="swarm-retry-victim-review",
            tenant_id=1,
            task_id="swarm-retry-victim-task",
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="edict_recorded",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json='{"title":"victim"}',
            created_at="2026-07-28T00:00:00+00:00",
            updated_at="2026-07-28T00:00:00+00:00",
        )
    )
    db.add(
        SwarmRun(
            id="swarm-retry-cross-tenant-run",
            task_id="swarm-retry-attacker-task",
            review_id="swarm-retry-victim-review",
            mode="standard",
            status="failed",
            source_label="FALLBACK",
            route_plan_json="{}",
        )
    )
    db.commit()
    db.close()

    with (
        patch("src.swarm_execution_loop.run_swarm_execution_loop") as run_swarm,
        patch("src.swarm_persistence.attach_swarm_result_to_review") as attach_review,
    ):
        response = TestClient(app).post(
            "/api/swarm-runs/swarm-retry-cross-tenant-run/retry"
        )

    payload = response.json()
    assert payload["success"] is False
    assert "无权" in payload["error"] or "review" in payload["error"]
    run_swarm.assert_not_called()
    attach_review.assert_not_called()
