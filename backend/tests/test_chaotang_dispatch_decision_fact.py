"""The legacy Chaotang dispatch must be a durable DecisionTask adapter."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, DecreeExecutionEvent, OutboxEvent
from web.main import app


_BODY = {
    "rawCommand": "分析低温电池市场并形成决策建议",
    "intent": "市场分析",
    "selectedCategories": [
        {
            "taskType": "analysis",
            "ministers": ["hu_bu"],
            "groups": ["finlaw"],
            "label": "市场分析",
        }
    ],
}


def test_dispatch_commits_decision_fact_before_execution(
    isolated_session_local, monkeypatch
):
    from src.execution import decree_dispatcher

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    observed: dict[str, object] = {}

    def capture_trigger(event_id: str):
        with isolated_session_local() as db:
            event = db.get(OutboxEvent, event_id)
            observed["decision_exists_before_dispatch_trigger"] = (
                event is not None and db.get(DecisionTask, event.task_id) is not None
            )

    monkeypatch.setattr(decree_dispatcher, "dispatch_after_commit", capture_trigger)

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is True
    task_id = response.json()["data"]["taskId"]
    with isolated_session_local() as db:
        decision = db.get(DecisionTask, task_id)
        assert decision is not None
        assert decision.user_id == "1"
        assert decision.status == "edict_recorded"
        event = (
            db.query(DecreeExecutionEvent)
            .filter_by(task_id=task_id, event_type="dispatch.queued")
            .one()
        )
        assert event.actor == "chancellor"
        assert event.source_label == "MIXED"
    assert observed["decision_exists_before_dispatch_trigger"] is True


def test_dispatch_compat_court_task_veto_returns_full_receipt_and_honest_status(
    isolated_session_local, monkeypatch
):
    """direct.py 的 'court' 模式调用 dispatch_compat_court_task 时不带
    constraints/department_override(跟 chaotang.py 那条带 ministers/groups
    的路径不同)，真实走门下省关键词范围检查。封驳时 receipt 的字段集必须
    跟正常路径一致(调用方只读 receipt['status']，但别的字段不能是 None
    到下游轮询链路断掉)，task.status 必须诚实，不能停在 executing。"""
    from src.execution.canonical_court_dispatch import dispatch_compat_court_task
    from src.db.models import DecisionTask

    receipt = dispatch_compat_court_task(
        task_id="t-menxia-veto-direct",
        user_id="1",
        command="我要去美国看世界杯决赛",
        compat_entrypoint="direct.execute",
        tenant_id=None,
    )

    assert receipt["status"] == "menxia_veto_pending"
    assert receipt["review_id"] is not None
    assert receipt["outbox_event_id"] is None
    assert receipt["route_decision_id"]

    with isolated_session_local() as db:
        task = db.get(DecisionTask, "t-menxia-veto-direct")
        assert task is not None
        assert task.status == "menxia_veto_pending"

        import json

        from src.db.models import CourtReview

        review = db.get(CourtReview, receipt["review_id"])
        assert review is not None
        memorial = json.loads(review.memorial_json)
        # 2026-07-18 审计发现:ShangshufangReviewMemorial 的必填字段(前端
        # buildView 无条件读取/.filter())漏填会在渲染时直接崩，不是可选的。
        # 这条路径(canonical_court_dispatch.py)之前漏了 4 个，比
        # shangshufang.py 那条还多。
        for required_field in (
            "evidence_gaps",
            "decision_options",
            "next_best_action",
            "source_label",
        ):
            assert required_field in memorial, f"缺必填字段 {required_field}"
        assert memorial["decision_options"] == []
        assert memorial["title"] == "门下省封驳纪要"


def test_dispatch_persistence_failure_blocks_execution(
    isolated_session_local, monkeypatch
):
    import web.routers.chaotang as chaotang
    import src.execution.canonical_court_dispatch as canonical_dispatch

    monkeypatch.setenv("FENGQUN_LEGACY_CHAOTANG_DAEMON", "0")
    monkeypatch.setattr(
        canonical_dispatch,
        "dispatch_compat_court_task",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("DB故障")),
    )
    spawned: list[str] = []
    monkeypatch.setattr(
        chaotang, "_spawn_run", lambda task_id, *args, **kwargs: spawned.append(task_id)
    )

    response = TestClient(app).post("/api/chaotang/decree/dispatch", json=_BODY)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["error"] == "canonical_dispatch_failed"
    assert spawned == []
    with isolated_session_local() as db:
        assert db.query(DecisionTask).count() == 0
