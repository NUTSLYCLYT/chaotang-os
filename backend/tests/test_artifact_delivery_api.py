"""HTTP contract tests for tenant-authorized artifact delivery."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.artifact_delivery_support import (
    contract_review_pack,
    seed_delivery_source,
)


def _contract_review_pack(*, task_id: str) -> dict:
    return contract_review_pack(task_id=task_id)


def _create_request(*, task_id: str, idempotency_key: str) -> dict:
    return {
        "task_id": task_id,
        "final_memorial_id": f"memorial-{task_id}",
        "final_memorial_version": 2,
        "contract_review_pack": _contract_review_pack(task_id=task_id),
        "delivery_formula_version": "w06-v1",
        "idempotency_key": idempotency_key,
        "expiry_seconds": 3600,
    }


def _assert_public_json(value: dict) -> None:
    forbidden_keys = {
        "source_payload_json",
        "storage_path",
        "resume_token_hash",
        "idempotency_key_hash",
    }

    def visit(node):
        if isinstance(node, dict):
            assert forbidden_keys.isdisjoint(node)
            for child in node.values():
                visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)

    visit(value)


def _set_api_user(*, tenant_id: int | None, tenant_slug: str = "tenant-7") -> None:
    from web import deps
    from web.main import app
    from web.schemas.auth import CurrentUser

    app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=7,
        username="artifact-owner",
        role="user",
        tenant_slug=tenant_slug,
        tenant_id=tenant_id,
    )


def _seed_delivery_request(session_factory, body: dict, **overrides):
    db = session_factory()
    try:
        result = seed_delivery_source(
            db,
            tenant_id=overrides.pop("tenant_id", 7),
            task_id=body["task_id"],
            final_memorial_id=body["final_memorial_id"],
            final_memorial_version=body["final_memorial_version"],
            payload=body["contract_review_pack"],
            **overrides,
        )
        db.commit()
        return result
    finally:
        db.close()


def _create_ready_delivery(
    client: TestClient,
    session_factory,
    *,
    suffix: str,
) -> dict:
    body = _create_request(
        task_id=f"task-api-{suffix}",
        idempotency_key=f"api-{suffix}-secret",
    )
    _seed_delivery_request(session_factory, body)
    response = client.post(
        "/api/artifacts/deliveries",
        json=body,
    )
    assert response.status_code == 201
    return response.json()["manifest"]


def _download_audit_counts(session_factory, *, artifact_id: str) -> tuple[int, int]:
    from src.db.models import ArtifactDeliveryAuditEvent

    db = session_factory()
    try:
        failure_count = (
            db.query(ArtifactDeliveryAuditEvent)
            .filter_by(
                artifact_id=artifact_id,
                event_type="artifact.download",
                outcome="FAILURE",
            )
            .count()
        )
        success_count = (
            db.query(ArtifactDeliveryAuditEvent)
            .filter_by(
                artifact_id=artifact_id,
                event_type="artifact.download",
                outcome="SUCCESS",
            )
            .count()
        )
        return failure_count, success_count
    finally:
        db.close()


@pytest.fixture()
def artifact_api(isolated_session_local, tmp_path: Path):
    from web import deps
    from web.main import app
    from web.routers import artifacts as artifacts_router
    from web.schemas.auth import CurrentUser

    storage_root = tmp_path / "artifact-storage"
    originals = dict(app.dependency_overrides)
    app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=7,
        username="artifact-owner",
        role="user",
        tenant_slug="tenant-7",
        tenant_id=7,
    )

    session_factory_dependency = getattr(
        artifacts_router,
        "get_artifact_session_factory",
        None,
    )
    if session_factory_dependency is not None:
        app.dependency_overrides[session_factory_dependency] = (
            lambda: isolated_session_local
        )
    else:
        artifacts_router.SessionLocal = isolated_session_local

    storage_root_dependency = getattr(
        artifacts_router,
        "get_artifact_storage_root",
        None,
    )
    if storage_root_dependency is not None:
        app.dependency_overrides[storage_root_dependency] = lambda: storage_root

    try:
        yield (
            TestClient(app, raise_server_exceptions=False),
            isolated_session_local,
            storage_root,
        )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(originals)


def test_delivery_http_contract_create_read_download_and_resume(artifact_api) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import deliver_artifact_packet

    client, session_factory, storage_root = artifact_api
    create_body = _create_request(
        task_id="task-api-ready",
        idempotency_key="api-create-secret",
    )
    _seed_delivery_request(session_factory, create_body)

    created = client.post("/api/artifacts/deliveries", json=create_body)
    assert created.status_code == 201
    created_json = created.json()
    _assert_public_json(created_json)
    assert "api-create-secret" not in json.dumps(created_json, sort_keys=True)

    manifest = created_json["manifest"]
    assert manifest["overall_status"] == "READY"
    assert {item["kind"] for item in manifest["artifacts"]} == {
        "PDF",
        "DOCX",
        "JSON",
    }
    assert all(item["download_url"] for item in manifest["artifacts"])

    manifest_id = manifest["manifest_id"]
    read = client.get(f"/api/artifacts/manifests/{manifest_id}")
    assert read.status_code == 200
    assert read.json() == manifest
    _assert_public_json(read.json())

    json_item = next(item for item in manifest["artifacts"] if item["kind"] == "JSON")
    downloaded = client.get(json_item["download_url"])
    expected = render_one_artifact(
        task_id=create_body["task_id"],
        final_memorial_id=create_body["final_memorial_id"],
        final_memorial_version=create_body["final_memorial_version"],
        payload=create_body["contract_review_pack"],
        kind="JSON",
    )
    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"] == "application/json"
    assert downloaded.content == expected.content

    partial_db = session_factory()

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expected PDF test failure")
        return render_one_artifact(**kwargs)

    try:
        partial_payload = _contract_review_pack(task_id="task-api-partial")
        seed_delivery_source(
            partial_db,
            tenant_id=7,
            task_id="task-api-partial",
            final_memorial_id="memorial-task-api-partial",
            final_memorial_version=2,
            payload=partial_payload,
        )
        partial_packet = deliver_artifact_packet(
            partial_db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-api-partial",
            final_memorial_id="memorial-task-api-partial",
            final_memorial_version=2,
            payload=partial_payload,
            delivery_formula_version="w06-v1",
            idempotency_key="partial-seed-secret",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            renderer=fail_pdf,
        )
    finally:
        partial_db.close()

    partial_read = client.get(
        f"/api/artifacts/manifests/{partial_packet.manifest.manifest_id}"
    )
    assert partial_read.status_code == 200
    partial_items = partial_read.json()["artifacts"]
    partial_by_kind = {item["kind"]: item for item in partial_items}
    assert "download_url" not in next(
        item for item in partial_items if item["kind"] == "PDF"
    )
    assert all(
        item["download_url"]
        for item in partial_items
        if item["kind"] in {"DOCX", "JSON"}
    )

    resumed = client.post(
        f"/api/artifacts/manifests/{partial_packet.manifest.manifest_id}/resume",
        json={
            "resume_token": partial_packet.resume_token,
            "idempotency_key": "api-resume-secret",
        },
    )
    assert resumed.status_code == 200
    resumed_json = resumed.json()
    _assert_public_json(resumed_json)
    assert "api-resume-secret" not in json.dumps(resumed_json, sort_keys=True)
    assert resumed_json["manifest"]["delivery_revision"] == 2
    assert resumed_json["manifest"]["overall_status"] == "READY"
    assert all(
        item["download_url"]
        for item in resumed_json["manifest"]["artifacts"]
    )
    resumed_by_kind = {
        item["kind"]: item
        for item in resumed_json["manifest"]["artifacts"]
    }
    from src.db.models import ArtifactDeliveryItem

    identity_db = session_factory()
    try:
        for kind in ("DOCX", "JSON"):
            assert (
                resumed_by_kind[kind]["artifact_id"]
                == partial_by_kind[kind]["artifact_id"]
            )
            assert (
                resumed_by_kind[kind]["content_hash"]
                == partial_by_kind[kind]["content_hash"]
            )
            assert (
                resumed_by_kind[kind]["download_url"]
                == partial_by_kind[kind]["download_url"]
            )
            assert (
                identity_db.query(ArtifactDeliveryItem)
                .filter_by(id=resumed_by_kind[kind]["artifact_id"])
                .count()
                == 1
            )
            assert client.get(resumed_by_kind[kind]["download_url"]).status_code == 200
    finally:
        identity_db.close()


def test_cross_tenant_and_unknown_delivery_resources_are_404(artifact_api) -> None:
    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(
        client,
        session_factory,
        suffix="tenant-boundary",
    )
    artifact = manifest["artifacts"][0]

    _set_api_user(tenant_id=99, tenant_slug="tenant-99")
    assert (
        client.get(
            f"/api/artifacts/manifests/{manifest['manifest_id']}"
        ).status_code
        == 404
    )
    assert client.get(artifact["download_url"]).status_code == 404
    assert (
        client.post(
            f"/api/artifacts/manifests/{manifest['manifest_id']}/resume",
            json={
                "resume_token": "not-disclosed",
                "idempotency_key": "cross-tenant-resume",
            },
        ).status_code
        == 404
    )

    assert client.get("/api/artifacts/manifests/unknown").status_code == 404
    assert client.get("/api/artifacts/unknown/download").status_code == 404


def test_missing_tenant_is_403(artifact_api) -> None:
    client, _, _ = artifact_api
    _set_api_user(tenant_id=None)

    response = client.post(
        "/api/artifacts/deliveries",
        json=_create_request(
            task_id="task-api-missing-tenant",
            idempotency_key="missing-tenant-secret",
        ),
    )
    assert response.status_code == 403


def test_expired_artifact_has_no_url_and_download_is_410(artifact_api) -> None:
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )
    from src.db.models import ArtifactDeliveryItem, ArtifactManifest

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(client, session_factory, suffix="expired")
    expired_at = datetime.now(timezone.utc) - timedelta(seconds=1)

    db = session_factory()
    try:
        row = db.query(ArtifactManifest).filter_by(
            id=manifest["manifest_id"]
        ).one()
        sealed = json.loads(row.manifest_json)
        for item in sealed["artifacts"]:
            item["expires_at"] = expired_at.isoformat()
        row.manifest_json = json.dumps(
            sealed,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        row.content_hash = canonical_manifest_hash(
            ArtifactManifestV1.model_validate(sealed)
        )
        for item_row in db.query(ArtifactDeliveryItem).filter_by(
            manifest_id=manifest["manifest_id"]
        ):
            item_row.expires_at = expired_at.isoformat()
        db.commit()
    finally:
        db.close()

    read = client.get(f"/api/artifacts/manifests/{manifest['manifest_id']}")
    assert read.status_code == 200
    assert all(
        "download_url" not in item
        for item in read.json()["artifacts"]
    )

    artifact_id = manifest["artifacts"][0]["artifact_id"]
    expired_download = client.get(f"/api/artifacts/{artifact_id}/download")
    assert expired_download.status_code == 410


def test_corrupt_download_is_409_and_failure_audit_is_durable(
    artifact_api,
) -> None:
    from src.db.models import ArtifactDeliveryAuditEvent, ArtifactDeliveryItem

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(client, session_factory, suffix="corrupt")
    artifact_id = next(
        item["artifact_id"]
        for item in manifest["artifacts"]
        if item["kind"] == "JSON"
    )

    db = session_factory()
    try:
        item = db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one()
        Path(item.storage_path).write_bytes(b"corrupted")
    finally:
        db.close()

    response = client.get(f"/api/artifacts/{artifact_id}/download")
    assert response.status_code == 409

    audit_db = session_factory()
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


def test_malformed_expiry_is_409_and_failure_audit_is_durable(
    artifact_api,
) -> None:
    from src.db.models import ArtifactDeliveryAuditEvent, ArtifactDeliveryItem

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(client, session_factory, suffix="bad-expiry")
    artifact_id = manifest["artifacts"][0]["artifact_id"]

    db = session_factory()
    try:
        item = db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one()
        item.expires_at = "not-a-datetime"
        db.commit()
    finally:
        db.close()

    response = client.get(f"/api/artifacts/{artifact_id}/download")
    assert response.status_code == 409

    audit_db = session_factory()
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


def test_successful_download_appends_one_durable_audit(artifact_api) -> None:
    from src.db.models import ArtifactDeliveryAuditEvent

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(
        client,
        session_factory,
        suffix="audit-success",
    )
    artifact = next(
        item for item in manifest["artifacts"] if item["kind"] == "PDF"
    )

    response = client.get(artifact["download_url"])
    assert response.status_code == 200

    audit_db = session_factory()
    try:
        events = (
            audit_db.query(ArtifactDeliveryAuditEvent)
            .filter_by(
                artifact_id=artifact["artifact_id"],
                event_type="artifact.download",
                outcome="SUCCESS",
            )
            .all()
        )
        assert len(events) == 1
    finally:
        audit_db.close()


def test_delivery_request_validation_and_conflict_mapping(artifact_api) -> None:
    client, session_factory, _ = artifact_api
    body = _create_request(
        task_id="task-api-validation",
        idempotency_key="validation-secret",
    )

    mismatched = dict(body)
    mismatched["contract_review_pack"] = _contract_review_pack(
        task_id="different-task"
    )
    assert client.post("/api/artifacts/deliveries", json=mismatched).status_code == 422

    _seed_delivery_request(session_factory, body)
    assert client.post("/api/artifacts/deliveries", json=body).status_code == 201
    conflicting = dict(body)
    conflicting["delivery_formula_version"] = "w06-v2"
    assert client.post("/api/artifacts/deliveries", json=conflicting).status_code == 409


@pytest.mark.parametrize(
    ("source_case", "expected_status"),
    [
        ("missing", 404),
        ("cross_tenant", 404),
        ("non_current", 409),
        ("non_ready", 409),
        ("hash_corrupt", 409),
        ("pack_mismatch", 409),
    ],
)
def test_create_rejects_untrusted_final_memorial_source(
    artifact_api,
    source_case: str,
    expected_status: int,
) -> None:
    from src.db.models import ArtifactManifest

    client, session_factory, _ = artifact_api
    body = _create_request(
        task_id=f"task-api-source-{source_case}",
        idempotency_key=f"api-source-{source_case}-key",
    )
    source_payload = body["contract_review_pack"]
    if source_case == "pack_mismatch":
        body["contract_review_pack"] = {
            **source_payload,
            "decision_summary": "caller pack does not match the final memorial",
        }
    _seed_delivery_request(
        session_factory,
        {**body, "contract_review_pack": source_payload},
        add_memorial=source_case != "missing",
        memorial_tenant_id=99 if source_case == "cross_tenant" else None,
        is_current=source_case != "non_current",
        status="rejected" if source_case == "non_ready" else "ready_for_decision",
        content_hash="0" * 64 if source_case == "hash_corrupt" else None,
    )

    response = client.post("/api/artifacts/deliveries", json=body)

    assert response.status_code == expected_status
    db = session_factory()
    try:
        assert db.query(ArtifactManifest).count() == 0
    finally:
        db.close()


def test_create_and_resume_each_own_and_close_their_session(artifact_api) -> None:
    from sqlalchemy.orm import Session, sessionmaker

    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import deliver_artifact_packet
    from web.main import app
    from web.routers import artifacts as artifacts_router

    client, base_session_factory, storage_root = artifact_api
    lifecycle = {"created": 0, "closed": 0}

    class TrackingSession(Session):
        def __init__(self, *args, **kwargs):
            lifecycle["created"] += 1
            super().__init__(*args, **kwargs)

        def close(self):
            lifecycle["closed"] += 1
            return super().close()

    tracking_factory = sessionmaker(
        bind=base_session_factory.kw["bind"],
        class_=TrackingSession,
        autocommit=False,
        autoflush=False,
    )
    app.dependency_overrides[
        artifacts_router.get_artifact_session_factory
    ] = lambda: tracking_factory

    create_body = _create_request(
        task_id="task-api-session-create",
        idempotency_key="session-create-secret",
    )
    _seed_delivery_request(base_session_factory, create_body)
    created = client.post(
        "/api/artifacts/deliveries",
        json=create_body,
    )
    assert created.status_code == 201
    assert lifecycle == {"created": 1, "closed": 1}

    seed_db = base_session_factory()

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expected PDF test failure")
        return render_one_artifact(**kwargs)

    try:
        partial_payload = _contract_review_pack(task_id="task-api-session-resume")
        seed_delivery_source(
            seed_db,
            tenant_id=7,
            task_id="task-api-session-resume",
            final_memorial_id="memorial-task-api-session-resume",
            final_memorial_version=1,
            payload=partial_payload,
        )
        partial = deliver_artifact_packet(
            seed_db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-api-session-resume",
            final_memorial_id="memorial-task-api-session-resume",
            final_memorial_version=1,
            payload=partial_payload,
            delivery_formula_version="w06-v1",
            idempotency_key="session-resume-seed-secret",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            renderer=fail_pdf,
        )
    finally:
        seed_db.close()

    resumed = client.post(
        f"/api/artifacts/manifests/{partial.manifest.manifest_id}/resume",
        json={
            "resume_token": partial.resume_token,
            "idempotency_key": "session-resume-command-secret",
        },
    )
    assert resumed.status_code == 200
    assert lifecycle == {"created": 2, "closed": 2}


def test_coordinated_manifest_item_and_file_forgery_is_rejected(
    artifact_api,
) -> None:
    from src.db.models import ArtifactDeliveryItem, ArtifactManifest

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(
        client,
        session_factory,
        suffix="sealed-hash-forgery",
    )
    artifact_id = next(
        item["artifact_id"]
        for item in manifest["artifacts"]
        if item["kind"] == "PDF"
    )
    forged_content = b"forged artifact bytes"
    forged_hash = hashlib.sha256(forged_content).hexdigest()

    db = session_factory()
    try:
        manifest_row = db.query(ArtifactManifest).filter_by(
            id=manifest["manifest_id"]
        ).one()
        sealed_hash = manifest_row.content_hash
        sealed = json.loads(manifest_row.manifest_json)
        sealed_item = next(
            item for item in sealed["artifacts"] if item["artifact_id"] == artifact_id
        )
        sealed_item["mime_type"] = "text/plain"
        sealed_item["content_hash"] = forged_hash
        sealed_item["byte_size"] = len(forged_content)
        manifest_row.manifest_json = json.dumps(
            sealed,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )

        item_row = db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one()
        item_row.mime_type = "text/plain"
        item_row.content_hash = forged_hash
        item_row.byte_size = len(forged_content)
        Path(item_row.storage_path).write_bytes(forged_content)
        db.commit()
        assert manifest_row.content_hash == sealed_hash
    finally:
        db.close()

    read = client.get(f"/api/artifacts/manifests/{manifest['manifest_id']}")
    download = client.get(f"/api/artifacts/{artifact_id}/download")
    failure_count, success_count = _download_audit_counts(
        session_factory,
        artifact_id=artifact_id,
    )

    assert (
        read.status_code,
        download.status_code,
        failure_count,
        success_count,
    ) == (409, 409, 1, 0)


def test_manifest_read_rejects_mutable_incomplete_reason_mismatch(
    artifact_api,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import deliver_artifact_packet
    from src.db.models import ArtifactDeliveryItem

    client, session_factory, storage_root = artifact_api
    task_id = "task-api-reason-mismatch"
    memorial_id = "memorial-api-reason-mismatch"
    payload = _contract_review_pack(task_id=task_id)

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expected PDF failure")
        return render_one_artifact(**kwargs)

    db = session_factory()
    try:
        seed_delivery_source(
            db,
            tenant_id=7,
            task_id=task_id,
            final_memorial_id=memorial_id,
            final_memorial_version=1,
            payload=payload,
        )
        packet = deliver_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=7,
            task_id=task_id,
            final_memorial_id=memorial_id,
            final_memorial_version=1,
            payload=payload,
            delivery_formula_version="w06-v1",
            idempotency_key="api-reason-mismatch-key",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            renderer=fail_pdf,
        )
        item = db.query(ArtifactDeliveryItem).filter_by(
            id=packet.manifest.artifact("PDF").artifact_id
        ).one()
        item.incomplete_reason = "forged-row-reason"
        db.commit()
    finally:
        db.close()

    response = client.get(
        f"/api/artifacts/manifests/{packet.manifest.manifest_id}"
    )
    assert response.status_code == 409


@pytest.mark.parametrize("corruption", ["malformed_json", "schema_invalid"])
def test_invalid_persisted_manifest_is_409_and_download_audits_once(
    artifact_api,
    corruption: str,
) -> None:
    from src.db.models import ArtifactManifest

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(
        client,
        session_factory,
        suffix=f"persisted-{corruption}",
    )
    artifact_id = manifest["artifacts"][0]["artifact_id"]

    db = session_factory()
    try:
        row = db.query(ArtifactManifest).filter_by(
            id=manifest["manifest_id"]
        ).one()
        if corruption == "malformed_json":
            row.manifest_json = "{not-json"
        else:
            invalid = json.loads(row.manifest_json)
            invalid["schema_version"] = "ArtifactManifestV0"
            row.manifest_json = json.dumps(
                invalid,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
        db.commit()
    finally:
        db.close()

    read = client.get(f"/api/artifacts/manifests/{manifest['manifest_id']}")
    download = client.get(f"/api/artifacts/{artifact_id}/download")
    failure_count, success_count = _download_audit_counts(
        session_factory,
        artifact_id=artifact_id,
    )

    assert (
        read.status_code,
        download.status_code,
        failure_count,
        success_count,
    ) == (409, 409, 1, 0)


@pytest.mark.parametrize("corruption", ["missing", "corrupt"])
def test_unverified_stored_file_is_not_advertised(
    artifact_api,
    corruption: str,
) -> None:
    from src.db.models import ArtifactDeliveryItem

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(
        client,
        session_factory,
        suffix=f"stored-{corruption}",
    )
    artifact_id = manifest["artifacts"][0]["artifact_id"]

    db = session_factory()
    try:
        row = db.query(ArtifactDeliveryItem).filter_by(id=artifact_id).one()
        path = Path(row.storage_path)
        if corruption == "missing":
            path.unlink()
        else:
            path.write_bytes(b"corrupted")
    finally:
        db.close()

    read = client.get(f"/api/artifacts/manifests/{manifest['manifest_id']}")
    download = client.get(f"/api/artifacts/{artifact_id}/download")
    failure_count, success_count = _download_audit_counts(
        session_factory,
        artifact_id=artifact_id,
    )
    public_item = next(
        item
        for item in read.json()["artifacts"]
        if item["artifact_id"] == artifact_id
    )

    assert read.status_code == 200
    assert "download_url" not in public_item
    assert (download.status_code, failure_count, success_count) == (409, 1, 0)
