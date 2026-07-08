"""结构化记忆（typed_memory）schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MemoryHeaderItem(BaseModel):
    filename: str
    name: str
    type: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    updated_at_hint: str = ""


class MemoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    type: str = "reference"
    description: str = ""
    tags: list[str] = Field(default_factory=list)


class MemoryUpdateRequest(BaseModel):
    content: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class MemorySearchRequest(BaseModel):
    query: str = ""
    type: str | None = None


class MemoryActionResult(BaseModel):
    ok: bool = True
    filename: str | None = None
    error: str | None = None
    extra: dict[str, Any] | None = None
