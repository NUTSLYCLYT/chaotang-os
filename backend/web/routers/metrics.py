"""Prometheus 指标端点 — /metrics

无前缀（非 /api/* 路径），返回 text/plain 兼容 Prometheus scraper。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(tags=["metrics"])


class MetricEventRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    ts: int | None = None
    taskId: str | None = None
    domain: str | None = None
    route: str | None = None
    durationMs: int | None = None
    reason: str | None = None


@router.get("/api/metrics/tokens")
def token_usage() -> dict:
    """Token 用量监控:会话/各运行累计 token + 成本 + 预算上限(防跑飞可观测)。"""
    from src import token_monitor
    return {"success": True, "data": token_monitor.summary(), "error": None}


@router.post("/api/metrics")
def ingest_metric(event: MetricEventRequest) -> dict:
    """Browser fire-and-forget metrics ingestion.

    This is intentionally small: it records the event for backend observability
    when that sink exists, and otherwise accepts the metric without inventing
    business facts.
    """
    try:
        from src.production_events import record_event

        record_event(
            "frontend_metric",
            status="info",
            metric_name=event.name,
            task_id=event.taskId,
            domain=event.domain,
            route=event.route,
            duration_ms=event.durationMs,
            reason=event.reason,
            ts=event.ts,
        )
    except Exception:
        pass
    return {"success": True, "data": {"accepted": True}, "error": None}


@router.get("/metrics", include_in_schema=False)
def prometheus_metrics() -> Response:
    try:
        from src.observability import metrics_exporter
        body = metrics_exporter.export()
    except ImportError:
        body = "# metrics unavailable\n"
    return Response(content=body, media_type="text/plain; charset=utf-8")
