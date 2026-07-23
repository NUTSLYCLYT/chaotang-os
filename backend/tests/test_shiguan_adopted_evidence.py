from __future__ import annotations

import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.api.decrees as decrees_module
from app.jinyiwei import db as jinyiwei_db
from app.jinyiwei import storage as jinyiwei_storage
from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceItem,
    FreshnessRequirement,
    RequiredFact,
    SourceType,
)
from app.shiguan import archive_decree, db, storage
from app.shiguan.errors import (
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanStorageError,
    ShiguanWriteNotCommittedError,
)
from app.shiguan.models import ArchiveEvidenceReferenceCreate

NOW = datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


def _reply_payload(*, conclusion: str = "准奏") -> dict[str, object]:
    return {
        "type": "REPLY",
        "title": "丞相回奏",
        "content": conclusion,
        "matter_type": "综合事项",
        "department": "户部",
        "source_kind": "DECREE",
        "source_text": "请核定预算",
        "participating_departments": ["户部"],
        "reply_process": "户部办理",
        "reply_conclusion": conclusion,
        "reply_time": "2026-07-20T10:00:00+00:00",
        "respondent": "丞相",
    }


def _item(
    evidence_id: str = "evidence-1",
    *,
    retrieved_at: str = "2026-07-20T09:00:00+00:00",
    publisher: str = "财政署",
) -> EvidenceItem:
    return EvidenceItem.model_validate(
        {
            "evidence_id": evidence_id,
            "fact_key": "amount",
            "value": {"total": 42},
            "unit": "CNY",
            "as_of": "2026-07-20T08:00:00+00:00",
            "retrieved_at": retrieved_at,
            "source_url": "https://example.test/budget",
            "publisher": publisher,
            "source_type": "PUBLIC_API",
            "quality": "AUTHORITATIVE",
            "stance": "SUPPORTS",
            "excerpt": "预算总额为四十二。",
            "content_hash": hashlib.sha256(b"source").hexdigest(),
            "confidence": 0.9,
        }
    )


def _fact(
    *,
    key: str = "amount",
    category: str = "PUBLIC_STATISTIC",
    data_scope: str = "EXTERNAL_PUBLIC",
    subject: str = "年度预算",
) -> RequiredFact:
    return RequiredFact(
        key=key,
        description="需要核实的事实",
        category=category,
        data_scope=data_scope,
        subject=subject,
        jurisdiction="CN",
        expected_unit="CNY",
    )


def _request_for(*facts: RequiredFact) -> DataGapRequest:
    return DataGapRequest(
        request_id="request-archive",
        requesting_agent="户部",
        question="请核实事实",
        required_facts=facts,
        decision_context="形成回奏",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=(
            SourceType.SHIGUAN,
            SourceType.MCP,
            SourceType.PUBLIC_API,
        ),
    )


def _snapshot_with(
    *,
    current: tuple[EvidenceItem, ...],
    historical: tuple[EvidenceItem, ...] = (),
) -> SimpleNamespace:
    fact = _fact()
    return SimpleNamespace(
        packs=(
            SimpleNamespace(
                pack_id="pack-1",
                investigation_id="investigation-1",
                request=_request_for(fact),
                evidence_by_fact={"amount": current},
                historical_evidence_by_fact={"amount": historical},
            ),
        )
    )


def _ref(item: EvidenceItem | None = None) -> ArchiveEvidenceReferenceCreate:
    snapshot = (item or _item()).model_dump(mode="json")
    snapshot.update(
        {
            "category": "PUBLIC_STATISTIC",
            "data_scope": "EXTERNAL_PUBLIC",
            "subject": "年度预算",
            "jurisdiction": "CN",
        }
    )
    return ArchiveEvidenceReferenceCreate(
        pack_id="pack-1",
        investigation_id="investigation-1",
        snapshot=snapshot,
    )


def _response() -> SimpleNamespace:
    return SimpleNamespace(
        departments=["户部"],
        processing_path=["丞相", "户部"],
        rationale="交户部办理",
        council_verdict=None,
        final_verdict="准奏",
    )


def test_fresh_database_is_v3_and_initialization_is_idempotent(tmp_path) -> None:
    path = tmp_path / "fresh.sqlite3"
    for _ in range(2):
        connection = db.get_connection(path)
        connection.close()

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 3
        columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(archive_evidence_references)"
            ).fetchall()
        }
        assert columns == {
            "archive_id",
            "ordinal",
            "evidence_id",
            "pack_id",
            "investigation_id",
            "snapshot_json",
            "snapshot_hash",
        }
    finally:
        connection.close()


