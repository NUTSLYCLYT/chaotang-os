"""R0-W06-3 RED: canonical manifest persistence and read authorization."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _sealed_manifest(
    *,
    tenant_id: int,
    manifest_id: str,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
) -> dict:
    return {
        "schema_version": "ArtifactManifestV1",
        "manifest_id": manifest_id,
        "tenant_id": tenant_id,
        "task_id": task_id,
        "final_memorial_id": final_memorial_id,
        "final_memorial_version": final_memorial_version,
        "delivery_formula_version": "w06-v1",
        "delivery_revision": 1,
        "idempotency_key_hash": "c" * 64,
        "payload_hash": "d" * 64,
        "artifacts": [
            {
                "artifact_id": "artifact-pdf",
                "kind": "PDF",
                "mime_type": "application/pdf",
                "byte_size": 10,
                "content_hash": "a" * 64,
                "lineage_hash": "b" * 64,
                "status": "STORED",
            },
            {
                "artifact_id": "artifact-docx",
                "kind": "DOCX",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "byte_size": 20,
                "content_hash": "1" * 64,
                "lineage_hash": "2" * 64,
                "status": "STORED",
            },
            {
                "artifact_id": "artifact-json",
                "kind": "JSON",
                "mime_type": "application/json",
                "byte_size": 30,
                "content_hash": "3" * 64,
                "lineage_hash": "4" * 64,
                "status": "STORED",
            },
        ],
        "overall_status": "READY",
    }


def _stored_manifest_json(manifest: dict) -> str:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    validated = ArtifactManifestV1.model_validate(manifest)
    return json.dumps(validated.model_dump(mode="json"), sort_keys=True)


def test_manifest_persistence_is_idempotent_for_memorial_lineage(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    manifest = _sealed_manifest(
        tenant_id=1,
        manifest_id="manifest-task-1-v2",
        task_id="task-manifest-1",
        final_memorial_id="memorial-1",
        final_memorial_version=2,
    )
    payload = {
        "tenant_id": 1,
        "task_id": "task-manifest-1",
        "final_memorial_id": "memorial-1",
        "final_memorial_version": 2,
        "delivery_formula_version": "w06-v1",
        "content_hash": "c" * 64,
        "manifest_json": manifest,
        "overall_status": "READY",
    }
    first = persist_manifest(db, **payload)
    second = persist_manifest(db, **payload)
    assert first.id == second.id
    assert first.overall_status == "READY"
    db.close()


def test_manifest_persistence_rejects_embedded_tenant_mismatch(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    manifest = _sealed_manifest(
        tenant_id=2,
        manifest_id="manifest-wrong-tenant",
        task_id="task-wrong-tenant",
        final_memorial_id="memorial-wrong-tenant",
        final_memorial_version=1,
    )
    with pytest.raises(ValueError, match="tenant"):
        persist_manifest(
            db,
            tenant_id=1,
            task_id="task-wrong-tenant",
            final_memorial_id="memorial-wrong-tenant",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            content_hash="c" * 64,
            manifest_json=manifest,
            overall_status="READY",
        )
    db.close()


def test_manifest_hash_cannot_change_for_same_lineage(isolated_session_local) -> None:
    from src.artifacts.service import persist_manifest

    db = isolated_session_local()
    manifest = _sealed_manifest(
        tenant_id=1,
        manifest_id="m2",
        task_id="task-manifest-2",
        final_memorial_id="memorial-2",
        final_memorial_version=1,
    )
    persist_manifest(
        db,
        tenant_id=1,
        task_id="task-manifest-2",
        final_memorial_id="memorial-2",
        final_memorial_version=1,
        delivery_formula_version="w06-v1",
        content_hash="a" * 64,
        manifest_json=manifest,
        overall_status="READY",
    )
    with pytest.raises(ValueError):
        persist_manifest(
            db,
            tenant_id=1,
            task_id="task-manifest-2",
            final_memorial_id="memorial-2",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            content_hash="b" * 64,
            manifest_json=manifest,
            overall_status="READY",
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

    manifest = _sealed_manifest(
        tenant_id=1,
        manifest_id="m-race",
        task_id="task-race",
        final_memorial_id="memorial-race",
        final_memorial_version=1,
    )

    class Query:
        def filter_by(self, **_kwargs):
            return self

        def one_or_none(self):
            return winner

    class FakeDB:
        def add(self, _row):
            pass

        def flush(self):
            raise IntegrityError("insert", {}, Exception("unique"))

        def rollback(self):
            pass

        def query(self, _model):
            return Query()

    winner = type(
        "Winner",
        (),
        {
            "content_hash": "c" * 64,
            "manifest_json": _stored_manifest_json(manifest),
            "task_id": "task-race",
        },
    )()
    result = persist_manifest(
        FakeDB(),
        tenant_id=1,
        task_id="task-race",
        final_memorial_id="memorial-race",
        final_memorial_version=1,
        delivery_formula_version="w06-v1",
        content_hash="c" * 64,
        manifest_json=manifest,
        overall_status="READY",
    )
    assert result is winner


def test_two_independent_sessions_replay_same_manifest(tmp_path) -> None:
    from src.artifacts.service import persist_manifest
    from src.db.models import ArtifactManifest, Base

    engine = create_engine(
        f"sqlite:///{tmp_path / 'manifest-race.db'}", connect_args={"timeout": 30}
    )
    Base.metadata.create_all(engine, tables=[ArtifactManifest.__table__])
    factory = sessionmaker(bind=engine)
    manifest = _sealed_manifest(
        tenant_id=1,
        manifest_id="m-two-session",
        task_id="task-two-session",
        final_memorial_id="memorial-two-session",
        final_memorial_version=1,
    )

    def write_once():
        db = factory()
        try:
            row = persist_manifest(
                db,
                tenant_id=1,
                task_id="task-two-session",
                final_memorial_id="memorial-two-session",
                final_memorial_version=1,
                delivery_formula_version="w06-v1",
                content_hash="c" * 64,
                manifest_json=manifest,
                overall_status="READY",
            )
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
