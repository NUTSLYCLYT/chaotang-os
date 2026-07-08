"""案例归档 schema。"""
from __future__ import annotations

from pydantic import BaseModel


class CaseRejectRequest(BaseModel):
    reason: str = ""


class CaseActionResponse(BaseModel):
    ok: bool


class ReceiptRequest(BaseModel):
    """30天成果回执:这条被引用的旧案后来成了没。"""

    source: str
    outcome: str  # confirmed / refuted
    note: str = ""