def test_explicit_v2_to_v3_migration_and_runtime_rejects_v2(tmp_path) -> None:
    path = tmp_path / "v2.sqlite3"
    connection = sqlite3.connect(path)
    connection.executescript(db._V2_SCHEMA_STATEMENTS)
    connection.close()

    with pytest.raises(ShiguanStorageError, match="显式迁移"):
        db.get_connection(path)

    db.migrate_v2_to_v3(path)
    db.get_connection(path).close()
    with pytest.raises(ShiguanStorageError, match="无法迁移"):
        db.migrate_v2_to_v3(path)


def test_failed_v2_migration_rolls_back_table_and_version(tmp_path, monkeypatch) -> None:
    path = tmp_path / "v2.sqlite3"
    connection = sqlite3.connect(path)
    connection.executescript(db._V2_SCHEMA_STATEMENTS)
    connection.close()
    monkeypatch.setattr(
        db,
        "_validate_v3_table",
        lambda _connection: (_ for _ in ()).throw(ValueError()),
    )

    with pytest.raises(ShiguanStorageError, match="无法迁移"):
        db.migrate_v2_to_v3(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert (
            connection.execute(
                "SELECT 1 FROM sqlite_master WHERE name='archive_evidence_references'"
            ).fetchone()
            is None
        )
    finally:
        connection.close()


def test_legacy_archives_load_with_empty_evidence_references(tmp_path) -> None:
    archive = storage.create_archive(_reply_payload(), db_path=tmp_path / "db.sqlite3")
    assert archive.evidence_references == []


def test_reply_and_complete_snapshot_are_atomic_ordered_and_hash_checked(tmp_path) -> None:
    path = tmp_path / "db.sqlite3"
    refs = [_ref(_item("evidence-2")), _ref(_item("evidence-1"))]

    reply = storage.create_reply_with_evidence(
        _reply_payload(), refs, reply_id="reply-1", db_path=path
    )

    assert [ref.evidence_id for ref in reply.evidence_references] == [
        "evidence-2",
        "evidence-1",
    ]
    assert reply.evidence_references[0].snapshot.model_dump(
        mode="json",
        exclude={"category", "data_scope", "subject", "jurisdiction"},
    ) == _item("evidence-2").model_dump(mode="json")
    connection = sqlite3.connect(path)
    try:
        raw = connection.execute(
            "SELECT snapshot_json, snapshot_hash FROM archive_evidence_references "
            "WHERE archive_id='reply-1' AND ordinal=0"
        ).fetchone()
        assert hashlib.sha256(raw[0].encode()).hexdigest() == raw[1]
        connection.execute(
            "UPDATE archive_evidence_references SET snapshot_json='{}' "
            "WHERE archive_id='reply-1' AND ordinal=0"
        )
        connection.commit()
    finally:
        connection.close()
    with pytest.raises(ShiguanStorageError, match="证据快照"):
        storage.get_archive("reply-1", db_path=path)


def test_archive_snapshot_preserves_public_source_metadata_and_accepts_legacy_rows(
    tmp_path,
) -> None:
    path = tmp_path / "db.sqlite3"
    item = _item().model_copy(
        update={
            "published_at": "2026-07-20T08:00:00+00:00",
            "coverage": ("CN",),
            "license_note": "CC BY 4.0 attribution required.",
        }
    )
    reply = storage.create_reply_with_evidence(
        _reply_payload(),
        [_ref(item)],
        reply_id="reply-with-source-metadata",
        db_path=path,
    )
    snapshot = reply.evidence_references[0].snapshot
    assert snapshot.published_at == item.published_at
    assert snapshot.coverage == item.coverage
    assert snapshot.license_note == item.license_note

    legacy = _item().model_dump(mode="json")
    legacy.pop("published_at", None)
    legacy.pop("coverage", None)
    legacy.pop("license_note", None)
    legacy.update(
        {
            "category": "PUBLIC_STATISTIC",
            "data_scope": "EXTERNAL_PUBLIC",
            "subject": "年度预算",
            "jurisdiction": "CN",
        }
    )
    assert (
        ArchiveEvidenceReferenceCreate(
            pack_id="pack-legacy",
            investigation_id="investigation-legacy",
            snapshot=legacy,
        ).snapshot.published_at
        is None
    )


def test_resolver_archives_only_selected_current_evidence_with_complete_mcp_metadata() -> None:
    adopted = _item("evidence-adopted").model_copy(
        update={
            "source_type": SourceType.MCP,
            "published_at": "2026-07-20T08:00:00+00:00",
            "coverage": ("CN", "SZ"),
            "license_note": "Public read-only quote.",
            "access_url": "https://stock.example.test/quote/002594",
            "access_metadata": {
                "mcp_server_id": "market-data",
                "mcp_tool_name": "data_quote",
                "approval_version": "2026-07-22",
                "mapping_version": "quote-v1",
                "response_hash": "a" * 64,
                "mapping": {"price_path": "data.price"},
            },
        }
    )
    unadopted = _item("evidence-unused")
    historical = _item("evidence-historical")

    refs = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(
            current=(adopted, unadopted),
            historical=(historical,),
        ),
        ("evidence-adopted",),
    )

    assert len(refs) == 1
    archived = refs[0].snapshot
    assert archived.evidence_id == "evidence-adopted"
    assert archived.category == "PUBLIC_STATISTIC"
    assert archived.data_scope == "EXTERNAL_PUBLIC"
    assert archived.subject == "年度预算"
    assert archived.jurisdiction == "CN"
    assert archived.source_type == "MCP"
    assert archived.source_url == adopted.source_url
    assert archived.publisher == adopted.publisher
    assert archived.published_at == adopted.published_at
    assert archived.coverage == adopted.coverage
    assert archived.license_note == adopted.license_note
    assert archived.access_url == adopted.access_url
    assert archived.access_metadata == adopted.access_metadata

    with pytest.raises(ValueError, match="missing"):
        archive_decree.resolve_adopted_evidence_references(
            _snapshot_with(current=(adopted,), historical=(historical,)),
            ("evidence-historical",),
        )


