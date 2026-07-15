"""史官读模型：把 canonical 正式奏折与史馆归档投影成前端既有契约。

P3a 收口后，本路由只读 canonical DB。史馆归档内的正式奏折快照优先；早期归档
若没有快照，才回退同一事实源中的 FinalMemorial。没有真实内容时返回空，不合成
教训、证据、标签或来源。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/scribe", tags=["scribe"])
logger = logging.getLogger(__name__)

_ADJUDICABLE_SOURCES = frozenset({"LIVE", "MIXED", "LIVE_ENGINE", "LIVE_SWARM"})


def _loads_dict(value: str | None) -> dict[str, Any]:
    try:
        loaded = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _lesson_texts(memorial: dict[str, Any]) -> list[str]:
    explicit = memorial.get("lessons")
    if isinstance(explicit, list):
        lessons = [
            item.strip()
            for item in explicit
            if isinstance(item, str) and item.strip()
        ]
        if lessons:
            return lessons
    summary = memorial.get("summary")
    return [summary.strip()] if isinstance(summary, str) and summary.strip() else []


def _wire_source_label(source_label: str) -> str:
    # 前端 CourtDoc 契约把引擎实现层归入真实来源，不暴露 LIVE_ENGINE 内部别名。
    return "LIVE" if source_label == "LIVE_ENGINE" else source_label


def _canonical_archives() -> list[dict[str, Any]]:
    """读取每个 task 最新的真实归档，并补齐可选的正式奏折快照。"""
    from src.tenant import DEFAULT_TENANT_SLUG, get_current_tenant

    # 当前 canonical 两张表还没有 tenant_id；非 default 租户必须 fail closed。
    if (get_current_tenant() or DEFAULT_TENANT_SLUG) != DEFAULT_TENANT_SLUG:
        return []

    from src.db.engine import SessionLocal
    from src.db.models import FinalMemorial, ShiguanArchive

    try:
        db = SessionLocal()
        try:
            rows = (
                db.query(ShiguanArchive)
                .order_by(ShiguanArchive.created_at.desc())
                .limit(200)
                .all()
            )
            task_ids = {row.task_id for row in rows}
            formal_rows = (
                db.query(FinalMemorial)
                .filter(FinalMemorial.task_id.in_(task_ids))
                .all()
                if task_ids
                else []
            )
            formal_by_task = {row.task_id: row for row in formal_rows}

            # ORM rows are expired after session close in the default sessionmaker;
            # copy the projection while the session is live.
            projected: list[dict[str, Any]] = []
            seen_tasks: set[str] = set()
            for row in rows:
                if row.task_id in seen_tasks:
                    continue
                seen_tasks.add(row.task_id)
                formal = formal_by_task.get(row.task_id)
                memorial = _loads_dict(row.final_memorial_json)
                if not memorial and formal is not None:
                    memorial = _loads_dict(formal.memorial_json)
                decision = _loads_dict(row.emperor_decision_json)
                source_label = str(
                    row.source_label
                    or (formal.source_label if formal is not None else "")
                )
                projected.append(
                    {
                        "archive_id": row.id,
                        "task_id": row.task_id,
                        "title": (
                            str(memorial.get("title") or "").strip()
                            or (row.refined_edict or row.raw_question or "").strip()
                            or row.task_id
                        ),
                        "created_at": row.created_at,
                        "memorial": memorial,
                        "decision": decision,
                        "source_label": source_label,
                        "synthetic": bool(row.synthetic_flag),
                    }
                )
            return projected
        finally:
            db.close()
    except Exception:
        logger.warning("scribe canonical projection unavailable", exc_info=True)
        return []


def _usable_archives() -> list[dict[str, Any]]:
    return [
        archive
        for archive in _canonical_archives()
        if not archive["synthetic"]
        and archive["source_label"] in _ADJUDICABLE_SOURCES
        and _lesson_texts(archive["memorial"])
    ]


@router.get("/lessons")
def scribe_lessons(_: CurrentUser = Depends(get_current_user)) -> dict:
    """投影真实归档内容；没有单独 lessons 时使用正式奏折的真实 summary。"""
    entries = []
    for archive in _usable_archives():
        task_id = archive["task_id"]
        texts = _lesson_texts(archive["memorial"])
        entries.append(
            {
                "billId": task_id,
                "billTitle": archive["title"],
                "extractedAt": archive["created_at"],
                "lessons": [
                    {"id": f"{task_id}-{index}", "text": text, "severity": "note"}
                    for index, text in enumerate(texts)
                ],
                "patterns": [],
                "tags": [],
                "summary": str(archive["decision"].get("reason") or ""),
            }
        )
    return ok({"lessons": entries})


@router.get("/archive-docs")
def scribe_archive_docs(_: CurrentUser = Depends(get_current_user)) -> dict:
    """把已人工裁决的真实史馆归档重塑成 CourtDoc，不臆造证据。"""
    docs = []
    for archive in _usable_archives():
        docs.append(
            {
                "caseId": archive["task_id"],
                "light": "green",
                "headline": archive["title"],
                "shielded": None,
                "items": [
                    {
                        "level": "yellow",
                        "title": text,
                        "odds": None,
                        "impact": None,
                        "fix": None,
                        "evidenceRef": None,
                    }
                    for text in _lesson_texts(archive["memorial"])
                ],
                "actions": ["open_annals", "trace_evidence", "export_amulet"],
                "provenance": {
                    "advisors": [],
                    "grounding": "none",
                    "gate": "passed",
                },
                "sourceLabel": _wire_source_label(archive["source_label"]),
                "signed": True,
                "sealedArchive": archive["archive_id"],
            }
        )
    return ok({"docs": docs})
