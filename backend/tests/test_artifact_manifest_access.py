"""R0-W06-4 RED: tenant-scoped manifest access contract."""

from __future__ import annotations

import pytest


def test_manifest_read_requires_same_tenant_and_returns_canonical_v1(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant

    db = isolated_session_local()
    manifest = get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=7)
    assert manifest.schema_version == "ArtifactManifestV1"
    assert manifest.task_id == "task-1"
    db.close()


def test_manifest_read_rejects_cross_tenant_access(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant

    db = isolated_session_local()
    with pytest.raises(PermissionError):
        get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=99)
    db.close()