def test_archive_snapshot_deep_freezes_value_and_access_metadata() -> None:
    item = _item().model_copy(
        update={
            "value": {"nested": [{"amount": 42}]},
            "access_metadata": {
                "mapping": {"path": ["data", "price"]},
                "response_hash": "b" * 64,
            },
        }
    )
    snapshot = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(current=(item,)),
        ("evidence-1",),
    )[0].snapshot

    with pytest.raises(TypeError):
        snapshot.value["nested"][0]["amount"] = 43
    with pytest.raises(TypeError):
        snapshot.access_metadata["mapping"]["path"][0] = "forged"


@pytest.mark.parametrize(
    "unsafe_key",
    [
        "header",
        "HEADERS",
        "request_headers",
        "request-headers",
        "requestHeaders",
        "ｒｅｑｕｅｓｔ＿ｈｅａｄｅｒｓ",
        "Authorization",
        "client_secret",
        "clientSecret",
        "session_token",
        "refresh-token",
        "credential_value",
        "dbPassword",
        "cookie_jar",
        "request_body",
        "rawBody",
        "raw_response_body",
        "request_payload",
        "raw-payload",
    ],
)
def test_resolver_rejects_sensitive_mcp_access_metadata_key_variants(
    unsafe_key: str,
) -> None:
    item = _item().model_copy(
        update={
            "source_type": SourceType.MCP,
            "access_metadata": {"audit": {"nested": {unsafe_key: "not archived"}}},
        }
    )

    with pytest.raises(ValueError, match="sensitive"):
        archive_decree.resolve_adopted_evidence_references(
            _snapshot_with(current=(item,)),
            ("evidence-1",),
        )


@pytest.mark.parametrize(
    "safe_metadata",
    [
        {
            "response_hash": "a" * 64,
            "content_hash": "b" * 64,
            "approval_fingerprint": "c" * 64,
        },
        {
            "mcp_server_id": "market-data",
            "mcp_tool_name": "data_quote",
            "approval_version": "2026-07-22",
            "mapping_version": "quote-v1",
            "request_id": "safe-audit-id",
            "provenance_note": "the value may mention token but values are not scanned",
        },
    ],
)
def test_resolver_allows_explicit_non_sensitive_provenance_keys(
    safe_metadata: dict[str, object],
) -> None:
    item = _item().model_copy(
        update={
            "source_type": SourceType.MCP,
            "access_metadata": safe_metadata,
        }
    )

    reference = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(current=(item,)),
        ("evidence-1",),
    )[0]

    assert reference.snapshot.access_metadata == safe_metadata


def test_new_reply_version_does_not_overwrite_old_reply_snapshot(tmp_path) -> None:
    path = tmp_path / "shiguan.sqlite3"
    old = _item("evidence-old")
    new = _item("evidence-new").model_copy(update={"value": {"total": 84}})
    old_ref = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(current=(old,)),
        ("evidence-old",),
    )
    new_ref = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(current=(new,)),
        ("evidence-new",),
    )

    storage.create_reply_with_evidence(
        _reply_payload(conclusion="旧结论"),
        old_ref,
        reply_id="reply-old",
        db_path=path,
    )
    storage.create_reply_with_evidence(
        _reply_payload(conclusion="新结论"),
        new_ref,
        reply_id="reply-new",
        db_path=path,
    )

    assert storage.get_archive("reply-old", db_path=path).evidence_references[
        0
    ].evidence_id == "evidence-old"
    assert storage.get_archive("reply-new", db_path=path).evidence_references[
        0
    ].evidence_id == "evidence-new"


