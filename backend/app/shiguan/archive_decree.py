"""Automatic 史馆 archival for a completed chancellor (丞相) decree.

This module builds one ``REPLY`` archive containing both the original
decree text and the chancellor's routing/processing result, then writes it
via ``app.shiguan.storage.create_archive``.

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

import json
import logging
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.shiguan import storage
from app.shiguan.errors import (
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanWriteNotCommittedError,
)
from app.shiguan.models import ArchiveEvidenceReferenceCreate

logger = logging.getLogger(__name__)

_TITLE_MAX_LENGTH = 80
_DEFAULT_RESPONDENT = "丞相"
_DEFAULT_MATTER_TYPE = "综合事项"
_APPROVED_ROUTE_AUTHORITY_SOURCE = "approved_route_authority"


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


def _approved_route_authority_evidence(
    internal_result: object | None,
) -> list[dict[str, object]]:
    approved_route = _get_field(internal_result, "approved_route")
    draft_version = _get_field(internal_result, "draft_version")
    draft_fingerprint = _get_field(internal_result, "draft_fingerprint")
    if approved_route is None:
        return []
    if draft_version is None and draft_fingerprint is None:
        return []
    if (
        not isinstance(draft_version, int)
        or draft_version < 1
        or not isinstance(draft_fingerprint, str)
        or len(draft_fingerprint) != 64
        or any(
            character not in "0123456789abcdef"
            for character in draft_fingerprint
        )
    ):
        raise ValueError("approved route authority audit is incomplete")
    departments = _get_field(approved_route, "departments")
    if not isinstance(departments, tuple) or not departments:
        raise ValueError("approved route authority departments are invalid")
    serialized_departments = [
        {
            "department": _get_field(route, "department"),
            "required_bureaus": list(
                _get_field(route, "required_bureaus", ()) or ()
            ),
        }
        for route in departments
    ]
    note = json.dumps(
        {
            "draft_fingerprint": draft_fingerprint,
            "draft_version": draft_version,
            "departments": serialized_departments,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return [
        {
            "source": _APPROVED_ROUTE_AUTHORITY_SOURCE,
            "reality_label": "LIVE",
            "note": note,
        }
    ]


def resolve_adopted_evidence_references(
    evidence_snapshot: object,
    adopted_evidence_ids: tuple[str, ...] | list[str],
) -> list[ArchiveEvidenceReferenceCreate]:
    """Resolve selected IDs from frozen pack order, rejecting any spoof/conflict."""

    adopted = tuple(adopted_evidence_ids)
    if len(adopted) != len(set(adopted)):
        raise ValueError("adopted evidence IDs must be unique")
    wanted = set(adopted)
    first: dict[str, ArchiveEvidenceReferenceCreate] = {}
    identities: dict[str, str] = {}
    for pack in _get_field(evidence_snapshot, "packs", ()) or ():
        pack_id = _get_field(pack, "pack_id")
        investigation_id = _get_field(pack, "investigation_id")
        request = _get_field(pack, "request")
        required_facts = _get_field(request, "required_facts", ()) or ()
        facts_by_key = {
            _get_field(fact, "key"): fact
            for fact in required_facts
            if _get_field(fact, "key")
        }
        evidence_by_fact = _get_field(pack, "evidence_by_fact", {})
        if not isinstance(evidence_by_fact, Mapping):
            raise ValueError("invalid frozen evidence pack")
        for fact_key, items in evidence_by_fact.items():
            fact = facts_by_key.get(fact_key)
            if fact is None:
                raise ValueError("current evidence is missing its fact binding")
            for item in items:
                evidence_id = _get_field(item, "evidence_id")
                if evidence_id not in wanted:
                    continue
                dumped = item.model_dump(mode="json", warnings="none")
                dumped.update(
                    {
                        "category": _get_field(fact, "category"),
                        "data_scope": _get_field(fact, "data_scope"),
                        "subject": _get_field(fact, "subject"),
                        "jurisdiction": _get_field(fact, "jurisdiction"),
                    }
                )
                reference = ArchiveEvidenceReferenceCreate(
                    pack_id=pack_id,
                    investigation_id=investigation_id,
                    snapshot=dumped,
                )
                identity = json.dumps(
                    reference.snapshot.model_dump(
                        mode="json", exclude={"retrieved_at"}
                    ),
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                )
                if evidence_id in identities and identities[evidence_id] != identity:
                    raise ValueError("selected evidence has immutable conflict")
                identities[evidence_id] = identity
                if evidence_id not in first:
                    first[evidence_id] = reference
    missing = wanted - first.keys()
    if missing:
        raise ValueError("selected evidence is missing from frozen packs")
    return [first[evidence_id] for evidence_id in adopted]


def _write_pending_evidence(
    reply_id: str,
    evidence_ids: tuple[str, ...],
    *,
    owner_user_id: str,
    jinyiwei_db_path: Path | None,
    batch_fingerprint: str,
) -> None:
    if not evidence_ids:
        return
    from app.jinyiwei import storage as jinyiwei_storage

    jinyiwei_storage.write_pending_adoptions(
        evidence_ids,
        reply_id,
        owner_user_id=owner_user_id,
        at=datetime.now(UTC),
        db_path=jinyiwei_db_path,
        batch_fingerprint=batch_fingerprint,
    )


def _confirm_reply_evidence(
    reply_id: str,
    evidence_ids: tuple[str, ...],
    *,
    owner_user_id: str,
    jinyiwei_db_path: Path | None,
    batch_fingerprint: str,
) -> None:
    if not evidence_ids:
        return
    from app.jinyiwei import storage as jinyiwei_storage

    jinyiwei_storage.confirm_adoptions(
        evidence_ids,
        reply_id,
        owner_user_id=owner_user_id,
        at=datetime.now(UTC),
        db_path=jinyiwei_db_path,
        batch_fingerprint=batch_fingerprint,
    )


def _link_reply_evidence(
    reply_id: str,
    evidence_ids: tuple[str, ...],
    *,
    owner_user_id: str,
    jinyiwei_db_path: Path | None,
    batch_fingerprint: str,
) -> None:
    _write_pending_evidence(
        reply_id,
        evidence_ids,
        owner_user_id=owner_user_id,
        jinyiwei_db_path=jinyiwei_db_path,
        batch_fingerprint=batch_fingerprint,
    )
    _confirm_reply_evidence(
        reply_id,
        evidence_ids,
        owner_user_id=owner_user_id,
        jinyiwei_db_path=jinyiwei_db_path,
        batch_fingerprint=batch_fingerprint,
    )


def reconcile_reply_evidence(
    reply_id: str,
    *,
    owner_user_id: str = "__system__",
    shiguan_db_path: Path | None = None,
    jinyiwei_db_path: Path | None = None,
) -> None:
    """Reconcile from immutable Shiguan state; callers supply only a REPLY ID."""

    reply = storage.get_archive(
        reply_id,
        owner_user_id=owner_user_id,
        db_path=shiguan_db_path,
    )
    if reply.type != "REPLY":
        raise ValueError("evidence reconciliation requires an existing REPLY")
    evidence_ids = tuple(
        reference.evidence_id for reference in reply.evidence_references
    )
    if not evidence_ids:
        return
    from app.jinyiwei import storage as jinyiwei_storage

    batch_fingerprint = jinyiwei_storage.adoption_batch_fingerprint(
        tuple(
            reference.snapshot.model_dump(
                mode="json",
                exclude={"category", "data_scope", "subject", "jurisdiction"},
            )
            for reference in reply.evidence_references
        )
    )
    _link_reply_evidence(
        reply_id,
        evidence_ids,
        owner_user_id=owner_user_id,
        jinyiwei_db_path=jinyiwei_db_path,
        batch_fingerprint=batch_fingerprint,
    )


def archive_chancellor_decree(
    decree_text: str,
    response: object,
    internal_result: object | None = None,
    *,
    shiguan_db_path: Path | None = None,
    jinyiwei_db_path: Path | None = None,
    reply_id: str | None = None,
    owner_user_id: str = "__system__",
) -> ArchiveDecreeResult:
    """Archive a completed chancellor decree as one REPLY record.

    The reply records ``decree_text`` as its ``DECREE`` source and captures
    ``response``'s routing/processing result. ``respondent`` defaults to
    ``"丞相"``.

    This function never raises -- every exception (malformed ``response``,
    validation failure, storage I/O failure) is caught and logged.
    """

    generated_reply_id = reply_id or uuid.uuid4().hex
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
        owning_department = departments[0] if departments else _DEFAULT_RESPONDENT
        process_parts = []
        if processing_path:
            process_parts.append(f"\u5904\u7406\u8def\u5f84\uff1a{' -> '.join(processing_path)}")
        if rationale:
            process_parts.append(f"\u4e1e\u76f8\u5206\u6d41\u7406\u7531\uff1a{rationale}")
        if council_verdict:
            process_parts.append(f"军机处会审结论：{council_verdict}")
        reply_process = "；".join(process_parts) if process_parts else "丞相直接裁决"
        reply_conclusion = final_verdict

        reply_time = datetime.now(UTC).isoformat()
        existing_reply = None
        if reply_id is not None:
            try:
                existing_reply = storage.get_archive(
                    reply_id,
                    owner_user_id=owner_user_id,
                    db_path=shiguan_db_path,
                )
            except ArchiveNotFoundError:
                pass
            else:
                if existing_reply.type == "REPLY" and existing_reply.reply_time:
                    reply_time = existing_reply.reply_time

        reply_payload = {
            "type": "REPLY",
            "title": _truncate(f"丞相回奏：{decree_text}", _TITLE_MAX_LENGTH),
            "content": reply_conclusion,
            "matter_type": matter_type,
            "department": owning_department,
            "source_kind": "DECREE",
            "source_text": decree_text,
            "participating_departments": departments or [_DEFAULT_RESPONDENT],
            "reply_process": reply_process,
            "reply_conclusion": reply_conclusion,
            "reply_time": reply_time,
            "respondent": _DEFAULT_RESPONDENT,
            "evidence": _approved_route_authority_evidence(internal_result),
        }
        adopted = tuple(_get_field(internal_result, "adopted_evidence_ids", ()) or ())
        snapshot = _get_field(internal_result, "evidence_snapshot")
        if adopted and snapshot is None:
            return ArchiveDecreeResult(archived=False)
        refs = (
            resolve_adopted_evidence_references(snapshot, adopted)
            if adopted
            else []
        )
        evidence_ids = tuple(reference.snapshot.evidence_id for reference in refs)
        from app.jinyiwei import storage as jinyiwei_storage

        batch_fingerprint = (
            jinyiwei_storage.adoption_batch_fingerprint(
                tuple(
                    reference.snapshot.model_dump(
                        mode="json",
                        exclude={
                            "category",
                            "data_scope",
                            "subject",
                            "jurisdiction",
                        },
                    )
                    for reference in refs
                )
            )
            if refs
            else ""
        )
        if existing_reply is not None:
            reply = storage.create_reply_with_evidence(
                reply_payload,
                refs,
                reply_id=generated_reply_id,
                owner_user_id=owner_user_id,
                db_path=shiguan_db_path,
            )
            try:
                _link_reply_evidence(
                    reply.id,
                    evidence_ids,
                    owner_user_id=owner_user_id,
                    jinyiwei_db_path=jinyiwei_db_path,
                    batch_fingerprint=batch_fingerprint,
                )
            except Exception:  # noqa: BLE001 - repairable cross-database boundary
                logger.exception("丞相回奏证据链接失败，等待按 reply_id 对账")
            return ArchiveDecreeResult(archived=True, reply_id=reply.id)
        _write_pending_evidence(
            generated_reply_id,
            evidence_ids,
            owner_user_id=owner_user_id,
            jinyiwei_db_path=jinyiwei_db_path,
            batch_fingerprint=batch_fingerprint,
        )
        try:
            reply = storage.create_reply_with_evidence(
                reply_payload,
                refs,
                reply_id=generated_reply_id,
                owner_user_id=owner_user_id,
                db_path=shiguan_db_path,
            )
        except (ArchiveValidationError, ShiguanWriteNotCommittedError):
            if evidence_ids:
                jinyiwei_storage.cancel_pending_adoptions(
                    evidence_ids,
                    generated_reply_id,
                    owner_user_id=owner_user_id,
                    db_path=jinyiwei_db_path,
                    batch_fingerprint=batch_fingerprint,
                )
            logger.exception("丞相回奏在提交前失败，已终结待确认批次")
            return ArchiveDecreeResult(
                archived=False, reply_id=generated_reply_id
            )
        except Exception:  # noqa: BLE001 - commit result is ambiguous by default
            logger.exception("丞相回奏提交结果不明确，保留 reply_id 等待对账")
            return ArchiveDecreeResult(
                archived=False, reply_id=generated_reply_id
            )
        try:
            _confirm_reply_evidence(
                reply.id,
                evidence_ids,
                owner_user_id=owner_user_id,
                jinyiwei_db_path=jinyiwei_db_path,
                batch_fingerprint=batch_fingerprint,
            )
        except Exception:  # noqa: BLE001 - repairable cross-database boundary
            logger.exception("丞相回奏证据链接失败，等待按 reply_id 对账")
        return ArchiveDecreeResult(archived=True, reply_id=reply.id)
    except Exception:  # noqa: BLE001 - archival must never break the decree endpoint
        logger.exception("丞相旨意自动归档失败")
        return ArchiveDecreeResult(
            archived=False, reply_id=generated_reply_id
        )
