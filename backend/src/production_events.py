"""Production wide events for release-grade debugging.

This module intentionally has no third-party dependency. It writes newline JSON
events with enough dimensions to debug long-tail agent failures after release,
without storing full user prompts or secrets.

钦天监用途：发布门禁、生产事故复盘、多蜂群异常和不可逆客户承诺必须能从
这些事件中追溯 case/task/run/model/gate reason，再决定是否放行。
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.observability import metrics_exporter

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_EVENT_PATH = PROJECT_ROOT / "data" / "observability" / "production_events.jsonl"
RED_EVENT_TYPES = {
    "run_async_failed",
    "run_index_drift_detected",
    "swarm_api_failed",
    "release_readiness",
}
YELLOW_STATUSES = {"degraded", "warning", "pending"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def event_path() -> Path:
    configured = os.environ.get("FENGQUN_PRODUCTION_EVENTS", "").strip()
    return Path(configured) if configured else DEFAULT_EVENT_PATH


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def task_fingerprint(task_input: str | None) -> dict[str, Any]:
    text = task_input or ""
    return {
        "task_hash": _short_hash(text) if text else "",
        "task_preview": text[:120],
        "task_length": len(text),
    }


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value[:1000]
    if isinstance(value, list):
        return [_clean(item) for item in value[:50]]
    if isinstance(value, dict):
        return {str(k)[:80]: _clean(v) for k, v in list(value.items())[:80]}
    return str(value)[:1000]


def build_event(event_type: str, **fields: Any) -> dict[str, Any]:
    base = {
        "event_type": event_type,
        "timestamp": utc_now(),
        "service": "jiqun-flow",
        "case_id": "",
        "task_id": "",
        "run_id": "",
        "session_id": "",
        "flow": "",
        "config": "",
        "swarm": "",
        "step": "",
        "model": "",
        "status": "",
        "gate_status": "",
        "gate_reason": "",
        "latency_ms": None,
        "tenant_slug": "",
        "user_role": "",
        "error": "",
    }
    for key, value in fields.items():
        cleaned = _clean(value)
        if key == "task_preview" and isinstance(cleaned, str):
            cleaned = cleaned[:120]
        base[key] = cleaned
    return base


def record_event(event_type: str, **fields: Any) -> dict[str, Any]:
    event = build_event(event_type, **fields)
    path = event_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    metrics_exporter.inc_counter(
        "production_events_total",
        labels={
            "event_type": event_type,
            "status": str(event.get("status") or "unknown"),
            "gate_status": str(event.get("gate_status") or "none"),
        },
    )
    return event


def recent_events(limit: int = 100, path: Path | None = None) -> list[dict[str, Any]]:
    target = path or event_path()
    if not target.exists():
        return []
    lines = target.read_text(encoding="utf-8").splitlines()[-max(1, min(limit, 500)):]
    events: list[dict[str, Any]] = []
    for line in lines:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def _is_red_event(event: dict[str, Any]) -> bool:
    if str(event.get("gate_status", "")).lower() == "blocked":
        return True
    if str(event.get("status", "")).lower() in {"error", "failed", "blocked"}:
        return True
    if event.get("event_type") in RED_EVENT_TYPES and str(event.get("gate_status", "")).lower() != "clear":
        return True
    return False


def _is_yellow_event(event: dict[str, Any]) -> bool:
    if _is_red_event(event):
        return False
    if str(event.get("status", "")).lower() in YELLOW_STATUSES:
        return True
    if str(event.get("gate_status", "")).lower() in {"warning", "degraded", "pending"}:
        return True
    error = str(event.get("error", "")).lower()
    return "timeout" in error or "unavailable" in error


def summarize_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Return a small release-facing summary for dashboards and gates."""
    if not events:
        return {
            "light": "yellow",
            "total": 0,
            "red": 0,
            "yellow": 0,
            "green": 0,
            "by_type": {},
            "last_event_at": "",
            "next_action": "先产生生产观测事件，再判断发布。",
            "blockers": [],
            "warnings": [],
        }
    red_events = [event for event in events if _is_red_event(event)]
    yellow_events = [event for event in events if _is_yellow_event(event)]
    by_type: dict[str, int] = {}
    for event in events:
        event_type = str(event.get("event_type") or "unknown")
        by_type[event_type] = by_type.get(event_type, 0) + 1
    light = "red" if red_events else "yellow" if yellow_events else "green"
    next_action = "可以进入发布候选。" if light == "green" else (
        "先处理阻断事件，再重新运行发布门禁。" if light == "red" else "补齐降级项证据，再进入最终发布门禁。"
    )
    return {
        "light": light,
        "total": len(events),
        "red": len(red_events),
        "yellow": len(yellow_events),
        "green": max(0, len(events) - len(red_events) - len(yellow_events)),
        "by_type": by_type,
        "last_event_at": str(events[-1].get("timestamp", "")) if events else "",
        "next_action": next_action,
        "blockers": [
            {
                "event_type": event.get("event_type", ""),
                "run_id": event.get("run_id", ""),
                "gate_reason": event.get("gate_reason", "") or event.get("error", ""),
            }
            for event in red_events[:10]
        ],
        "warnings": [
            {
                "event_type": event.get("event_type", ""),
                "run_id": event.get("run_id", ""),
                "gate_reason": event.get("gate_reason", "") or event.get("error", ""),
            }
            for event in yellow_events[:10]
        ],
    }


def release_gate_snapshot(limit: int = 200, path: Path | None = None) -> dict[str, Any]:
    events = recent_events(limit=limit, path=path)
    summary = summarize_events(events)
    return {
        "ready": summary["light"] == "green" and bool(events),
        "light": summary["light"] if events else "yellow",
        "events_considered": len(events),
        "summary": summary,
        "next_action": "先产生生产观测事件，再判断发布。" if not events else summary["next_action"],
        "blockers": ["no_production_events"] if not events else summary["blockers"],
        "warnings": [] if not events else summary["warnings"],
    }


def timed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)