def test_same_evidence_id_cannot_be_reused_with_different_snapshot(tmp_path) -> None:
    path = tmp_path / "shiguan.sqlite3"
    first = _ref(_item("stable-id"))
    changed = _ref(
        _item("stable-id").model_copy(
            update={
                "value": {"total": 99},
                "content_hash": hashlib.sha256(b"changed").hexdigest(),
            }
        )
    )
    storage.create_reply_with_evidence(
        _reply_payload(conclusion="旧结论"),
        [first],
        reply_id="reply-old",
        db_path=path,
    )

    with pytest.raises(ShiguanStorageError, match="证据 ID"):
        storage.create_reply_with_evidence(
            _reply_payload(conclusion="新结论"),
            [changed],
            reply_id="reply-new",
            db_path=path,
        )

    assert [archive.id for archive in storage.list_archives(db_path=path)] == [
        "reply-old"
    ]


def test_internal_reply_creation_is_idempotent_and_immutable(tmp_path) -> None:
    path = tmp_path / "db.sqlite3"
    first = storage.create_reply_with_evidence(
        _reply_payload(), [_ref()], reply_id="reply-1", db_path=path
    )
    second = storage.create_reply_with_evidence(
        _reply_payload(), [_ref()], reply_id="reply-1", db_path=path
    )
    assert second == first
    with pytest.raises(ShiguanStorageError, match="不可变冲突"):
        storage.create_reply_with_evidence(
            _reply_payload(conclusion="驳回"), [_ref()], reply_id="reply-1", db_path=path
        )


def test_public_create_rejects_forged_references(tmp_path) -> None:
    payload = _reply_payload()
    payload["evidence_references"] = [_ref().model_dump(mode="json")]
    with pytest.raises(ArchiveValidationError):
        storage.create_archive(payload, db_path=tmp_path / "db.sqlite3")


def test_resolver_uses_selected_order_first_appearance_and_rejects_conflicts() -> None:
    first = _item(retrieved_at="2026-07-20T09:00:00+00:00")
    later = _item(retrieved_at="2026-07-20T09:30:00+00:00")
    unselected = _item("evidence-2")
    snapshot = SimpleNamespace(
        packs=(
                SimpleNamespace(
                    pack_id="pack-1",
                    investigation_id="investigation-1",
                    request=_request_for(_fact()),
                    evidence_by_fact={"amount": (first, unselected)},
                ),
                SimpleNamespace(
                    pack_id="pack-2",
                    investigation_id="investigation-2",
                    request=_request_for(_fact()),
                    evidence_by_fact={"amount": (later,)},
                ),
        )
    )
    refs = archive_decree.resolve_adopted_evidence_references(snapshot, ("evidence-1",))
    assert len(refs) == 1
    assert refs[0].pack_id == "pack-1"
    assert refs[0].snapshot.retrieved_at == first.retrieved_at

    conflicting = _item(publisher="伪造来源")
    snapshot.packs[1].evidence_by_fact = {"amount": (conflicting,)}
    with pytest.raises(ValueError, match="immutable"):
        archive_decree.resolve_adopted_evidence_references(snapshot, ("evidence-1",))
    with pytest.raises(ValueError, match="missing"):
        archive_decree.resolve_adopted_evidence_references(snapshot, ("unknown",))


def test_resolver_returns_the_graph_ordered_union_not_pack_order() -> None:
    item_a = _item("evidence-a")
    item_b = _item("evidence-b")
    snapshot = SimpleNamespace(
        packs=(
                SimpleNamespace(
                    pack_id="pack-1",
                    investigation_id="investigation-1",
                    request=_request_for(_fact()),
                    evidence_by_fact={"amount": (item_a, item_b)},
                ),
        )
    )

    refs = archive_decree.resolve_adopted_evidence_references(
        snapshot, ("evidence-b", "evidence-a")
    )

    assert [reference.snapshot.evidence_id for reference in refs] == [
        "evidence-b",
        "evidence-a",
    ]


def test_archive_retry_with_same_reply_id_reuses_stored_reply_time(tmp_path) -> None:
    path = tmp_path / "shiguan.sqlite3"

    first = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        reply_id="reply-1",
        shiguan_db_path=path,
    )
    second = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        reply_id="reply-1",
        shiguan_db_path=path,
    )

    assert first.archived is True
    assert second.archived is True
    assert second.reply_id == first.reply_id == "reply-1"
    assert len(storage.list_archives(db_path=path)) == 1


