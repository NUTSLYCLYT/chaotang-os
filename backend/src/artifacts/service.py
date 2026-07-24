"""Persistence boundary for canonical W06 artifact manifests."""

from __future__ import annotations

import hashlib

from src.db.models import ArtifactManifest


def persist_manifest(
    db,
    *,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    delivery_formula_version: str,
    content_hash: str | None = None,
) -> ArtifactManifest:
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
        if existing.content_hash != content_hash:
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
    )
    db.add(row)
    db.flush()
    return row
