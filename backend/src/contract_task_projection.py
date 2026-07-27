from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.artifacts.service import (
    DeliveryConflict,
    DeliveryExpired,
    DeliveryForbidden,
    DeliveryIntegrityError,
    DeliveryNotFound,
    get_delivery_manifest_for_tenant,
)
from src.contract_mission_repository import (
    MissionBindingConflict,
    load_current_mission_snapshot,
)
from src.contract_task_actions import (
    ContractTaskFacts,
    resolve_contract_task_actions,
)
from src.contracts.contract_lineage_identity import (
    ContractLineageIdentityV1,
    require_r0_review_pack_binding,
)
from src.contracts.contract_review_pack import ContractReviewPackV1
from src.contracts.contract_task_read_model import (
    ArchiveReceiptV1,
    ContractTaskBlockerCode,
    ContractTaskBlockerV1,
    ContractTaskIdentityV1,
    ContractTaskReadModelV1,
    FinalMemorialIdentityV1,
    MissionSnapshotViewV1,
    PublicArtifactDeliveryV1,
    PublicArtifactItemV1,
)
from src.db.models import (
    ArtifactManifest,
    DecisionTask,
    FinalMemorial,
    SecureIngestArtifact,
    ShiguanArchive,
)
from src.formal_memorial import ADJUDICABLE_SOURCE_LABELS

_DELIVERY_ERRORS = (
    DeliveryNotFound,
    DeliveryForbidden,
    DeliveryExpired,
    DeliveryConflict,
    DeliveryIntegrityError,
)
_DELIVERY_PROJECTION_ERRORS = _DELIVERY_ERRORS + (
    TypeError,
    ValueError,
    json.JSONDecodeError,
)
_FALLBACK_SOURCE_LABELS = {"FALLBACK", "DEMO"}
_ADJUDICABLE_PACK_SOURCE_LABELS = {"TASK_EVIDENCE"}
_REQUIRED_ARTIFACT_KINDS = {"PDF", "DOCX", "JSON"}


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _parse_json_object(value: str | None) -> dict[str, Any]:
    parsed = json.loads(value or "")
    if not isinstance(parsed, dict):
        raise ValueError("expected a JSON object")
    return parsed


def _source_class(
    task: DecisionTask,
    final: FinalMemorial | None,
    pack: ContractReviewPackV1 | None,
) -> str:
    labels = {task.source_label}
    if final is not None:
        labels.add(final.source_label)
    if labels & _FALLBACK_SOURCE_LABELS:
        return "FALLBACK"
    if not labels <= ADJUDICABLE_SOURCE_LABELS:
        return "UNKNOWN"
    if pack is None:
        return "ADJUDICABLE"
    pack_labels = {label.upper() for label in pack.source_labels}
    if pack_labels & _FALLBACK_SOURCE_LABELS or "fallback" in pack.engine_tiers:
        return "FALLBACK"
    if (
        pack.quality_gate_status != "PASSED"
        or not pack_labels <= _ADJUDICABLE_PACK_SOURCE_LABELS
    ):
        return "UNKNOWN"
    return "ADJUDICABLE"


def _delivery_complete(delivery: PublicArtifactDeliveryV1 | None) -> bool:
    if delivery is None or delivery.overall_status != "READY":
        return False
    return (
        len(delivery.artifacts) == len(_REQUIRED_ARTIFACT_KINDS)
        and {item.kind for item in delivery.artifacts}
        == _REQUIRED_ARTIFACT_KINDS
        and all(item.download_url is not None for item in delivery.artifacts)
    )


def _evidence_ready(db, *, task: DecisionTask, has_pack: bool) -> bool:
    if has_pack:
        return True
    if task.tenant_id is None:
        return False
    return (
        db.query(SecureIngestArtifact)
        .filter_by(
            tenant_id=task.tenant_id,
            user_id=task.user_id,
            mission_contract_id=task.id,
            status="ACCEPTED",
        )
        .count()
        > 0
    )


def _current_final(
    db,
    *,
    task: DecisionTask,
) -> tuple[FinalMemorial | None, ContractTaskBlockerCode | None]:
    rows = (
        db.query(FinalMemorial)
        .filter_by(task_id=task.id, is_current=True)
        .order_by(FinalMemorial.id.asc())
        .all()
    )
    if not rows:
        return None, None
    if len(rows) != 1:
        return None, "LINEAGE_CONFLICT"
    final = rows[0]
    if task.tenant_id is None or final.tenant_id != task.tenant_id:
        return None, "LINEAGE_CONFLICT"
    return final, None


