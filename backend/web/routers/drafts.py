"""草稿审批端点 — /api/drafts/*"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.tool_router import approve_draft, list_drafts, reject_draft

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.drafts import (
    DraftRejectRequest,
    DraftStats,
    DraftStatusResponse,
)

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


@router.get("")
def api_list_drafts(
    status: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_drafts(status=status)


@router.get("/stats", response_model=DraftStats)
def api_drafts_stats(
    _: CurrentUser = Depends(get_current_user),
) -> DraftStats:
    all_drafts = list_drafts()
    stats = {
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "executed": 0,
        "total": len(all_drafts),
    }
    for d in all_drafts:
        s = d.get("status", "pending")
        stats[s] = stats.get(s, 0) + 1
    return DraftStats(**stats)


@router.get("/{draft_id}")
def api_get_draft(
    draft_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    from src.tool_router import DRAFTS_DIR
    path = DRAFTS_DIR / f"{draft_id}.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Draft '{draft_id}' not found",
        )
    return json.loads(path.read_text(encoding="utf-8"))


@router.post("/{draft_id}/approve", response_model=DraftStatusResponse)
def api_approve_draft(
    draft_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> DraftStatusResponse:
    result = approve_draft(draft_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Draft '{draft_id}' not found",
        )
    return DraftStatusResponse(status="approved", draft=result)


@router.post("/{draft_id}/reject", response_model=DraftStatusResponse)
def api_reject_draft(
    draft_id: str,
    body: DraftRejectRequest | None = None,
    _: CurrentUser = Depends(get_current_user),
) -> DraftStatusResponse:
    reason = body.reason if body else ""
    result = reject_draft(draft_id, reason)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Draft '{draft_id}' not found",
        )
    return DraftStatusResponse(status="rejected", draft=result)


@router.post("/{draft_id}/execute", response_model=DraftStatusResponse)
def api_execute_draft(
    draft_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> DraftStatusResponse:
    from src.tool_router import DRAFTS_DIR
    path = DRAFTS_DIR / f"{draft_id}.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Draft '{draft_id}' not found",
        )

    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Draft must be approved first (current: {data.get('status')})",
        )

    data["status"] = "executed"
    data["executed_at"] = datetime.now().isoformat()
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return DraftStatusResponse(status="executed", draft=data)
