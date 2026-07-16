"""Promote one quality- and provenance-gated candidate into a formal memorial."""

from __future__ import annotations

import json
from hashlib import sha256
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from src.db.models import FinalMemorial


ADJUDICABLE_SOURCE_LABELS = frozenset({"LIVE", "MIXED", "LIVE_ENGINE", "LIVE_SWARM"})


class FormalMemorialBlocked(ValueError):
    """The candidate cannot cross the formal decision boundary."""


def ensure_final_memorial_table(db: "Session") -> None:
    """Create the additive fact table for legacy local/edge databases."""
    from src.db.models import FinalMemorial

    FinalMemorial.__table__.create(db.get_bind(), checkfirst=True)


def adjudication_block_reason(quality_result: dict[str, Any], source_label: str) -> str | None:
    if not bool(quality_result.get("passed")):
        return "quality_gate_failed"
    if source_label not in ADJUDICABLE_SOURCE_LABELS:
        return f"non_adjudicable_source:{source_label}"
    return None


def formalize_memorial(
    db: "Session",
    *,
    task_id: str,
    review_id: str,
    swarm_result: dict[str, Any],
) -> "FinalMemorial":
    """Create or idempotently replay the sole formal memorial for a task."""
    from src.db.models import CourtReview, FinalMemorial

    # Existing local/edge databases may be opened before Alembic 010 has run.
    # SQLAlchemy create_all does not add new tables to an already-created DB, so keep
    # the official worker from dead-lettering solely because this additive table is
    # absent.  Alembic remains the production schema history and creates the same
    # model/index shape; checkfirst makes this a no-op after migration.
    ensure_final_memorial_table(db)

    run = swarm_result.get("swarm_run") or {}
    quality = swarm_result.get("quality_result") or {}
    source_label = str(run.get("source_label") or "FALLBACK")
    reason = adjudication_block_reason(quality, source_label)
    if reason:
        raise FormalMemorialBlocked(reason)
    if run.get("task_id") not in {None, task_id}:
        raise FormalMemorialBlocked("swarm_run_task_mismatch")
    if run.get("review_id") not in {None, review_id}:
        raise FormalMemorialBlocked("swarm_run_review_mismatch")

    review = db.query(CourtReview).filter_by(id=review_id, task_id=task_id).first()
    if review is None:
        raise FormalMemorialBlocked("candidate_review_not_found")
    from src.core_tenant_lineage import (
        assert_known_tenant_lineage_consistent,
        assert_no_tenant_lineage_conflict,
    )

    assert_no_tenant_lineage_conflict(db, task_id=task_id, inherited_tenant_id=review.tenant_id)
    try:
        memorial = json.loads(review.memorial_json or "null")
    except json.JSONDecodeError as exc:
        raise FormalMemorialBlocked("candidate_memorial_invalid_json") from exc
    if not isinstance(memorial, dict) or not memorial:
        raise FormalMemorialBlocked("candidate_memorial_empty")

    memorial_json = json.dumps(memorial, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    content_hash = sha256(memorial_json.encode("utf-8")).hexdigest()
    swarm_run_id = str(run.get("id") or "")
    if not swarm_run_id:
        raise FormalMemorialBlocked("swarm_run_id_missing")
    quality_result_id = str(quality.get("id") or f"quality:{swarm_run_id}")

    existing = db.query(FinalMemorial).filter_by(task_id=task_id).first()
    if existing is not None:
        assert_known_tenant_lineage_consistent(
            context=f"formal_memorial:{task_id}",
            review_tenant_id=review.tenant_id,
            memorial_tenant_id=existing.tenant_id,
        )
        immutable = (
            existing.review_id,
            existing.swarm_run_id,
            existing.quality_result_id,
            existing.source_label,
            existing.content_hash,
        )
        candidate = (
            review_id,
            swarm_run_id,
            quality_result_id,
            source_label,
            content_hash,
        )
        if immutable != candidate:
            raise FormalMemorialBlocked("formal_memorial_conflict")
        return existing

    memorial_id = f"formal_{sha256(task_id.encode('utf-8')).hexdigest()[:16]}"
    row = FinalMemorial(
        id=memorial_id,
        tenant_id=review.tenant_id,
        task_id=task_id,
        review_id=review_id,
        swarm_run_id=swarm_run_id,
        quality_result_id=quality_result_id,
        status="ready_for_decision",
        source_label=source_label,
        memorial_json=memorial_json,
        content_hash=content_hash,
    )
    db.add(row)
    from src.migration_telemetry import record_canonical_chain_event_after_commit

    record_canonical_chain_event_after_commit(
        db, "final_memorial_promoted", caller_id="formal_memorial.formalize_memorial"
    )
    return row
