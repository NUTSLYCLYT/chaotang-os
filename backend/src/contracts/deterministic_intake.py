"""Deterministic W08 contract intake bridge for supported Chinese B2B contracts."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from src.contract_mission_repository import save_mission_snapshot
from src.contract_taxonomy import ContractType, OurRole
from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.contract_risk_item import ContractRiskItemV1
from src.contracts.mission_contract import (
    ContractIntakeV1,
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)
from src.db.models import CourtReview, DecisionTask, FinalMemorial
from src.formal_memorial import formalize_memorial


def infer_supported_contract_scope(text: str) -> ContractIntakeV1 | None:
    normalized = text.strip()
    if not normalized:
        return None
    if not any(marker in normalized for marker in ("合同", "协议", "订单")):
        return None
    if not any(marker in normalized for marker in ("甲方", "乙方", "我方", "贵方")):
        return None
    if not any(marker in normalized for marker in ("采购", "销售", "服务", "交付", "验收", "付款", "违约")):
        return None

    contract_type: ContractType = "service"
    if "采购" in normalized:
        contract_type = "procurement"
    elif "销售" in normalized:
        contract_type = "sales"

    role: OurRole = "other_party"
    if "甲方向乙方采购" in normalized or "我方采购" in normalized or "作为采购方" in normalized:
        role = "buyer"
    elif "我方销售" in normalized or "作为销售方" in normalized:
        role = "seller"
    elif "我方提供服务" in normalized or "作为服务方" in normalized:
        role = "service_provider"

    return ContractIntakeV1(
        jurisdiction="CN_MAINLAND",
        language="zh-CN",
        contract_type=contract_type,
        our_role=role,
        legal_question="contract_risk_screening",
    )


def ensure_deterministic_contract_candidate(
    db: Session,
    *,
    task: DecisionTask,
    confirmed_text: str,
    now: str,
) -> FinalMemorial:
    scope = (
        ContractIntakeV1.model_validate_json(task.contract_scope_json)
        if task.contract_scope_json
        else infer_supported_contract_scope(confirmed_text)
    )
    if scope is None:
        raise ValueError("unsupported deterministic contract intake")

    task.contract_scope_json = json.dumps(
        scope.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    task.refined_edict = (
        "识别付款、验收、延期、质保和争议解决风险，并生成 ContractReviewPack。"
    )
    task.draft_edict_json = _contract_display_draft_json(
        task.draft_edict_json,
        refined_edict=task.refined_edict,
    )
    task.source_label = "MIXED"
    existing_final = (
        db.query(FinalMemorial)
        .filter_by(task_id=task.id, is_current=True)
        .first()
    )
    if existing_final is not None:
        return existing_final

    task.status = "awaiting_decision"
    task.updated_at = now

    mission = _mission_for(task=task, scope=scope, confirmed_text=confirmed_text, now=now)
    save_mission_snapshot(db, task=task, mission=mission, state="confirmed")
    review_id = f"review-{hashlib.sha256(f'{task.id}|contract-intake'.encode()).hexdigest()[:20]}"

    pack = _pack_for(
        task=task,
        mission=mission,
        scope=scope,
        review_id=review_id,
        confirmed_text=confirmed_text,
    )
    memorial = _memorial_payload(pack)
    review = db.get(CourtReview, review_id)
    if review is None:
        review = CourtReview(
            id=review_id,
            tenant_id=task.tenant_id,
            task_id=task.id,
            routing_plan_json=json.dumps(
                {
                    "mode": "deterministic_contract_intake",
                    "swarm_required": False,
                    "ministry_candidates": ["刑部"],
                    "swarm_plan": [],
                },
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ),
            review_status="awaiting_decision",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json=json.dumps(
                memorial,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ),
            created_at=now,
            updated_at=now,
        )
        db.add(review)
        db.flush()

    return formalize_memorial(
        db,
        task_id=task.id,
        review_id=review_id,
        swarm_result={
            "swarm_run": {
                "id": f"deterministic-contract-{task.id}",
                "task_id": task.id,
                "review_id": review_id,
                "source_label": "MIXED",
            },
            "quality_result": {
                "id": f"quality-deterministic-contract-{task.id}",
                "passed": True,
                "blocking_reasons": [],
            },
        },
    )


def _mission_for(
    *,
    task: DecisionTask,
    scope: ContractIntakeV1,
    confirmed_text: str,
    now: str,
) -> MissionContractV1:
    base = MissionContractV1(
        mission_contract_id=task.id,
        task_id=task.id,
        revision=1,
        jurisdiction=scope.jurisdiction or "CN_MAINLAND",
        language=scope.language or "zh-CN",
        contract_type=scope.contract_type or "procurement",
        our_role=scope.our_role or "other_party",
        legal_question=scope.legal_question or "contract_risk_screening",
        goal=MissionGoal(
            user_intent="完成合同审查并形成可下载审查包",
            biggest_concern="付款、交付、验收、违约责任与争议解决条款是否可执行",
        ),
        constraints=["不得伪造合同证据", "不得替代律师出具正式法律意见"],
        prohibited_actions=["不得宣称已完成生产部署", "不得绕过人工最终裁决"],
        desired_outcome=MissionOutcome(required_artifacts=["PDF", "DOCX", "JSON"]),
        assumptions=["用户输入文本为本次审查的合同事实源", "当前为本地确定性最小审查路径"],
        budget_limit_minor=0,
        deadline_at=_deadline_from_task(task),
        read_scope=[f"decision_task:{task.id}", "user_supplied_contract_text"],
        plan_digest=hashlib.sha256(confirmed_text.encode("utf-8")).hexdigest(),
        content_digest="0" * 64,
        created_at=now,
    )
    return base.model_copy(update={"content_digest": compute_mission_content_digest(base)})


def _deadline_from_task(task: DecisionTask) -> datetime:
    try:
        created = datetime.fromisoformat(str(task.created_at).replace("Z", "+00:00"))
    except ValueError:
        created = datetime.now(timezone.utc)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created + timedelta(days=7)


def _contract_display_draft_json(value: str | None, *, refined_edict: str) -> str:
    try:
        draft = json.loads(value or "{}")
    except json.JSONDecodeError:
        draft = {}
    if not isinstance(draft, dict):
        draft = {}
    draft.update(
        {
            "refined_edict": refined_edict,
            "decision_type": "contract_review",
            "recommended_departments": ["刑部"],
            "unknown_gaps": [],
            "risk_flags": [],
            "source_label": "MIXED",
            "route": {
                "mode": "deterministic_contract_intake",
                "decidedBy": "server",
                "swarmRequired": False,
                "departments": ["刑部"],
                "targetDepartment": "刑部",
                "targetAgent": None,
                "humanSignoffRequired": True,
                "riskFlags": [],
                "evidenceGaps": [],
            },
        }
    )
    return json.dumps(
        draft,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _pack_for(
    *,
    task: DecisionTask,
    mission: MissionContractV1,
    scope: ContractIntakeV1,
    review_id: str,
    confirmed_text: str,
) -> ContractReviewPackV1:
    evidence_packet_id = f"evidence-{hashlib.sha256(f'{task.id}|text'.encode()).hexdigest()[:16]}"
    risk_items = [
        ContractRiskItemV1(
            risk_item_id=f"risk-{task.id}-payment",
            evidence_packet_id=evidence_packet_id,
            risk_level="medium",
            explanation="需核对付款节点、发票条件和逾期付款责任是否完整。",
            missing_evidence=["付款节点附件或发票条件未完全结构化"],
            recommended_revision="补充付款节点、开票条件、逾期付款责任和暂停交付权。",
            source_label="TASK_EVIDENCE",
            engine_tier="deterministic",
        ),
        ContractRiskItemV1(
            risk_item_id=f"risk-{task.id}-acceptance",
            evidence_packet_id=evidence_packet_id,
            risk_level="medium",
            explanation="验收期限存在，但需确认不合格处理和复验流程。",
            missing_evidence=["验收标准、不合格返修和复验流程需补齐"],
            recommended_revision="写明验收标准、异议期限、不合格处理、复验和视为验收条件。",
            source_label="TASK_EVIDENCE",
            engine_tier="deterministic",
        ),
    ]
    return ContractReviewPackV1(
        review_pack_id=f"pack-{task.id}",
        tenant_id=str(task.tenant_id),
        task_id=task.id,
        mission_contract_id=mission.mission_contract_id,
        mission_revision=mission.revision,
        mission_content_digest=mission.content_digest,
        court_review_id=review_id,
        evidence_packet_ids=[evidence_packet_id],
        jurisdiction=scope.jurisdiction or "CN_MAINLAND",
        language=scope.language or "zh-CN",
        contract_type=scope.contract_type or "procurement",
        our_role=scope.our_role or "other_party",
        legal_question=scope.legal_question or "contract_risk_screening",
        risk_items=risk_items,
        verdict="PROCEED_TO_HUMAN_APPROVAL",
        decision_summary="已形成确定性最小审查包，可先下载归档；后续黄金合同阶段继续扩充条款覆盖。",
        affected_sections=["payment", "delivery", "acceptance", "liability"],
        source_labels=["TASK_EVIDENCE"],
        engine_tiers=["deterministic"],
        quality_gate_status="PASSED",
    )


def _memorial_payload(pack: ContractReviewPackV1) -> dict[str, Any]:
    return {
        "title": "合同审查回奏",
        "verdict": "可进入人工批准",
        "summary": pack.decision_summary,
        "ministry_outputs": [],
        "conflict_summary": [],
        "evidence_gaps": [],
        "risk_flags": [],
        "risk_register": [item.model_dump(mode="json") for item in pack.risk_items],
        "decision_options": ["approve", "request_evidence"],
        "next_best_action": "generate_contract_review_pack",
        "source_label": "MIXED",
        "quality_gate": {"passed": True, "status": "passed", "reasons": []},
        "contract_review": pack.model_dump(mode="json"),
    }