def test_archive_retry_still_rejects_changed_business_content(tmp_path) -> None:
    path = tmp_path / "shiguan.sqlite3"
    first = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        reply_id="reply-1",
        shiguan_db_path=path,
    )
    changed = _response()
    changed.final_verdict = "驳回"

    second = archive_decree.archive_chancellor_decree(
        "请核定预算",
        changed,
        reply_id="reply-1",
        shiguan_db_path=path,
    )

    assert first.archived is True
    assert second.archived is False
    assert storage.get_archive("reply-1", db_path=path).reply_conclusion == "准奏"


def _seed_jinyiwei_evidence(path, *items: EvidenceItem) -> None:
    from app.jinyiwei import db as jinyiwei_db

    connection = jinyiwei_db.get_connection(path)
    try:
        for item in items:
            dumped = item.model_dump(mode="json")
            connection.execute(
                "INSERT INTO evidence_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item.evidence_id,
                    item.fact_key,
                    json.dumps(dumped["value"]),
                    item.unit,
                    item.as_of,
                    item.retrieved_at,
                    item.source_url,
                    item.publisher,
                    item.source_type.value,
                    item.quality.value,
                    item.stance.value,
                    item.excerpt,
                    item.content_hash,
                    item.confidence,
                    json.dumps(dumped),
                ),
            )
        connection.commit()
    finally:
        connection.close()


def test_batch_pending_is_atomic_and_confirmation_never_downgrades(tmp_path) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    _seed_jinyiwei_evidence(path, _item("evidence-1"))
    with pytest.raises(jinyiwei_storage.JinyiweiStorageError):
        jinyiwei_storage.write_pending_adoptions(
            ("evidence-1", "missing"), "reply-1", at=NOW, db_path=path
        )
    assert jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=path) == []

    with pytest.raises(jinyiwei_storage.JinyiweiStorageError):
        jinyiwei_storage.confirm_adoptions(("evidence-1",), "reply-1", at=NOW, db_path=path)
    assert jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=path) == []

    jinyiwei_storage.write_pending_adoptions(("evidence-1",), "reply-1", at=NOW, db_path=path)
    confirmed = jinyiwei_storage.confirm_adoptions(
        ("evidence-1",), "reply-1", at=NOW, db_path=path
    )[0]
    jinyiwei_storage.write_pending_adoptions(
        ("evidence-1",), "reply-1", at=datetime(2026, 7, 21, tzinfo=UTC), db_path=path
    )
    after = jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=path)[0]
    assert after.status == "CONFIRMED"
    assert after.created_at == confirmed.created_at
    assert after.confirmed_at == confirmed.confirmed_at


def test_confirm_requires_the_complete_reply_adoption_set_atomically(tmp_path) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    _seed_jinyiwei_evidence(path, _item("evidence-a"), _item("evidence-b"))
    jinyiwei_storage.write_pending_adoptions(
        ("evidence-a", "evidence-b"), "reply-1", at=NOW, db_path=path
    )

    with pytest.raises(jinyiwei_storage.JinyiweiStorageError):
        jinyiwei_storage.confirm_adoptions(("evidence-a",), "reply-1", at=NOW, db_path=path)

    adoptions = jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=path)
    assert [(item.evidence_id, item.status) for item in adoptions] == [
        ("evidence-a", "PENDING"),
        ("evidence-b", "PENDING"),
    ]


def test_pending_stage_requires_one_exact_ordered_immutable_batch_per_reply(
    tmp_path,
) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    item_a = _item("evidence-a")
    item_b = _item("evidence-b")
    _seed_jinyiwei_evidence(path, item_a, item_b)
    fingerprint = jinyiwei_storage.adoption_batch_fingerprint((item_a, item_b))
    jinyiwei_storage.write_pending_adoptions(
        ("evidence-a", "evidence-b"),
        "reply-exact",
        at=NOW,
        db_path=path,
        batch_fingerprint=fingerprint,
    )
    jinyiwei_storage.write_pending_adoptions(
        ("evidence-a", "evidence-b"),
        "reply-exact",
        at=NOW,
        db_path=path,
        batch_fingerprint=fingerprint,
    )

    for disguised in (
        ("evidence-a",),
        ("evidence-b",),
        ("evidence-b", "evidence-a"),
    ):
        with pytest.raises(jinyiwei_storage.JinyiweiStorageError, match="batch"):
            jinyiwei_storage.write_pending_adoptions(
                disguised,
                "reply-exact",
                at=NOW,
                db_path=path,
            )

    assert [
        item.evidence_id
        for item in jinyiwei_storage.list_adoptions_by_reply(
            "reply-exact", db_path=path
        )
    ] == ["evidence-a", "evidence-b"]


