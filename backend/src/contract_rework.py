"""R0-W05 evidence-bound contract section recomputation."""

from __future__ import annotations

import hashlib
import io
import json
from typing import TYPE_CHECKING, Any

import docx
from sqlalchemy import func

from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.contract_risk_item import ContractRiskItemV1
from src.contracts.evidence_packet import EvidencePacketV1
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


def recompute_contract_review(
    db: "Session",
    event: "OutboxEvent",
) -> dict[str, Any]:
    """Recompute only the declared contract section for the current generation."""
    from src.db.models import CourtReview, DecisionTask, OutboxEvent, SecureIngestArtifact

    payload = json.loads(event.payload_json or "{}")
    affected_sections = payload.get("affected_sections")
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

    packets = [
        EvidencePacketV1(**item) for item in payload.get("evidence_packets", [])
    ]
    if not packets:
        raise ValueError("rework generation 缺少 EvidencePacket")

    task = db.query(DecisionTask).filter_by(id=event.task_id).one()
    review = (
        db.query(CourtReview)
        .filter_by(task_id=event.task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )
    if review is None:
        raise ValueError("rework generation 缺少 canonical CourtReview")

    risk_items: list[ContractRiskItemV1] = []
    for packet in packets:
        artifact = (
            db.query(SecureIngestArtifact)
            .filter_by(
                id=packet.input_version_id,
                tenant_id=event.tenant_id,
                mission_contract_id=event.task_id,
                status="ACCEPTED",
            )
            .one()
        )
        raw_bytes = read_artifact_bytes_at_path(artifact.storage_path)
        actual_digest = hashlib.sha256(raw_bytes).hexdigest()
        if actual_digest != packet.input_digest or actual_digest != artifact.digest_sha256:
            raise ValueError("绑定证据内容摘要已变化")
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

    pack_id = "review_pack_" + hashlib.sha256(event.id.encode("utf-8")).hexdigest()[:16]
    pack = ContractReviewPackV1(
        review_pack_id=pack_id,
        tenant_id=str(event.tenant_id),
        task_id=event.task_id,
        mission_contract_id=event.task_id,
        court_review_id=review.id,
        evidence_packet_ids=[packet.evidence_packet_id for packet in packets],
        jurisdiction="UNSUPPORTED_OR_UNKNOWN",
        language="UNSUPPORTED_OR_UNKNOWN",
        contract_type="UNSUPPORTED_OR_UNKNOWN",
        our_role="UNSUPPORTED_OR_UNKNOWN",
        risk_items=risk_items,
        verdict="NEED_LEGAL_REVIEW",
        decision_summary="canonical 任务尚未冻结合同支持维度，新增证据仅形成候选并升级人工法务复核。",
        affected_sections=affected_sections,
        source_labels=["TASK_EVIDENCE"],
        engine_tiers=["deterministic"],
        quality_gate_status="PENDING",
    )
    memorial = json.loads(review.memorial_json or "{}")
    memorial["contract_review"] = pack.model_dump()
    review.memorial_json = json.dumps(
        memorial,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    review.review_status = "reviewing"
    task.status = "reviewing"
    payload["status"] = "candidate_ready"
    payload["contract_review_pack_id"] = pack_id
    payload["court_review_id"] = review.id
    event.payload_json = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return {
        "fenced": False,
        "generation": event.generation,
        "affected_sections": affected_sections,
        "contract_review_pack_id": pack_id,
        "court_review_id": review.id,
    }
