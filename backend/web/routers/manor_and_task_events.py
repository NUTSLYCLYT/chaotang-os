"""庄园分析 + 通用任务 SSE(2026-07-11 补齐)。

frontend/src/lib/api/adapters/manor-adapter.ts 和 task-events-sse.ts 调用
/api/manor/analyze、/api/manor/stream、/api/tasks/{taskId}/events——三个都
从未在后端实现过。经审计确认调用方(command-center barrel 内的孤立 hook)
没有任何真实页面渲染路径。manor-adapter 默认 API_MODE==='mock' 时根本不会
打这些真实端点；这里仍按用户要求补上诚实兜底，不生成假律师分析/假任务
事件流。
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["manor-and-task-events"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.post("/api/manor/analyze")
def manor_analyze(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    domain = str(body.get("domain") or "legal")
    return {
        "task_id": f"manor-fallback-{_now_iso()}",
        "domain": domain,
        "summary": "庄园分析真链尚未接入，当前无法给出真实研判，不生成假结论。",
        "requires_departments": [],
        "risks": [],
        "action_cards": [],
    }


@router.post("/api/manor/stream")
def manor_stream(body: dict[str, Any] = Body(default_factory=dict)) -> StreamingResponse:
    domain = str(body.get("domain") or "legal")

    def events():
        yield f"event: open\ndata: {json.dumps({'request_id': 'fallback', 'domain': domain}, ensure_ascii=False)}\n\n"
        yield (
            "event: fallback\n"
            f"data: {json.dumps({'reason': 'no_live_adapter', 'message': '庄园分析真链尚未接入'}, ensure_ascii=False)}\n\n"
        )
        yield f"event: eof\ndata: {json.dumps({'frames': 2})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/api/tasks/{task_id}/events")
def task_events(task_id: str) -> StreamingResponse:
    from web.task_registry import get_task

    def events():
        task = get_task(task_id)
        status = "failed" if task is None else "archived"
        yield f"data: {json.dumps({'taskId': task_id, 'status': status, 'ts': _now_iso()}, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
