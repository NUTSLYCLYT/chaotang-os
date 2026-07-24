"""R0-W06-4 RED: tenant-scoped manifest access contract."""

from __future__ import annotations

import pytest


def test_manifest_read_requires_same_tenant_and_returns_canonical_v1(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(ArtifactManifest(id="manifest-1", tenant_id=7, task_id="task-1", final_memorial_id="memorial-1", final_memorial_version=1, delivery_formula_version="w06-v1", manifest_json='{"schema_version":"ArtifactManifestV1","manifest_id":"manifest-1","task_id":"task-1","final_memorial_id":"memorial-1","final_memorial_version":1,"delivery_formula_version":"w06-v1","artifacts":[{"artifact_id":"a","kind":"JSON","mime_type":"application/json","byte_size":1,"content_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","lineage_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","status":"READY"}],"overall_status":"READY"}', overall_status="READY"))
    db.commit()
    manifest = get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=7)
    assert manifest.schema_version == "ArtifactManifestV1"
    assert manifest.task_id == "task-1"
    db.close()


def test_manifest_read_rejects_cross_tenant_access(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant

    db = isolated_session_local()
    from src.db.models import ArtifactManifest, Base
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(ArtifactManifest(id="manifest-1", tenant_id=7, task_id="task-1", final_memorial_id="memorial-1", final_memorial_version=1, delivery_formula_version="w06-v1", manifest_json='{}', overall_status="READY"))
    db.commit()
    with pytest.raises(PermissionError):
        get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=99)
    db.close()
