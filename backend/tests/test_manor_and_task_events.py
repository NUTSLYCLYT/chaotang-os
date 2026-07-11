"""庄园分析 + 通用任务SSE回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: manor-adapter.ts
和 task-events-sse.ts 调用的端点一直打 404，该功能无任何真实页面渲染
(孤立组件)，这里诚实兜底，不生成假律师分析或假任务事件。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_manor_analyze_returns_honest_no_data_result():
    client = TestClient(app)
    response = client.post("/api/manor/analyze", json={"domain": "legal", "situation": "test"})
    assert response.status_code == 200
    body = response.json()
    assert body["domain"] == "legal"
    assert body["risks"] == []
    assert "尚未接入" in body["summary"]


def test_manor_stream_emits_open_fallback_eof():
    client = TestClient(app)
    with client.stream("POST", "/api/manor/stream", json={"domain": "legal"}) as response:
        body = "".join(response.iter_text())
    assert response.status_code == 200
    assert "event: open" in body
    assert "event: fallback" in body
    assert "event: eof" in body


def test_task_events_sse_returns_status_for_unknown_task():
    client = TestClient(app)
    with client.stream("GET", "/api/tasks/does-not-exist/events") as response:
        body = "".join(response.iter_text())
    assert response.status_code == 200
    assert '"taskId": "does-not-exist"' in body
    assert '"status": "failed"' in body
