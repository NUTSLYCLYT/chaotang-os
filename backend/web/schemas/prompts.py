"""Prompt 编辑器相关 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PromptFilesResponse(BaseModel):
    key: str
    files: dict[str, str]


class PromptFileSaveRequest(BaseModel):
    content: str = ""


class PromptFileSaveResponse(BaseModel):
    status: str = "saved"
    key: str
    filename: str
    length: int


class PromptUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    reason: str = "Web编辑器修改"
    author: str = "user"


class PromptUpdateResponse(BaseModel):
    status: str = "saved"
    key: str
    new_version: str
    current_content_length: int
    versions_count: int


class PromptProposalActionResponse(BaseModel):
    status: str
    key: str
    filename: str


class PromptGroupedAgent(BaseModel):
    key: str
    display_name: str


class PromptGroupedSwarm(BaseModel):
    id: str
    name: str
    agents: list[PromptGroupedAgent]


class PromptGroupedResponse(BaseModel):
    swarms: list[PromptGroupedSwarm]
    ungrouped: list[PromptGroupedAgent]


class PromptUpgradesResponse(BaseModel):
    proposals: list[Any]
