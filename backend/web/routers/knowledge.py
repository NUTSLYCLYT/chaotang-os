"""知识库 + 预设端点 —

  GET  /api/knowledge/search
  GET  /api/knowledge/stats
  POST /api/knowledge/index     （K0C fail-closed；旧写入口固定返回 409）
  GET  /api/knowledge/sources
  GET  /api/knowledge/health    （30s 缓存防止 ImaSource 远端反复检查）
  POST /api/knowledge/upload    （K0C fail-closed；旧写入口固定返回 409）
  GET  /api/presets             （tool+knowledge 组合预设）
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from src import legacy_write_tripwire
from web.deps import get_current_user
from web.routers._envelope import fail
from web.schemas.auth import CurrentUser
from web.schemas.knowledge import (
    KnowledgeSearchResponse,
)

router = APIRouter(prefix="/api", tags=["knowledge"])

# /api/knowledge/health 30s 内存缓存
_HEALTH_CACHE: dict[str, Any] = {"data": None, "expires_at": 0.0}
_HEALTH_TTL_SEC = 30


@router.get("/knowledge/search", response_model=KnowledgeSearchResponse)
def api_knowledge_search(
    query: str = Query(..., min_length=1),
    top_k: int = Query(3, ge=1, le=50),
    _: CurrentUser = Depends(get_current_user),
) -> KnowledgeSearchResponse:
    try:
        from src.knowledge_rag import get_rag
        results = get_rag().search(query, top_k=top_k)
        return KnowledgeSearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/knowledge/stats")
def api_knowledge_stats(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.knowledge_rag import get_rag
        return get_rag().stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/knowledge/index",
    status_code=409,
    responses={409: {"description": "Legacy knowledge writer blocked"}},
)
def api_knowledge_index(
    _: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    """K0C: reject the retired direct index writer before any side effect."""
    detail = legacy_write_tripwire.blocked_write_detail(
        "legacy-knowledge-api-writers"
    )
    return JSONResponse(
        status_code=409,
        content=fail(
            "旧知识索引入口已封禁；索引只能消费 canonical promotion 产物",
            extra=detail,
        ),
    )


@router.get("/knowledge/sources")
def api_knowledge_sources(
    _: CurrentUser = Depends(get_current_user),
) -> Any:
    try:
        from src.knowledge import list_available_sources
        return list_available_sources()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/knowledge/health")
def api_knowledge_health(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """轮询所有知识源健康度，前端 60s 拉一次，本地 30s 缓存防穿透。"""
    now = time.time()
    if _HEALTH_CACHE["data"] is not None and _HEALTH_CACHE["expires_at"] > now:
        return _HEALTH_CACHE["data"]
    try:
        from src.knowledge.adapters import all_source_types, get_source
        out: dict[str, Any] = {}
        for t in all_source_types():
            src = get_source(t)
            if src is None:
                out[t] = {"ok": False, "error": "unregistered"}
                continue
            if not src.is_configured():
                out[t] = {"ok": False, "error": "not_configured"}
                continue
            out[t] = src.health_check()
        _HEALTH_CACHE["data"] = out
        _HEALTH_CACHE["expires_at"] = now + _HEALTH_TTL_SEC
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/knowledge/upload",
    status_code=409,
    responses={409: {"description": "Legacy knowledge writer blocked"}},
)
async def api_knowledge_upload(
    _: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    """K0C: reject the retired direct upload writer before any side effect."""
    detail = legacy_write_tripwire.blocked_write_detail(
        "legacy-knowledge-api-writers"
    )
    return JSONResponse(
        status_code=409,
        content=fail(
            "旧知识上传入口已封禁；内容必须经 canonical archive/outcome promotion 晋升",
            extra=detail,
        ),
    )


@router.get("/presets", tags=["presets"])
def api_list_presets(
    _: CurrentUser = Depends(get_current_user),
) -> Any:
    """列出 config/presets.yaml 中所有 tool+knowledge 预设。"""
    try:
        from src.preset_loader import list_presets
        return list_presets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