def _verified_pack(
    *,
    task: DecisionTask,
    final: FinalMemorial,
) -> tuple[dict[str, Any], ContractReviewPackV1]:
    memorial_payload = _parse_json_object(final.memorial_json)
    canonical = _canonical_json(memorial_payload)
    actual_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(actual_hash, final.content_hash):
        raise ValueError("final memorial content hash mismatch")
    pack = ContractReviewPackV1.model_validate(
        memorial_payload.get("contract_review")
    )
    if task.tenant_id is None:
        raise ValueError("task tenant identity is missing")
    identity = ContractLineageIdentityV1.for_task(
        tenant_id=task.tenant_id,
        task_id=task.id,
    )
    require_r0_review_pack_binding(identity, pack)
    if pack.court_review_id != final.review_id:
        raise ValueError("review pack court review identity mismatch")
    return memorial_payload, pack


def _delivery_projection(
    db,
    *,
    storage_root: Path,
    task: DecisionTask,
    final: FinalMemorial,
    pack: ContractReviewPackV1,
) -> tuple[PublicArtifactDeliveryV1 | None, ContractTaskBlockerCode | None]:
    rows = (
        db.query(ArtifactManifest)
        .filter_by(tenant_id=task.tenant_id, task_id=task.id)
        .order_by(
            ArtifactManifest.delivery_formula_version.asc(),
            ArtifactManifest.delivery_revision.asc(),
            ArtifactManifest.id.asc(),
        )
        .all()
    )
    if not rows:
        return None, None
    exact = [
        row
        for row in rows
        if row.final_memorial_id == final.id
        and row.final_memorial_version == final.version
    ]
    if not exact:
        return None, "DELIVERY_INTEGRITY_FAILED"
    formula_versions = {row.delivery_formula_version for row in exact}
    if len(formula_versions) != 1:
        return None, "DELIVERY_INTEGRITY_FAILED"
    revisions = [
        row.delivery_revision
        for row in exact
        if isinstance(row.delivery_revision, int)
    ]
    if len(revisions) != len(exact):
        return None, "DELIVERY_INTEGRITY_FAILED"
    latest_revision = max(revisions)
    latest = [row for row in exact if row.delivery_revision == latest_revision]
    if len(latest) != 1:
        return None, "DELIVERY_INTEGRITY_FAILED"
    row = latest[0]
    try:
        access = get_delivery_manifest_for_tenant(
            db,
            storage_root=storage_root,
            manifest_id=row.id,
            tenant_id=task.tenant_id,
        )
        source_pack = ContractReviewPackV1.model_validate(
            _parse_json_object(row.source_payload_json)
        )
    except _DELIVERY_PROJECTION_ERRORS:
        return None, "DELIVERY_INTEGRITY_FAILED"
    if source_pack != pack:
        return None, "DELIVERY_INTEGRITY_FAILED"
    manifest = access.manifest
    return (
        PublicArtifactDeliveryV1(
            manifest_id=manifest.manifest_id,
            task_id=manifest.task_id,
            final_memorial_id=manifest.final_memorial_id,
            final_memorial_version=manifest.final_memorial_version,
            delivery_formula_version=manifest.delivery_formula_version,
            delivery_revision=manifest.delivery_revision,
            payload_hash=manifest.payload_hash,
            artifacts=[
                PublicArtifactItemV1(
                    artifact_id=item.artifact_id,
                    kind=item.kind,
                    mime_type=item.mime_type,
                    byte_size=item.byte_size,
                    content_hash=item.content_hash,
                    lineage_hash=item.lineage_hash,
                    status=item.status,
                    incomplete_reason=item.incomplete_reason,
                    expires_at=item.expires_at,
                    download_url=(
                        f"/api/artifacts/{item.artifact_id}/download"
                        if item.downloadable
                        else None
                    ),
                )
                for item in access.items
            ],
            overall_status=manifest.overall_status,
            resume_token_expires_at=manifest.resume_token_expires_at,
        ),
        None,
    )


def _archive_receipt(
    db,
    *,
    task: DecisionTask,
    final: FinalMemorial,
    final_payload: dict[str, Any],
) -> tuple[ArchiveReceiptV1 | None, ContractTaskBlockerCode | None]:
    rows = (
        db.query(ShiguanArchive)
        .filter_by(tenant_id=task.tenant_id, task_id=task.id)
        .order_by(ShiguanArchive.created_at.asc(), ShiguanArchive.id.asc())
        .all()
    )
    if not rows:
        return None, None
    exact: list[ShiguanArchive] = []
    for row in rows:
        if (
            row.final_memorial_id != final.id
            or row.final_memorial_version != final.version
            or row.final_memorial_content_hash != final.content_hash
            or row.synthetic_flag
            or row.source_label not in ADJUDICABLE_SOURCE_LABELS
        ):
            continue
        try:
            archived_payload = _parse_json_object(row.final_memorial_json)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if archived_payload == final_payload:
            exact.append(row)
    if len(exact) != 1 or len(rows) != 1:
        return None, "ARCHIVE_LINEAGE_CONFLICT"
    row = exact[0]
    return (
        ArchiveReceiptV1(
            archive_id=row.id,
            task_id=row.task_id,
            final_memorial_id=row.final_memorial_id,
            final_memorial_version=row.final_memorial_version,
            final_memorial_content_hash=row.final_memorial_content_hash,
            archived_at=row.created_at,
            source_label=row.source_label,
        ),
        None,
    )


