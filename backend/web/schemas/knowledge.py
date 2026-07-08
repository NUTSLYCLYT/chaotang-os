"""知识库 + 预设 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class KnowledgeUploadJSONRequest(BaseModel):
    filename: str = ""
    content: str = ""
    dataset: str | None = None


class KnowledgeUploadResponse(BaseModel):
    status: str = "uploaded"
    filename: str
    path: str
    indexed_documents: int = 0


class KnowledgeSearchResponse(BaseModel):
    results: list[dict[str, Any]]