def test_pending_stage_rejects_same_id_with_different_snapshot_identity(
    tmp_path,
) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    original = _item("same-id")
    changed = original.model_copy(
        update={
            "value": {"total": 999},
            "content_hash": hashlib.sha256(b"different").hexdigest(),
        }
    )
    _seed_jinyiwei_evidence(path, original)

    with pytest.raises(jinyiwei_storage.JinyiweiStorageError, match="identity"):
        jinyiwei_storage.write_pending_adoptions(
            ("same-id",),
            "reply-snapshot-conflict",
            at=NOW,
            db_path=path,
            batch_fingerprint=jinyiwei_storage.adoption_batch_fingerprint(
                (changed,)
            ),
        )
    assert jinyiwei_storage.list_adoptions_by_reply(
        "reply-snapshot-conflict", db_path=path
    ) == []


def test_concurrent_different_pending_batches_never_merge(tmp_path) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    _seed_jinyiwei_evidence(path, _item("evidence-a"), _item("evidence-b"))

    def stage(evidence_id: str) -> str:
        try:
            jinyiwei_storage.write_pending_adoptions(
                (evidence_id,), "reply-race", at=NOW, db_path=path
            )
        except jinyiwei_storage.JinyiweiStorageError:
            return "rejected"
        return "accepted"

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(stage, ("evidence-a", "evidence-b")))

    assert sorted(outcomes) == ["accepted", "rejected"]
    stored = jinyiwei_storage.list_adoptions_by_reply(
        "reply-race", db_path=path
    )
    assert len(stored) == 1
    assert stored[0].evidence_id in {"evidence-a", "evidence-b"}


def test_link_failure_keeps_reply_and_reconciliation_uses_only_reply_id(
    tmp_path, monkeypatch
) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    internal = SimpleNamespace(
        adopted_evidence_ids=("evidence-1",),
        evidence_snapshot=SimpleNamespace(
            packs=(
                    SimpleNamespace(
                        pack_id="pack-1",
                        investigation_id="investigation-1",
                        request=_request_for(_fact()),
                        evidence_by_fact={"amount": (item,)},
                    ),
            )
        ),
    )
    original_confirm = jinyiwei_storage.confirm_adoptions
    monkeypatch.setattr(
        jinyiwei_storage,
        "confirm_adoptions",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError()),
    )

    outcome = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
        reply_id="reply-1",
    )

    assert outcome.archived is True
    assert outcome.reply_id == "reply-1"
    assert storage.get_archive("reply-1", db_path=shiguan_path).evidence_references
    assert (
        jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=jinyiwei_path)[0].status
        == "PENDING"
    )
    monkeypatch.setattr(jinyiwei_storage, "confirm_adoptions", original_confirm)
    archive_decree.reconcile_reply_evidence(
        "reply-1", shiguan_db_path=shiguan_path, jinyiwei_db_path=jinyiwei_path
    )
    assert (
        jinyiwei_storage.list_adoptions_by_reply("reply-1", db_path=jinyiwei_path)[0].status
        == "CONFIRMED"
    )


def test_adoption_protocol_is_pending_then_archive_write_then_confirmed(
    tmp_path, monkeypatch
) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    internal = SimpleNamespace(
        adopted_evidence_ids=("evidence-1",),
        evidence_snapshot=_snapshot_with(current=(item,)),
    )
    events: list[str] = []
    original_pending = jinyiwei_storage.write_pending_adoptions
    original_create = storage.create_reply_with_evidence
    original_confirm = jinyiwei_storage.confirm_adoptions

    def pending(*args, **kwargs):
        events.append("pending")
        return original_pending(*args, **kwargs)

    def create(*args, **kwargs):
        events.append("archive")
        return original_create(*args, **kwargs)

    def confirm(*args, **kwargs):
        events.append("confirmed")
        return original_confirm(*args, **kwargs)

    monkeypatch.setattr(jinyiwei_storage, "write_pending_adoptions", pending)
    monkeypatch.setattr(storage, "create_reply_with_evidence", create)
    monkeypatch.setattr(jinyiwei_storage, "confirm_adoptions", confirm)

    outcome = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
        reply_id="reply-protocol",
    )

    assert outcome.archived is True
    assert events == ["pending", "archive", "confirmed"]
    assert (
        jinyiwei_storage.list_adoptions_by_reply(
            "reply-protocol", db_path=jinyiwei_path
        )[0].status
        == "CONFIRMED"
    )


