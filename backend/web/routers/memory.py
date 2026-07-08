"""结构化记忆（typed_memory）端点 —

  GET    /api/memory                 — 列表（?type 过滤）
  POST   /api/memory                 — 创建
  GET    /api/memory/{filename}      — 详情
  PUT    /api/memory/{filename}      — 更新
  DELETE /api/memory/{filename}      — 删除
  POST   /api/memory/search          — LLM rank + FTS 回退
  POST   /api/memory/rebuild-index
  GET    /api/memory/stats

⚠️ 路由顺序：search / rebuild-index / stats 静态路由必须先于 {filename} 注册。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

# TypedMemoryStore 内部处理跨平台文件锁；这里保留 handler 内导入以避免启动期放大依赖问题。
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.memory import (
    MemoryCreateRequest,
    MemoryHeaderItem,
    MemorySearchRequest,
    MemoryUpdateRequest,
)

router = APIRouter(prefix="/api/memory", tags=["memory"])


# ── 静态路由优先 ────────────────────────────────────────

@router.get("", response_model=list[MemoryHeaderItem])
def memory_list(
    type: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> list[MemoryHeaderItem]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        headers = store.scan()
        if type and type in TypedMemoryStore.VALID_TYPES:
            headers = [h for h in headers if h.type == type]
        return [
            MemoryHeaderItem(
                filename=h.filename,
                name=h.name,
                type=h.type,
                description=h.description,
                tags=h.tags,
                created_at=h.created_at,
                updated_at=h.updated_at,
                updated_at_hint=h.updated_at or "",
            )
            for h in headers
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("", status_code=status.HTTP_201_CREATED)
def memory_create(
    body: MemoryCreateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        result = store.save(
            name=body.name,
            content=body.content,
            type=body.type,
            description=body.description,
            tags=body.tags,
        )
        if not result.get("ok"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "保存失败"),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/search")
def memory_search(
    body: MemorySearchRequest,
    limit: int = Query(10, ge=1, le=50),
    type: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        type_filter = body.type or type

        try:
            from src.typed_memory_llm import llm_rank_memories
            headers = store.scan()
            if type_filter and type_filter in TypedMemoryStore.VALID_TYPES:
                headers = [h for h in headers if h.type == type_filter]
            hits = llm_rank_memories(body.query, headers)[:limit]
            return [
                {
                    "filename": getattr(h, "header", h).filename,
                    "name": getattr(h, "header", h).name,
                    "type": getattr(h, "header", h).type,
                    "description": getattr(h, "header", h).description,
                    "tags": getattr(h, "header", h).tags,
                    "created_at": getattr(h, "header", h).created_at,
                    "updated_at": getattr(h, "header", h).updated_at,
                    "content_preview": (
                        (h.content[:200] + "...") if len(h.content) > 200 else h.content
                    ) if hasattr(h, "content") else "",
                }
                for h in hits
            ]
        except Exception:
            fts_hits = store.search_fts(
                body.query, limit=limit, type_filter=type_filter,
            )
            return [
                {
                    "filename": h.filename,
                    "name": h.name,
                    "type": h.type,
                    "description": h.description,
                    "tags": h.tags,
                }
                for h in fts_hits
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/rebuild-index")
def memory_rebuild_index(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        return store.rebuild_index()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/stats")
def memory_stats(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        return store.stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── 动态路由 ────────────────────────────────────────────

@router.get("/{filename}")
def memory_detail(
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        record = store.get(filename)
        if record is None:
            raise HTTPException(status_code=404, detail="记忆不存在")
        return record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{filename}")
def memory_update(
    filename: str,
    body: MemoryUpdateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        result = store.update(
            filename=filename,
            content=body.content,
            description=body.description,
            tags=body.tags,
        )
        if not result.get("ok"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "更新失败"),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{filename}")
def memory_delete(
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.tenant import get_current_tenant
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=get_current_tenant())
        result = store.delete(filename)
        if not result.get("ok"):
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "删除失败"),
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
