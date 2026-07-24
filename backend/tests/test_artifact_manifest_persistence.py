"""R0-W06-3 RED: canonical manifest persistence and read authorization."""

from __future__ import annotations

import pytest
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


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
    payload = {"tenant_id": 1, "task_id": "task-manifest-1", "final_memorial_id": "memorial-1", "final_memorial_version": 2, "delivery_formula_version": "w06-v1", "content_hash": "c"*64, "manifest_json": manifest, "overall_status": "READY"}
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
        tenant_id=1,
        task_id="task-manifest-2",
        final_memorial_id="memorial-2",
        final_memorial_version=1,
        delivery_formula_version="w06-v1",
            content_hash="a" * 64, manifest_json={"schema_version":"ArtifactManifestV1","manifest_id":"m2","task_id":"task-manifest-2","final_memorial_id":"memorial-2","final_memorial_version":1,"delivery_formula_version":"w06-v1","artifacts":[{"artifact_id":"a1","kind":"JSON","mime_type":"application/json","byte_size":1,"content_hash":"a"*64,"lineage_hash":"b"*64,"status":"READY"}],"overall_status":"READY"}, overall_status="READY",
    )
    with pytest.raises(ValueError):
        persist_manifest(
            db,
            tenant_id=1,
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
            tenant_id=1,
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
    winner = type("Winner", (), {"content_hash": "c"*64, "manifest_json": __import__("json").dumps(manifest, sort_keys=True), "task_id": "task-race"})()
    result = persist_manifest(FakeDB(), tenant_id=1, task_id="task-race", final_memorial_id="memorial-race", final_memorial_version=1, delivery_formula_version="w06-v1", content_hash="c"*64, manifest_json=manifest, overall_status="READY")
    assert result is winner


def test_two_independent_sessions_replay_same_manifest(tmp_path) -> None:
    from src.artifacts.service import persist_manifest
    from src.db.models import ArtifactManifest, Base

    engine = create_engine(f"sqlite:///{tmp_path / 'manifest-race.db'}", connect_args={"timeout": 30})
    Base.metadata.create_all(engine, tables=[ArtifactManifest.__table__])
    factory = sessionmaker(bind=engine)
    manifest = {
        "schema_version": "ArtifactManifestV1", "manifest_id": "m-two-session",
        "task_id": "task-two-session", "final_memorial_id": "memorial-two-session",
        "final_memorial_version": 1, "delivery_formula_version": "w06-v1",
        "artifacts": [{"artifact_id": "a1", "kind": "JSON", "mime_type": "application/json", "byte_size": 1, "content_hash": "a"*64, "lineage_hash": "b"*64, "status": "READY"}],
        "overall_status": "READY",
    }

    def write_once():
        db = factory()
        try:
            row = persist_manifest(db, tenant_id=1, task_id="task-two-session", final_memorial_id="memorial-two-session", final_memorial_version=1, delivery_formula_version="w06-v1", content_hash="c"*64, manifest_json=manifest, overall_status="READY")
            db.commit()
            return row.id
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _n: write_once(), range(2)))
    assert ids[0] == ids[1]
    db = factory()
    assert db.query(ArtifactManifest).count() == 1
    db.close()
