"""Persistence boundary for canonical W06 artifact manifests."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from src.artifacts.delivery import ArtifactRenderer, render_one_artifact
from src.db.models import (
    ArtifactDeliveryAuditEvent,
    ArtifactDeliveryItem,
    ArtifactManifest,
    DecisionTask,
    FinalMemorial,
)

if TYPE_CHECKING:
    from src.contracts.artifact_manifest import ArtifactManifestV1


class DeliveryConflict(RuntimeError):
    pass


class DeliveryNotFound(LookupError):
    pass


class DeliveryForbidden(PermissionError):
    pass


class DeliveryExpired(RuntimeError):
    pass


class DeliveryIntegrityError(RuntimeError):
    pass


class DeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class DeliveryPacket:
    manifest: ArtifactManifestV1
    resume_token: str | None


@dataclass(frozen=True)
class DeliveryItemAccess:
    artifact_id: str
    kind: str
    mime_type: str
    byte_size: int
    content_hash: str
    lineage_hash: str
    status: str
    incomplete_reason: str | None
    expires_at: datetime | None
    downloadable: bool


@dataclass(frozen=True)
class DeliveryManifestAccess:
    manifest: ArtifactManifestV1
    items: tuple[DeliveryItemAccess, ...]


@dataclass(frozen=True)
class VerifiedDeliveryArtifact:
    content: bytes
    mime_type: str


_DELIVERY_KINDS = ("PDF", "DOCX", "JSON")
_EMPTY_CONTENT_HASH = hashlib.sha256(b"").hexdigest()
_MIME_TYPES = {
    "PDF": "application/pdf",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "JSON": "application/json",
}
_UNRESOLVED_DOWNLOAD_MANIFEST_ID = "unresolved-download"


@dataclass(frozen=True)
class _DeliveryDraft:
    artifact_id: str
    kind: str
    mime_type: str
    status: str
    storage_path: str | None
    content_hash: str
    byte_size: int
    lineage_hash: str
    incomplete_reason: str | None
    retry_count: int
    audit_events: tuple[tuple[str, str, dict[str, str]], ...]


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_text(value: str) -> str:
    return _sha256_bytes(value.encode("utf-8"))


def _canonical_source_payload_json(payload: dict[str, Any]) -> str:
    return json.dumps(
        payload,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _validate_source_payload_json(
    source_payload_json: str | None,
    *,
    expected_hash: str,
) -> dict[str, Any]:
    if source_payload_json is None:
        raise DeliveryIntegrityError("delivery source payload is missing")
    try:
        payload = json.loads(source_payload_json)
    except json.JSONDecodeError as exc:
        raise DeliveryIntegrityError("delivery source payload is invalid") from exc
    if (
        not isinstance(payload, dict)
        or _canonical_source_payload_json(payload) != source_payload_json
        or _sha256_text(source_payload_json) != expected_hash
    ):
        raise DeliveryIntegrityError(
            "delivery source payload does not match payload hash"
        )
    return payload


def _resolve_delivery_source(
    db,
    *,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    supplied_payload: dict[str, Any],
) -> dict[str, Any]:
    from src.contracts.contract_review_pack import ContractReviewPackV1

    task = (
        db.query(DecisionTask)
        .filter_by(id=task_id, tenant_id=tenant_id)
        .one_or_none()
    )
    if task is None:
        raise DeliveryNotFound("delivery task not found")

    memorial = (
        db.query(FinalMemorial)
        .filter_by(
            id=final_memorial_id,
            tenant_id=tenant_id,
            task_id=task_id,
            version=final_memorial_version,
        )
        .one_or_none()
    )
    if memorial is None:
        raise DeliveryNotFound("final memorial not found")
    if not memorial.is_current:
        raise DeliveryConflict("final memorial is not current")
    if memorial.status != "ready_for_decision":
        raise DeliveryConflict("final memorial is not ready for decision")

    try:
        memorial_payload = json.loads(memorial.memorial_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise DeliveryIntegrityError("final memorial payload is invalid") from exc
    if not isinstance(memorial_payload, dict):
        raise DeliveryIntegrityError("final memorial payload is invalid")
    canonical_memorial_json = _canonical_source_payload_json(memorial_payload)
    memorial_hash = _sha256_text(canonical_memorial_json)
    if (
        not isinstance(memorial.content_hash, str)
        or not hmac.compare_digest(memorial_hash, memorial.content_hash)
    ):
        raise DeliveryIntegrityError("final memorial hash does not match content")

    try:
        source_pack = ContractReviewPackV1.model_validate(
            memorial_payload.get("contract_review")
        )
    except (TypeError, ValueError) as exc:
        raise DeliveryIntegrityError(
            "final memorial contract review source is invalid"
        ) from exc
    try:
        supplied_pack = ContractReviewPackV1.model_validate(supplied_payload)
    except (TypeError, ValueError) as exc:
        raise DeliveryConflict("supplied contract review pack is invalid") from exc
    if source_pack.task_id != task_id:
        raise DeliveryIntegrityError(
            "final memorial contract review task does not match lineage"
        )
    if source_pack != supplied_pack:
        raise DeliveryConflict(
            "supplied contract review pack does not match final memorial"
        )
    return source_pack.model_dump(mode="json")


def _manifest_id(
    *,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
) -> str:
    identity = _sha256_text(
        json.dumps(
            {
                "delivery_formula_version": delivery_formula_version,
                "delivery_revision": delivery_revision,
                "final_memorial_id": final_memorial_id,
                "final_memorial_version": final_memorial_version,
                "task_id": task_id,
                "tenant_id": tenant_id,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )[:24]
    return f"manifest_{identity}"


def _artifact_id(
    *,
    origin_manifest_id: str,
    kind: str,
    lineage_hash: str,
    content_hash: str,
) -> str:
    identity = _sha256_text(
        json.dumps(
            {
                "content_hash": content_hash,
                "kind": kind,
                "lineage_hash": lineage_hash,
                "origin_manifest_id": origin_manifest_id,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )[:24]
    return f"artifact_{identity}"


def _lineage_hash(
    *,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
    payload_hash: str,
    kind: str,
    content_hash: str,
) -> str:
    identity = json.dumps(
        {
            "content_hash": content_hash,
            "delivery_formula_version": delivery_formula_version,
            "delivery_revision": delivery_revision,
            "final_memorial_id": final_memorial_id,
            "final_memorial_version": final_memorial_version,
            "kind": kind,
            "payload_hash": payload_hash,
            "task_id": task_id,
            "tenant_id": tenant_id,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    return _sha256_text(identity)


def _draft_artifact_identity(
    *,
    tenant_id: int,
    manifest_id: str,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
    payload_hash: str,
    kind: str,
    content_hash: str,
) -> tuple[str, str]:
    lineage_hash = _lineage_hash(
        tenant_id=tenant_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=delivery_revision,
        payload_hash=payload_hash,
        kind=kind,
        content_hash=content_hash,
    )
    return (
        _artifact_id(
            origin_manifest_id=manifest_id,
            kind=kind,
            lineage_hash=lineage_hash,
            content_hash=content_hash,
        ),
        lineage_hash,
    )


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("expires_at must be timezone-aware")
    return value.astimezone(timezone.utc).isoformat()


def _require_future_expiry(value: datetime) -> datetime:
    expiry = datetime.fromisoformat(_utc_iso(value))
    if expiry <= datetime.now(timezone.utc):
        raise DeliveryExpired("delivery expiry must be in the future")
    return expiry


def _attempt_artifact(
    *,
    storage_root: Path,
    tenant_id: int,
    manifest_id: str,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
    payload: dict[str, Any],
    payload_hash: str,
    kind: str,
    retry_count: int,
    renderer: ArtifactRenderer,
) -> _DeliveryDraft:
    from src.artifacts.storage import read_verified_artifact, store_artifact_bytes

    try:
        rendered = renderer(
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            payload=payload,
            kind=kind,
        )
        if rendered.kind != kind:
            raise ValueError("renderer returned the wrong artifact kind")
        if (
            rendered.byte_size != len(rendered.content)
            or rendered.content_hash != _sha256_bytes(rendered.content)
        ):
            raise ValueError("renderer returned inconsistent artifact metadata")
    except Exception:
        artifact_id, lineage_hash = _draft_artifact_identity(
            tenant_id=tenant_id,
            manifest_id=manifest_id,
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            delivery_formula_version=delivery_formula_version,
            delivery_revision=delivery_revision,
            payload_hash=payload_hash,
            kind=kind,
            content_hash=_EMPTY_CONTENT_HASH,
        )
        return _DeliveryDraft(
            artifact_id=artifact_id,
            kind=kind,
            mime_type=_MIME_TYPES[kind],
            status="UNAVAILABLE",
            storage_path=None,
            content_hash=_EMPTY_CONTENT_HASH,
            byte_size=0,
            lineage_hash=lineage_hash,
            incomplete_reason="renderer_failed",
            retry_count=retry_count,
            audit_events=(
                (
                    "artifact.generated",
                    "FAILURE",
                    {
                        "kind": kind,
                        "message": "artifact rendering failed",
                        "reason": "renderer_failed",
                    },
                ),
            ),
        )

    artifact_id, lineage_hash = _draft_artifact_identity(
        tenant_id=tenant_id,
        manifest_id=manifest_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=delivery_revision,
        payload_hash=payload_hash,
        kind=kind,
        content_hash=rendered.content_hash,
    )
    try:
        stored = store_artifact_bytes(
            storage_root,
            tenant_id=tenant_id,
            artifact_id=artifact_id,
            content=rendered.content,
        )
        read_verified_artifact(
            stored.path,
            expected_hash=stored.content_hash,
            expected_size=stored.byte_size,
        )
    except Exception:
        failed_artifact_id, failed_lineage_hash = _draft_artifact_identity(
            tenant_id=tenant_id,
            manifest_id=manifest_id,
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            delivery_formula_version=delivery_formula_version,
            delivery_revision=delivery_revision,
            payload_hash=payload_hash,
            kind=kind,
            content_hash=_EMPTY_CONTENT_HASH,
        )
        return _DeliveryDraft(
            artifact_id=failed_artifact_id,
            kind=kind,
            mime_type=rendered.mime_type,
            status="UNAVAILABLE",
            storage_path=None,
            content_hash=_EMPTY_CONTENT_HASH,
            byte_size=0,
            lineage_hash=failed_lineage_hash,
            incomplete_reason="storage_failed",
            retry_count=retry_count,
            audit_events=(
                (
                    "artifact.generated",
                    "SUCCESS",
                    {"kind": kind},
                ),
                (
                    "artifact.stored",
                    "FAILURE",
                    {
                        "kind": kind,
                        "message": "artifact storage failed",
                        "reason": "storage_failed",
                    },
                ),
            ),
        )

    return _DeliveryDraft(
        artifact_id=artifact_id,
        kind=kind,
        mime_type=rendered.mime_type,
        status="STORED",
        storage_path=str(stored.path),
        content_hash=stored.content_hash,
        byte_size=stored.byte_size,
        lineage_hash=lineage_hash,
        incomplete_reason=None,
        retry_count=retry_count,
        audit_events=(
            ("artifact.generated", "SUCCESS", {"kind": kind}),
            ("artifact.stored", "SUCCESS", {"kind": kind}),
        ),
    )


def _find_idempotency_winner(
    db,
    *,
    tenant_id: int,
    idempotency_key_hash: str,
) -> ArtifactManifest | None:
    return (
        db.query(ArtifactManifest)
        .filter_by(
            tenant_id=tenant_id,
            idempotency_key_hash=idempotency_key_hash,
        )
        .one_or_none()
    )


def _verify_persisted_manifest(
    row: ArtifactManifest,
) -> ArtifactManifestV1:
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )

    try:
        manifest = ArtifactManifestV1.model_validate_json(row.manifest_json)
    except (TypeError, ValueError) as exc:
        raise DeliveryIntegrityError(
            "persisted manifest contract is invalid"
        ) from exc

    sealed_hash = canonical_manifest_hash(manifest)
    if (
        not isinstance(row.content_hash, str)
        or not hmac.compare_digest(sealed_hash, row.content_hash)
    ):
        raise DeliveryIntegrityError("persisted manifest hash does not match seal")
    if (
        manifest.manifest_id != row.id
        or manifest.tenant_id != row.tenant_id
        or manifest.task_id != row.task_id
        or manifest.final_memorial_id != row.final_memorial_id
        or manifest.final_memorial_version != row.final_memorial_version
        or manifest.delivery_formula_version != row.delivery_formula_version
        or manifest.delivery_revision != row.delivery_revision
        or manifest.idempotency_key_hash != row.idempotency_key_hash
        or manifest.payload_hash != row.payload_hash
        or manifest.overall_status != row.overall_status
    ):
        raise DeliveryIntegrityError(
            "persisted manifest sealed fields do not match row"
        )
    return manifest


def _assert_replay_request(
    row: ArtifactManifest,
    *,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
    payload_hash: str,
    source_payload_json: str,
    expires_at: datetime,
) -> ArtifactManifestV1:
    manifest = _verify_persisted_manifest(row)
    persisted_payload = _validate_source_payload_json(
        row.source_payload_json,
        expected_hash=manifest.payload_hash,
    )
    if (
        row.task_id != task_id
        or row.final_memorial_id != final_memorial_id
        or row.final_memorial_version != final_memorial_version
        or row.delivery_formula_version != delivery_formula_version
        or row.delivery_revision != delivery_revision
        or row.payload_hash != payload_hash
        or _canonical_source_payload_json(persisted_payload) != source_payload_json
        or manifest.artifacts[0].expires_at != expires_at.astimezone(timezone.utc)
    ):
        raise DeliveryConflict(
            "delivery idempotency key was reused with a different request"
        )
    return manifest


def _replay_packet(
    db,
    *,
    storage_root: Path,
    row: ArtifactManifest,
    manifest: ArtifactManifestV1 | None = None,
) -> DeliveryPacket:
    from src.artifacts.storage import read_verified_artifact

    manifest = manifest or _verify_persisted_manifest(row)
    _validate_source_payload_json(
        row.source_payload_json,
        expected_hash=manifest.payload_hash,
    )
    item_rows = _delivery_item_rows(
        db,
        manifest=manifest,
    )
    for manifest_item in manifest.artifacts:
        item_row = item_rows[manifest_item.kind]
        if manifest_item.status == "STORED":
            stored_path = _delivery_storage_path(
                storage_root=storage_root,
                tenant_id=manifest.tenant_id,
                artifact_id=item_row.id,
                storage_path=item_row.storage_path,
            )
            read_verified_artifact(
                stored_path,
                expected_hash=item_row.content_hash,
                expected_size=item_row.byte_size,
            )
    if manifest.overall_status == "UNDER_REVIEW":
        raise DeliveryError("artifact delivery failed")
    return DeliveryPacket(manifest=manifest, resume_token=None)


def _assert_item_projection(
    item_row: ArtifactDeliveryItem,
    *,
    manifest_item,
    tenant_id: int,
) -> None:
    state_matches_seal = item_row.state == manifest_item.status or (
        item_row.state == "EXPIRED" and manifest_item.status == "STORED"
    )
    if (
        item_row.id != manifest_item.artifact_id
        or item_row.tenant_id != tenant_id
        or item_row.kind != manifest_item.kind
        or item_row.mime_type != manifest_item.mime_type
        or not state_matches_seal
        or item_row.content_hash != manifest_item.content_hash
        or item_row.byte_size != manifest_item.byte_size
        or item_row.incomplete_reason != manifest_item.incomplete_reason
    ):
        raise DeliveryIntegrityError(
            "delivery item projection does not match immutable manifest"
        )


def _assert_item_origin(
    db,
    *,
    item_row: ArtifactDeliveryItem,
    manifest_item,
    tenant_id: int,
) -> None:
    origin_row = (
        db.query(ArtifactManifest)
        .filter_by(id=item_row.manifest_id, tenant_id=tenant_id)
        .one_or_none()
    )
    if origin_row is None:
        raise DeliveryIntegrityError("delivery artifact origin manifest is missing")
    origin_manifest = _verify_persisted_manifest(origin_row)
    try:
        origin_item = origin_manifest.artifact(manifest_item.kind)
    except ValueError as exc:
        raise DeliveryIntegrityError(
            "delivery artifact origin membership is invalid"
        ) from exc
    if origin_item != manifest_item:
        raise DeliveryIntegrityError(
            "delivery artifact does not match its sealed origin"
        )


def _delivery_item_rows(
    db,
    *,
    manifest: ArtifactManifestV1,
) -> dict[str, ArtifactDeliveryItem]:
    artifact_ids = [item.artifact_id for item in manifest.artifacts]
    if len(set(artifact_ids)) != len(_DELIVERY_KINDS):
        raise DeliveryIntegrityError("delivery manifest artifact ids are not unique")
    rows = (
        db.query(ArtifactDeliveryItem)
        .filter(
            ArtifactDeliveryItem.tenant_id == manifest.tenant_id,
            ArtifactDeliveryItem.id.in_(artifact_ids),
        )
        .all()
    )
    by_id = {row.id: row for row in rows}
    if set(by_id) != set(artifact_ids) or len(rows) != len(_DELIVERY_KINDS):
        raise DeliveryIntegrityError("delivery manifest items are incomplete")

    by_kind: dict[str, ArtifactDeliveryItem] = {}
    for manifest_item in manifest.artifacts:
        row = by_id[manifest_item.artifact_id]
        _assert_item_projection(
            row,
            manifest_item=manifest_item,
            tenant_id=manifest.tenant_id,
        )
        _assert_item_origin(
            db,
            item_row=row,
            manifest_item=manifest_item,
            tenant_id=manifest.tenant_id,
        )
        by_kind[manifest_item.kind] = row
    return by_kind


def _persist_delivery_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    manifest_id: str,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    delivery_revision: int,
    idempotency_key_hash: str,
    payload_hash: str,
    source_payload_json: str,
    expires_at: datetime,
    drafts: list[_DeliveryDraft],
    resume_token: str | None,
) -> DeliveryPacket:
    from src.contracts.artifact_manifest import (
        ArtifactManifestItemV1,
        ArtifactManifestV1,
    )

    statuses = {draft.status for draft in drafts}
    if statuses == {"STORED"}:
        overall_status = "READY"
    elif statuses == {"UNAVAILABLE"}:
        overall_status = "UNDER_REVIEW"
    else:
        overall_status = "PARTIAL"
    resume_token_hash = (
        _sha256_text(resume_token) if overall_status == "PARTIAL" else None
    )
    manifest_items = [
        ArtifactManifestItemV1(
            artifact_id=draft.artifact_id,
            kind=draft.kind,
            mime_type=draft.mime_type,
            byte_size=draft.byte_size,
            content_hash=draft.content_hash,
            lineage_hash=draft.lineage_hash,
            status=draft.status,
            incomplete_reason=draft.incomplete_reason,
            expires_at=expires_at,
        )
        for draft in drafts
    ]
    manifest = ArtifactManifestV1(
        manifest_id=manifest_id,
        tenant_id=tenant_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=delivery_revision,
        idempotency_key_hash=idempotency_key_hash,
        payload_hash=payload_hash,
        artifacts=manifest_items,
        overall_status=overall_status,
        resume_token_hash=resume_token_hash,
        resume_token_expires_at=(
            expires_at if overall_status == "PARTIAL" else None
        ),
    )
    manifest_row = persist_delivery_manifest(
        db,
        manifest=manifest,
        source_payload_json=source_payload_json,
    )
    if manifest_row.id != manifest.manifest_id:
        raise DeliveryConflict("delivery idempotency winner identity mismatch")
    artifact_ids = [item.artifact_id for item in manifest.artifacts]
    existing_rows = (
        db.query(ArtifactDeliveryItem)
        .filter(
            ArtifactDeliveryItem.tenant_id == tenant_id,
            ArtifactDeliveryItem.id.in_(artifact_ids),
        )
        .all()
    )
    existing_by_id = {row.id: row for row in existing_rows}
    if set(existing_by_id) == set(artifact_ids):
        return _replay_packet(
            db,
            storage_root=storage_root,
            row=manifest_row,
            manifest=manifest,
        )

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    expiry_text = _utc_iso(expires_at)
    for draft, manifest_item in zip(drafts, manifest.artifacts, strict=True):
        existing = existing_by_id.get(manifest_item.artifact_id)
        if existing is not None:
            _assert_item_projection(
                existing,
                manifest_item=manifest_item,
                tenant_id=tenant_id,
            )
            _assert_item_origin(
                db,
                item_row=existing,
                manifest_item=manifest_item,
                tenant_id=tenant_id,
            )
            continue
        db.add(
            ArtifactDeliveryItem(
                id=manifest_item.artifact_id,
                tenant_id=tenant_id,
                manifest_id=manifest.manifest_id,
                kind=manifest_item.kind,
                mime_type=manifest_item.mime_type,
                state=draft.status,
                storage_path=draft.storage_path,
                content_hash=manifest_item.content_hash,
                byte_size=manifest_item.byte_size,
                incomplete_reason=draft.incomplete_reason,
                last_failure=draft.incomplete_reason,
                retry_count=draft.retry_count,
                resume_token_hash=(
                    resume_token_hash if draft.status == "UNAVAILABLE" else None
                ),
                expires_at=expiry_text,
                created_at=now,
                updated_at=now,
            )
        )
    db.flush()
    for draft, manifest_item in zip(drafts, manifest.artifacts, strict=True):
        for event_type, outcome, detail in draft.audit_events:
            append_delivery_audit_event(
                db,
                tenant_id=tenant_id,
                manifest_id=manifest.manifest_id,
                artifact_id=manifest_item.artifact_id,
                event_type=event_type,
                outcome=outcome,
                detail=detail,
            )
    append_delivery_audit_event(
        db,
        tenant_id=tenant_id,
        manifest_id=manifest.manifest_id,
        artifact_id=None,
        event_type=(
            "delivery.failed"
            if overall_status == "UNDER_REVIEW"
            else "delivery.sealed"
        ),
        outcome="FAILURE" if overall_status == "UNDER_REVIEW" else "SUCCESS",
        detail={"overall_status": overall_status},
    )
    db.flush()
    if overall_status == "UNDER_REVIEW":
        db.commit()
        raise DeliveryError("artifact delivery failed")
    return DeliveryPacket(manifest=manifest, resume_token=resume_token)


def _deliver_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    payload: dict[str, Any],
    delivery_formula_version: str,
    idempotency_key: str,
    expires_at: datetime,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    """Render, verify, and seal one canonical three-format delivery packet."""
    expires_at = _require_future_expiry(expires_at)
    payload = _resolve_delivery_source(
        db,
        tenant_id=tenant_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        supplied_payload=payload,
    )
    idempotency_key_hash = _sha256_text(idempotency_key)
    source_payload_json = _canonical_source_payload_json(payload)
    payload_hash = _sha256_text(source_payload_json)
    winner = _find_idempotency_winner(
        db,
        tenant_id=tenant_id,
        idempotency_key_hash=idempotency_key_hash,
    )
    if winner is not None:
        manifest = _assert_replay_request(
            winner,
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            delivery_formula_version=delivery_formula_version,
            delivery_revision=1,
            payload_hash=payload_hash,
            source_payload_json=source_payload_json,
            expires_at=expires_at,
        )
        return _replay_packet(
            db,
            storage_root=storage_root,
            row=winner,
            manifest=manifest,
        )
    manifest_id = _manifest_id(
        tenant_id=tenant_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=1,
    )
    drafts = [
        _attempt_artifact(
            storage_root=storage_root,
            tenant_id=tenant_id,
            manifest_id=manifest_id,
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            delivery_formula_version=delivery_formula_version,
            delivery_revision=1,
            payload=payload,
            payload_hash=payload_hash,
            kind=kind,
            retry_count=0,
            renderer=renderer,
        )
        for kind in _DELIVERY_KINDS
    ]
    resume_token = (
        secrets.token_urlsafe(32)
        if {draft.status for draft in drafts} == {"STORED", "UNAVAILABLE"}
        else None
    )
    return _persist_delivery_packet(
        db,
        storage_root=storage_root,
        tenant_id=tenant_id,
        manifest_id=manifest_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=1,
        idempotency_key_hash=idempotency_key_hash,
        payload_hash=payload_hash,
        source_payload_json=source_payload_json,
        expires_at=expires_at,
        drafts=drafts,
        resume_token=resume_token,
    )


def _resume_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    manifest_id: str,
    resume_token: str,
    idempotency_key: str,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    """Retry only unavailable kinds from one immutable partial revision."""
    from src.artifacts.storage import read_verified_artifact

    prior_manifest = get_manifest_for_tenant(
        db,
        manifest_id=manifest_id,
        tenant_id=tenant_id,
    )
    if (
        prior_manifest.overall_status != "PARTIAL"
        or prior_manifest.resume_token_hash is None
        or prior_manifest.resume_token_expires_at is None
    ):
        raise DeliveryConflict("delivery manifest is not resumable")
    supplied_hash = _sha256_text(resume_token)
    if not hmac.compare_digest(supplied_hash, prior_manifest.resume_token_hash):
        raise DeliveryConflict("delivery resume token mismatch")
    if prior_manifest.resume_token_expires_at <= datetime.now(timezone.utc):
        raise DeliveryConflict("delivery resume token expired")
    prior_manifest_row = (
        db.query(ArtifactManifest)
        .filter_by(id=manifest_id, tenant_id=tenant_id)
        .one_or_none()
    )
    if prior_manifest_row is None:
        raise DeliveryNotFound("delivery manifest not found")
    payload = _validate_source_payload_json(
        prior_manifest_row.source_payload_json,
        expected_hash=prior_manifest.payload_hash,
    )
    source_payload_json = _canonical_source_payload_json(payload)

    prior_rows = _delivery_item_rows(
        db,
        manifest=prior_manifest,
    )

    idempotency_key_hash = _sha256_text(idempotency_key)
    next_revision = prior_manifest.delivery_revision + 1
    winner = _find_idempotency_winner(
        db,
        tenant_id=tenant_id,
        idempotency_key_hash=idempotency_key_hash,
    )
    if winner is not None:
        manifest = _assert_replay_request(
            winner,
            task_id=prior_manifest.task_id,
            final_memorial_id=prior_manifest.final_memorial_id,
            final_memorial_version=prior_manifest.final_memorial_version,
            delivery_formula_version=prior_manifest.delivery_formula_version,
            delivery_revision=next_revision,
            payload_hash=prior_manifest.payload_hash,
            source_payload_json=source_payload_json,
            expires_at=prior_manifest.resume_token_expires_at,
        )
        return _replay_packet(
            db,
            storage_root=storage_root,
            row=winner,
            manifest=manifest,
        )
    next_manifest_id = _manifest_id(
        tenant_id=tenant_id,
        task_id=prior_manifest.task_id,
        final_memorial_id=prior_manifest.final_memorial_id,
        final_memorial_version=prior_manifest.final_memorial_version,
        delivery_formula_version=prior_manifest.delivery_formula_version,
        delivery_revision=next_revision,
    )
    drafts: list[_DeliveryDraft] = []
    for kind in _DELIVERY_KINDS:
        prior_row = prior_rows[kind]
        prior_item = prior_manifest.artifact(kind)
        if prior_row.state == "UNAVAILABLE":
            drafts.append(
                _attempt_artifact(
                    storage_root=storage_root,
                    tenant_id=tenant_id,
                    manifest_id=next_manifest_id,
                    task_id=prior_manifest.task_id,
                    final_memorial_id=prior_manifest.final_memorial_id,
                    final_memorial_version=prior_manifest.final_memorial_version,
                    delivery_formula_version=prior_manifest.delivery_formula_version,
                    delivery_revision=next_revision,
                    payload=payload,
                    payload_hash=prior_manifest.payload_hash,
                    kind=kind,
                    retry_count=prior_row.retry_count + 1,
                    renderer=renderer,
                )
            )
            continue
        if prior_row.state != "STORED" or prior_row.storage_path is None:
            raise DeliveryIntegrityError("delivery item state is not resumable")
        stored_path = _delivery_storage_path(
            storage_root=storage_root,
            tenant_id=tenant_id,
            artifact_id=prior_row.id,
            storage_path=prior_row.storage_path,
        )
        read_verified_artifact(
            stored_path,
            expected_hash=prior_row.content_hash,
            expected_size=prior_row.byte_size,
        )
        drafts.append(
            _DeliveryDraft(
                artifact_id=prior_item.artifact_id,
                kind=kind,
                mime_type=prior_row.mime_type,
                status="STORED",
                storage_path=prior_row.storage_path,
                content_hash=prior_row.content_hash,
                byte_size=prior_row.byte_size,
                lineage_hash=prior_item.lineage_hash,
                incomplete_reason=None,
                retry_count=prior_row.retry_count,
                audit_events=(
                    ("artifact.reused", "SUCCESS", {"kind": kind}),
                ),
            )
        )

    statuses = {draft.status for draft in drafts}
    next_resume_token = (
        secrets.token_urlsafe(32)
        if statuses == {"STORED", "UNAVAILABLE"}
        else None
    )
    return _persist_delivery_packet(
        db,
        storage_root=storage_root,
        tenant_id=tenant_id,
        manifest_id=next_manifest_id,
        task_id=prior_manifest.task_id,
        final_memorial_id=prior_manifest.final_memorial_id,
        final_memorial_version=prior_manifest.final_memorial_version,
        delivery_formula_version=prior_manifest.delivery_formula_version,
        delivery_revision=next_revision,
        idempotency_key_hash=idempotency_key_hash,
        payload_hash=prior_manifest.payload_hash,
        source_payload_json=source_payload_json,
        expires_at=prior_manifest.resume_token_expires_at,
        drafts=drafts,
        resume_token=next_resume_token,
    )


def deliver_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    payload: dict[str, Any],
    delivery_formula_version: str,
    idempotency_key: str,
    expires_at: datetime,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    """Execute and commit one complete create-delivery command transaction."""
    try:
        packet = _deliver_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=tenant_id,
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
            payload=payload,
            delivery_formula_version=delivery_formula_version,
            idempotency_key=idempotency_key,
            expires_at=expires_at,
            renderer=renderer,
        )
        db.commit()
        return packet
    except DeliveryError:
        raise
    except Exception:
        db.rollback()
        raise


def resume_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    manifest_id: str,
    resume_token: str,
    idempotency_key: str,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    """Execute and commit one complete resume-delivery command transaction."""
    try:
        packet = _resume_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=tenant_id,
            manifest_id=manifest_id,
            resume_token=resume_token,
            idempotency_key=idempotency_key,
            renderer=renderer,
        )
        db.commit()
        return packet
    except DeliveryError:
        raise
    except Exception:
        db.rollback()
        raise


def _canonical_manifest_json(manifest: ArtifactManifestV1) -> str:
    return json.dumps(
        manifest.model_dump(mode="json", exclude_none=True),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _assert_idempotent_replay(
    row: ArtifactManifest,
    *,
    manifest: ArtifactManifestV1,
    manifest_json: str,
    source_payload_json: str | None,
) -> None:
    _verify_persisted_manifest(row)
    if (
        row.payload_hash != manifest.payload_hash
        or row.manifest_json != manifest_json
        or (
            source_payload_json is not None
            and row.source_payload_json != source_payload_json
        )
    ):
        raise DeliveryConflict(
            "delivery idempotency key was reused with a different payload"
        )


def persist_delivery_manifest(
    db,
    *,
    manifest: ArtifactManifestV1 | dict,
    source_payload_json: str | None = None,
) -> ArtifactManifest:
    """Persist one immutable delivery revision and converge identical retries."""
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )

    validated = ArtifactManifestV1.model_validate(manifest)
    if source_payload_json is not None:
        _validate_source_payload_json(
            source_payload_json,
            expected_hash=validated.payload_hash,
        )
    manifest_json = _canonical_manifest_json(validated)
    idempotent = (
        db.query(ArtifactManifest)
        .filter_by(
            tenant_id=validated.tenant_id,
            idempotency_key_hash=validated.idempotency_key_hash,
        )
        .one_or_none()
    )
    if idempotent is not None:
        _assert_idempotent_replay(
            idempotent,
            manifest=validated,
            manifest_json=manifest_json,
            source_payload_json=source_payload_json,
        )
        return idempotent

    lineage_filter = {
        "tenant_id": validated.tenant_id,
        "task_id": validated.task_id,
        "final_memorial_id": validated.final_memorial_id,
        "final_memorial_version": validated.final_memorial_version,
        "delivery_formula_version": validated.delivery_formula_version,
    }
    occupied_revision = (
        db.query(ArtifactManifest)
        .filter_by(
            **lineage_filter,
            delivery_revision=validated.delivery_revision,
        )
        .one_or_none()
    )
    if occupied_revision is not None:
        if (
            occupied_revision.idempotency_key_hash
            == validated.idempotency_key_hash
        ):
            _assert_idempotent_replay(
                occupied_revision,
                manifest=validated,
                manifest_json=manifest_json,
                source_payload_json=source_payload_json,
            )
            return occupied_revision
        raise DeliveryConflict("delivery revision is already sealed")

    latest_revision = (
        db.query(sa.func.max(ArtifactManifest.delivery_revision))
        .filter_by(**lineage_filter)
        .scalar()
    )
    expected_revision = (latest_revision or 0) + 1
    if validated.delivery_revision != expected_revision:
        winner = (
            db.query(ArtifactManifest)
            .filter_by(
                tenant_id=validated.tenant_id,
                idempotency_key_hash=validated.idempotency_key_hash,
            )
            .one_or_none()
        )
        if winner is not None:
            _assert_idempotent_replay(
                winner,
                manifest=validated,
                manifest_json=manifest_json,
                source_payload_json=source_payload_json,
            )
            return winner
        raise DeliveryConflict(
            f"delivery revision must be monotonic: expected {expected_revision}"
        )

    row = ArtifactManifest(
        id=validated.manifest_id,
        tenant_id=validated.tenant_id,
        task_id=validated.task_id,
        final_memorial_id=validated.final_memorial_id,
        final_memorial_version=validated.final_memorial_version,
        delivery_formula_version=validated.delivery_formula_version,
        delivery_revision=validated.delivery_revision,
        idempotency_key_hash=validated.idempotency_key_hash,
        payload_hash=validated.payload_hash,
        source_payload_json=source_payload_json,
        content_hash=canonical_manifest_hash(validated),
        manifest_json=manifest_json,
        overall_status=validated.overall_status,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        winner = (
            db.query(ArtifactManifest)
            .filter_by(
                tenant_id=validated.tenant_id,
                idempotency_key_hash=validated.idempotency_key_hash,
            )
            .one_or_none()
        )
        if winner is None:
            raise DeliveryIntegrityError(
                "delivery uniqueness conflict has no idempotency winner"
            ) from exc
        _assert_idempotent_replay(
            winner,
            manifest=validated,
            manifest_json=manifest_json,
            source_payload_json=source_payload_json,
        )
        return winner
    return row


def _append_delivery_audit_row(
    db,
    *,
    tenant_id: int,
    manifest_id: str,
    artifact_id: str | None,
    event_type: str,
    outcome: str,
    detail: dict,
) -> ArtifactDeliveryAuditEvent:
    row = ArtifactDeliveryAuditEvent(
        id="delivery_audit_" + uuid.uuid4().hex,
        tenant_id=tenant_id,
        manifest_id=manifest_id,
        artifact_id=artifact_id,
        event_type=event_type,
        outcome=outcome,
        detail_json=json.dumps(
            detail,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ),
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    db.add(row)
    db.flush()
    return row


def append_delivery_audit_event(
    db,
    *,
    tenant_id: int,
    manifest_id: str,
    artifact_id: str | None,
    event_type: str,
    outcome: str,
    detail: dict,
) -> ArtifactDeliveryAuditEvent:
    """Append tenant-authorized delivery evidence without mutating prior events."""
    manifest_row = (
        db.query(ArtifactManifest).filter_by(id=manifest_id).one_or_none()
    )
    if manifest_row is None:
        raise DeliveryNotFound("delivery manifest not found")
    if manifest_row.tenant_id != tenant_id:
        raise DeliveryForbidden("delivery manifest tenant mismatch")
    manifest = _verify_persisted_manifest(manifest_row)

    if artifact_id is not None:
        artifact = (
            db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one_or_none()
        )
        if artifact is None:
            raise DeliveryNotFound("delivery artifact not found")
        if artifact.tenant_id != tenant_id:
            raise DeliveryForbidden("delivery artifact tenant mismatch")
        manifest_item = next(
            (
                item
                for item in manifest.artifacts
                if item.artifact_id == artifact_id
            ),
            None,
        )
        if manifest_item is None:
            raise DeliveryForbidden("delivery artifact manifest mismatch")
        _assert_item_projection(
            artifact,
            manifest_item=manifest_item,
            tenant_id=tenant_id,
        )
        _assert_item_origin(
            db,
            item_row=artifact,
            manifest_item=manifest_item,
            tenant_id=tenant_id,
        )

    return _append_delivery_audit_row(
        db,
        tenant_id=tenant_id,
        manifest_id=manifest_id,
        artifact_id=artifact_id,
        event_type=event_type,
        outcome=outcome,
        detail=detail,
    )


def persist_manifest(
    db,
    *,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    content_hash: str | None = None,
    manifest_json: dict,
    overall_status: str,
) -> ArtifactManifest:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    validated_manifest = ArtifactManifestV1.model_validate(manifest_json)
    manifest_json = validated_manifest.model_dump(mode="json")
    if (
        validated_manifest.tenant_id != tenant_id
        or validated_manifest.task_id != task_id
        or validated_manifest.final_memorial_id != final_memorial_id
        or validated_manifest.final_memorial_version != final_memorial_version
        or validated_manifest.delivery_formula_version != delivery_formula_version
    ):
        raise ValueError("manifest tenant or lineage identity does not match persistence arguments")
    if content_hash is None or not __import__("re").fullmatch(r"[0-9a-f]{64}", content_hash):
        raise ValueError("manifest content_hash must be a SHA-256 digest")
    existing = (
        db.query(ArtifactManifest)
        .filter_by(
            task_id=task_id,
            tenant_id=tenant_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
        )
        .one_or_none()
    )
    if existing is not None:
        if existing.content_hash != content_hash or existing.manifest_json != json.dumps(manifest_json, sort_keys=True):
            raise ValueError("artifact manifest lineage hash cannot change")
        return existing
    manifest_id = "manifest_" + hashlib.sha256(
        f"{task_id}|{final_memorial_id}|{final_memorial_version}".encode()
    ).hexdigest()[:24]
    row = ArtifactManifest(
        id=manifest_id,
        task_id=task_id,
        tenant_id=tenant_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        delivery_revision=validated_manifest.delivery_revision,
        idempotency_key_hash=validated_manifest.idempotency_key_hash,
        payload_hash=validated_manifest.payload_hash,
        content_hash=content_hash,
        manifest_json=json.dumps(manifest_json, sort_keys=True),
        overall_status=overall_status,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        winner = (
            db.query(ArtifactManifest)
            .filter_by(
                task_id=task_id,
                tenant_id=tenant_id,
                final_memorial_id=final_memorial_id,
                final_memorial_version=final_memorial_version,
            )
            .one_or_none()
        )
        if winner is None:
            raise
        if winner.content_hash != content_hash or winner.manifest_json != json.dumps(manifest_json, sort_keys=True):
            raise ValueError("artifact manifest lineage hash cannot change") from exc
        return winner
    return row


def get_manifest_for_tenant(db, *, manifest_id: str, tenant_id: int):
    row = db.query(ArtifactManifest).filter_by(id=manifest_id).one_or_none()
    if row is None:
        raise DeliveryNotFound("manifest not found")
    if row.tenant_id != tenant_id:
        raise DeliveryForbidden("manifest tenant mismatch")
    return _verify_persisted_manifest(row)


def _parse_delivery_expiry(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        expires_at = datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise DeliveryIntegrityError(
            "delivery item expiry is invalid"
        ) from exc
    if expires_at.tzinfo is None or expires_at.utcoffset() is None:
        raise DeliveryIntegrityError("delivery item expiry must be timezone-aware")
    return expires_at.astimezone(timezone.utc)


def _delivery_storage_path(
    *,
    storage_root: Path,
    tenant_id: int,
    artifact_id: str,
    storage_path: str | None,
) -> Path:
    if storage_path is None:
        raise DeliveryIntegrityError("stored delivery artifact has no path")
    path = Path(storage_path)
    expected_path = storage_root / str(tenant_id) / artifact_id
    if path != expected_path:
        raise DeliveryIntegrityError(
            "delivery artifact path does not match storage identity"
        )
    return path


def get_delivery_manifest_for_tenant(
    db,
    *,
    storage_root: Path,
    manifest_id: str,
    tenant_id: int,
) -> DeliveryManifestAccess:
    """Return a public-safe delivery projection for one authorized tenant."""
    from src.artifacts.storage import read_verified_artifact

    manifest = get_manifest_for_tenant(
        db,
        manifest_id=manifest_id,
        tenant_id=tenant_id,
    )
    by_kind = _delivery_item_rows(
        db,
        manifest=manifest,
    )

    now = datetime.now(timezone.utc)
    items: list[DeliveryItemAccess] = []
    for manifest_item in manifest.artifacts:
        row = by_kind[manifest_item.kind]
        expires_at = _parse_delivery_expiry(row.expires_at)
        if expires_at != manifest_item.expires_at:
            raise DeliveryIntegrityError(
                "delivery item expiry does not match immutable manifest"
            )
        downloadable = False
        if (
            row.state == "STORED"
            and expires_at is not None
            and expires_at > now
        ):
            try:
                stored_path = _delivery_storage_path(
                    storage_root=storage_root,
                    tenant_id=tenant_id,
                    artifact_id=row.id,
                    storage_path=row.storage_path,
                )
                read_verified_artifact(
                    stored_path,
                    expected_hash=row.content_hash,
                    expected_size=row.byte_size,
                )
            except DeliveryIntegrityError:
                pass
            else:
                downloadable = True
        items.append(
            DeliveryItemAccess(
                artifact_id=row.id,
                kind=row.kind,
                mime_type=row.mime_type,
                byte_size=row.byte_size,
                content_hash=row.content_hash,
                lineage_hash=manifest_item.lineage_hash,
                status=row.state,
                incomplete_reason=row.incomplete_reason,
                expires_at=expires_at,
                downloadable=downloadable,
            )
        )
    return DeliveryManifestAccess(manifest=manifest, items=tuple(items))


def read_verified_delivery_artifact(
    db,
    *,
    storage_root: Path,
    artifact_id: str,
    tenant_id: int,
) -> VerifiedDeliveryArtifact:
    """Read one authorized artifact and durably audit the verified outcome."""
    from src.artifacts.storage import read_verified_artifact

    item = (
        db.query(ArtifactDeliveryItem)
        .filter_by(id=artifact_id)
        .one_or_none()
    )
    if item is None:
        _commit_unresolved_download_audit(db, tenant_id=tenant_id)
        raise DeliveryNotFound("delivery artifact not found")
    if item.tenant_id != tenant_id:
        _commit_unresolved_download_audit(db, tenant_id=tenant_id)
        raise DeliveryForbidden("delivery artifact tenant mismatch")

    try:
        access = get_delivery_manifest_for_tenant(
            db,
            storage_root=storage_root,
            manifest_id=item.manifest_id,
            tenant_id=tenant_id,
        )
        selected = next(
            (
                candidate
                for candidate in access.items
                if candidate.artifact_id == artifact_id
            ),
            None,
        )
        if selected is None:
            raise DeliveryIntegrityError(
                "delivery artifact is not a member of its manifest"
            )
        if selected.status == "EXPIRED":
            raise DeliveryExpired("delivery artifact has expired")
        if selected.status != "STORED":
            raise DeliveryConflict("delivery artifact is not stored")
        if selected.expires_at is None:
            raise DeliveryIntegrityError("delivery artifact expiry is missing")
        if selected.expires_at <= datetime.now(timezone.utc):
            item.state = "EXPIRED"
            raise DeliveryExpired("delivery artifact has expired")
        stored_path = _delivery_storage_path(
            storage_root=storage_root,
            tenant_id=tenant_id,
            artifact_id=item.id,
            storage_path=item.storage_path,
        )
        content = read_verified_artifact(
            stored_path,
            expected_hash=selected.content_hash,
            expected_size=selected.byte_size,
        )
    except (DeliveryConflict, DeliveryExpired, DeliveryIntegrityError) as exc:
        reason = (
            "expired"
            if isinstance(exc, DeliveryExpired)
            else "conflict"
            if isinstance(exc, DeliveryConflict)
            else "integrity_error"
        )
        item.last_failure = reason
        item.updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        _commit_download_audit(
            db,
            tenant_id=tenant_id,
            manifest_id=item.manifest_id,
            artifact_id=artifact_id,
            outcome="FAILURE",
            reason=reason,
        )
        raise

    verified = VerifiedDeliveryArtifact(
        content=content,
        mime_type=selected.mime_type,
    )
    _commit_download_audit(
        db,
        tenant_id=tenant_id,
        manifest_id=item.manifest_id,
        artifact_id=artifact_id,
        outcome="SUCCESS",
        reason="verified",
    )
    return verified


def _commit_unresolved_download_audit(db, *, tenant_id: int) -> None:
    try:
        _append_delivery_audit_row(
            db,
            tenant_id=tenant_id,
            manifest_id=_UNRESOLVED_DOWNLOAD_MANIFEST_ID,
            artifact_id=None,
            event_type="artifact.download",
            outcome="FAILURE",
            detail={"reason": "not_found_or_forbidden"},
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise DeliveryIntegrityError(
            "artifact download audit could not be committed"
        ) from exc


def _commit_download_audit(
    db,
    *,
    tenant_id: int,
    manifest_id: str,
    artifact_id: str,
    outcome: str,
    reason: str,
) -> None:
    try:
        if outcome == "FAILURE":
            item = (
                db.query(ArtifactDeliveryItem)
                .filter_by(
                    id=artifact_id,
                    tenant_id=tenant_id,
                    manifest_id=manifest_id,
                )
                .one_or_none()
            )
            manifest = (
                db.query(ArtifactManifest)
                .filter_by(id=manifest_id, tenant_id=tenant_id)
                .one_or_none()
            )
            if item is None or manifest is None:
                raise DeliveryIntegrityError(
                    "failed download audit identity is invalid"
                )
            _append_delivery_audit_row(
                db,
                tenant_id=tenant_id,
                manifest_id=manifest_id,
                artifact_id=artifact_id,
                event_type="artifact.download",
                outcome=outcome,
                detail={"reason": reason},
            )
        else:
            append_delivery_audit_event(
                db,
                tenant_id=tenant_id,
                manifest_id=manifest_id,
                artifact_id=artifact_id,
                event_type="artifact.download",
                outcome=outcome,
                detail={"reason": reason},
            )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise DeliveryIntegrityError(
            "artifact download audit could not be committed"
        ) from exc
