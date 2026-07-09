"""Dadian aggregate API.

These endpoints back the /dadian overview page. They intentionally aggregate
existing backend facts instead of reviving frontend BFF business logic.
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser
from web.task_registry import task_snapshot

router = APIRouter(prefix="/api/court", tags=["dadian"])

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _safe_memorials() -> list[dict[str, Any]]:
    try:
        from web.routers.throne import _build_memorial_list

        memorials = _build_memorial_list()
        return memorials if isinstance(memorials, list) else []
    except Exception:
        return []


def _task_rows(limit: int = 100) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for task_id, task in task_snapshot().items():
        rows.append(
            {
                "id": task_id,
                "taskId": task_id,
                "title": (task.get("task_input") or task_id)[:80],
                "status": task.get("task_status") or task.get("status") or "running",
                "createdAt": task.get("started_at") or "",
                "updatedAt": task.get("finished_at") or task.get("started_at") or "",
                "departments": task.get("departments") or [],
            }
        )
    try:
        from src.db.engine import SessionLocal
        from src.db.flow_store import ensure_task_result_json_column, task_record
        from src.db.models import Task as DbTask

        db = SessionLocal()
        try:
            ensure_task_result_json_column(db)
            records = (
                db.query(DbTask)
                .order_by(DbTask.updated_at.desc(), DbTask.created_at.desc())
                .limit(limit)
                .all()
            )
            seen = {row["taskId"] for row in rows}
            for record in records:
                if record.task_id in seen:
                    continue
                rows.append(task_record(record))
        finally:
            db.close()
    except Exception:
        pass
    rows.sort(key=lambda row: row.get("updatedAt") or row.get("createdAt") or "", reverse=True)
    return rows[:limit]


def _status_for_feed(status: object) -> str:
    value = str(status or "").lower()
    if value in {"running", "processing", "queued", "reviewing"}:
        return "执行中"
    if value in {"pending", "pending_review", "report_ready", "approved"}:
        return "待审"
    return "已结"


def _dept_label(row: dict[str, Any]) -> str:
    departments = row.get("departments")
    if isinstance(departments, list) and departments:
        return str(departments[0])
    return str(row.get("sourceDepartment") or row.get("department") or row.get("agentCode") or "丞相")


def _strip_json_fence(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        value = "\n".join(lines).strip()
    return value


def _normalize_advice(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    recommendation = str(value.get("chancellorRecommendation") or "").strip()
    situation = str(value.get("todaySituation") or "").strip()
    raw_reasons = value.get("reasons")
    reasons = [str(item).strip() for item in raw_reasons] if isinstance(raw_reasons, list) else []
    reasons = [item for item in reasons if item]
    if not recommendation:
        return None
    return {
        "todaySituation": situation,
        "chancellorRecommendation": recommendation,
        "reasons": reasons[:3] or ["来自当前朝堂事实与模型推理。"],
    }


def _live_chancellor_advice(
    dept: str,
    tasks: list[dict[str, Any]],
    memorials: list[dict[str, Any]],
    pending: list[dict[str, Any]],
    high_risk: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if os.environ.get("FENGQUN_CHANCELLOR_LIVE", "false").lower() not in {"1", "true", "yes"}:
        return None
    base = os.environ.get("LITELLM_BASE", "http://127.0.0.1:4000").rstrip("/")
    model = os.environ.get("FENGQUN_CHANCELLOR_MODEL", "deepseek-chat")
    key = os.environ.get("LITELLM_API_KEY", "")
    timeout = float(os.environ.get("FENGQUN_CHANCELLOR_TIMEOUT_SECONDS", "12"))
    facts = {
        "dept": dept,
        "pending": pending[:5],
        "highRisk": high_risk[:5],
        "recentTasks": tasks[:5],
        "recentMemorials": memorials[:5],
    }
    prompt = (
        "你是朝堂 OS 的丞相。基于给定事实生成今日要务。"
        "如果没有待裁或高风险事项，也要诚实说明当前无急件，并给出一个下一步建议。"
        "只返回 JSON，不要 markdown。字段必须是:"
        '{"todaySituation": "...", "chancellorRecommendation": "...", "reasons": ["...","...","..."]}.'
        f"\n事实: {json.dumps(facts, ensure_ascii=False, default=str)}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "你只输出可解析 JSON。不得编造不存在的风险或任务。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 500,
    }
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        req = urllib.request.Request(
            f"{base}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = json.loads(response.read().decode("utf-8"))
        content = raw["choices"][0]["message"]["content"]
        return _normalize_advice(json.loads(_strip_json_fence(str(content))))
    except Exception:
        return None


@router.get("/dadian/pulse")
def dadian_pulse(_: CurrentUser = Depends(get_current_user)) -> dict:
    tasks = _task_rows()
    memorials = _safe_memorials()
    active_status = {"running", "processing", "queued", "reviewing"}
    pending_status = {"pending", "pending_review", "report_ready", "approved"}
    active_tasks = sum(1 for row in tasks if str(row.get("status", "")).lower() in active_status)
    pending_decisions = sum(1 for row in tasks if str(row.get("status", "")).lower() in pending_status)
    risk_count = sum(
        1
        for row in memorials
        if row.get("riskLevel") in {"high", "critical", "medium"} or row.get("priority") in {"high", "urgent"}
    )
    opportunity_count = sum(1 for row in memorials if row.get("priority") in {"high", "urgent"})
    return ok(
        {
            "activeTasks": active_tasks,
            "riskCount": risk_count,
            "opportunityCount": opportunity_count,
            "swarmActivity": active_tasks,
            "memorialsToday": len(memorials[:20]),
            "pendingDecisions": pending_decisions,
            "source": "real" if tasks or memorials else "fallback",
            "generatedAt": _now(),
        }
    )


@router.get("/dadian/feed")
def dadian_feed(
    limit: int = Query(8, ge=1, le=20),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    tasks = _task_rows(limit=limit)
    memorials = _safe_memorials()
    items: list[dict[str, Any]] = []
    for row in tasks:
        items.append(
            {
                "id": str(row.get("id") or row.get("taskId")),
                "depts": [_dept_label(row)],
                "title": str(row.get("title") or row.get("rawCommand") or row.get("taskId") or "未命名朝务"),
                "status": _status_for_feed(row.get("status")),
                "time": str(row.get("updatedAt") or row.get("createdAt") or "刚刚"),
                "taskId": row.get("taskId") or row.get("id"),
                "agentCode": row.get("agentCode"),
            }
        )
    if len(items) < limit:
        for row in memorials[: limit - len(items)]:
            items.append(
                {
                    "id": str(row.get("id") or f"memorial-{len(items)}"),
                    "depts": [str(row.get("sourceDepartment") or row.get("agentCode") or "丞相")],
                    "title": str(row.get("title") or row.get("summary") or "未命名奏报"),
                    "status": _status_for_feed(row.get("status")),
                    "time": str(row.get("createdAt") or row.get("updatedAt") or "刚刚"),
                    "taskId": row.get("id"),
                    "agentCode": row.get("agentCode"),
                }
            )
    source = "real" if items else "fallback"
    notice = (
        f"{items[0]['depts'][0]} · {items[0]['title']}"
        if items
        else "暂无朝堂动态；可先从上书房下旨，形成第一条可追踪奏报。"
    )
    return ok({"items": items, "notice": notice, "source": source, "generatedAt": _now()})


@router.get("/chancellor-advice")
def chancellor_advice(
    dept: str = Query("overview", max_length=64),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    tasks = _task_rows(limit=20)
    memorials = _safe_memorials()
    pending = [
        row
        for row in tasks
        if str(row.get("status", "")).lower() in {"pending", "pending_review", "report_ready", "approved"}
    ]
    high_risk = [
        row
        for row in memorials
        if row.get("riskLevel") in {"high", "critical", "medium"} or row.get("priority") in {"high", "urgent"}
    ]
    live_advice = _live_chancellor_advice(dept, tasks, memorials, pending, high_risk)
    if live_advice:
        advice = live_advice
        source = "live"
        reason = None
    elif pending or high_risk:
        target = pending[0] if pending else high_risk[0]
        title = str(target.get("title") or target.get("summary") or target.get("id") or "当前朝务")
        advice = {
            "todaySituation": f"{dept} 当前有 {len(pending)} 条待裁事项、{len(high_risk)} 条风险提示。",
            "chancellorRecommendation": f"先处理《{title[:48]}》，核清证据、风险边界和下一步责任人。",
            "reasons": [
                "来自后端任务与奏报聚合，不调用离线 mock。",
                "待裁与高风险事项优先级高于一般浏览。",
                "建议进入上书房或军机处继续形成可归档决策。",
            ],
        }
        source = "derived"
        reason = None
    else:
        advice = None
        source = "unavailable"
        reason = "no_pending_or_high_risk_fact"
    return ok(
        {
            "dept": dept,
            "source": source,
            "advice": advice,
            "generatedAt": _now(),
            "reason": reason,
        }
    )


class DecisionJudgmentRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    verdict: str | None = Field(default=None, max_length=4000)
    taskId: str | None = Field(default=None, max_length=128)
    helpful: bool
    note: str = Field(default="", max_length=1000)


def _judgment_path() -> Path:
    configured = os.environ.get("FENGQUN_DADIAN_JUDGMENT_LEDGER")
    if configured:
        return Path(configured)
    return _PROJECT_ROOT / "data" / "dadian_decision_judgments.jsonl"


def _read_judgments() -> list[dict[str, Any]]:
    path = _judgment_path()
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
        except json.JSONDecodeError:
            continue
    return rows


@router.get("/decision-judgment")
def decision_judgment_stats(_: CurrentUser = Depends(get_current_user)) -> dict:
    rows = _read_judgments()
    count = len(rows)
    helpful = sum(1 for row in rows if row.get("helpful") is True)
    helpful_rate = round(helpful / count * 100) if count else None
    return ok({"count": count, "helpfulRate": helpful_rate})


@router.post("/decision-judgment")
def record_decision_judgment(
    body: DecisionJudgmentRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    path = _judgment_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        "question": body.question,
        "verdict": body.verdict,
        "taskId": body.taskId,
        "helpful": body.helpful,
        "note": body.note,
        "createdAt": _now(),
    }
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    rows = _read_judgments()
    count = len(rows)
    helpful = sum(1 for row in rows if row.get("helpful") is True)
    return ok({"recorded": True, "count": count, "helpfulRate": round(helpful / count * 100) if count else None})
