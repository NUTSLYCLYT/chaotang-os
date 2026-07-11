"""钦天监预测情景回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: 前端
features/qintian/* 的 scenarios/generate/learning-path 一直打 404,该功能
无任何真实页面渲染(孤立组件),这里按契约诚实返回空情景集。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_qintian_scenarios_returns_honest_empty_envelope():
    client = TestClient(app)
    response = client.get("/api/qintian/scenarios")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []
    assert body["meta"]["source"] == "seed"


def test_qintian_scenarios_generate_returns_fallback_when_no_live_brain():
    client = TestClient(app)
    response = client.post("/api/qintian/scenarios/generate")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["sourceLabel"] == "FALLBACK"
    assert body["data"] is None


def test_qintian_learning_path_returns_honest_not_found():
    client = TestClient(app)
    response = client.get("/api/qintian/learning-path?forecastId=unknown")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
