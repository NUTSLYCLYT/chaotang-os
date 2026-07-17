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
from datetime import UTC, datetime

from app.shiguan import storage

logger = logging.getLogger(__name__)

_TITLE_MAX_LENGTH = 80
_DEFAULT_RESPONSIBLE_OWNER = "丞相"
_DEFAULT_MATTER_TYPE = "综合事项"


def _get_field(response: object, name: str, default: object = None) -> object:
    if isinstance(response, dict):
        return response.get(name, default)
    return getattr(response, name, default)


def _truncate(text: str, max_length: int) -> str:
    stripped = text.strip()
    if len(stripped) <= max_length:
        return stripped
    return stripped[:max_length].rstrip() + "…"


def archive_chancellor_decree(decree_text: str, response: object) -> None:
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

        matter_type = "、".join(departments) if departments else _DEFAULT_MATTER_TYPE

        memorial_payload = {
            "type": "MEMORIAL",
            "title": _truncate(decree_text, _TITLE_MAX_LENGTH) or "旨意",
            "content": decree_text,
            "matter_type": matter_type,
            "department": _DEFAULT_RESPONSIBLE_OWNER,
        }
        memorial = storage.create_archive(memorial_payload)

        process_parts = []
        if processing_path:
            process_parts.append(f"处理路径：{'->'.join(processing_path)}")
        if rationale:
            process_parts.append(f"丞相分流理由：{rationale}")
        if council_verdict:
            process_parts.append(f"军机处会审结论：{council_verdict}")
        decision_process = "；".join(process_parts) if process_parts else "丞相直接裁决"

        decision_conclusion = final_verdict or "（无最终裁决内容）"

        decision_payload = {
            "type": "DECISION",
            "title": _truncate(f"丞相决策：{decree_text}", _TITLE_MAX_LENGTH),
            "content": decision_conclusion,
            "matter_type": matter_type,
            "department": matter_type,
            "related_archive_ids": [memorial.id],
            "participating_departments": departments or [_DEFAULT_RESPONSIBLE_OWNER],
            "decision_process": decision_process,
            "decision_conclusion": decision_conclusion,
            "decision_time": datetime.now(UTC).isoformat(),
            "responsible_owner": _DEFAULT_RESPONSIBLE_OWNER,
        }
        storage.create_archive(decision_payload)
    except Exception:  # noqa: BLE001 - archival must never break the decree endpoint
        logger.exception("丞相旨意自动归档失败")
        return None
