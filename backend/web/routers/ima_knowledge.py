"""web/routers/ima_knowledge.py — IMA 知识库(上书房补证附件)真实接口。

2026-07-10 接线:/api/court/ima-knowledge 此前从未有过后端实现(上传/列表/归档
三个操作全是死链)。真实存储见 src/ima_knowledge_store.py——独立元数据 + 复用
knowledge_rag 索引,不重造 RAG。
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src import ima_knowledge_store as store
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/court", tags=["ima-knowledge"])


class _ImaKnowledgeUploadRequest(BaseModel):
    filename: str
    content: str
    mimeType: str | None = None
    size: int | None = None
    lastModified: int | None = None
    source: str = "shangshufang_upload"


class _ImaKnowledgeStatusRequest(BaseModel):
    id: str
    status: Literal["active", "archived"]


@router.get("/ima-knowledge")
def ima_knowledge_list(
    limit: int = 20,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    docs = store.list_documents()[: max(1, min(limit, 200))]
    return ok({"documents": docs})


@router.post("/ima-knowledge")
def ima_knowledge_upload(
    body: _ImaKnowledgeUploadRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    filename = body.filename.strip()
    content = body.content
    if not filename or not content:
        return fail("filename 与 content 必填")
    doc = store.save_document(filename, content, source=body.source)
    return ok({"document": doc})


@router.patch("/ima-knowledge")
def ima_knowledge_set_status(
    body: _ImaKnowledgeStatusRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    doc = store.set_status(body.id, body.status)
    if doc is None:
        return fail(f"未找到文档: {body.id}")
    return ok({"document": doc})
