"""通用预测/情报 BFF + 太医仪表盘/新闻(2026-07-11 补齐)。

frontend/src/lib/api/client.ts 自己的注释已经承认: "intel / health / forecast
→ 只能 mock（V1 没有对应端点）"——这几个 /api/court/* 路径在后端从未实现过，
且调用方 safeReal() 早已优雅降级到 mock，不会真的报错给用户。经审计确认
调用这些接口的组件也没有真实页面渲染路径。这里仍按用户要求补上诚实空
数据端点，让"降级到 mock"这一步不再是因为 404，而是因为后端如实报告
暂无真实数据源。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/court", tags=["forecast-intel-taiyi"])


def _observe(endpoint: str, operation: str) -> None:
    from src.migration_telemetry import record_legacy_endpoint_call

    record_legacy_endpoint_call(
        endpoint=f"forecast_intel_taiyi.{endpoint}",
        caller_id="anonymous",
        operation=operation,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.get("/intel")
def court_intel(limit: int = Query(default=30), domain: str | None = Query(default=None)) -> dict:
    _observe("intel", "read")
    return {"success": True, "data": [], "error": None}


@router.get("/forecast")
def court_forecast(limit: int = Query(default=10)) -> dict:
    _observe("forecast", "read")
    return {"success": True, "data": [], "error": None}


@router.get("/taiyi/dashboard")
def taiyi_dashboard() -> dict:
    _observe("taiyi.dashboard", "read")
    return {"success": False, "data": None, "error": "taiyi_dashboard_source_unavailable"}


@router.get("/taiyi/news")
def taiyi_news() -> dict:
    _observe("taiyi.news", "read")
    return {"success": True, "data": [], "error": None}
