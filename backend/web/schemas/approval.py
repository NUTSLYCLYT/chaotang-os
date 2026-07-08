"""审批通知 schema。"""
from __future__ import annotations

from pydantic import BaseModel


class ApprovalNotification(BaseModel):
    notification_id: str
    draft_id: str
    tool_name: str = ""
    message: str = ""
    created_at: str = ""
    status: str = ""
