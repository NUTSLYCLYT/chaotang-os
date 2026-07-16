"""史官读模型：只投影 canonical、append-only 的真实结果事件。

正式奏折回答“当时建议什么”，结果事件回答“后来实际怎样”。两者不可互相
冒充：奏折 summary 永远不会被合成 lesson；存储不可用时显式 503，而不是返回
一个看似可信的空列表。
"""

from __future__ import annotations

import json
import logging
from typing import Any

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException

from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/scribe", tags=["scribe"])
logger = logging.getLogger(__name__)

_ADJUDICABLE_SOURCES = frozenset({"LIVE", "MIXED", "LIVE_ENGINE", "LIVE_SWARM"})
_TERMINAL_SUCCESS = frozenset({"success", "succeeded", "completed", "passed"})
_TERMINAL_BLOCKED = frozenset({"blocked", "failed", "error", "rejected"})
_ADOPT_ACTIONS = frozenset({"adopt", "approve", "archive"})


def _loads_dict(value: str | None) -> dict[str, Any]:
    try:
        loaded = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _lesson_texts(payload: dict[str, Any]) -> list[str]:
    explicit = payload.get("lessons")
    if not isinstance(explicit, list):
        return []
    return [
        item.strip()
        for item in explicit
        if isinstance(item, str) and item.strip()
    ]


def _wire_source_label(source_label: str) -> str:
    return "LIVE" if source_label == "LIVE_ENGINE" else source_label


def _canonical_outcomes() -> list[dict[str, Any]]:
    """Read the latest terminal outcome per task, capped after task de-duplication."""
    from src.tenant import (
        DEFAULT_TENANT_SLUG,
        get_current_tenant,
        resolve_current_tenant_id,
    )

    # The legacy canonical court tables remain unscoped. Never expose them to a
    # non-default tenant merely because the outcome ledger itself has tenant_id.
    if (get_current_tenant() or DEFAULT_TENANT_SLUG) != DEFAULT_TENANT_SLUG:
        return []
    tenant_id = resolve_current_tenant_id()

    from src.db.engine import SessionLocal
    from src.db.models import (
        ArchiveOutcomeEvent,
        EmperorDecision,
        FinalMemorial,
        ShiguanArchive,
    )

    db = None
    try:
        db = SessionLocal()
        rank = sa.func.row_number().over(
            partition_by=ArchiveOutcomeEvent.task_id,
            order_by=(
                ArchiveOutcomeEvent.recorded_at.desc(),
                ArchiveOutcomeEvent.id.desc(),
            ),
        ).label("row_rank")
        ranked = (
            db.query(ArchiveOutcomeEvent.id.label("event_id"), rank)
            .filter(
                ArchiveOutcomeEvent.tenant_id == tenant_id,
                ArchiveOutcomeEvent.synthetic_flag.is_(False),
            )
            .subquery()
        )
        events = (
            db.query(ArchiveOutcomeEvent)
            .join(ranked, ranked.c.event_id == ArchiveOutcomeEvent.id)
            .filter(ranked.c.row_rank == 1)
            .order_by(
                ArchiveOutcomeEvent.recorded_at.desc(),
                ArchiveOutcomeEvent.id.desc(),
            )
            .limit(200)
            .all()
        )
        task_ids = {event.task_id for event in events}
        archive_ids = {event.archive_id for event in events if event.archive_id}

        archives = (
            db.query(ShiguanArchive)
            .filter(
                sa.or_(
                    ShiguanArchive.id.in_(archive_ids) if archive_ids else sa.false(),
                    ShiguanArchive.task_id.in_(task_ids) if task_ids else sa.false(),
                )
            )
            .order_by(ShiguanArchive.created_at.desc(), ShiguanArchive.id.desc())
            .all()
        )
        archive_by_id = {archive.id: archive for archive in archives}
        latest_archive_by_task: dict[str, ShiguanArchive] = {}
        for archive in archives:
            latest_archive_by_task.setdefault(archive.task_id, archive)

        formals = (
            db.query(FinalMemorial).filter(FinalMemorial.task_id.in_(task_ids)).all()
            if task_ids
            else []
        )
        formal_by_task = {formal.task_id: formal for formal in formals}
        decisions = (
            db.query(EmperorDecision)
            .filter(EmperorDecision.task_id.in_(task_ids))
            .order_by(EmperorDecision.created_at.desc(), EmperorDecision.id.desc())
            .all()
            if task_ids
            else []
        )
        latest_decision_by_task: dict[str, EmperorDecision] = {}
        for decision in decisions:
            latest_decision_by_task.setdefault(decision.task_id, decision)

        projected: list[dict[str, Any]] = []
        for event in events:
            actual = str(event.actual or "").strip().lower()
            if actual not in _TERMINAL_SUCCESS | _TERMINAL_BLOCKED:
                continue
            archive = archive_by_id.get(event.archive_id) or latest_archive_by_task.get(
                event.task_id
            )
            if archive is not None and archive.synthetic_flag:
                continue
            source_label = str(
                event.source_type
                or (archive.source_label if archive is not None else "")
            )
            if source_label not in _ADJUDICABLE_SOURCES:
                continue
            payload = _loads_dict(event.payload_json)
            lessons = _lesson_texts(payload)
            if not lessons:
                continue

            memorial = _loads_dict(
                archive.final_memorial_json if archive is not None else None
            )
            formal = formal_by_task.get(event.task_id)
            if not memorial and formal is not None:
                memorial = _loads_dict(formal.memorial_json)
            archived_decision = _loads_dict(
                archive.emperor_decision_json if archive is not None else None
            )
            latest_decision = latest_decision_by_task.get(event.task_id)
            decision_action = str(
                archived_decision.get("action")
                or (latest_decision.action if latest_decision is not None else "")
            ).lower()
            blocked = actual in _TERMINAL_BLOCKED or decision_action == "reject"
            title = str(memorial.get("title") or "").strip()
            if not title and archive is not None:
                title = str(archive.refined_edict or archive.raw_question or "").strip()

            projected.append(
                {
                    "archive_id": archive.id if archive is not None else None,
                    "task_id": event.task_id,
                    "title": title or event.task_id,
                    "occurred_at": event.occurred_at,
                    "lessons": lessons,
                    "playbook": str(payload.get("playbook") or ""),
                    "actual": actual,
                    "blocked": blocked,
                    "source_label": source_label,
                    "signed": event.source_auth_level
                    in {"authenticated", "human_confirmed"},
                    "adopted": decision_action in _ADOPT_ACTIONS,
                }
            )
        return projected
    except HTTPException:
        raise
    except Exception:
        logger.warning("scribe canonical projection unavailable", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="史官事实账本暂不可用",
        ) from None
    finally:
        if db is not None:
            db.close()


