"""需求文档存档端点 — /api/requirements/*"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.requirements import (
    RequirementItem,
    RequirementSaveRequest,
    RequirementSaveResponse,
)
from src.runtime_paths import resolve_runtime_paths

router = APIRouter(prefix="/api/requirements", tags=["requirements"])

_REQS_DIR = (
    resolve_runtime_paths().data / "requirements"
)
_REQS_DIR.mkdir(parents=True, exist_ok=True)

_REQ_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")


def _validate_req_id(req_id: str) -> str:
    """防路径穿越 — req_id 为时间戳格式，限制字符集。"""
    if not req_id or "/" in req_id or "\\" in req_id or ".." in req_id:
        raise HTTPException(status_code=400, detail=f"非法 req_id: {req_id!r}")
    if not _REQ_ID_RE.match(req_id):
        raise HTTPException(status_code=400, detail=f"非法 req_id: {req_id!r}")
    return req_id


# ── 静态路由优先 ────────────────────────────────────────

@router.post("/save", response_model=RequirementSaveResponse)
def api_save_requirement(
    body: RequirementSaveRequest,
    _: CurrentUser = Depends(get_current_user),
) -> RequirementSaveResponse:
    """保存需求文档（来自 flow_requirements run 的最终输出）。"""
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content 不能为空")

    req_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    title = body.title or content[:40].replace("\n", " ")
    doc = {
        "id": req_id,
        "title": title,
        "content": content,
        "run_id": body.run_id,
        "flow_name": body.flow_name,
        "created_at": datetime.now().isoformat(),
    }
    path = _REQS_DIR / f"{req_id}.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)

    return RequirementSaveResponse(id=req_id, title=title)


@router.get("", response_model=list[RequirementItem])
def api_list_requirements(
    _: CurrentUser = Depends(get_current_user),
) -> list[RequirementItem]:
    items: list[RequirementItem] = []
    for f in sorted(_REQS_DIR.glob("*.json"), reverse=True):
        try:
            with open(f, encoding="utf-8") as fh:
                doc = json.load(fh)
            items.append(RequirementItem(
                id=f.stem,
                title=doc.get("title", "") or "",
                content=doc.get("content", "") or "",
                run_id=doc.get("run_id", "") or "",
                flow_name=doc.get("flow_name", "") or "",
                created_at=doc.get("created_at", "") or "",
            ))
        except Exception:
            continue
    return items


@router.get("/{req_id}")
def api_get_requirement(
    req_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    req_id = _validate_req_id(req_id)
    path = _REQS_DIR / f"{req_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="需求文档不存在")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)
