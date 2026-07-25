"""Service-level tests for sealed artifact packet delivery."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from tests.artifact_delivery_support import (
    contract_review_pack,
    seed_delivery_source,
)


def test_deliver_packet_stores_exact_three_formats(
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import deliver_artifact_packet
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    payload = contract_review_pack(task_id="task-ready")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-ready",
        final_memorial_id="memorial-ready",
        final_memorial_version=2,
        payload=payload,
    )
    packet = deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-ready",
        final_memorial_id="memorial-ready",
        final_memorial_version=2,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key="ready-key",
        expires_at=datetime(2026, 7, 26, tzinfo=timezone.utc),
    )

    assert packet.resume_token is None
    assert packet.manifest.overall_status == "READY"
    assert [item.kind for item in packet.manifest.artifacts] == [
        "PDF",
        "DOCX",
        "JSON",
    ]
    assert {item.status for item in packet.manifest.artifacts} == {"STORED"}

    rows = (
        db.query(ArtifactDeliveryItem)
        .filter_by(manifest_id=packet.manifest.manifest_id)
        .order_by(ArtifactDeliveryItem.id)
        .all()
    )
    assert len(rows) == 3
    assert {row.kind for row in rows} == {"PDF", "DOCX", "JSON"}
    assert len([path for path in storage_root.rglob("*") if path.is_file()]) == 3
    for row in rows:
        stored_path = Path(row.storage_path)
        stored_bytes = stored_path.read_bytes()
        expected = render_one_artifact(
            task_id="task-ready",
            final_memorial_id="memorial-ready",
            final_memorial_version=2,
            payload=payload,
            kind=row.kind,
        )
        assert stored_path.is_relative_to(storage_root)
        assert stored_bytes == expected.content
        assert row.content_hash == hashlib.sha256(stored_bytes).hexdigest()
        assert row.byte_size == len(stored_bytes)
        assert packet.manifest.artifact(row.kind).content_hash == row.content_hash

    manifest_row = db.query(ArtifactManifest).one()
    assert manifest_row.id == packet.manifest.manifest_id
    events = (
        db.query(ArtifactDeliveryAuditEvent)
        .filter_by(manifest_id=packet.manifest.manifest_id)
        .all()
    )
    assert Counter((event.event_type, event.outcome) for event in events) == Counter(
        {
            ("artifact.generated", "SUCCESS"): 3,
            ("artifact.stored", "SUCCESS"): 3,
            ("delivery.sealed", "SUCCESS"): 1,
        }
    )
    db.close()


@pytest.mark.parametrize(
    ("source_case", "expected_exception_name"),
    [
        ("missing", "DeliveryNotFound"),
        ("cross_tenant", "DeliveryNotFound"),
        ("non_current", "DeliveryConflict"),
        ("non_ready", "DeliveryConflict"),
        ("hash_corrupt", "DeliveryIntegrityError"),
        ("pack_mismatch", "DeliveryConflict"),
    ],
)
def test_create_rejects_untrusted_final_memorial_before_rendering(
    isolated_session_local,
    tmp_path: Path,
    source_case: str,
    expected_exception_name: str,
) -> None:
    from src.artifacts import service
    from src.artifacts.delivery import render_one_artifact

    db = isolated_session_local()
    task_id = f"task-source-{source_case}"
    memorial_id = f"memorial-source-{source_case}"
    source_payload = contract_review_pack(task_id=task_id)
    supplied_payload = source_payload
    seed_options = {
        "add_memorial": source_case != "missing",
        "memorial_tenant_id": 99 if source_case == "cross_tenant" else None,
        "is_current": source_case != "non_current",
        "status": "rejected" if source_case == "non_ready" else "ready_for_decision",
        "content_hash": "0" * 64 if source_case == "hash_corrupt" else None,
    }
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id=task_id,
        final_memorial_id=memorial_id,
        final_memorial_version=1,
        payload=source_payload,
        **seed_options,
    )
    if source_case == "pack_mismatch":
        supplied_payload = {
            **source_payload,
            "decision_summary": "caller supplied a different review pack",
        }

    attempts: list[str] = []

    def track_renderer(**kwargs):
        attempts.append(kwargs["kind"])
        return render_one_artifact(**kwargs)

    expected_exception = getattr(service, expected_exception_name)
    with pytest.raises(expected_exception):
        service.deliver_artifact_packet(
            db,
            storage_root=tmp_path / "artifact-storage",
            tenant_id=7,
            task_id=task_id,
            final_memorial_id=memorial_id,
            final_memorial_version=1,
            payload=supplied_payload,
            delivery_formula_version="w06-v1",
            idempotency_key=f"source-{source_case}-key",
            expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
            renderer=track_renderer,
        )

    assert attempts == []
    assert not (tmp_path / "artifact-storage").exists()
    db.close()


def test_partial_packet_resumes_only_pdf_without_rewriting_prior_revision(
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        DeliveryForbidden,
        deliver_artifact_packet,
    )
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    payload = contract_review_pack(task_id="task-partial")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-partial",
        final_memorial_id="memorial-partial",
        final_memorial_version=1,
        payload=payload,
    )
    raw_idempotency_key = "partial-key-secret"
    leaked_path = tmp_path / "private" / "renderer-token-secret"

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError(f"renderer failed at {leaked_path}")
        return render_one_artifact(**kwargs)

    partial = deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-partial",
        final_memorial_id="memorial-partial",
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key=raw_idempotency_key,
        expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )

    assert partial.manifest.overall_status == "PARTIAL"
    assert partial.manifest.delivery_revision == 1
    assert partial.manifest.artifact("PDF").status == "UNAVAILABLE"
    assert partial.manifest.artifact("PDF").incomplete_reason == "renderer_failed"
    assert {
        item.kind
        for item in partial.manifest.artifacts
        if item.status == "STORED"
    } == {"DOCX", "JSON"}
    assert partial.resume_token
    resume_token_hash = hashlib.sha256(partial.resume_token.encode()).hexdigest()
    assert partial.manifest.resume_token_hash == resume_token_hash

    revision_one_row = (
        db.query(ArtifactManifest)
        .filter_by(id=partial.manifest.manifest_id)
        .one()
    )
    revision_one_json = revision_one_row.manifest_json
    revision_one_items = {
        row.kind: row
        for row in db.query(ArtifactDeliveryItem)
        .filter_by(manifest_id=partial.manifest.manifest_id)
        .all()
    }
    assert revision_one_items["PDF"].resume_token_hash == resume_token_hash
    assert revision_one_items["DOCX"].resume_token_hash is None
    assert revision_one_items["JSON"].resume_token_hash is None
    stored_snapshots = {
        kind: (
            Path(row.storage_path).read_bytes(),
            Path(row.storage_path).stat().st_mtime_ns,
            row.storage_path,
        )
        for kind, row in revision_one_items.items()
        if kind != "PDF"
    }
    persisted_text = "\n".join(
        [
            revision_one_row.manifest_json,
            *(row.resume_token_hash or "" for row in revision_one_items.values()),
            *(
                event.detail_json
                for event in db.query(ArtifactDeliveryAuditEvent)
                .filter_by(manifest_id=partial.manifest.manifest_id)
                .all()
            ),
        ]
    )
    assert raw_idempotency_key not in persisted_text
    assert partial.resume_token not in persisted_text
    assert str(leaked_path) not in persisted_text
    failure_detail = json.loads(
        db.query(ArtifactDeliveryAuditEvent)
        .filter_by(
            manifest_id=partial.manifest.manifest_id,
            artifact_id=revision_one_items["PDF"].id,
            outcome="FAILURE",
        )
        .one()
        .detail_json
    )
    assert failure_detail == {
        "kind": "PDF",
        "message": "artifact rendering failed",
        "reason": "renderer_failed",
    }

    from src.artifacts.service import resume_artifact_packet

    with pytest.raises(DeliveryForbidden):
        resume_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=7,
            manifest_id=partial.manifest.manifest_id,
            resume_token="wrong-token",
            idempotency_key="resume-key",
        )

    resumed_kinds: list[str] = []

    def track_real_renderer(**kwargs):
        resumed_kinds.append(kwargs["kind"])
        return render_one_artifact(**kwargs)

    resumed = resume_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        manifest_id=partial.manifest.manifest_id,
        resume_token=partial.resume_token,
        idempotency_key="resume-key",
        renderer=track_real_renderer,
    )

    assert resumed.resume_token is None
    assert resumed.manifest.overall_status == "READY"
    assert resumed.manifest.delivery_revision == 2
    assert resumed_kinds == ["PDF"]
    assert revision_one_row.manifest_json == revision_one_json
    revision_two_items = {
        row.kind: row
        for row in db.query(ArtifactDeliveryItem)
        .filter_by(manifest_id=resumed.manifest.manifest_id)
        .all()
    }
    assert revision_two_items["PDF"].retry_count == 1
    assert revision_two_items["DOCX"].retry_count == 0
    assert revision_two_items["JSON"].retry_count == 0
    for kind in ("DOCX", "JSON"):
        old_bytes, old_mtime, old_path = stored_snapshots[kind]
        assert revision_two_items[kind].storage_path == old_path
        assert Path(old_path).read_bytes() == old_bytes
        assert Path(old_path).stat().st_mtime_ns == old_mtime
    db.close()


def test_resume_rejects_expired_token(
    isolated_session_local,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.artifacts import service
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        DeliveryExpired,
        deliver_artifact_packet,
        resume_artifact_packet,
    )

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expired retry")
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    payload = contract_review_pack(task_id="task-expired")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-expired",
        final_memorial_id="memorial-expired",
        final_memorial_version=1,
        payload=payload,
    )
    partial = deliver_artifact_packet(
        db,
        storage_root=tmp_path / "artifact-storage",
        tenant_id=7,
        task_id="task-expired",
        final_memorial_id="memorial-expired",
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key="expired-create-key",
        expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )

    class ExpiredClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2100, 1, 1, tzinfo=timezone.utc)

    monkeypatch.setattr(service, "datetime", ExpiredClock)
    with pytest.raises(DeliveryExpired):
        resume_artifact_packet(
            db,
            storage_root=tmp_path / "artifact-storage",
            tenant_id=7,
            manifest_id=partial.manifest.manifest_id,
            resume_token=partial.resume_token,
            idempotency_key="expired-resume-key",
        )
    db.close()


def test_delivery_with_all_formats_failed_records_audit_and_raises(
    tmp_path: Path,
) -> None:
    from src.artifacts.service import DeliveryError, deliver_artifact_packet
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    def fail_every_kind(**kwargs):
        raise RuntimeError(f"failure at {tmp_path}/private/{kwargs['kind']}")

    factory, engine = _file_session_factory(tmp_path / "all-failed.db")
    db = factory()
    payload = contract_review_pack(task_id="task-failed")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-failed",
        final_memorial_id="memorial-failed",
        final_memorial_version=1,
        payload=payload,
    )
    with pytest.raises(DeliveryError):
        deliver_artifact_packet(
            db,
            storage_root=tmp_path / "artifact-storage",
            tenant_id=7,
            task_id="task-failed",
            final_memorial_id="memorial-failed",
            final_memorial_version=1,
            payload=payload,
            delivery_formula_version="w06-v1",
            idempotency_key="all-failed-key",
            expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
            renderer=fail_every_kind,
        )
    db.close()

    observed = factory()
    try:
        failed_manifest = observed.query(ArtifactManifest).one()
        assert failed_manifest.overall_status == "UNDER_REVIEW"
        assert failed_manifest.source_payload_json == json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        failed_items = observed.query(ArtifactDeliveryItem).all()
        assert len(failed_items) == 3
        assert {item.state for item in failed_items} == {"UNAVAILABLE"}
        assert {item.incomplete_reason for item in failed_items} == {
            "renderer_failed"
        }
        failed = (
            observed.query(ArtifactDeliveryAuditEvent)
            .filter_by(event_type="delivery.failed", outcome="FAILURE")
            .one()
        )
        assert str(tmp_path) not in failed.detail_json
        assert len(failed.detail_json) <= 200
    finally:
        observed.close()
        engine.dispose()


def test_json_unavailable_resumes_from_internal_source_payload_only(
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        deliver_artifact_packet,
        resume_artifact_packet,
    )
    from src.db.models import ArtifactManifest

    payload = contract_review_pack(
        task_id="task-json-partial",
        decision_summary="JSON 输出不可作为恢复输入",
    )

    def fail_json(**kwargs):
        if kwargs["kind"] == "JSON":
            raise RuntimeError("JSON renderer unavailable")
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-json-partial",
        final_memorial_id="memorial-json-partial",
        final_memorial_version=1,
        payload=payload,
    )
    partial = deliver_artifact_packet(
        db,
        storage_root=tmp_path / "artifact-storage",
        tenant_id=7,
        task_id="task-json-partial",
        final_memorial_id="memorial-json-partial",
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key="json-partial-key",
        expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
        renderer=fail_json,
    )

    source_payload_json = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    partial_manifest_id = partial.manifest.manifest_id
    resume_token = partial.resume_token
    db.close()

    db = isolated_session_local()
    row = db.query(ArtifactManifest).filter_by(id=partial_manifest_id).one()
    assert row.source_payload_json == source_payload_json
    assert hashlib.sha256(source_payload_json.encode()).hexdigest() == row.payload_hash
    assert "source_payload_json" not in partial.manifest.model_dump()

    attempted_kinds: list[str] = []

    def track_real_renderer(**kwargs):
        attempted_kinds.append(kwargs["kind"])
        return render_one_artifact(**kwargs)

    resumed = resume_artifact_packet(
        db,
        storage_root=tmp_path / "artifact-storage",
        tenant_id=7,
        manifest_id=partial_manifest_id,
        resume_token=resume_token,
        idempotency_key="json-resume-key",
        renderer=track_real_renderer,
    )

    assert resumed.manifest.overall_status == "READY"
    assert attempted_kinds == ["JSON"]
    db.close()


@pytest.mark.parametrize("operation", ["create_replay", "resume"])
def test_delivery_rejects_tampered_internal_source_payload(
    isolated_session_local,
    tmp_path: Path,
    operation: str,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        DeliveryIntegrityError,
        deliver_artifact_packet,
        resume_artifact_packet,
    )
    from src.db.models import ArtifactManifest

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("PDF unavailable")
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    task_id = f"task-source-tamper-{operation}"
    memorial_id = f"memorial-source-tamper-{operation}"
    payload = contract_review_pack(task_id=task_id)
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id=task_id,
        final_memorial_id=memorial_id,
        final_memorial_version=1,
        payload=payload,
    )
    arguments = {
        "storage_root": storage_root,
        "tenant_id": 7,
        "task_id": task_id,
        "final_memorial_id": memorial_id,
        "final_memorial_version": 1,
        "payload": payload,
        "delivery_formula_version": "w06-v1",
        "idempotency_key": f"source-create-{operation}",
        "expires_at": datetime(2099, 7, 26, tzinfo=timezone.utc),
        "renderer": fail_pdf,
    }
    partial = deliver_artifact_packet(db, **arguments)
    row = db.query(ArtifactManifest).filter_by(id=partial.manifest.manifest_id).one()
    row.source_payload_json = '{"title":"tampered"}'
    db.commit()

    with pytest.raises(DeliveryIntegrityError):
        if operation == "create_replay":
            deliver_artifact_packet(db, **arguments)
        else:
            resume_artifact_packet(
                db,
                storage_root=storage_root,
                tenant_id=7,
                manifest_id=partial.manifest.manifest_id,
                resume_token=partial.resume_token,
                idempotency_key="source-resume-tampered",
            )
    db.close()


@pytest.mark.parametrize("offset", [timedelta(0), timedelta(seconds=-1)])
def test_deliver_rejects_non_future_expiry_before_render_or_storage(
    isolated_session_local,
    tmp_path: Path,
    offset: timedelta,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import DeliveryExpired, deliver_artifact_packet
    from src.db.models import ArtifactManifest

    attempts: list[str] = []

    def track_real_renderer(**kwargs):
        attempts.append(kwargs["kind"])
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    payload = contract_review_pack(task_id="task-expiry-preflight")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-expiry-preflight",
        final_memorial_id="memorial-expiry-preflight",
        final_memorial_version=1,
        payload=payload,
    )
    with pytest.raises(DeliveryExpired):
        deliver_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=7,
            task_id="task-expiry-preflight",
            final_memorial_id="memorial-expiry-preflight",
            final_memorial_version=1,
            payload=payload,
            delivery_formula_version="w06-v1",
            idempotency_key=f"expiry-preflight-{offset.total_seconds()}",
            expires_at=datetime.now(timezone.utc) + offset,
            renderer=track_real_renderer,
        )

    assert attempts == []
    assert not storage_root.exists()
    assert db.query(ArtifactManifest).count() == 0
    db.close()


@pytest.mark.parametrize(
    ("field", "tampered_value"),
    [
        ("id", "tampered-artifact-id"),
        ("kind", "TXT"),
        ("mime_type", "application/json"),
        ("state", "UNAVAILABLE"),
        ("content_hash", "0" * 64),
        ("byte_size", 1),
    ],
)
def test_resume_rejects_tampered_prior_item_projection(
    isolated_session_local,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    tampered_value,
) -> None:
    from src.artifacts import storage
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        DeliveryIntegrityError,
        deliver_artifact_packet,
        resume_artifact_packet,
    )
    from src.db.models import ArtifactDeliveryItem

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("PDF unavailable")
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    task_id = f"task-tamper-{field}"
    memorial_id = f"memorial-tamper-{field}"
    payload = contract_review_pack(task_id=task_id)
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id=task_id,
        final_memorial_id=memorial_id,
        final_memorial_version=1,
        payload=payload,
    )
    partial = deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id=task_id,
        final_memorial_id=memorial_id,
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key=f"tamper-create-{field}",
        expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )
    docx_row = (
        db.query(ArtifactDeliveryItem)
        .filter_by(manifest_id=partial.manifest.manifest_id, kind="DOCX")
        .one()
    )
    target_path = Path(docx_row.storage_path)
    setattr(docx_row, field, tampered_value)
    db.commit()

    if field in {"content_hash", "byte_size"}:
        real_verified_read = storage.read_verified_artifact

        def accept_target_row(path, *, expected_hash, expected_size):
            if Path(path) == target_path:
                return target_path.read_bytes()
            return real_verified_read(
                path,
                expected_hash=expected_hash,
                expected_size=expected_size,
            )

        monkeypatch.setattr(storage, "read_verified_artifact", accept_target_row)

    with pytest.raises(DeliveryIntegrityError):
        resume_artifact_packet(
            db,
            storage_root=storage_root,
            tenant_id=7,
            manifest_id=partial.manifest.manifest_id,
            resume_token=partial.resume_token,
            idempotency_key=f"tamper-resume-{field}",
        )
    db.close()


def test_create_replay_is_idempotent_and_changed_payload_conflicts(
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.service import DeliveryConflict, deliver_artifact_packet
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    db = isolated_session_local()
    payload = contract_review_pack(task_id="task-replay")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-replay",
        final_memorial_id="memorial-replay",
        final_memorial_version=1,
        payload=payload,
    )
    arguments = {
        "storage_root": tmp_path / "artifact-storage",
        "tenant_id": 7,
        "task_id": "task-replay",
        "final_memorial_id": "memorial-replay",
        "final_memorial_version": 1,
        "payload": payload,
        "delivery_formula_version": "w06-v1",
        "idempotency_key": "create-replay-key",
        "expires_at": datetime(2099, 7, 26, tzinfo=timezone.utc),
    }

    first = deliver_artifact_packet(db, **arguments)
    replayed = deliver_artifact_packet(db, **arguments)

    assert replayed.manifest.manifest_id == first.manifest.manifest_id
    assert db.query(ArtifactManifest).count() == 1
    assert db.query(ArtifactDeliveryItem).count() == 3
    assert (
        db.query(ArtifactDeliveryAuditEvent).filter_by(outcome="SUCCESS").count()
        == 7
    )
    with pytest.raises(DeliveryConflict):
        changed_payload = {
            **payload,
            "decision_summary": "changed payload",
        }
        deliver_artifact_packet(
            db,
            **{**arguments, "payload": changed_payload},
        )
    assert db.query(ArtifactManifest).count() == 1
    assert db.query(ArtifactDeliveryItem).count() == 3
    db.close()


def test_resume_replay_is_idempotent(
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        deliver_artifact_packet,
        resume_artifact_packet,
    )
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("retry PDF")
        return render_one_artifact(**kwargs)

    db = isolated_session_local()
    storage_root = tmp_path / "artifact-storage"
    payload = contract_review_pack(task_id="task-resume-replay")
    seed_delivery_source(
        db,
        tenant_id=7,
        task_id="task-resume-replay",
        final_memorial_id="memorial-resume-replay",
        final_memorial_version=1,
        payload=payload,
    )
    partial = deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-resume-replay",
        final_memorial_id="memorial-resume-replay",
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key="partial-replay-key",
        expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )
    arguments = {
        "storage_root": storage_root,
        "tenant_id": 7,
        "manifest_id": partial.manifest.manifest_id,
        "resume_token": partial.resume_token,
        "idempotency_key": "resume-replay-key",
    }

    first = resume_artifact_packet(db, **arguments)
    success_events = (
        db.query(ArtifactDeliveryAuditEvent).filter_by(outcome="SUCCESS").count()
    )
    replayed = resume_artifact_packet(db, **arguments)

    assert replayed.manifest.manifest_id == first.manifest.manifest_id
    assert db.query(ArtifactManifest).count() == 2
    assert db.query(ArtifactDeliveryItem).count() == 6
    assert (
        db.query(ArtifactDeliveryAuditEvent).filter_by(outcome="SUCCESS").count()
        == success_events
    )
    db.close()


def _file_session_factory(path: Path):
    from src.db.models import Base

    engine = create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine


def test_concurrent_create_converges_without_duplicate_items_or_success_audits(
    tmp_path: Path,
) -> None:
    from src.artifacts.service import deliver_artifact_packet
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    factory, engine = _file_session_factory(tmp_path / "create-race.db")
    seed_db = factory()
    payload = contract_review_pack(task_id="task-create-race")
    seed_delivery_source(
        seed_db,
        tenant_id=7,
        task_id="task-create-race",
        final_memorial_id="memorial-create-race",
        final_memorial_version=1,
        payload=payload,
    )
    seed_db.commit()
    seed_db.close()
    start = Barrier(2)

    def create_once() -> str:
        db = factory()
        try:
            start.wait()
            packet = deliver_artifact_packet(
                db,
                storage_root=tmp_path / "create-storage",
                tenant_id=7,
                task_id="task-create-race",
                final_memorial_id="memorial-create-race",
                final_memorial_version=1,
                payload=payload,
                delivery_formula_version="w06-v1",
                idempotency_key="create-race-key",
                expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
            )
            return packet.manifest.manifest_id
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        manifest_ids = list(pool.map(lambda _index: create_once(), range(2)))

    db = factory()
    try:
        assert manifest_ids[0] == manifest_ids[1]
        assert db.query(ArtifactManifest).count() == 1
        assert db.query(ArtifactDeliveryItem).count() == 3
        assert (
            db.query(ArtifactDeliveryAuditEvent)
            .filter_by(outcome="SUCCESS")
            .count()
            == 7
        )
    finally:
        db.close()
        engine.dispose()


def test_concurrent_resume_converges_without_duplicate_revision_or_items(
    tmp_path: Path,
) -> None:
    from src.artifacts.delivery import render_one_artifact
    from src.artifacts.service import (
        deliver_artifact_packet,
        resume_artifact_packet,
    )
    from src.db.models import (
        ArtifactDeliveryAuditEvent,
        ArtifactDeliveryItem,
        ArtifactManifest,
    )

    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("retry PDF concurrently")
        return render_one_artifact(**kwargs)

    factory, engine = _file_session_factory(tmp_path / "resume-race.db")
    storage_root = tmp_path / "resume-storage"
    setup_db = factory()
    payload = contract_review_pack(task_id="task-resume-race")
    seed_delivery_source(
        setup_db,
        tenant_id=7,
        task_id="task-resume-race",
        final_memorial_id="memorial-resume-race",
        final_memorial_version=1,
        payload=payload,
    )
    partial = deliver_artifact_packet(
        setup_db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-resume-race",
        final_memorial_id="memorial-resume-race",
        final_memorial_version=1,
        payload=payload,
        delivery_formula_version="w06-v1",
        idempotency_key="resume-race-create-key",
        expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )
    setup_db.commit()
    setup_db.close()
    start = Barrier(2)

    def resume_once() -> str:
        db = factory()
        try:
            start.wait()
            packet = resume_artifact_packet(
                db,
                storage_root=storage_root,
                tenant_id=7,
                manifest_id=partial.manifest.manifest_id,
                resume_token=partial.resume_token,
                idempotency_key="resume-race-key",
            )
            return packet.manifest.manifest_id
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        manifest_ids = list(pool.map(lambda _index: resume_once(), range(2)))

    db = factory()
    try:
        revision_two = (
            db.query(ArtifactManifest).filter_by(delivery_revision=2).one()
        )
        assert manifest_ids == [revision_two.id, revision_two.id]
        assert db.query(ArtifactManifest).count() == 2
        assert db.query(ArtifactDeliveryItem).count() == 6
        assert (
            db.query(ArtifactDeliveryAuditEvent)
            .filter_by(manifest_id=revision_two.id, outcome="SUCCESS")
            .count()
            == 5
        )
    finally:
        db.close()
        engine.dispose()
