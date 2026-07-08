"""知识库 + 预设端点 —

  GET  /api/knowledge/search
  GET  /api/knowledge/stats
  POST /api/knowledge/index
  GET  /api/knowledge/sources
  GET  /api/knowledge/health    （30s 缓存防止 ImaSource 远端反复检查）
  POST /api/knowledge/upload    （支持 multipart 与 JSON 两种入参）
  GET  /api/presets             （tool+knowledge 组合预设）
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.knowledge import (
    KnowledgeSearchResponse,
    KnowledgeUploadResponse,
)

router = APIRouter(prefix="/api", tags=["knowledge"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

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


@router.post("/knowledge/index")
def api_knowledge_index(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """将 knowledge/docs/ 目录下的文档入库。"""
    try:
        from src.knowledge_rag import get_rag
        return get_rag().add_directory()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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
    response_model=KnowledgeUploadResponse,
    status_code=201,
)
async def api_knowledge_upload(
    request: Request,
    _: CurrentUser = Depends(get_current_user),
) -> KnowledgeUploadResponse:
    """支持 multipart 文件上传 或 JSON {filename, content, dataset?}。"""
    upload_dir = _PROJECT_ROOT / "knowledge" / "docs" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    content_type = request.headers.get("content-type", "")

    if "multipart" in content_type:
        form = await request.form()
        # 取第一个文件
        file_obj = None
        for v in form.values():
            if hasattr(v, "filename") and hasattr(v, "read"):
                file_obj = v
                break
        if file_obj is None or not getattr(file_obj, "filename", ""):
            raise HTTPException(status_code=400, detail="无文件")
        safe_name = Path(file_obj.filename).name
        target = upload_dir / safe_name
        target.write_bytes(await file_obj.read())
    else:
        try:
            body_json = await request.json() if await request.body() else {}
        except Exception:
            body_json = {}
        filename = (body_json.get("filename") or "").strip()
        body_content = body_json.get("content") or ""
        if not filename or not body_content:
            raise HTTPException(
                status_code=400,
                detail="filename 与 content 必填",
            )
        safe_name = Path(filename).name
        if not safe_name.endswith((".md", ".txt")):
            safe_name = safe_name + ".md"
        target = upload_dir / safe_name
        target.write_text(body_content, encoding="utf-8")

    indexed = 0
    try:
        from src.knowledge_rag import get_rag
        result = get_rag().add_directory(str(upload_dir.parent))
        indexed = result.get("indexed", 0) if isinstance(result, dict) else 0
    except Exception:
        pass

    return KnowledgeUploadResponse(
        status="uploaded",
        filename=safe_name,
        path=str(target.relative_to(_PROJECT_ROOT)),
        indexed_documents=indexed,
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
