"""通用预测/情报 BFF + 太医仪表盘/新闻回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: frontend
lib/api/client.ts 自己的注释承认"intel / health / forecast → 只能 mock
（V1 没有对应端点）"，调用方 safeReal() 早已优雅降级，这里补上诚实空数据
端点，让降级是因为"如实报告无数据"而不是 404。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


def test_court_intel_and_forecast_return_empty_honest_lists():
    client = TestClient(app)
    intel = client.get("/api/court/intel?limit=5").json()
    assert intel["success"] is True
    assert intel["data"] == []

    forecast = client.get("/api/court/forecast?limit=5").json()
    assert forecast["success"] is True
    assert forecast["data"] == []


def test_taiyi_dashboard_reports_unavailable_not_fake_profile():
    client = TestClient(app)
    response = client.get("/api/court/taiyi/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None


def test_taiyi_news_returns_empty_list():
    client = TestClient(app)
    response = client.get("/api/court/taiyi/news")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []
