"""R0-W06-3 RED: canonical manifest persistence and read authorization."""

from __future__ import annotations

import hashlib
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
    delivery_revision: int = 1,
    idempotency_key_hash: str = "c" * 64,
    payload_hash: str = "d" * 64,
    requested_expiry_seconds: int = 3600,
) -> dict:
    return {
        "schema_version": "ArtifactManifestV1",
        "manifest_id": manifest_id,
        "tenant_id": tenant_id,
        "task_id": task_id,
        "final_memorial_id": final_memorial_id,
        "final_memorial_version": final_memorial_version,
        "delivery_formula_version": "w06-v1",
        "delivery_revision": delivery_revision,
        "idempotency_key_hash": idempotency_key_hash,
        "payload_hash": payload_hash,
        "requested_expiry_seconds": requested_expiry_seconds,
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


def test_delivery_manifest_replay_returns_one_canonical_row(
    isolated_session_local,
) -> None:
    from src.artifacts.service import persist_delivery_manifest
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )
    from src.db.models import ArtifactManifest

    db = isolated_session_local()
    manifest = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id="manifest-idempotent",
            task_id="task-idempotent",
            final_memorial_id="memorial-idempotent",
            final_memorial_version=3,
        )
    )

    first = persist_delivery_manifest(db, manifest=manifest)
    second = persist_delivery_manifest(db, manifest=manifest)

    assert first.id == second.id == "manifest-idempotent"
    assert first.content_hash == canonical_manifest_hash(manifest)
    assert first.delivery_revision == 1
    assert first.idempotency_key_hash == "c" * 64
    assert first.payload_hash == "d" * 64
    assert db.query(ArtifactManifest).count() == 1
    db.close()


def test_delivery_manifest_rejects_same_key_with_changed_payload(
    isolated_session_local,
) -> None:
    from src.artifacts.service import DeliveryConflict, persist_delivery_manifest
    from src.contracts.artifact_manifest import ArtifactManifestV1

    db = isolated_session_local()
    first = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id="manifest-conflict",
            task_id="task-conflict",
            final_memorial_id="memorial-conflict",
            final_memorial_version=1,
        )
    )
    changed = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id="manifest-conflict",
            task_id="task-conflict",
            final_memorial_id="memorial-conflict",
            final_memorial_version=1,
            payload_hash="e" * 64,
        )
    )

    persist_delivery_manifest(db, manifest=first)
    with pytest.raises(DeliveryConflict, match="idempotency"):
        persist_delivery_manifest(db, manifest=changed)
    db.close()


@pytest.mark.parametrize("json_target", ["manifest", "source"])
@pytest.mark.parametrize("non_finite", [float("nan"), float("inf")])
def test_delivery_manifest_persistence_rejects_non_finite_canonical_json(
    isolated_session_local,
    json_target: str,
    non_finite: float,
) -> None:
    from src.artifacts.service import (
        DeliveryIntegrityError,
        persist_delivery_manifest,
    )
    from src.contracts.artifact_manifest import ArtifactManifestV1
    from src.db.models import ArtifactManifest

    db = isolated_session_local()
    manifest = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id=f"manifest-non-finite-{json_target}",
            task_id=f"task-non-finite-{json_target}",
            final_memorial_id=f"memorial-non-finite-{json_target}",
            final_memorial_version=1,
        )
    )
    source_payload_json = None
    if json_target == "manifest":
        manifest.artifacts[0].byte_size = non_finite
    else:
        source_payload_json = json.dumps(
            {"non_finite": non_finite},
            allow_nan=True,
            separators=(",", ":"),
            sort_keys=True,
        )
        manifest.payload_hash = hashlib.sha256(
            source_payload_json.encode("utf-8")
        ).hexdigest()

    with pytest.raises(DeliveryIntegrityError):
        persist_delivery_manifest(
            db,
            manifest=manifest,
            source_payload_json=source_payload_json,
        )
    assert db.query(ArtifactManifest).count() == 0
    db.close()


def test_concurrent_delivery_manifest_replay_converges(tmp_path) -> None:
    from src.artifacts.service import persist_delivery_manifest
    from src.contracts.artifact_manifest import ArtifactManifestV1
    from src.db.models import ArtifactManifest, Base

    engine = create_engine(
        f"sqlite:///{tmp_path / 'delivery-manifest-race.db'}",
        connect_args={"timeout": 30},
    )
    Base.metadata.create_all(engine, tables=[ArtifactManifest.__table__])
    factory = sessionmaker(bind=engine)
    manifest = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id="manifest-delivery-race",
            task_id="task-delivery-race",
            final_memorial_id="memorial-delivery-race",
            final_memorial_version=1,
        )
    )

    def write_once() -> str:
        db = factory()
        try:
            row = persist_delivery_manifest(db, manifest=manifest)
            db.commit()
            return row.id
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _n: write_once(), range(2)))

    assert ids == ["manifest-delivery-race", "manifest-delivery-race"]
    db = factory()
    assert db.query(ArtifactManifest).count() == 1
    db.close()
    engine.dispose()


def test_delivery_revisions_are_strictly_monotonic_for_one_lineage(
    isolated_session_local,
) -> None:
    from src.artifacts.service import DeliveryConflict, persist_delivery_manifest
    from src.contracts.artifact_manifest import ArtifactManifestV1

    db = isolated_session_local()

    def manifest(revision: int):
        return ArtifactManifestV1.model_validate(
            _sealed_manifest(
                tenant_id=1,
                manifest_id=f"manifest-revision-{revision}",
                task_id="task-revision",
                final_memorial_id="memorial-revision",
                final_memorial_version=2,
                delivery_revision=revision,
                idempotency_key_hash=str(revision) * 64,
            )
        )

    first = persist_delivery_manifest(db, manifest=manifest(1))
    second = persist_delivery_manifest(db, manifest=manifest(2))

    assert (first.delivery_revision, second.delivery_revision) == (1, 2)
    with pytest.raises(DeliveryConflict, match="revision"):
        persist_delivery_manifest(db, manifest=manifest(4))
    db.close()


def test_delivery_audit_events_are_append_only_and_tenant_scoped(
    isolated_session_local,
) -> None:
    from src.artifacts.service import (
        DeliveryForbidden,
        append_delivery_audit_event,
        persist_delivery_manifest,
    )
    from src.contracts.artifact_manifest import ArtifactManifestV1
    from src.db.models import ArtifactDeliveryAuditEvent

    db = isolated_session_local()
    manifest = ArtifactManifestV1.model_validate(
        _sealed_manifest(
            tenant_id=1,
            manifest_id="manifest-audit",
            task_id="task-audit",
            final_memorial_id="memorial-audit",
            final_memorial_version=1,
        )
    )
    persist_delivery_manifest(db, manifest=manifest)

    first = append_delivery_audit_event(
        db,
        tenant_id=1,
        manifest_id=manifest.manifest_id,
        artifact_id=None,
        event_type="delivery.persisted",
        outcome="SUCCESS",
        detail={"attempt": 1},
    )
    second = append_delivery_audit_event(
        db,
        tenant_id=1,
        manifest_id=manifest.manifest_id,
        artifact_id=None,
        event_type="delivery.replayed",
        outcome="SUCCESS",
        detail={"attempt": 2},
    )

    assert first.id != second.id
    assert json.loads(first.detail_json) == {"attempt": 1}
    assert db.query(ArtifactDeliveryAuditEvent).count() == 2
    with pytest.raises(DeliveryForbidden):
        append_delivery_audit_event(
            db,
            tenant_id=2,
            manifest_id=manifest.manifest_id,
            artifact_id=None,
            event_type="delivery.read",
            outcome="SUCCESS",
            detail={},
        )
    assert db.query(ArtifactDeliveryAuditEvent).count() == 2
    db.close()
