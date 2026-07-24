"""Persistence boundary for canonical W06 artifact manifests."""

from __future__ import annotations

import hashlib
import json
from sqlalchemy.exc import IntegrityError

from src.db.models import ArtifactManifest


def persist_manifest(
    db,
    *,
    tenant_id: int = 1,
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
        validated_manifest.task_id != task_id
        or validated_manifest.final_memorial_id != final_memorial_id
        or validated_manifest.final_memorial_version != final_memorial_version
        or validated_manifest.delivery_formula_version != delivery_formula_version
    ):
        raise ValueError("manifest lineage identity does not match persistence arguments")
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
        content_hash=content_hash,
        manifest_json=json.dumps(manifest_json, sort_keys=True),
        overall_status=overall_status,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
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
            raise ValueError("artifact manifest lineage hash cannot change")
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
    if manifest.task_id != row.task_id or manifest.final_memorial_id != row.final_memorial_id or manifest.final_memorial_version != row.final_memorial_version or manifest.delivery_formula_version != row.delivery_formula_version:
        raise ValueError("persisted manifest lineage mismatch")
    return manifest
