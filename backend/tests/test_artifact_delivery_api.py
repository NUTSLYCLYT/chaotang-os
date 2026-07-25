"""HTTP contract tests for tenant-authorized artifact delivery."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _contract_review_pack(*, task_id: str) -> dict:
    return {
        "schema_version": "ContractReviewPackV1",
        "review_pack_id": f"pack-{task_id}",
        "tenant_id": "tenant-7",
        "task_id": task_id,
        "mission_contract_id": f"mission-{task_id}",
        "court_review_id": f"review-{task_id}",
        "evidence_packet_ids": ["evidence-1"],
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "risk_items": [],
        "verdict": "REVISE_BEFORE_PROCEED",
        "decision_summary": "付款和责任条款需修改后再推进。",
        "affected_sections": ["contract_review"],
        "source_labels": ["TASK_EVIDENCE"],
        "engine_tiers": ["validated_model"],
        "quality_gate_status": "PENDING",
        "candidate_status": "CANDIDATE",
    }


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


def _create_ready_delivery(client: TestClient, *, suffix: str) -> dict:
    response = client.post(
        "/api/artifacts/deliveries",
        json=_create_request(
            task_id=f"task-api-{suffix}",
            idempotency_key=f"api-{suffix}-secret",
        ),
    )
    assert response.status_code == 201
    return response.json()["manifest"]


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
        yield TestClient(app), isolated_session_local, storage_root
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
        partial_packet = deliver_artifact_packet(
            partial_db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-api-partial",
            final_memorial_id="memorial-task-api-partial",
            final_memorial_version=2,
            payload=_contract_review_pack(task_id="task-api-partial"),
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


def test_cross_tenant_and_unknown_delivery_resources_are_404(artifact_api) -> None:
    client, _, _ = artifact_api
    manifest = _create_ready_delivery(client, suffix="tenant-boundary")
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
    from src.db.models import ArtifactDeliveryItem, ArtifactManifest

    client, session_factory, _ = artifact_api
    manifest = _create_ready_delivery(client, suffix="expired")
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
    manifest = _create_ready_delivery(client, suffix="corrupt")
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
    manifest = _create_ready_delivery(client, suffix="bad-expiry")
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
    manifest = _create_ready_delivery(client, suffix="audit-success")
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
    client, _, _ = artifact_api
    body = _create_request(
        task_id="task-api-validation",
        idempotency_key="validation-secret",
    )

    mismatched = dict(body)
    mismatched["contract_review_pack"] = _contract_review_pack(
        task_id="different-task"
    )
    assert client.post("/api/artifacts/deliveries", json=mismatched).status_code == 422

    assert client.post("/api/artifacts/deliveries", json=body).status_code == 201
    conflicting = dict(body)
    conflicting["final_memorial_version"] = 3
    assert client.post("/api/artifacts/deliveries", json=conflicting).status_code == 409


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

    created = client.post(
        "/api/artifacts/deliveries",
        json=_create_request(
            task_id="task-api-session-create",
            idempotency_key="session-create-secret",
        ),
    )
    assert created.status_code == 201
    assert lifecycle == {"created": 1, "closed": 1}

    seed_db = base_session_factory()

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expected PDF test failure")
        return render_one_artifact(**kwargs)

    try:
        partial = deliver_artifact_packet(
            seed_db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-api-session-resume",
            final_memorial_id="memorial-task-api-session-resume",
            final_memorial_version=1,
            payload=_contract_review_pack(task_id="task-api-session-resume"),
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
