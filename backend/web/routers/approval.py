"""审批通知端点 — /api/approval/pending"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/approval", tags=["approval"])


@router.get("/pending")
def approval_pending(
    user: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.approval_manager import ApprovalNotifier
        notifier = ApprovalNotifier()
        pending = notifier.get_pending(user)
        return {
            "notifications": [
                {
                    "notification_id": n.notification_id,
                    "draft_id": n.draft_id,
                    "tool_name": n.tool_name,
                    "message": n.message,
                    "created_at": n.created_at,
                    "status": n.status,
                }
                for n in pending
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
