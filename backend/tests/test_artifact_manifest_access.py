"""R0-W06-4 RED: tenant-scoped manifest access contract."""

from __future__ import annotations

import json

import pytest


def _sealed_manifest_json(*, tenant_id: int) -> str:
    return json.dumps(
        {
            "schema_version": "ArtifactManifestV1",
            "manifest_id": "manifest-1",
            "tenant_id": tenant_id,
            "task_id": "task-1",
            "final_memorial_id": "memorial-1",
            "final_memorial_version": 1,
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
        },
        sort_keys=True,
    )


def test_manifest_read_requires_same_tenant_and_returns_canonical_v1(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(
        ArtifactManifest(
            id="manifest-1",
            tenant_id=7,
            task_id="task-1",
            final_memorial_id="memorial-1",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            manifest_json=_sealed_manifest_json(tenant_id=7),
            overall_status="READY",
        )
    )
    db.commit()
    manifest = get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=7)
    assert manifest.schema_version == "ArtifactManifestV1"
    assert manifest.task_id == "task-1"
    db.close()


def test_manifest_read_rejects_cross_tenant_access(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(
        ArtifactManifest(
            id="manifest-1",
            tenant_id=7,
            task_id="task-1",
            final_memorial_id="memorial-1",
            final_memorial_version=1,
            delivery_formula_version="w06-v1",
            manifest_json=_sealed_manifest_json(tenant_id=7),
            overall_status="READY",
        )
    )
    db.commit()
    with pytest.raises(PermissionError):
        get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=99)
    db.close()
