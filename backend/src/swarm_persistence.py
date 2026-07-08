"""蜂群运行结果持久化与军机处回写。"""
from __future__ import annotations

import json
from typing import Any

from src.db.models import CourtReview, SwarmEvidenceLink, SwarmQualityResult, SwarmRun, SwarmTaskRun
from src.shangshufang_loop import memorial_from_swarm_result, now_iso


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def persist_swarm_execution_result(db, result: dict[str, Any]) -> None:
    run = result["swarm_run"]
    db.add(
        SwarmRun(
            id=run["id"],
            task_id=run["task_id"],
            review_id=run["review_id"],
            mode=run["mode"],
            status=run["status"],
            source_label=run["source_label"],
            route_plan_json=_json(run["route_plan"]),
            trace_id=run.get("trace_id"),
            started_at=run["started_at"],
            finished_at=run["finished_at"],
            error=run.get("error"),
        )
    )
    for item in result["task_runs"]:
        db.add(
            SwarmTaskRun(
                id=item["id"],
                swarm_run_id=run["id"],
                swarm_id=item["swarm_id"],
                role=item["role"],
                status=item["status"],
                input_json=_json(item["input"]),
                output_json=_json(item["output"]),
                source_label=item["source_label"],
                confidence=item.get("confidence"),
                started_at=item["started_at"],
                finished_at=item["finished_at"],
                error=item.get("error"),
            )
        )
    for link in result["evidence_links"]:
        db.add(
            SwarmEvidenceLink(
                id=link["id"],
                swarm_run_id=run["id"],
                swarm_task_run_id=link["swarm_task_run_id"],
                claim=link["claim"],
                evidence_source_type=link["evidence_source_type"],
                evidence_ref=link.get("evidence_ref"),
                confidence=link["confidence"],
                created_at=run["finished_at"],
            )
        )
    quality = result["quality_result"]
    db.add(
        SwarmQualityResult(
            id=quality["id"],
            swarm_run_id=run["id"],
            passed=bool(quality["passed"]),
            blocking_reasons_json=_json(quality["blocking_reasons"]),
            warnings_json=_json(quality["warnings"]),
            revised_output_json=_json(quality["revised_output"]),
            created_at=quality["created_at"],
        )
    )


def attach_swarm_result_to_review(db, review_id: str, result: dict[str, Any]) -> None:
    # CourtReview may be pending in the same transaction during confirm-edict.
    # Flush first so the query can find and update that just-created row.
    db.flush()
    review = db.query(CourtReview).filter_by(id=review_id).first()
    if review is None:
        return
    memorial = _loads(review.memorial_json, {}) or {}
    memorial = memorial_from_swarm_result(memorial, result)
    review.memorial_json = _json(memorial)
    review.ministry_outputs_json = _json(memorial.get("ministry_outputs", []))
    review.conflict_summary_json = _json(memorial.get("conflict_summary", []))
    review.review_status = "awaiting_decision" if result["quality_result"]["passed"] else "awaiting_evidence"
    review.updated_at = now_iso()
