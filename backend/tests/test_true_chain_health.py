from src.true_chain_health import evaluate_true_chain_health


def test_true_chain_is_not_ready_without_real_runtime_evidence(isolated_session_local):
    db = isolated_session_local()
    try:
        result = evaluate_true_chain_health(db)
    finally:
        db.close()

    assert result["liveReady"] == {
        "backend": True,
        "swarmRun": False,
        "requiredDependencies": False,
    }
    assert result["status"] == "degraded"


def test_true_chain_accepts_completed_live_engine_evidence_even_when_quality_is_blocked(
    isolated_session_local,
):
    from src.db.models import SwarmRun, SwarmTaskRun

    db = isolated_session_local()
    db.add(
        SwarmRun(
            id="run-live-health",
            task_id="task-live-health",
            review_id="review-live-health",
            mode="deep",
            status="quality_blocked",
            source_label="FALLBACK",
            route_plan_json="{}",
            started_at="2099-01-01T00:00:00+00:00",
            finished_at="2099-01-01T00:01:00+00:00",
        )
    )
    db.add(
        SwarmTaskRun(
            id="task-run-live-health",
            swarm_run_id="run-live-health",
            swarm_id="xingbu_legal_risk_swarm",
            role="刑部法务风险蜂群",
            status="completed",
            source_label="LIVE_ENGINE",
            started_at="2099-01-01T00:00:00+00:00",
            finished_at="2099-01-01T00:01:00+00:00",
        )
    )
    db.commit()
    try:
        result = evaluate_true_chain_health(db)
    finally:
        db.close()

    assert result["liveReady"] == {
        "backend": True,
        "swarmRun": True,
        "requiredDependencies": True,
    }
    assert result["status"] == "ready"
    assert result["sourceLabel"] == "LIVE_ENGINE"
