"""Non-blocking single-reply archival for a completed chancellor decree."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from app.shiguan import storage

logger = logging.getLogger(__name__)

_TITLE_MAX_LENGTH = 80
_DEFAULT_RESPONDENT = "\u4e1e\u76f8"
_DEFAULT_MATTER_TYPE = "\u7efc\u5408\u4e8b\u9879"


@dataclass(frozen=True)
class ArchiveDecreeResult:
    """Internal, assertion-friendly outcome; never exposed by the HTTP API."""

    archived: bool
    reply_id: str | None = None


def _get_field(response: object, name: str, default: object = None) -> object:
    if isinstance(response, dict):
        return response.get(name, default)
    return getattr(response, name, default)


def _truncate(text: str, max_length: int) -> str:
    stripped = text.strip()
    if len(stripped) <= max_length:
        return stripped
    return stripped[:max_length].rstrip() + "\u2026"


def archive_chancellor_decree(
    decree_text: str, response: object, *, owner_user_id: str
) -> ArchiveDecreeResult:
    """Archive a completed decree as exactly one ``REPLY`` and never raise."""

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

        process_parts = []
        if processing_path:
            process_parts.append(f"\u5904\u7406\u8def\u5f84\uff1a{' -> '.join(processing_path)}")
        if rationale:
            process_parts.append(f"\u4e1e\u76f8\u5206\u6d41\u7406\u7531\uff1a{rationale}")
        if council_verdict:
            process_parts.append(f"\u519b\u673a\u5904\u4f1a\u5ba1\u7ed3\u8bba\uff1a{council_verdict}")

        reply_payload = {
            "type": "REPLY",
            "title": _truncate(f"\u4e1e\u76f8\u56de\u594f\uff1a{decree_text}", _TITLE_MAX_LENGTH),
            "content": final_verdict,
            "matter_type": _DEFAULT_MATTER_TYPE,
            "department": departments[0],
            "source_kind": "DECREE",
            "source_text": decree_text,
            "participating_departments": departments,
            "reply_process": "\uff1b".join(process_parts),
            "reply_conclusion": final_verdict,
            "reply_time": datetime.now(UTC).isoformat(),
            "respondent": _DEFAULT_RESPONDENT,
        }
        reply = storage.create_archive(reply_payload, owner_user_id=owner_user_id)
        return ArchiveDecreeResult(archived=True, reply_id=reply.id)
    except Exception:  # noqa: BLE001 - archival must never break the decree endpoint
        logger.exception("\u4e1e\u76f8\u65e8\u610f\u81ea\u52a8\u5f52\u6863\u5931\u8d25")
        return ArchiveDecreeResult(archived=False)
