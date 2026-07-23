"""R0-REQ-020：request_id/task_id/tenant_id/release_id/model_version 贯穿全链。

task_id/tenant_id 已经在承载链路的表上齐活了（既有代码），这里只验证新补的
request_id（任务创建时生成一次，全生命周期不变）和 release_id（部署级常量）
真的贯穿到 DecisionTask、每条 DecreeExecutionEvent 和 DecreeExecutionStatusV1。

model_version 只在真的发生模型调用时才有意义——本次改动把参数管道打通了
（record_timeline_event 接受 model_version kwarg，DecreeExecutionEvent/
TimelineEvent 都有这一列/字段），但 run_swarm_execution_loop 当前的返回契约
本身不保留"实际服务这次调用的模型是谁"这个信息（ModelAdapter.call() 返回值
里的 "model" 字段在蜂群深挖内部就被丢弃了）——把它接回来是蜂群执行循环
返回契约的改动，不是一个可以顺手做的小事，本次不做，如实记录为已知缺口，
不伪造假值。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.db.models import DecisionTask, DecreeExecutionEvent
from web.main import app


def test_request_id_generated_once_and_threads_through_decision_task_and_status(
    isolated_session_local,
):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "草拟一份内部通知"},
    ).json()["data"]
    task_id = draft["task_id"]

    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    assert task.request_id is not None
    assert task.request_id.startswith("req_")
    db.close()

    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )

    status = client.get(f"/api/shangshufang/tasks/{task_id}/status").json()["data"]
    assert status["execution_status"]["request_id"] == task.request_id


def test_request_id_and_release_id_present_on_timeline_events(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "对方要求股权对赌，独家合作三年，是否同意"},
    ).json()["data"]
    task_id = draft["task_id"]
    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )

    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    events = db.query(DecreeExecutionEvent).filter_by(task_id=task_id).all()
    assert events, "confirm-edict 至少应该写一条 timeline 事件"
    for event in events:
        assert event.request_id == task.request_id
        assert event.release_id is not None
    db.close()

    status = client.get(f"/api/shangshufang/tasks/{task_id}/status").json()["data"]
    timeline = status["execution_status"]["timeline"]
    assert len(timeline) >= 1
    assert any(item.get("release_id") for item in timeline)
