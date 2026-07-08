"""草稿审批相关 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DraftRejectRequest(BaseModel):
    reason: str = ""


class DraftStatusResponse(BaseModel):
    status: str
    draft: dict[str, Any] | None = None


class DraftStats(BaseModel):
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    executed: int = 0
    total: int = 0
