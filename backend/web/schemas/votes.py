"""协商/投票 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ProposalCreateRequest(BaseModel):
    proposal_id: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=1)
    proposer: str = "system"
    options: list[dict[str, Any]] = Field(default_factory=list)
    strategy: str = "majority"
    quorum: int = 2


class VoteRequest(BaseModel):
    voter: str = Field(..., min_length=1)
    option_id: str = Field(..., min_length=1)
    reason: str = ""


class VoteResult(BaseModel):
    accepted: bool
