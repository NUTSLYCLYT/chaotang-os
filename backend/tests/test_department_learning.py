"""部门校准飞轮回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: 前端
department-flywheel-recap.tsx / use-advisor-signal.ts 一直打 404，该功能
无任何真实页面渲染(孤立组件)，这里诚实返回空记录集。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_learning_records_returns_empty_honest_shape():
    client = TestClient(app)
    response = client.get("/api/court/learning/records")
    assert response.status_code == 200
    assert response.json()["data"]["records"] == []


def test_learning_backtest_returns_zeroed_report():
    client = TestClient(app)
    response = client.get("/api/court/learning/backtest")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["replayed"] == 0
    assert body["data"]["missed"] == []


def test_learning_advisor_signal_returns_empty_signals_with_primary_source():
    client = TestClient(app)
    response = client.get("/api/court/learning/advisor-signal")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["signals"] == []
    assert body["meta"]["source"] == "primary"
