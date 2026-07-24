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


def test_manifest_payload_is_required_and_canonical(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    with pytest.raises((TypeError, ValueError)):
        persist_manifest(
            db,
            task_id="task-empty",
            final_memorial_id="memorial-empty",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            manifest_json={},
            overall_status="PARTIAL",
        )
    db.close()


def test_unique_conflict_branch_reloads_existing_winner() -> None:
    from sqlalchemy.exc import IntegrityError
    from src.artifacts.service import persist_manifest

    manifest = {
        "schema_version": "ArtifactManifestV1", "manifest_id": "m-race",
        "task_id": "task-race", "final_memorial_id": "memorial-race",
        "final_memorial_version": 1, "delivery_formula_version": "w06-v1",
        "artifacts": [{"artifact_id": "a1", "kind": "JSON", "mime_type": "application/json", "byte_size": 1, "content_hash": "a"*64, "lineage_hash": "b"*64, "status": "READY"}],
        "overall_status": "READY",
    }
    class Query:
        def filter_by(self, **_kwargs): return self
        def one_or_none(self): return winner
    class FakeDB:
        def add(self, _row): pass
        def flush(self): raise IntegrityError("insert", {}, Exception("unique"))
        def rollback(self): pass
        def query(self, _model): return Query()
    winner = type("Winner", (), {"content_hash": None, "manifest_json": __import__("json").dumps(manifest, sort_keys=True), "task_id": "task-race"})()
    result = persist_manifest(FakeDB(), task_id="task-race", final_memorial_id="memorial-race", final_memorial_version=1, delivery_formula_version="w06-v1", manifest_json=manifest, overall_status="READY")
    assert result is winner
