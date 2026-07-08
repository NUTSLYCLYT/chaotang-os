"""朝堂任务启动协议端点。"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from src.task_protocol import classify_task, human_hint
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.task_protocol import TaskProtocolPreviewRequest

router = APIRouter(prefix="/api/task-protocol", tags=["task-protocol"])


@router.post("/preview")
def preview_task_protocol(
    body: TaskProtocolPreviewRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    protocol = classify_task(body.task)
    return {
        "hint": human_hint(protocol),
        "recommended_action": "continue",
        "mode": protocol.mode,
        "signoff_required": protocol.signoff_required,
    }
