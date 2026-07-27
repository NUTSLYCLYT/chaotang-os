"""R0-W05 evidence-bound contract section recomputation."""

from __future__ import annotations

import hashlib
import io
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import docx
from sqlalchemy import func, text

from src.contract_mission_repository import load_current_mission_snapshot
from src.contracts.contract_lineage_identity import (
    ContractLineageIdentityV1,
    require_r0_review_pack_binding,
)
from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.contract_risk_item import ContractRiskItemV1
from src.contracts.contract_support import evaluate_support
from src.contracts.evidence_packet import EvidencePacketV1, EvidenceStatus
from src.contracts.evidence_rework_generation import EvidenceReworkGenerationV1
from src.contracts.mission_contract import ContractIntakeV1
from src.secure_ingest.evidence import classify_evidence_artifact
from src.secure_ingest.storage import read_artifact_bytes_at_path

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from src.db.models import OutboxEvent


def _extract_docx_text(raw_bytes: bytes) -> str:
    document = docx.Document(io.BytesIO(raw_bytes))
    return "\n".join(
        paragraph.text.strip()
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    )


def _candidate_gate_reasons(
    pack: ContractReviewPackV1,
    packets: list[EvidencePacketV1],
) -> list[str]:
    reasons: list[str] = []
    if any(
        packet.evidence_status != "GROUNDED"
        or not packet.verification_receipt_id
        for packet in packets
    ):
        reasons.append("provenance_gate_failed")
    if pack.verdict == "NEED_LEGAL_REVIEW":
        reasons.append("contract_scope_requires_legal_review")
    return reasons


def _fail_closed_evidence_status(
    previous: EvidenceStatus,
    classified: EvidenceStatus,
) -> EvidenceStatus:
    """Never auto-promote blocked evidence, but allow a later STALE downgrade."""
    if previous == "GROUNDED":
        return classified
    if classified == "STALE":
        return "STALE"
    return previous


def _lock_evidence_version_publication(db: "Session") -> None:
    """Prevent accepted artifact phantoms during the final provenance check.

    SQLite's preceding DecisionTask UPDATE already holds the database write
    lock. PostgreSQL needs an explicit table lock because row locks do not
    block inserts of new sibling versions.
    """
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        return
    if dialect == "postgresql":
        db.execute(
            text("LOCK TABLE secure_ingest_artifacts IN SHARE MODE")
        )
        return
    raise RuntimeError(
        f"evidence rework publication unsupported for dialect {dialect!r}"
    )


def _lock_mission_publication(db: "Session") -> None:
    """Keep the final Mission identity stable through publication."""
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        return
    if dialect == "postgresql":
        db.execute(text("LOCK TABLE court_loop_runs IN SHARE MODE"))
        return
    raise RuntimeError(
        f"mission publication unsupported for dialect {dialect!r}"
    )


def _terminal_task_fence(task: Any, *, affected_sections: list[str]) -> dict[str, Any] | None:
    from src.execution.outbox_worker import TASK_TERMINAL_STATUSES

    if task.status not in TASK_TERMINAL_STATUSES:
        return None
    return {
        "fenced": True,
        "reason": "terminal_task",
        "task_status": task.status,
        "affected_sections": affected_sections,
    }


def _mission_fence(
    mission_snapshot: Any,
    *,
    affected_sections: list[str],
) -> dict[str, Any] | None:
    if mission_snapshot is None:
        return {
            "fenced": True,
            "reason": "mission_missing",
            "affected_sections": affected_sections,
        }
    if mission_snapshot.state != "confirmed":
        return {
            "fenced": True,
            "reason": "mission_not_confirmed",
            "affected_sections": affected_sections,
        }
    return None


