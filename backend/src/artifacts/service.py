"""Persistence boundary for canonical W06 artifact manifests."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from src.db.models import (
    ArtifactDeliveryAuditEvent,
    ArtifactDeliveryItem,
    ArtifactManifest,
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
) -> None:
    if row.payload_hash != manifest.payload_hash or row.manifest_json != manifest_json:
        raise DeliveryConflict(
            "delivery idempotency key was reused with a different payload"
        )


def persist_delivery_manifest(
    db,
    *,
    manifest: ArtifactManifestV1 | dict,
) -> ArtifactManifest:
    """Persist one immutable delivery revision and converge identical retries."""
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )

    validated = ArtifactManifestV1.model_validate(manifest)
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
        )
        return winner
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
    manifest = (
        db.query(ArtifactManifest).filter_by(id=manifest_id).one_or_none()
    )
    if manifest is None:
        raise DeliveryNotFound("delivery manifest not found")
    if manifest.tenant_id != tenant_id:
        raise DeliveryForbidden("delivery manifest tenant mismatch")

    if artifact_id is not None:
        artifact = (
            db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one_or_none()
        )
        if artifact is None:
            raise DeliveryNotFound("delivery artifact not found")
        if artifact.tenant_id != tenant_id or artifact.manifest_id != manifest_id:
            raise DeliveryForbidden("delivery artifact tenant or manifest mismatch")

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
    from src.contracts.artifact_manifest import ArtifactManifestV1

    row = db.query(ArtifactManifest).filter_by(id=manifest_id).one_or_none()
    if row is None:
        raise LookupError("manifest not found")
    if row.tenant_id != tenant_id:
        raise PermissionError("manifest tenant mismatch")
    manifest = ArtifactManifestV1.model_validate_json(row.manifest_json)
    if (
        manifest.tenant_id != row.tenant_id
        or manifest.task_id != row.task_id
        or manifest.final_memorial_id != row.final_memorial_id
        or manifest.final_memorial_version != row.final_memorial_version
        or manifest.delivery_formula_version != row.delivery_formula_version
    ):
        raise ValueError("persisted manifest tenant or lineage mismatch")
    return manifest