def _read_revision(model: ContractTaskReadModelV1) -> str:
    payload = model.model_dump(
        mode="json",
        exclude={"read_revision", "generated_at"},
        exclude_none=True,
    )
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def project_contract_task(
    db,
    *,
    storage_root: Path,
    task: DecisionTask,
) -> ContractTaskReadModelV1:
    if task.tenant_id is None:
        raise ValueError("contract task tenant identity is missing")

    projection_blockers: list[ContractTaskBlockerCode] = []
    mission = None
    mission_state = "NONE"
    try:
        snapshot = load_current_mission_snapshot(db, task=task)
    except MissionBindingConflict:
        snapshot = None
        mission_state = "CONFLICT"
        projection_blockers.append("MISSION_CONFLICT")
    else:
        if snapshot is not None:
            mission_state = snapshot.state.upper()
            mission = MissionSnapshotViewV1(
                state=mission_state,
                mission=snapshot.mission,
            )

    final, final_error = _current_final(db, task=task)
    if final_error is not None:
        projection_blockers.append(final_error)

    final_payload = None
    pack = None
    final_view = None
    if final is not None:
        try:
            final_payload, pack = _verified_pack(task=task, final=final)
        except (TypeError, ValueError, json.JSONDecodeError):
            projection_blockers.append("LINEAGE_CONFLICT")
        else:
            final_view = FinalMemorialIdentityV1(
                final_memorial_id=final.id,
                final_memorial_version=final.version,
                final_memorial_content_hash=final.content_hash,
                court_review_id=final.review_id,
                status=final.status,
                source_label=final.source_label,
            )

    delivery = None
    if final is not None and pack is not None:
        delivery, delivery_error = _delivery_projection(
            db,
            storage_root=storage_root,
            task=task,
            final=final,
            pack=pack,
        )
        if delivery_error is not None:
            projection_blockers.append(delivery_error)

    receipt = None
    if final is not None and final_payload is not None:
        receipt, receipt_error = _archive_receipt(
            db,
            task=task,
            final=final,
            final_payload=final_payload,
        )
        if receipt_error is not None:
            projection_blockers.append(receipt_error)

    if projection_blockers:
        allowed_actions = []
        blocker_codes = list(dict.fromkeys(projection_blockers))
    else:
        final_status = "NONE"
        if final is not None:
            final_status = {
                "ready_for_decision": "READY_FOR_DECISION",
                "awaiting_evidence": "AWAITING_EVIDENCE",
                "archived": "ARCHIVED",
                "superseded": "SUPERSEDED",
            }.get(final.status, "CONFLICT")
        resolution = resolve_contract_task_actions(
            ContractTaskFacts(
                mission_state=mission_state,
                source_class=_source_class(task, final, pack),
                evidence_ready=_evidence_ready(
                    db,
                    task=task,
                    has_pack=pack is not None,
                ),
                review_pack_ready=pack is not None,
                final_status=final_status,
                delivery_status=(
                    delivery.overall_status if delivery is not None else "NONE"
                ),
                decision_status=(
                    "APPROVED"
                    if receipt is not None or final_status == "ARCHIVED"
                    else "NONE"
                ),
                downloadable_count=(
                    sum(
                        item.download_url is not None
                        for item in delivery.artifacts
                    )
                    if delivery is not None
                    else 0
                ),
                delivery_complete=_delivery_complete(delivery),
                resume_capability_present=False,
                archive_receipt_present=receipt is not None,
            )
        )
        allowed_actions = list(resolution.allowed_actions)
        blocker_codes = list(resolution.blockers)

    generated_at = datetime.now(timezone.utc)
    model = ContractTaskReadModelV1(
        read_revision="0" * 64,
        generated_at=generated_at,
        task=ContractTaskIdentityV1(
            task_id=task.id,
            tenant_id=task.tenant_id,
            status=task.status,
            source_label=task.source_label,
            raw_question=task.raw_question,
            refined_edict=task.refined_edict,
        ),
        mission=mission,
        review_pack=pack,
        final_memorial=final_view,
        delivery=delivery,
        archive_receipt=receipt,
        allowed_actions=allowed_actions,
        blockers=[
            ContractTaskBlockerV1(code=code)
            for code in blocker_codes
        ],
    )
    return model.model_copy(update={"read_revision": _read_revision(model)})