def recompute_contract_review(
    db: "Session",
    event: "OutboxEvent",
) -> dict[str, Any]:
    """Recompute only the declared contract section for the current generation."""
    from src.db.models import CourtReview, DecisionTask, OutboxEvent, SecureIngestArtifact
    from src.w05_feature import w05_contract_rework_active

    generation = EvidenceReworkGenerationV1.model_validate_json(
        event.payload_json or "{}"
    )
    affected_sections = generation.affected_sections
    if not w05_contract_rework_active():
        return {
            "fenced": True,
            "reason": "capability_disabled",
            "generation": event.generation,
            "affected_sections": affected_sections,
        }
    if affected_sections != ["contract_review"]:
        raise ValueError("W05 只允许重算 contract_review section")

    current_generation = (
        db.query(func.max(OutboxEvent.generation))
        .filter_by(task_id=event.task_id)
        .scalar()
    )
    if event.generation != current_generation:
        return {
            "fenced": True,
            "generation": event.generation,
            "current_generation": current_generation,
            "affected_sections": affected_sections,
        }

    packets = generation.evidence_packets or []
    if not packets:
        raise ValueError("rework generation 缺少 EvidencePacket")

    task = db.query(DecisionTask).filter_by(id=event.task_id).one()
    task_fence = _terminal_task_fence(task, affected_sections=affected_sections)
    if task_fence is not None:
        return task_fence
    mission_snapshot = load_current_mission_snapshot(db, task=task)
    mission_fence = _mission_fence(
        mission_snapshot,
        affected_sections=affected_sections,
    )
    if mission_fence is not None:
        return mission_fence
    review = (
        db.query(CourtReview)
        .filter_by(task_id=event.task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )
    if review is None:
        raise ValueError("rework generation 缺少 canonical CourtReview")

    risk_items: list[ContractRiskItemV1] = []
    revalidated_packets: list[EvidencePacketV1] = []
    artifacts_by_id: dict[str, SecureIngestArtifact] = {}
    for packet in packets:
        artifact = (
            db.query(SecureIngestArtifact)
            .filter_by(
                id=packet.input_version_id,
                tenant_id=event.tenant_id,
                user_id=task.user_id,
                mission_contract_id=event.task_id,
                status="ACCEPTED",
            )
            .one()
        )
        artifacts_by_id[artifact.id] = artifact
        classified_status = classify_evidence_artifact(db, artifact)
        raw_bytes: bytes | None = None
        if (
            packet.evidence_status == "GROUNDED"
            and classified_status == "GROUNDED"
        ):
            try:
                raw_bytes = read_artifact_bytes_at_path(artifact.storage_path)
            except OSError:
                classified_status = "STALE"
            else:
                actual_digest = hashlib.sha256(raw_bytes).hexdigest()
                if (
                    actual_digest != packet.input_digest
                    or actual_digest != artifact.digest_sha256
                ):
                    classified_status = "STALE"
        # A worker may downgrade newly stale/conflicted evidence, but it cannot
        # silently promote an already blocked packet without a human resolution.
        revalidated_status = _fail_closed_evidence_status(
            packet.evidence_status,
            classified_status,
        )
        packet = packet.model_copy(update={"evidence_status": revalidated_status})
        revalidated_packets.append(packet)
        if packet.evidence_status != "GROUNDED":
            continue
        if raw_bytes is None:
            raise RuntimeError(
                "evidence rework invariant: grounded evidence bytes unavailable"
            )
        excerpt = _extract_docx_text(raw_bytes)[:2000]
        if not excerpt:
            raise ValueError("绑定证据没有可核验文本")
        risk_items.append(
            ContractRiskItemV1(
                risk_item_id=(
                    "risk_"
                    + hashlib.sha256(
                        f"{event.id}|{packet.evidence_packet_id}".encode("utf-8")
                    ).hexdigest()[:16]
                ),
                evidence_packet_id=packet.evidence_packet_id,
                file_version_id=packet.input_version_id,
                page_number=None,
                clause_ref=None,
                raw_excerpt=excerpt,
                risk_level="medium",
                explanation="新增证据涉及合同付款、验收或责任条件，需由 canonical 会审复核。",
                missing_evidence=["DOCX 文本抽取未提供可靠页码/条款定位"],
                recommended_revision="核对触发条件、期限、异议机制和责任边界后再推进。",
                source_label="TASK_EVIDENCE",
                engine_tier="deterministic",
            )
        )

    generation_payload = generation.to_payload()
    generation_payload.pop("evidence_status", None)
    generation_payload["evidence_packets"] = [
        packet.model_dump(mode="json") for packet in revalidated_packets
    ]
    generation = EvidenceReworkGenerationV1.model_validate(generation_payload)
    packets = generation.evidence_packets or []

    scope = generation.contract_scope or ContractIntakeV1()
    support = evaluate_support(
        scope,
        mission_contract_id=event.task_id,
        revision=event.generation,
        evaluated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        capability_active=w05_contract_rework_active(),
    )
    supported = support.support_status == "SUPPORTED"
    pack_id = "review_pack_" + hashlib.sha256(event.id.encode("utf-8")).hexdigest()[:16]
    pack = ContractReviewPackV1(
        review_pack_id=pack_id,
        tenant_id=str(event.tenant_id),
        task_id=event.task_id,
        mission_contract_id=event.task_id,
        mission_revision=mission_snapshot.mission.revision,
        mission_content_digest=mission_snapshot.mission.content_digest,
        court_review_id=review.id,
        evidence_packet_ids=[packet.evidence_packet_id for packet in packets],
        jurisdiction=scope.jurisdiction or "UNSUPPORTED_OR_UNKNOWN",
        language=scope.language or "UNSUPPORTED_OR_UNKNOWN",
        contract_type=scope.contract_type or "UNSUPPORTED_OR_UNKNOWN",
        our_role=scope.our_role or "UNSUPPORTED_OR_UNKNOWN",
        legal_question=scope.legal_question or "UNSUPPORTED_OR_UNKNOWN",
        risk_items=risk_items,
        verdict="REVISE_BEFORE_PROCEED" if supported else "NEED_LEGAL_REVIEW",
        decision_summary=(
            "补证已绑定当前 generation；合同付款、验收和责任条件仍须人工裁决。"
            if supported
            else "canonical 任务缺少受支持的合同范围，新增证据仅形成候选并升级人工法务复核。"
        ),
        affected_sections=affected_sections,
        source_labels=["TASK_EVIDENCE"],
        engine_tiers=["deterministic"],
        quality_gate_status="PENDING",
    )
    require_r0_review_pack_binding(
        ContractLineageIdentityV1.for_task(
            tenant_id=event.tenant_id,
            task_id=event.task_id,
        ),
        pack,
    )
    # Parsing evidence is intentionally outside the task lock. Publication is
    # not: generation allocation and canonical writes share this lock so a
    # newer request cannot be interleaved between this fence and the writes.
    from src.execution.decree_dispatcher import lock_evidence_rework_task

    lock_evidence_rework_task(db, event.task_id)
    db.refresh(task)
    task_fence = _terminal_task_fence(task, affected_sections=affected_sections)
    if task_fence is not None:
        return task_fence
    if not w05_contract_rework_active():
        return {
            "fenced": True,
            "reason": "capability_disabled",
            "generation": event.generation,
            "affected_sections": affected_sections,
        }
    current_generation = (
        db.query(func.max(OutboxEvent.generation))
        .filter_by(task_id=event.task_id)
        .scalar()
    )
    if event.generation != current_generation:
        return {
            "fenced": True,
            "generation": event.generation,
            "current_generation": current_generation,
            "affected_sections": affected_sections,
        }

    _lock_mission_publication(db)
    publication_mission = load_current_mission_snapshot(db, task=task)
    mission_fence = _mission_fence(
        publication_mission,
        affected_sections=affected_sections,
    )
    if mission_fence is not None:
        return mission_fence
    if (
        publication_mission.mission.revision != mission_snapshot.mission.revision
        or publication_mission.mission.content_digest
        != mission_snapshot.mission.content_digest
    ):
        return {
            "fenced": True,
            "reason": "mission_changed",
            "mission_revision": mission_snapshot.mission.revision,
            "current_mission_revision": publication_mission.mission.revision,
            "affected_sections": affected_sections,
        }

    _lock_evidence_version_publication(db)
    # Final fail-closed recheck under the artifact-version publication fence.
    # A concurrent immutable sibling can only make a packet less trustworthy;
    # it can never promote it.
    publication_packets: list[EvidencePacketV1] = []
    for packet in packets:
        artifact = artifacts_by_id[packet.input_version_id]
        publication_status = _fail_closed_evidence_status(
            packet.evidence_status,
            classify_evidence_artifact(db, artifact),
        )
        publication_packets.append(
            packet.model_copy(update={"evidence_status": publication_status})
        )
    generation_payload = generation.to_payload()
    generation_payload.pop("evidence_status", None)
    generation_payload["evidence_packets"] = [
        packet.model_dump(mode="json") for packet in publication_packets
    ]
    generation = EvidenceReworkGenerationV1.model_validate(generation_payload)
    packets = generation.evidence_packets or []
    grounded_packet_ids = {
        packet.evidence_packet_id
        for packet in packets
        if packet.evidence_status == "GROUNDED"
    }
    pack = pack.model_copy(
        update={
            "risk_items": [
                item
                for item in pack.risk_items
                if item.evidence_packet_id in grounded_packet_ids
            ]
        }
    )
    gate_reasons = _candidate_gate_reasons(pack, packets)
    pack = pack.model_copy(
        update={"quality_gate_status": "FAILED" if gate_reasons else "PASSED"}
    )

    memorial = json.loads(review.memorial_json or "{}")
    memorial["contract_review"] = pack.model_dump()
    review.memorial_json = json.dumps(
        memorial,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    review.review_status = "awaiting_evidence" if gate_reasons else "awaiting_decision"
    task.status = "awaiting_evidence" if gate_reasons else "awaiting_decision"
    generation = EvidenceReworkGenerationV1.model_validate(
        {
            **generation.to_payload(),
            "status": "quality_blocked" if gate_reasons else "candidate_ready",
            "gate_reasons": gate_reasons,
            "contract_review_pack_id": pack_id,
            "court_review_id": review.id,
        }
    )
    event.payload_json = json.dumps(
        generation.to_payload(),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    result = {
        "fenced": False,
        "generation": event.generation,
        "affected_sections": affected_sections,
        "contract_review_pack_id": pack_id,
        "court_review_id": review.id,
        "quality_gate_status": pack.quality_gate_status,
        "gate_reasons": gate_reasons,
    }
    if gate_reasons:
        return result

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    run_id = "run_rework_" + hashlib.sha256(event.id.encode("utf-8")).hexdigest()[:16]
    task_run_id = "task_run_" + hashlib.sha256(
        f"{event.id}|contract_review".encode("utf-8")
    ).hexdigest()[:16]
    quality_id = "quality_rework_" + hashlib.sha256(
        event.id.encode("utf-8")
    ).hexdigest()[:16]
    warnings = [
        missing
        for item in pack.risk_items
        for missing in item.missing_evidence
    ]
    swarm_result = {
        "swarm_run": {
            "id": run_id,
            "task_id": event.task_id,
            "review_id": review.id,
            "mode": "evidence_rework",
            "status": "completed",
            "source_label": "MIXED",
            "route_plan": {
                "generation": event.generation,
                "affected_sections": affected_sections,
                "contract_review_pack_id": pack_id,
            },
            "trace_id": event.id,
            "started_at": now,
            "finished_at": now,
            "error": None,
        },
        "task_runs": [
            {
                "id": task_run_id,
                "swarm_id": "xingbu-contract-review",
                "role": "刑部合同重审",
                "status": "completed",
                "input": {
                    "generation": event.generation,
                    "evidence_packet_ids": pack.evidence_packet_ids,
                },
                "output": pack.model_dump(),
                "source_label": "MIXED",
                "confidence": "中",
                "started_at": now,
                "finished_at": now,
                "error": None,
            }
        ],
        "evidence_links": [
            {
                "id": "evidence_link_"
                + hashlib.sha256(
                    f"{event.id}|{packet.evidence_packet_id}".encode("utf-8")
                ).hexdigest()[:16],
                "swarm_task_run_id": task_run_id,
                "claim": "合同补证已绑定并纳入当前 generation 重审。",
                "evidence_source_type": "secure_ingest_artifact",
                "evidence_ref": packet.input_version_id,
                "confidence": "中",
            }
            for packet in packets
        ],
        "quality_result": {
            "id": quality_id,
            "passed": True,
            "blocking_reasons": [],
            "warnings": warnings,
            "revised_output": pack.model_dump(),
            "created_at": now,
        },
    }
    from src.formal_memorial import formalize_memorial
    from src.swarm_persistence import persist_swarm_execution_result

    persist_swarm_execution_result(db, swarm_result)
    formal = formalize_memorial(
        db,
        task_id=event.task_id,
        review_id=review.id,
        swarm_result=swarm_result,
    )
    result["final_memorial_id"] = formal.id
    result["final_memorial_version"] = formal.version
    result["final_memorial_content_hash"] = formal.content_hash
    return result
