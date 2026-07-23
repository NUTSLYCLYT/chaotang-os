"""Old-case (旧案) recall: explainable, deterministic matching over archives.

This module only implements the pure query/matching core -- no HTTP layer.
``find_similar_archives`` assumes the caller has already guaranteed at
least one of ``matter_type``/``department`` is non-empty (that guard is
enforced here too, raising :class:`app.shiguan.errors.ArchiveValidationError`,
so an HTTP layer in a later module can either pre-validate the request body
itself or simply let this function's error surface and map it to a 422).

``safe_recall_context_for_department`` is the fail-closed entry point meant
to be reused by the ministry/军机处/丞相 agent layers (a later module): it
never raises, and its return value distinguishes "matches found", "query
succeeded but no matches" and "史馆 unavailable" so a caller can decide how
to degrade gracefully.
"""

from __future__ import annotations

import logging
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.shiguan import storage
from app.shiguan.errors import ArchiveValidationError
from app.shiguan.models import Archive, ReviewStatus

logger = logging.getLogger(__name__)

_RECALL_FETCH_LIMIT = 500
MAX_RECALL_LIMIT = 100
_SUMMARY_LENGTH = 200

_BOTH_MATCH_REASON = "事项类型+部门匹配"
_MATTER_TYPE_ONLY_REASON = "仅事项类型匹配"
_DEPARTMENT_ONLY_REASON = "仅部门匹配"

_UNAVAILABLE_REASON = "shiguan_unavailable"


class RecallMatch(BaseModel):
    """One matched historical archive returned by 旧案召回 (old-case recall)."""

    model_config = ConfigDict(extra="forbid")

    archive_id: str
    match_reason: str
    historical_conclusion: str
    evidence_labels: list[str] = Field(default_factory=list)
    review_status: ReviewStatus | None = None
    lessons_learned: str | None = None
    pitfalls: str | None = None


class RecallContext(BaseModel):
    """The result of a fail-closed recall lookup for a single department.

    Three distinguishable outcomes:
    - ``available=True, entries=[...]``: the lookup succeeded and found
      matches.
    - ``available=True, entries=[]``: the lookup succeeded but found no
      matches.
    - ``available=False, reason="shiguan_unavailable"``: the lookup itself
      failed (e.g. storage error) -- callers must not treat this the same
      as "no matches".
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    available: bool
    entries: tuple[RecallMatch, ...] = ()
    reason: str | None = None


def _summarize(content: str) -> str:
    stripped = content.strip()
    if len(stripped) <= _SUMMARY_LENGTH:
        return stripped
    return stripped[:_SUMMARY_LENGTH].rstrip() + "…"


def _to_recall_match(archive: Archive, reason: str) -> RecallMatch:
    conclusion = (
        archive.reply_conclusion
        if archive.type == "REPLY" and archive.reply_conclusion
        else _summarize(archive.content)
    )
    return RecallMatch(
        archive_id=archive.id,
        match_reason=reason,
        historical_conclusion=conclusion,
        evidence_labels=[evidence.reality_label for evidence in archive.evidence],
        review_status=archive.review_status,
        lessons_learned=archive.lessons_learned,
        pitfalls=archive.pitfalls,
    )


def find_similar_archives(
    matter_type: str | None = None,
    department: str | None = None,
    limit: int = 10,
    *,
    db_path: Path | None = None,
) -> list[RecallMatch]:
    """Find archives similar to the given matter type and/or department.

    Matching priority (highest first), each group internally sorted by
    ``created_at DESC`` (via ``storage.list_archives``) and de-duplicated
    against archives already selected by a higher-priority group:

    1. Both ``matter_type`` and ``department`` match.
    2. Only ``matter_type`` matches.
    3. Only ``department`` matches.

    Raises:
        ArchiveValidationError: Neither ``matter_type`` nor ``department``
            is provided, or ``limit`` is not a positive integer.
        ShiguanStorageError: The underlying storage read failed.
    """

    normalized_matter_type = matter_type.strip() if matter_type else None
    normalized_department = department.strip() if department else None

    if not normalized_matter_type and not normalized_department:
        raise ArchiveValidationError("matter_type 或 department 至少需要提供一项")
    if (
        not isinstance(limit, int)
        or isinstance(limit, bool)
        or limit <= 0
        or limit > MAX_RECALL_LIMIT
    ):
        raise ArchiveValidationError(f"limit 必须为 1 至 {MAX_RECALL_LIMIT} 的整数")

    seen_ids: set[str] = set()
    matches: list[RecallMatch] = []

    def _collect(reason: str, *, mt: str | None, dept: str | None) -> None:
        if len(matches) >= limit:
            return
        archives = storage.list_archives(
            matter_type=mt, department=dept, limit=_RECALL_FETCH_LIMIT, db_path=db_path
        )
        for archive in archives:
            if archive.id in seen_ids:
                continue
            seen_ids.add(archive.id)
            matches.append(_to_recall_match(archive, reason))
            if len(matches) >= limit:
                return

    if normalized_matter_type and normalized_department:
        _collect(_BOTH_MATCH_REASON, mt=normalized_matter_type, dept=normalized_department)
    if normalized_matter_type:
        _collect(_MATTER_TYPE_ONLY_REASON, mt=normalized_matter_type, dept=None)
    if normalized_department:
        _collect(_DEPARTMENT_ONLY_REASON, mt=None, dept=normalized_department)

    return matches[:limit]


def safe_recall_context_for_department(
    department: str, limit: int = 3, *, db_path: Path | None = None
) -> RecallContext:
    """Fail-closed recall lookup by department, for reuse by agent layers.

    Never raises: any failure (empty department, storage error, or any
    other unexpected exception) is caught and reported as
    ``available=False, reason="shiguan_unavailable"``, distinct from the
    "queried successfully, no matches" case (``available=True, entries=[]``).
    """

    try:
        if not department or not department.strip():
            return RecallContext(available=False, reason=_UNAVAILABLE_REASON)
        matches = find_similar_archives(department=department.strip(), limit=limit, db_path=db_path)
        return RecallContext(available=True, entries=tuple(matches))
    except Exception:  # noqa: BLE001 - fail-closed by design, must never raise
        logger.exception("史馆旧案召回不可用")
        return RecallContext(available=False, reason=_UNAVAILABLE_REASON)
