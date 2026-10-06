"""Authenticated read-only API for the CapabilityRegistry projection."""

from __future__ import annotations

from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from app.api.auth import CurrentUser
from app.capabilities import (
    build_capability_registry_projection,
    get_capability_registry_item,
)
from app.capabilities.contracts import CapabilityRegistryItem, CapabilityRegistrySummary
from app.capabilities.projection import CapabilitySnapshotError

router = APIRouter(prefix="/api/v1/capabilities", tags=["capabilities"])

_ALLOWED_QUERY_KEYS = {"type", "home", "source", "status", "risk"}


def _validate_query(request: Request) -> JSONResponse | None:
    params = request.query_params
    if any(key not in _ALLOWED_QUERY_KEYS for key in params.keys()):
        return JSONResponse(
            status_code=400, content={"status": "error", "reason": "validation"}
        )
    if any(len(params.getlist(key)) > 1 for key in params.keys()):
        return JSONResponse(
            status_code=400, content={"status": "error", "reason": "validation"}
        )
    return None


def _summary(
    items: list[CapabilityRegistryItem],
    baseline: CapabilityRegistrySummary,
) -> CapabilityRegistrySummary:
    by_type = Counter(item.card.type for item in items)
    by_home = Counter(item.card.recommended_home for item in items)
    by_status = Counter(item.card.status for item in items)
    catalog_items = [item for item in items if item.catalog is not None]
    return CapabilityRegistrySummary(
        total=len(items),
        by_type=dict(sorted(by_type.items())),
        by_home=dict(sorted(by_home.items())),
        by_status=dict(sorted(by_status.items())),
        external_review_required=sum(
            1 for item in items if item.external_review and item.external_review.audit_required
        ),
        small_sample_without_authority_score=sum(
            1 for item in items if item.card.sample_count < 5 and item.card.authority_score is None
        ),
        catalog_hanlin_skills=sum(
            item.card.recommended_home == "hanlin" for item in catalog_items
        ),
        catalog_provider_groups=sum(
            item.card.recommended_home == "honglusi" for item in catalog_items
        ),
        catalog_mcp_tools=sum(
            item.catalog.tool_count for item in catalog_items if item.catalog
        ),
        catalog_snapshot_provider_groups=baseline.catalog_snapshot_provider_groups,
        catalog_snapshot_mcp_tools=baseline.catalog_snapshot_mcp_tools,
        catalog_excluded_support_tools=baseline.catalog_excluded_support_tools,
    )


def _storage_error() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"status": "error", "reason": "storage"},
    )


@router.get("")
def list_capabilities(
    request: Request,
    current_user: CurrentUser,
    type: Annotated[str | None, Query(max_length=32)] = None,
    home: Annotated[str | None, Query(max_length=64)] = None,
    source: Annotated[str | None, Query(max_length=64)] = None,
    status: Annotated[str | None, Query(max_length=32)] = None,
    risk: Annotated[str | None, Query(max_length=32)] = None,
):
    """Return a filtered, deterministic read-only capability registry."""

    del current_user
    validation_error = _validate_query(request)
    if validation_error is not None:
        return validation_error

    try:
        projection = build_capability_registry_projection()
    except CapabilitySnapshotError:
        return _storage_error()
    items = projection.items
    if type is not None:
        items = [item for item in items if item.card.type == type]
    if home is not None:
        items = [item for item in items if item.card.recommended_home == home]
    if source is not None:
        items = [item for item in items if item.card.source == source]
    if status is not None:
        items = [item for item in items if item.card.status == status]
    if risk is not None:
        items = [item for item in items if item.card.risk_level == risk]

    filtered = projection.model_copy(
        update={"items": items, "summary": _summary(items, projection.summary)}
    )
    return {"status": "ok", "registry": filtered.model_dump(mode="json")}


@router.get("/{capability_id}")
def get_capability(capability_id: str, current_user: CurrentUser):
    """Return one registry item by opaque capability id."""

    del current_user
    try:
        item = get_capability_registry_item(capability_id)
    except CapabilitySnapshotError:
        return _storage_error()
    if item is None:
        return JSONResponse(
            status_code=404, content={"status": "error", "reason": "not_found"}
        )
    return {"status": "ok", "capability": item.model_dump(mode="json")}
