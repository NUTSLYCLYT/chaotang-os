"""R0-W06-3 RED: canonical manifest persistence and read authorization."""

from __future__ import annotations

import pytest


def test_manifest_persistence_is_idempotent_for_memorial_lineage(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    manifest = {
        "schema_version": "ArtifactManifestV1",
        "manifest_id": "manifest-task-1-v2",
        "task_id": "task-manifest-1",
        "final_memorial_id": "memorial-1",
        "final_memorial_version": 2,
        "delivery_formula_version": "w06-v1",
        "artifacts": [{"artifact_id": "a1", "kind": "JSON", "mime_type": "application/json", "byte_size": 1, "content_hash": "a" * 64, "lineage_hash": "b" * 64, "status": "READY"}],
        "overall_status": "READY",
    }
    payload = {"task_id": "task-manifest-1", "final_memorial_id": "memorial-1", "final_memorial_version": 2, "delivery_formula_version": "w06-v1", "manifest_json": manifest, "overall_status": "READY"}
    first = persist_manifest(db, **payload)
    second = persist_manifest(db, **payload)
    assert first.id == second.id
    assert first.overall_status == "READY"
    db.close()


def test_manifest_hash_cannot_change_for_same_lineage(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    persist_manifest(
        db,
        task_id="task-manifest-2",
        final_memorial_id="memorial-2",
        final_memorial_version=1,
        delivery_formula_version="w06-v1",
            content_hash="a" * 64, manifest_json={"schema_version":"ArtifactManifestV1","manifest_id":"m2","task_id":"task-manifest-2","final_memorial_id":"memorial-2","final_memorial_version":1,"delivery_formula_version":"w06-v1","artifacts":[{"artifact_id":"a1","kind":"JSON","mime_type":"application/json","byte_size":1,"content_hash":"a"*64,"lineage_hash":"b"*64,"status":"READY"}],"overall_status":"READY"}, overall_status="READY",
    )
    with pytest.raises(ValueError):
        persist_manifest(
            db,
            task_id="task-manifest-2",
            final_memorial_id="memorial-2",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            content_hash="b" * 64, manifest_json={"schema_version":"ArtifactManifestV1","manifest_id":"m2","task_id":"task-manifest-2","final_memorial_id":"memorial-2","final_memorial_version":1,"delivery_formula_version":"w06-v1","artifacts":[{"artifact_id":"a1","kind":"JSON","mime_type":"application/json","byte_size":1,"content_hash":"a"*64,"lineage_hash":"b"*64,"status":"READY"}],"overall_status":"READY"}, overall_status="READY",
        )
    db.close()
