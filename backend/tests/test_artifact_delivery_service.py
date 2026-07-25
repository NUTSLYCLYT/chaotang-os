"""Service-level tests for sealed artifact packet delivery."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import Barrier

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


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
    payload = {"title": "测试奏折", "summary": "可复核结论"}
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
    payload = {"title": "部分交付", "summary": "保留成功格式"}
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
) -> None:
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
    partial = deliver_artifact_packet(
        db,
        storage_root=tmp_path / "artifact-storage",
        tenant_id=7,
        task_id="task-expired",
        final_memorial_id="memorial-expired",
        final_memorial_version=1,
        payload={"title": "过期交付"},
        delivery_formula_version="w06-v1",
        idempotency_key="expired-create-key",
        expires_at=datetime(2000, 1, 1, tzinfo=timezone.utc),
        renderer=fail_pdf,
    )

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
    isolated_session_local,
    tmp_path: Path,
) -> None:
    from src.artifacts.service import DeliveryError, deliver_artifact_packet
    from src.db.models import ArtifactDeliveryAuditEvent, ArtifactManifest

    def fail_every_kind(**kwargs):
        raise RuntimeError(f"failure at {tmp_path}/private/{kwargs['kind']}")

    db = isolated_session_local()
    with pytest.raises(DeliveryError):
        deliver_artifact_packet(
            db,
            storage_root=tmp_path / "artifact-storage",
            tenant_id=7,
            task_id="task-failed",
            final_memorial_id="memorial-failed",
            final_memorial_version=1,
            payload={"title": "全部失败"},
            delivery_formula_version="w06-v1",
            idempotency_key="all-failed-key",
            expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
            renderer=fail_every_kind,
        )

    assert db.query(ArtifactManifest).filter_by(overall_status="PARTIAL").count() == 0
    failed = (
        db.query(ArtifactDeliveryAuditEvent)
        .filter_by(event_type="delivery.failed", outcome="FAILURE")
        .one()
    )
    assert str(tmp_path) not in failed.detail_json
    assert len(failed.detail_json) <= 200
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
    arguments = {
        "storage_root": tmp_path / "artifact-storage",
        "tenant_id": 7,
        "task_id": "task-replay",
        "final_memorial_id": "memorial-replay",
        "final_memorial_version": 1,
        "payload": {"title": "幂等交付", "summary": "相同输入"},
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
        deliver_artifact_packet(
            db,
            **{**arguments, "payload": {"title": "changed payload"}},
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
    partial = deliver_artifact_packet(
        db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-resume-replay",
        final_memorial_id="memorial-resume-replay",
        final_memorial_version=1,
        payload={"title": "恢复幂等"},
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
                payload={"title": "并发创建"},
                delivery_formula_version="w06-v1",
                idempotency_key="create-race-key",
                expires_at=datetime(2099, 7, 26, tzinfo=timezone.utc),
            )
            db.commit()
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
    partial = deliver_artifact_packet(
        setup_db,
        storage_root=storage_root,
        tenant_id=7,
        task_id="task-resume-race",
        final_memorial_id="memorial-resume-race",
        final_memorial_version=1,
        payload={"title": "并发恢复"},
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
            db.commit()
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