def test_pending_creation_failure_prevents_archive_write(
    tmp_path, monkeypatch
) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    item = _item()
    internal = SimpleNamespace(
        adopted_evidence_ids=("evidence-1",),
        evidence_snapshot=_snapshot_with(current=(item,)),
    )
    writes: list[str] = []
    monkeypatch.setattr(
        jinyiwei_storage,
        "write_pending_adoptions",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("pending failed")),
    )
    monkeypatch.setattr(
        storage,
        "create_reply_with_evidence",
        lambda *_args, **_kwargs: writes.append("archive"),
    )

    outcome = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=tmp_path / "jinyiwei.sqlite3",
        reply_id="reply-pending-failed",
    )

    assert outcome.archived is False
    assert writes == []


def test_shiguan_write_failure_atomically_removes_orphan_pending(
    tmp_path, monkeypatch
) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    internal = SimpleNamespace(
        adopted_evidence_ids=("evidence-1",),
        evidence_snapshot=_snapshot_with(current=(item,)),
    )
    monkeypatch.setattr(
        storage,
        "create_reply_with_evidence",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ShiguanWriteNotCommittedError("write failed")
        ),
    )

    outcome = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
        reply_id="reply-write-failed",
    )

    assert outcome.archived is False
    assert outcome.reply_id == "reply-write-failed"
    assert jinyiwei_storage.list_adoptions_by_reply(
        "reply-write-failed", db_path=jinyiwei_path
    ) == []
    with pytest.raises(ArchiveNotFoundError):
        archive_decree.reconcile_reply_evidence(
            "reply-write-failed",
            shiguan_db_path=shiguan_path,
            jinyiwei_db_path=jinyiwei_path,
        )
    assert jinyiwei_storage.list_adoptions_by_reply(
        "reply-write-failed", db_path=jinyiwei_path
    ) == []


def test_ambiguous_commit_then_raise_preserves_reply_id_and_recoverable_pending(
    tmp_path, monkeypatch
) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    internal = SimpleNamespace(
        adopted_evidence_ids=("evidence-1",),
        evidence_snapshot=_snapshot_with(current=(item,)),
    )
    original_create = storage.create_reply_with_evidence

    def commit_then_raise(*args, **kwargs):
        original_create(*args, **kwargs)
        raise ShiguanStorageError("connection lost after commit")

    monkeypatch.setattr(storage, "create_reply_with_evidence", commit_then_raise)
    outcome = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
    )

    assert outcome.archived is False
    assert outcome.reply_id is not None
    assert storage.get_archive(
        outcome.reply_id, db_path=shiguan_path
    ).evidence_references[0].evidence_id == "evidence-1"
    assert jinyiwei_storage.list_adoptions_by_reply(
        outcome.reply_id, db_path=jinyiwei_path
    )[0].status == "PENDING"

    monkeypatch.setattr(storage, "create_reply_with_evidence", original_create)
    archive_decree.reconcile_reply_evidence(
        outcome.reply_id,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
    )
    assert jinyiwei_storage.list_adoptions_by_reply(
        outcome.reply_id, db_path=jinyiwei_path
    )[0].status == "CONFIRMED"

    retry = archive_decree.archive_chancellor_decree(
        "请核定预算",
        _response(),
        internal,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
        reply_id=outcome.reply_id,
    )
    assert retry.archived is True
    assert retry.reply_id == outcome.reply_id


def test_cancel_pending_batch_is_atomic_idempotent_and_never_deletes_confirmed(
    tmp_path,
) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    _seed_jinyiwei_evidence(path, _item("evidence-a"), _item("evidence-b"))
    jinyiwei_storage.write_pending_adoptions(
        ("evidence-a", "evidence-b"), "reply-cancel", at=NOW, db_path=path
    )

    with pytest.raises(jinyiwei_storage.JinyiweiStorageError):
        jinyiwei_storage.cancel_pending_adoptions(
            ("evidence-a",), "reply-cancel", db_path=path
        )
    assert len(
        jinyiwei_storage.list_adoptions_by_reply("reply-cancel", db_path=path)
    ) == 2

    jinyiwei_storage.cancel_pending_adoptions(
        ("evidence-a", "evidence-b"), "reply-cancel", db_path=path
    )
    jinyiwei_storage.cancel_pending_adoptions(
        ("evidence-a", "evidence-b"), "reply-cancel", db_path=path
    )
    assert jinyiwei_storage.list_adoptions_by_reply(
        "reply-cancel", db_path=path
    ) == []

    jinyiwei_storage.write_pending_adoptions(
        ("evidence-a", "evidence-b"), "reply-confirmed", at=NOW, db_path=path
    )
    jinyiwei_storage.confirm_adoptions(
        ("evidence-a", "evidence-b"), "reply-confirmed", at=NOW, db_path=path
    )
    with pytest.raises(jinyiwei_storage.JinyiweiStorageError):
        jinyiwei_storage.cancel_pending_adoptions(
            ("evidence-a", "evidence-b"), "reply-confirmed", db_path=path
        )
    assert {
        adoption.status
        for adoption in jinyiwei_storage.list_adoptions_by_reply(
            "reply-confirmed", db_path=path
        )
    } == {"CONFIRMED"}


