"""HTTP contract for 史馆 (Shiguan / Hall of Records) archives and 旧案召回
(old-case recall).

Mirrors the style established by ``app/api/decrees.py``
(``register_chancellor_exception_handlers``): this module is the *only*
place where ``app.shiguan`` is wired to HTTP. It does not re-implement any
validation or storage logic -- request bodies are passed straight through
to the existing ``app.shiguan.storage``/``app.shiguan.recall`` functions,
which already own the single source of truth for structural validation
(``app.shiguan.models``/``app.shiguan.validation``). Response bodies reuse
the existing Pydantic models (``Archive``, ``Statistics``, ``ReviewStatus``,
``RecallMatch``) directly as FastAPI ``response_model``s -- no parallel
schema is declared here.

Error responses are sanitized JSON, mapping the three domain exceptions
declared in ``app.shiguan.errors`` to fixed HTTP status codes:

- ``ArchiveNotFoundError`` -> 404
- ``ArchiveValidationError`` -> 422
- ``ShiguanStorageError`` -> 503

Every one of those exceptions already carries a message designed to be
safe to surface to a caller (see ``app.shiguan.errors`` docstrings), so the
handlers below forward ``str(exc)`` as-is rather than wrapping it in a
second, generic message.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.api.auth import CurrentUser
from app.shiguan import storage
from app.shiguan.errors import ArchiveNotFoundError, ArchiveValidationError, ShiguanStorageError
from app.shiguan.models import Archive, ArchiveType, ReviewStatus, Statistics
from app.shiguan.recall import MAX_RECALL_LIMIT, RecallMatch, find_similar_archives

_DEFAULT_LIST_LIMIT = 100
_MAX_LIST_LIMIT = 500
_DEFAULT_RECALL_LIMIT = 10

router = APIRouter(prefix="/api/v1/shiguan")


class ReviewStatusUpdateRequest(BaseModel):
    """Strict wire contract; unknown fields are rejected instead of ignored."""

    model_config = ConfigDict(extra="forbid")

    status: str
    reviewed_at: str
    note: str | None = None


class RecallRequest(BaseModel):
    """Strict recall request; response facts are owned by ``RecallMatch``."""

    model_config = ConfigDict(extra="forbid")

    matter_type: str | None = None
    department: str | None = None
    limit: int = Field(default=_DEFAULT_RECALL_LIMIT, ge=1, le=MAX_RECALL_LIMIT)


@router.post("/archives", response_model=Archive, status_code=201)
def create_archive(payload: dict[str, Any], current_user: CurrentUser) -> Archive:
    """Create a new archive of any of the five 史馆 types.

    ``payload`` is passed straight to ``storage.create_archive``, which owns
    every validation rule (required fields, DECISION-only fields, evidence
    labels, existing ``related_archive_ids``, rejecting a client-supplied
    ``id``). Any failure surfaces as ``ArchiveValidationError`` (422) or
    ``ShiguanStorageError`` (503) via the handlers registered below.
    """
    return storage.create_archive(payload, owner_user_id=current_user.id)


@router.get("/archives/{archive_id}", response_model=Archive)
def get_archive(archive_id: str, current_user: CurrentUser) -> Archive:
    """Fetch a single archive by id. 404s via ``ArchiveNotFoundError``."""
    return storage.get_archive(archive_id, owner_user_id=current_user.id)


@router.get("/archives", response_model=list[Archive])
def list_archives(
    current_user: CurrentUser,
    type: ArchiveType | None = None,
    matter_type: str | None = None,
    department: str | None = None,
    limit: int = Query(default=_DEFAULT_LIST_LIMIT, ge=1, le=_MAX_LIST_LIMIT),
) -> list[Archive]:
    """List archives, optionally filtered by type/matter_type/department.

    Ordering is the deterministic ``created_at DESC, id ASC`` already
    implemented by ``storage.list_archives``. ``limit`` is bounded to
    ``[1, 500]`` at the HTTP layer (in addition to ``storage``'s own
    positive-integer check) so a caller can never request an unbounded
    result set.
    """
    return storage.list_archives(
        type=type,
        matter_type=matter_type,
        department=department,
        limit=limit,
        owner_user_id=current_user.id,
    )


@router.patch("/archives/{archive_id}/review", response_model=ReviewStatus)
def update_review_status(
    archive_id: str, payload: ReviewStatusUpdateRequest, current_user: CurrentUser
) -> ReviewStatus:
    """Set (or replace) an archive's review/复盘 status.

    ``status``/``reviewed_at``/``note`` are read from ``payload`` and passed
    straight to ``storage.upsert_review_status``, which owns validation (the
    four-value status enum, a parseable ``reviewed_at``) and existence
    checks (``ArchiveNotFoundError`` -> 404). Repeated calls only keep the
    latest status -- no duplicate archive or history row is produced.
    """
    return storage.upsert_review_status(
        archive_id,
        payload.status,
        payload.reviewed_at,
        payload.note,
        owner_user_id=current_user.id,
    )


@router.get("/statistics", response_model=Statistics)
def get_statistics(current_user: CurrentUser) -> Statistics:
    """Report archive counters and the achievement success rate.

    ``success_rate`` is ``None`` (never a fabricated ``0``) whenever its
    denominator (``achieved + not_achieved + partial``) is zero -- see
    ``storage.get_statistics`` for the exact computation.
    """
    return storage.get_statistics(owner_user_id=current_user.id)


@router.post("/recall", response_model=list[RecallMatch])
def recall(payload: RecallRequest, current_user: CurrentUser) -> list[RecallMatch]:
    """Find similar historical archives by matter_type and/or department.

    At least one of ``matter_type``/``department`` must be provided;
    otherwise ``find_similar_archives`` raises ``ArchiveValidationError``
    (422). Matching/ranking/bounding is entirely owned by
    ``app.shiguan.recall`` -- this endpoint only forwards the request body.
    """
    return find_similar_archives(
        matter_type=payload.matter_type,
        department=payload.department,
        limit=payload.limit,
        owner_user_id=current_user.id,
    )


def register_shiguan_exception_handlers(app: FastAPI) -> None:
    """Register sanitized error responses for every 史馆 route.

    Each handler forwards the raised exception's own message as-is (every
    message in ``app.shiguan.errors`` is already designed to be safe to
    surface to a caller -- see that module's docstrings) rather than
    wrapping it in a second, generic message.
    """

    @app.exception_handler(ArchiveNotFoundError)
    async def _handle_archive_not_found(_request, exc: ArchiveNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "archive_not_found", "message": str(exc)},
        )

    @app.exception_handler(ArchiveValidationError)
    async def _handle_archive_validation_error(
        _request, exc: ArchiveValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "reason": "validation_failed", "message": str(exc)},
        )

    @app.exception_handler(ShiguanStorageError)
    async def _handle_storage_error(_request, exc: ShiguanStorageError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "reason": "storage_unavailable", "message": str(exc)},
        )
