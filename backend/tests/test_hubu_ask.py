"""户部问答(大屏可视化)回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: WorldCourtStage.tsx
调用 /api/court/hubu/ask 一直打 404，该组件无任何真实页面渲染(孤立组件)，
这里诚实返回未接入实时问答，不冒充已经真实回奏。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_hubu_ask_returns_honest_not_available():
    client = TestClient(app)
    response = client.post("/api/court/hubu/ask", json={"command": "问户部预算"})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "尚未接入" in body["error"]
