"""Backend preflight readiness report."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from src.backend_preflight import build_preflight_report
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api", tags=["preflight"])


@router.get("/preflight")
def api_preflight(
    window: int = Query(default=30, ge=1, le=200),
    _user: CurrentUser = Depends(get_current_user),
) -> dict:
    return build_preflight_report(window=window)
