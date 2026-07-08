"""Production observability endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from src.production_events import recent_events, release_gate_snapshot, summarize_events
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/observability", tags=["observability"])


@router.get("/events")
def api_observability_events(
    limit: int = Query(default=100, ge=1, le=500),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    events = recent_events(limit=limit)
    return {
        "count": len(events),
        "events": events,
    }


@router.get("/summary")
def api_observability_summary(
    limit: int = Query(default=200, ge=1, le=500),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    events = recent_events(limit=limit)
    return {
        "count": len(events),
        "summary": summarize_events(events),
    }


@router.get("/release-gate")
def api_observability_release_gate(
    limit: int = Query(default=200, ge=1, le=500),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    return release_gate_snapshot(limit=limit)
