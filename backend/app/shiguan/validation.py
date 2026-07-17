"""Strict, storage-facing validation for 史馆 archive payloads.

``app.shiguan.models`` already encodes structural contracts (types,
required fields, enum membership, cross-field DECISION requirements) as
Pydantic validators. This module is the single place that:

- Translates any ``pydantic.ValidationError`` raised while constructing an
  ``ArchiveCreate``/``ReviewStatus`` into this domain's own
  :class:`app.shiguan.errors.ArchiveValidationError`, with a sanitized,
  human-readable message (field path + reason only -- never a Python
  traceback or an internal file path).
- Performs the one check that structural Pydantic validation cannot do on
  its own: confirming every ``related_archive_ids`` entry already exists in
  the database, which requires a live connection.
"""

from __future__ import annotations

import sqlite3

import pydantic

from app.shiguan.errors import ArchiveValidationError
from app.shiguan.models import ArchiveCreate, ReviewStatus


def _format_pydantic_error(exc: pydantic.ValidationError) -> str:
    parts = []
    for error in exc.errors():
        location = ".".join(str(piece) for piece in error["loc"]) or "(root)"
        parts.append(f"{location}: {error['msg']}")
    return "; ".join(parts) if parts else "校验失败"


def validate_archive_create(payload: dict) -> ArchiveCreate:
    """Validate a raw archive-creation payload.

    Raises:
        ArchiveValidationError: ``payload`` fails structural validation
            (unknown type, empty required text, illegal evidence label,
            incomplete/duplicate DECISION-only fields, unparseable time,
            an attempt to set ``id``/``created_at``, etc.).
    """

    try:
        return ArchiveCreate.model_validate(payload)
    except pydantic.ValidationError as exc:
        raise ArchiveValidationError(_format_pydantic_error(exc)) from None


def validate_related_archive_ids(
    conn: sqlite3.Connection, related_archive_ids: list[str]
) -> None:
    """Confirm every id in ``related_archive_ids`` already exists in ``conn``.

    Raises:
        ArchiveValidationError: At least one referenced archive id does not
            exist.
    """

    for related_id in related_archive_ids:
        row = conn.execute("SELECT 1 FROM archives WHERE id = ?", (related_id,)).fetchone()
        if row is None:
            raise ArchiveValidationError(f"related_archive_ids 引用了不存在的档案: {related_id}")


def validate_review_status_update(payload: dict) -> ReviewStatus:
    """Validate a raw review-status upsert payload.

    Raises:
        ArchiveValidationError: ``status`` is not one of the four allowed
            values, ``reviewed_at`` is missing/unparseable, or the payload
            otherwise fails structural validation.
    """

    try:
        return ReviewStatus.model_validate(payload)
    except pydantic.ValidationError as exc:
        raise ArchiveValidationError(_format_pydantic_error(exc)) from None
