from __future__ import annotations

import hashlib
import json
from typing import Any


def contract_review_pack(
    *,
    task_id: str,
    tenant_id: str = "tenant-7",
    decision_summary: str = "付款和责任条款需修改后再推进。",
    risk_marker: str | None = None,
) -> dict[str, Any]:
    risk_items: list[dict[str, Any]] = []
    if risk_marker is not None:
        risk_items.append(
            {
                "schema_version": "ContractRiskItemV1",
                "risk_item_id": f"risk-{task_id}",
                "evidence_packet_id": "evidence-1",
                "file_version_id": "file-version-1",
                "page_number": 3,
                "clause_ref": "section-8.2",
                "raw_excerpt": risk_marker,
                "risk_level": "high",
                "explanation": f"explanation-{risk_marker}",
                "missing_evidence": [],
                "recommended_revision": f"revision-{risk_marker}",
                "source_label": "TASK_EVIDENCE",
                "engine_tier": "validated_model",
            }
        )
    return {
        "schema_version": "ContractReviewPackV1",
        "review_pack_id": f"pack-{task_id}",
        "tenant_id": tenant_id,
        "task_id": task_id,
        "mission_contract_id": f"mission-{task_id}",
        "court_review_id": f"review-{task_id}",
        "evidence_packet_ids": ["evidence-1"],
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "risk_items": risk_items,
        "verdict": "REVISE_BEFORE_PROCEED",
        "decision_summary": decision_summary,
        "affected_sections": ["contract_review"],
        "source_labels": ["TASK_EVIDENCE"],
        "engine_tiers": ["validated_model"],
        "quality_gate_status": "PENDING",
        "candidate_status": "CANDIDATE",
    }


def seed_delivery_source(
    db,
    *,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    payload: dict[str, Any] | None = None,
    task_tenant_id: int | None = None,
    memorial_tenant_id: int | None = None,
    status: str = "ready_for_decision",
    is_current: bool = True,
    content_hash: str | None = None,
    add_task: bool = True,
    add_memorial: bool = True,
):
    from src.db.models import DecisionTask, FinalMemorial

    canonical_payload = payload or contract_review_pack(
        task_id=task_id,
        tenant_id=f"tenant-{tenant_id}",
    )
    if add_task:
        db.add(
            DecisionTask(
                id=task_id,
                tenant_id=tenant_id if task_tenant_id is None else task_tenant_id,
                user_id="artifact-test-user",
                raw_question="deliver the canonical contract review pack",
                status="reviewed",
                source_label="LIVE",
            )
        )

    memorial = {"contract_review": canonical_payload}
    memorial_json = json.dumps(
        memorial,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    row = None
    if add_memorial:
        row = FinalMemorial(
            id=final_memorial_id,
            tenant_id=tenant_id if memorial_tenant_id is None else memorial_tenant_id,
            task_id=task_id,
            review_id=f"review-{task_id}",
            swarm_run_id=f"swarm-{task_id}",
            quality_result_id=f"quality-{task_id}",
            status=status,
            source_label="LIVE",
            memorial_json=memorial_json,
            content_hash=content_hash
            or hashlib.sha256(memorial_json.encode("utf-8")).hexdigest(),
            version=final_memorial_version,
            is_current=is_current,
        )
        db.add(row)
    db.flush()
    return canonical_payload, row
