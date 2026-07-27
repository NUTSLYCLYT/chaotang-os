from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from src.artifacts.delivery import render_one_artifact
from src.artifacts.service import deliver_artifact_packet
from src.contract_mission_repository import save_mission_snapshot
from src.contracts.mission_contract import (
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)
from src.db.models import DecisionTask, FinalMemorial, ShiguanArchive


def contract_mission(task_id: str) -> MissionContractV1:
    mission = MissionContractV1(
        mission_contract_id=task_id,
        task_id=task_id,
        revision=1,
        jurisdiction="CN_MAINLAND",
        language="zh-CN",
        contract_type="procurement",
        our_role="buyer",
        legal_question="contract_risk_screening",
        goal=MissionGoal(
            user_intent="完成采购合同审查",
            biggest_concern="付款、验收与责任边界",
        ),
        constraints=["不改变商业价格"],
        prohibited_actions=["不得伪造证据"],
        desired_outcome=MissionOutcome(required_artifacts=["PDF", "DOCX", "JSON"]),
        assumptions=["合同文本完整"],
        budget_limit_minor=0,
        deadline_at="2026-08-01T00:00:00+00:00",
        read_scope=["contract:source:v1"],
        plan_digest="a" * 64,
        content_digest="0" * 64,
        created_at="2026-07-27T00:00:00+00:00",
    )
    return mission.model_copy(
        update={"content_digest": compute_mission_content_digest(mission)}
    )


def contract_review_pack(
    task_id: str,
    *,
    tenant_id: str = "7",
    mission_contract_id: str | None = None,
    court_review_id: str | None = None,
    risk_items: list[dict[str, Any]] | None = None,
    source_labels: list[str] | None = None,
    engine_tiers: list[str] | None = None,
    quality_gate_status: str = "PASSED",
) -> dict[str, Any]:
    return {
        "schema_version": "ContractReviewPackV1",
        "review_pack_id": f"pack-{task_id}",
        "tenant_id": tenant_id,
        "task_id": task_id,
        "mission_contract_id": mission_contract_id or task_id,
        "court_review_id": court_review_id or f"review-{task_id}",
        "evidence_packet_ids": ["evidence-1"],
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "risk_items": risk_items or [],
        "verdict": "REVISE_BEFORE_PROCEED",
        "decision_summary": "付款、验收和责任条款需修改后再推进。",
        "affected_sections": ["contract_review"],
        "source_labels": source_labels or ["TASK_EVIDENCE"],
        "engine_tiers": engine_tiers or ["deterministic"],
        "quality_gate_status": quality_gate_status,
        "candidate_status": "CANDIDATE",
    }


def seed_contract_task(
    db,
    *,
    task_id: str = "task-contract-1",
    tenant_id: int = 7,
    user_id: str = "7",
    source_label: str = "LIVE",
    mission_state: str = "confirmed",
) -> DecisionTask:
    task = DecisionTask(
        id=task_id,
        tenant_id=tenant_id,
        user_id=user_id,
        raw_question="审查采购合同",
        refined_edict="识别风险、补证并生成审查包",
        status="reviewing",
        source_label=source_label,
    )
    db.add(task)
    db.flush()
    save_mission_snapshot(
        db,
        task=task,
        mission=contract_mission(task_id),
        state=mission_state,
    )
    db.flush()
    return task


def seed_final_memorial(
    db,
    *,
    task_id: str,
    tenant_id: int = 7,
    pack: dict[str, Any] | None = None,
    source_label: str = "LIVE",
) -> tuple[FinalMemorial, dict[str, Any]]:
    pack = pack or contract_review_pack(task_id)
    memorial = {"contract_review": pack}
    memorial_json = json.dumps(
        memorial,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    final = FinalMemorial(
        id=f"final-{task_id}",
        tenant_id=tenant_id,
        task_id=task_id,
        review_id=f"review-{task_id}",
        swarm_run_id=f"swarm-{task_id}",
        quality_result_id=f"quality-{task_id}",
        status="ready_for_decision",
        source_label=source_label,
        memorial_json=memorial_json,
        content_hash=hashlib.sha256(memorial_json.encode("utf-8")).hexdigest(),
        version=1,
        is_current=True,
    )
    db.add(final)
    db.flush()
    return final, pack


def seed_delivery(
    db,
    *,
    storage_root: Path,
    task_id: str,
    final: FinalMemorial,
    pack: dict[str, Any],
    delivery_formula_version: str = "w06-v1",
    idempotency_key: str = "contract-delivery-1",
    renderer: Callable[..., Any] = render_one_artifact,
):
    return deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id=task_id,
        final_memorial_id=final.id,
        final_memorial_version=final.version,
        payload=pack,
        delivery_formula_version=delivery_formula_version,
        idempotency_key=idempotency_key,
        requested_expiry_seconds=3600,
        renderer=renderer,
    )


def seed_exact_archive(
    db,
    *,
    task: DecisionTask,
    final: FinalMemorial,
    synthetic_flag: bool = False,
) -> ShiguanArchive:
    final.status = "archived"
    task.status = "archived"
    archive = ShiguanArchive(
        id=f"archive-{task.id}",
        tenant_id=task.tenant_id,
        task_id=task.id,
        raw_question=task.raw_question,
        refined_edict=task.refined_edict or "",
        final_memorial_json=final.memorial_json,
        final_memorial_id=final.id,
        final_memorial_version=final.version,
        final_memorial_content_hash=final.content_hash,
        emperor_decision_json=json.dumps(
            {"action": "approve", "reason": "人工确认"},
            sort_keys=True,
            separators=(",", ":"),
        ),
        evidence_chain_json="[]",
        source_label=final.source_label,
        synthetic_flag=synthetic_flag,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(archive)
    db.flush()
    return archive