@router.get("/lessons")
def scribe_lessons(_: CurrentUser = Depends(get_current_user)) -> dict:
    entries = []
    for outcome in _canonical_outcomes():
        task_id = outcome["task_id"]
        entries.append(
            {
                "billId": task_id,
                "billTitle": outcome["title"],
                "extractedAt": outcome["occurred_at"],
                "lessons": [
                    {"id": f"{task_id}-{index}", "text": text, "severity": "note"}
                    for index, text in enumerate(outcome["lessons"])
                ],
                "patterns": [],
                "tags": [],
                "summary": outcome["playbook"],
            }
        )
    return ok({"lessons": entries})


@router.get("/archive-docs")
def scribe_archive_docs(_: CurrentUser = Depends(get_current_user)) -> dict:
    docs = []
    for outcome in _canonical_outcomes():
        blocked = outcome["blocked"]
        docs.append(
            {
                "caseId": outcome["task_id"],
                "light": "red" if blocked else "green",
                "headline": outcome["title"],
                "shielded": None,
                "items": [
                    {
                        "level": "red" if blocked else "yellow",
                        "title": text,
                        "odds": None,
                        "impact": None,
                        "fix": None,
                        "evidenceRef": None,
                    }
                    for text in outcome["lessons"]
                ],
                "actions": ["open_annals", "trace_evidence", "export_amulet"],
                "provenance": {
                    "advisors": [],
                    "grounding": "none",
                    "gate": "blocked" if blocked else "passed",
                },
                "sourceLabel": _wire_source_label(outcome["source_label"]),
                "signed": bool(outcome["signed"] and not blocked),
                "sealedArchive": outcome["archive_id"],
            }
        )
    return ok({"docs": docs})