def test_concurrent_reply_reconciliation_is_idempotent(tmp_path) -> None:
    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    refs = archive_decree.resolve_adopted_evidence_references(
        _snapshot_with(current=(item,)),
        ("evidence-1",),
    )
    storage.create_reply_with_evidence(
        _reply_payload(),
        refs,
        reply_id="reply-concurrent",
        db_path=shiguan_path,
    )

    def reconcile(_: int) -> None:
        archive_decree.reconcile_reply_evidence(
            "reply-concurrent",
            shiguan_db_path=shiguan_path,
            jinyiwei_db_path=jinyiwei_path,
        )

    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(reconcile, range(8)))

    adoptions = jinyiwei_storage.list_adoptions_by_reply(
        "reply-concurrent", db_path=jinyiwei_path
    )
    assert [(item.evidence_id, item.status) for item in adoptions] == [
        ("evidence-1", "CONFIRMED")
    ]


def test_http_success_contract_survives_link_failure_with_one_reply(tmp_path, monkeypatch) -> None:
    from app.main import app

    shiguan_path = tmp_path / "shiguan.sqlite3"
    jinyiwei_path = tmp_path / "jinyiwei.sqlite3"
    item = _item()
    _seed_jinyiwei_evidence(jinyiwei_path, item)
    monkeypatch.setattr(db, "_DEFAULT_DB_PATH", shiguan_path)
    monkeypatch.setattr(jinyiwei_db, "DEFAULT_DB_PATH", jinyiwei_path)
    original_confirm = jinyiwei_storage.confirm_adoptions
    monkeypatch.setattr(
        jinyiwei_storage,
        "confirm_adoptions",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("offline failure")),
    )
    internal_result = {
        "chancellor_rationale": "交户部办理",
        "route_type": "single",
        "departments": ["户部"],
        "processing_path": ["上书房", "丞相（首次分流）", "户部", "丞相（最终汇总）"],
        "ministry_opinions": [
            {
                "department": "户部",
                "bureau_opinions": [{"bureau": "预算司", "opinion": "依据证据核定"}],
                "opinion": "同意核定",
            }
        ],
        "council_verdict": None,
        "final_verdict": "准奏",
        "recommendations": ["甲", "乙", "丙"],
        "adopted_evidence_ids": ("evidence-1",),
        "evidence_snapshot": SimpleNamespace(
            packs=(
                    SimpleNamespace(
                        pack_id="pack-1",
                        investigation_id="investigation-1",
                        request=_request_for(_fact()),
                        evidence_by_fact={"amount": (item,)},
                    ),
            )
        ),
    }

    class _Graph:
        def invoke(self, _state):
            return internal_result

    monkeypatch.setattr(decrees_module, "get_chancellor_graph", lambda: _Graph())
    response = TestClient(app).post(
        "/api/v1/decrees/chancellor", json={"decree_text": "请核定预算"}
    )

    assert response.status_code == 200
    assert set(response.json()) == {
        "status",
        "chancellor",
        "route_type",
        "rationale",
        "processing_path",
        "departments",
        "ministry_opinions",
        "council_verdict",
        "final_verdict",
        "recommendations",
    }
    replies = storage.list_archives(db_path=shiguan_path)
    assert len(replies) == 1
    assert replies[0].evidence_references[0].evidence_id == "evidence-1"
    reply_id = replies[0].id
    assert jinyiwei_storage.list_adoptions_by_reply(
        reply_id, db_path=jinyiwei_path
    )[0].status == "PENDING"
    monkeypatch.setattr(jinyiwei_storage, "confirm_adoptions", original_confirm)
    archive_decree.reconcile_reply_evidence(
        reply_id,
        shiguan_db_path=shiguan_path,
        jinyiwei_db_path=jinyiwei_path,
    )
    assert jinyiwei_storage.list_adoptions_by_reply(
        reply_id, db_path=jinyiwei_path
    )[0].status == "CONFIRMED"
