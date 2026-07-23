"""Automatic 史馆 archival for a completed chancellor (丞相) decree.

This module builds two linked archives -- a ``MEMORIAL`` (the original
decree text) and a ``DECISION`` (the chancellor's routing/processing
result) -- and writes them via ``app.shiguan.storage.create_archive``.

It is deliberately decoupled from ``app.api.decrees.ChancellorDecreeResponse``
(that module is outside this task's allowed paths): ``response`` is read
via duck-typing (attribute access, falling back to dict-style access) so it
accepts either a real ``ChancellorDecreeResponse`` instance or a plain
``dict``/test double exposing the same field names (``departments``,
``processing_path``, ``rationale``, ``council_verdict``, ``final_verdict``).

``archive_chancellor_decree`` must never raise: a later module wires this
into the hot path of ``POST /api/v1/decrees/chancellor`` *after* a
successful response has already been computed, and an archival failure
must never turn a successful decree response into an error, nor must it be
reported as a successful archival when it did not happen. All failures are
caught and logged (never re-raised).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from app.shiguan import storage

logger = logging.getLogger(__name__)

_TITLE_MAX_LENGTH = 80
_DEFAULT_RESPONSIBLE_OWNER = "丞相"
_DEFAULT_MATTER_TYPE = "综合事项"


@dataclass(frozen=True)
class ArchiveDecreeResult:
    """Internal, assertion-friendly outcome; never exposed by the HTTP API."""

    archived: bool
    memorial_id: str | None = None
    decision_id: str | None = None


def _get_field(response: object, name: str, default: object = None) -> object:
    if isinstance(response, dict):
        return response.get(name, default)
    return getattr(response, name, default)


def _truncate(text: str, max_length: int) -> str:
    stripped = text.strip()
    if len(stripped) <= max_length:
        return stripped
    return stripped[:max_length].rstrip() + "…"


def archive_chancellor_decree(
    decree_text: str, response: object, *, owner_user_id: str
) -> ArchiveDecreeResult:
    """Archive a completed chancellor decree as MEMORIAL + DECISION records.

    Writes a ``MEMORIAL`` archive holding the original ``decree_text``,
    then a ``DECISION`` archive (linked to the memorial via
    ``related_archive_ids``) capturing ``response``'s routing/processing
    result. ``responsible_owner`` defaults to ``"丞相"``.

    This function never raises -- every exception (malformed ``response``,
    validation failure, storage I/O failure) is caught and logged.
    """

    try:
        departments = [
            department for department in (_get_field(response, "departments") or []) if department
        ]
        processing_path = [
            step for step in (_get_field(response, "processing_path") or []) if step
        ]
        rationale = _get_field(response, "rationale") or ""
        council_verdict = _get_field(response, "council_verdict")
        final_verdict = _get_field(response, "final_verdict") or ""

        if (
            not isinstance(decree_text, str)
            or not decree_text.strip()
            or not departments
            or not isinstance(final_verdict, str)
            or not final_verdict.strip()
        ):
            return ArchiveDecreeResult(archived=False)

        matter_type = _DEFAULT_MATTER_TYPE
        owning_department = departments[0] if departments else _DEFAULT_RESPONSIBLE_OWNER

        memorial_payload = {
            "type": "MEMORIAL",
            "title": _truncate(decree_text, _TITLE_MAX_LENGTH) or "旨意",
            "content": decree_text,
            "matter_type": matter_type,
            "department": owning_department,
        }
        process_parts = []
        if processing_path:
            process_parts.append(f"处理路径：{'->'.join(processing_path)}")
        if rationale:
            process_parts.append(f"丞相分流理由：{rationale}")
        if council_verdict:
            process_parts.append(f"军机处会审结论：{council_verdict}")
        decision_process = "；".join(process_parts) if process_parts else "丞相直接裁决"

        decision_conclusion = final_verdict

        decision_payload = {
            "type": "DECISION",
            "title": _truncate(f"丞相决策：{decree_text}", _TITLE_MAX_LENGTH),
            "content": decision_conclusion,
            "matter_type": matter_type,
            "department": owning_department,
            "participating_departments": departments or [_DEFAULT_RESPONSIBLE_OWNER],
            "decision_process": decision_process,
            "decision_conclusion": decision_conclusion,
            "decision_time": datetime.now(UTC).isoformat(),
            "responsible_owner": _DEFAULT_RESPONSIBLE_OWNER,
        }
        memorial, decision = storage.create_linked_archive_pair(
            memorial_payload, decision_payload, owner_user_id=owner_user_id
        )
        return ArchiveDecreeResult(
            archived=True,
            memorial_id=memorial.id,
            decision_id=decision.id,
        )
    except Exception:  # noqa: BLE001 - archival must never break the decree endpoint
        logger.exception("丞相旨意自动归档失败")
        return ArchiveDecreeResult(archived=False)
