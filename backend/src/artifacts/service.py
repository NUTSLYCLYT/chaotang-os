"""Persistence boundary for canonical W06 artifact manifests."""

from __future__ import annotations

import hashlib
import json
from sqlalchemy.exc import IntegrityError

from src.db.models import ArtifactManifest


def persist_manifest(
    db,
    *,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    content_hash: str | None = None,
    manifest_json: dict | None = None,
    overall_status: str = "PARTIAL",
) -> ArtifactManifest:
    if manifest_json:
        from src.contracts.artifact_manifest import ArtifactManifestV1

        ArtifactManifestV1.model_validate(manifest_json)
    existing = (
        db.query(ArtifactManifest)
        .filter_by(
            task_id=task_id,
            final_memorial_id=final_memorial_id,
            final_memorial_version=final_memorial_version,
        )
        .one_or_none()
    )
    if existing is not None:
        if existing.content_hash != content_hash or existing.manifest_json != json.dumps(manifest_json or {}, sort_keys=True):
            raise ValueError("artifact manifest lineage hash cannot change")
        return existing
    manifest_id = "manifest_" + hashlib.sha256(
        f"{task_id}|{final_memorial_id}|{final_memorial_version}".encode()
    ).hexdigest()[:24]
    row = ArtifactManifest(
        id=manifest_id,
        task_id=task_id,
        final_memorial_id=final_memorial_id,
        final_memorial_version=final_memorial_version,
        delivery_formula_version=delivery_formula_version,
        content_hash=content_hash,
        manifest_json=json.dumps(manifest_json or {}, sort_keys=True),
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
                final_memorial_id=final_memorial_id,
                final_memorial_version=final_memorial_version,
            )
            .one_or_none()
        )
        if winner is None:
            raise
        if winner.content_hash != content_hash or winner.manifest_json != json.dumps(manifest_json or {}, sort_keys=True):
            raise ValueError("artifact manifest lineage hash cannot change")
        return winner
    return row
