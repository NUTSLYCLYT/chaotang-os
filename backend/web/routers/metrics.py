"""Prometheus 指标端点 — /metrics

无前缀（非 /api/* 路径），返回 text/plain 兼容 Prometheus scraper。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(tags=["metrics"])


@router.get("/api/metrics/tokens")
def token_usage() -> dict:
    """Token 用量监控:会话/各运行累计 token + 成本 + 预算上限(防跑飞可观测)。"""
    from src import token_monitor
    return {"success": True, "data": token_monitor.summary(), "error": None}


@router.get("/metrics", include_in_schema=False)
def prometheus_metrics() -> Response:
    try:
        from src.observability import metrics_exporter
        body = metrics_exporter.export()
    except ImportError:
        body = "# metrics unavailable\n"
    return Response(content=body, media_type="text/plain; charset=utf-8")
