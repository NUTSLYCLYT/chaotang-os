"""R0-W06-4 RED: tenant-scoped manifest access contract."""

from __future__ import annotations

import json

import pytest


def _sealed_manifest_json(*, manifest_id: str, tenant_id: int) -> str:
    return json.dumps(
        {
            "schema_version": "ArtifactManifestV1",
            "manifest_id": manifest_id,
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


def _manifest_row(
    *,
    manifest_id: str,
    tenant_id: int,
    embedded_tenant_id: int | None = None,
):
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )
    from src.db.models import ArtifactManifest

    manifest_json = _sealed_manifest_json(
        manifest_id=manifest_id,
        tenant_id=embedded_tenant_id or tenant_id,
    )
    manifest = ArtifactManifestV1.model_validate_json(manifest_json)
    return ArtifactManifest(
        id=manifest_id,
        tenant_id=tenant_id,
        task_id=manifest.task_id,
        final_memorial_id=manifest.final_memorial_id,
        final_memorial_version=manifest.final_memorial_version,
        delivery_formula_version=manifest.delivery_formula_version,
        delivery_revision=manifest.delivery_revision,
        idempotency_key_hash=manifest.idempotency_key_hash,
        payload_hash=manifest.payload_hash,
        content_hash=canonical_manifest_hash(manifest),
        manifest_json=manifest_json,
        overall_status=manifest.overall_status,
    )


def test_manifest_read_requires_same_tenant_and_returns_canonical_v1(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(_manifest_row(manifest_id="manifest-1", tenant_id=7))
    db.commit()
    manifest = get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=7)
    assert manifest.schema_version == "ArtifactManifestV1"
    assert manifest.task_id == "task-1"
    db.close()


def test_manifest_read_rejects_embedded_tenant_mismatch(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(
        _manifest_row(
            manifest_id="manifest-embedded-tenant-mismatch",
            tenant_id=7,
            embedded_tenant_id=2,
        )
    )
    db.commit()
    from src.artifacts.service import DeliveryIntegrityError

    with pytest.raises(DeliveryIntegrityError, match="sealed"):
        get_manifest_for_tenant(
            db,
            manifest_id="manifest-embedded-tenant-mismatch",
            tenant_id=7,
        )
    db.close()


def test_manifest_read_rejects_cross_tenant_access(isolated_session_local) -> None:
    from src.artifacts.service import get_manifest_for_tenant
    from src.db.models import ArtifactManifest, Base

    db = isolated_session_local()
    Base.metadata.create_all(db.bind, tables=[ArtifactManifest.__table__])
    db.add(_manifest_row(manifest_id="manifest-1", tenant_id=7))
    db.commit()
    with pytest.raises(PermissionError):
        get_manifest_for_tenant(db, manifest_id="manifest-1", tenant_id=99)
    db.close()


def test_download_membership_failure_audit_survives_session_close(
    isolated_session_local,
    tmp_path,
) -> None:
    from datetime import datetime, timedelta, timezone
    from pathlib import Path

    from src.artifacts.service import (
        DeliveryIntegrityError,
        deliver_artifact_packet,
        read_verified_delivery_artifact,
    )
    from src.db.models import ArtifactDeliveryAuditEvent, ArtifactManifest

    storage_root = Path(tmp_path) / "artifact-storage"
    seed_db = isolated_session_local()
    try:
        packet = deliver_artifact_packet(
            seed_db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-membership-audit",
            final_memorial_id="memorial-membership-audit",
            final_memorial_version=1,
            payload={"title": "membership", "summary": "audit"},
            delivery_formula_version="w06-v1",
            idempotency_key="membership-audit-key",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        artifact_id = packet.manifest.artifact("PDF").artifact_id
        row = seed_db.query(ArtifactManifest).filter_by(
            id=packet.manifest.manifest_id
        ).one()
        sealed = json.loads(row.manifest_json)
        sealed["artifacts"][0]["artifact_id"] = "manifest-member-tampered"
        row.manifest_json = json.dumps(
            sealed,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        seed_db.commit()
    finally:
        seed_db.close()

    download_db = isolated_session_local()
    try:
        with pytest.raises(DeliveryIntegrityError, match="manifest"):
            read_verified_delivery_artifact(
                download_db,
                storage_root=storage_root,
                artifact_id=artifact_id,
                tenant_id=7,
            )
    finally:
        download_db.close()

    audit_db = isolated_session_local()
    try:
        events = (
            audit_db.query(ArtifactDeliveryAuditEvent)
            .filter_by(
                artifact_id=artifact_id,
                event_type="artifact.download",
                outcome="FAILURE",
            )
            .all()
        )
        assert len(events) == 1
    finally:
        audit_db.close()


def test_manifest_read_rejects_canonical_hash_mismatch(
    isolated_session_local,
) -> None:
    from src.artifacts.service import DeliveryIntegrityError, get_manifest_for_tenant
    from src.db.models import ArtifactManifest

    db = isolated_session_local()
    row = _manifest_row(manifest_id="manifest-hash-mismatch", tenant_id=7)
    sealed_hash = row.content_hash
    db.add(row)
    db.commit()

    persisted = db.query(ArtifactManifest).filter_by(id=row.id).one()
    forged = json.loads(persisted.manifest_json)
    forged["artifacts"][0]["mime_type"] = "text/plain"
    persisted.manifest_json = json.dumps(
        forged,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    db.commit()
    assert persisted.content_hash == sealed_hash

    with pytest.raises(DeliveryIntegrityError, match="hash"):
        get_manifest_for_tenant(
            db,
            manifest_id=persisted.id,
            tenant_id=7,
        )
    db.close()


@pytest.mark.parametrize(
    ("field", "forged_value"),
    [
        ("delivery_revision", 2),
        ("idempotency_key_hash", "e" * 64),
        ("payload_hash", "f" * 64),
        ("overall_status", "PARTIAL"),
    ],
)
def test_manifest_read_rejects_sealed_row_field_mismatch(
    isolated_session_local,
    field: str,
    forged_value,
) -> None:
    from src.artifacts.service import DeliveryIntegrityError, get_manifest_for_tenant

    db = isolated_session_local()
    row = _manifest_row(
        manifest_id=f"manifest-row-{field}",
        tenant_id=7,
    )
    setattr(row, field, forged_value)
    db.add(row)
    db.commit()

    with pytest.raises(DeliveryIntegrityError, match="sealed"):
        get_manifest_for_tenant(
            db,
            manifest_id=row.id,
            tenant_id=7,
        )
    db.close()
