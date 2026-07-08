"""Local AI integration endpoints.

These endpoints expose the existing local-ai runtime to the backend mainline
without copying model weights or the CourtOS-Brain vault into this repository.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/local-ai", tags=["local-ai"])


class LocalAIAskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=8000)
    review: bool = False


@router.get("/status")
def api_local_ai_status(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    from src.local_ai_bridge import fusion_status

    return fusion_status()


@router.post("/index-courtos-brain")
def api_local_ai_index_courtos_brain(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.local_ai_bridge import index_courtos_brain

        return index_courtos_brain()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/audit-courtos-brain")
def api_local_ai_audit_courtos_brain(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.local_ai_bridge import audit_courtos_brain

        return audit_courtos_brain()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/ask")
def api_local_ai_ask(
    body: LocalAIAskRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.local_ai_bridge import ask_genius

        return ask_genius(body.query, review=body.review)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
