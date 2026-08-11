from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.jinyiwei import db, storage
from app.jinyiwei.models import DataGapRequest, EvidencePack, McpCallAudit, SourceType

NOW = datetime(2026, 7, 20, 8, 0, tzinfo=UTC)
OWNER_A = "user-a"
OWNER_B = "user-b"


def _request(*, request_id: str = "request-1") -> DataGapRequest:
    return DataGapRequest.model_validate(
        {
            "request_id": request_id,
            "requesting_agent": "hubu",
            "question": "What changed?",
            "required_facts": [
                {
                    "key": "amount",
                    "description": "Current amount",
                    "category": "ENTITY_REFERENCE",
                    "data_scope": "EXTERNAL_PUBLIC",
                    "subject": "Budget decision",
                    "expected_unit": "CNY",
                    "expected_shape": "number",
                },
                {
                    "key": "reason",
                    "description": "Reason for change",
                    "category": "ENTITY_REFERENCE",
                    "data_scope": "EXTERNAL_PUBLIC",
                    "subject": "Budget decision",
                },
            ],
            "decision_context": "Budget decision",
            "freshness": {
                "max_age_seconds": 3600,
                "not_before": "2026-07-20T00:00:00+00:00",
            },
            "existing_evidence_ids": ["prior-1"],
            "timeout_seconds": 30,
            "source_scope": ["PUBLIC_API", "PUBLIC_WEB"],
        }
    )


def _pack(
    *,
    pack_id: str = "pack-1",
    investigation_id: str = "investigation-1",
    request_id: str = "request-1",
    evidence_id: str = "evidence-1",
    value: int = 42,
    retrieved_at: str = "2026-07-20T07:50:00+00:00",
    publisher: str = "Example Authority",
) -> EvidencePack:
    request = _request(request_id=request_id)
    return EvidencePack.model_validate(
        {
            "pack_id": pack_id,
            "investigation_id": investigation_id,
            "status": "PARTIAL",
            "request": request.model_dump(mode="json"),
            "investigation_plan": {
                "fact_keys": ["amount", "reason"],
                "source_scope": ["PUBLIC_API", "PUBLIC_WEB"],
            },
            "evidence_by_fact": {
                "amount": [
                    {
                        "evidence_id": evidence_id,
                        "fact_key": "amount",
                        "value": {"total": value, "breakdown": [20, value - 20]},
                        "unit": "CNY",
                        "as_of": "2026-07-20T07:45:00+00:00",
                        "retrieved_at": retrieved_at,
                        "source_url": "https://example.test/data",
                        "publisher": publisher,
                        "source_type": "PUBLIC_API",
                        "quality": "AUTHORITATIVE",
                        "stance": "SUPPORTS",
                        "excerpt": "The total is 42.",
                        "content_hash": hashlib.sha256(b"minimal excerpt").hexdigest(),
                        "confidence": 0.9,
                    },
                    {
                        "evidence_id": f"{evidence_id}-conflict",
                        "fact_key": "amount",
                        "value": value + 1,
                        "unit": "CNY",
                        "as_of": "2026-07-20T07:40:00+00:00",
                        "retrieved_at": "2026-07-20T07:55:00+00:00",
                        "source_url": "https://secondary.example.test/report",
                        "publisher": "Secondary Publisher",
                        "source_type": "PUBLIC_WEB",
                        "quality": "SECONDARY",
                        "stance": "CONTRADICTS",
                        "excerpt": "The reported total is 43.",
                        "content_hash": hashlib.sha256(b"second excerpt").hexdigest(),
                        "confidence": 0.6,
                    },
                ],
                "reason": [],
            },
            "historical_evidence_by_fact": {"amount": [], "reason": []},
            "resolved_facts": ["amount"],
            "unresolved_facts": ["reason"],
            "conflicts": [
                {
                    "fact_key": "amount",
                    "evidence_ids": [evidence_id, f"{evidence_id}-conflict"],
                    "summary": "Sources disagree by one unit.",
                }
            ],
            "source_attempts": [
                {
                    "source_type": "PUBLIC_API",
                    "source_name": "Example API",
                    "status": "SUCCEEDED",
                    "started_at": "2026-07-20T07:40:00+00:00",
                    "completed_at": "2026-07-20T07:50:00+00:00",
                    "error": None,
                    "facts_attempted": ["amount", "reason"],
                },
                {
                    "source_type": "PUBLIC_WEB",
                    "source_name": "Example site",
                    "status": "FAILED",
                    "started_at": "2026-07-20T07:51:00+00:00",
                    "completed_at": "2026-07-20T07:56:00+00:00",
                    "error": "deadline exceeded",
                    "facts_attempted": ["reason"],
                },
            ],
            "investigation_started_at": "2026-07-20T07:40:00+00:00",
            "investigation_completed_at": "2026-07-20T07:56:00+00:00",
            "cache": {
                "hit": False,
                "cache_key": request.request_fingerprint,
                "cached_at": "2026-07-20T07:56:00+00:00",
                "expires_at": "2026-07-20T08:56:00+00:00",
            },
            "do_not_infer": ["Do not infer the missing reason."],
        }
    )


def _canonical(model: DataGapRequest | EvidencePack) -> str:
    return json.dumps(
        model.model_dump(
            mode="json",
            warnings="none",
            fallback=lambda value: dict(value) if isinstance(value, Mapping) else value,
        ),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _downgrade_adoption_tables_to_v4(
    connection: sqlite3.Connection, *, keep_batches: bool
) -> None:
    connection.execute(
        """
        CREATE TABLE evidence_adoptions_v4 (
            evidence_id TEXT NOT NULL,
            reply_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            confirmed_at TEXT,
            PRIMARY KEY (evidence_id, reply_id),
            FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
        )
        """
    )
    connection.execute(
        "INSERT INTO evidence_adoptions_v4 "
        "(evidence_id, reply_id, status, created_at, updated_at, confirmed_at) "
        "SELECT evidence_id, reply_id, status, created_at, updated_at, confirmed_at "
        "FROM evidence_adoptions"
    )
    connection.execute("DROP TABLE evidence_adoptions")
    connection.execute(
        "ALTER TABLE evidence_adoptions_v4 RENAME TO evidence_adoptions"
    )
    connection.execute("DROP TABLE adoption_batches")
    if keep_batches:
        connection.execute(
            """
            CREATE TABLE adoption_batches (
                reply_id TEXT PRIMARY KEY,
                evidence_ids_json TEXT NOT NULL,
                batch_fingerprint TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def test_schema_v5_has_nullable_request_owner_and_owner_partitioned_cache(
    tmp_path: Path,
) -> None:
    path = tmp_path / "schema-v5.sqlite3"

    db.initialize_database(path)

    connection = db.get_connection(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        request_info = {
            row["name"]: row
            for row in connection.execute("PRAGMA table_info(data_gap_requests)")
        }
        assert request_info["owner_user_id"]["notnull"] == 0
        cache_info = {
            row["name"]: row for row in connection.execute("PRAGMA table_info(cache_entries)")
        }
        assert cache_info["owner_user_id"]["notnull"] == 1
        assert cache_info["owner_user_id"]["pk"] == 1
        assert cache_info["fingerprint"]["pk"] == 2
        adoption_info = {
            row["name"]: row
            for row in connection.execute("PRAGMA table_info(evidence_adoptions)")
        }
        batch_info = {
            row["name"]: row
            for row in connection.execute("PRAGMA table_info(adoption_batches)")
        }
        assert adoption_info["owner_user_id"]["notnull"] == 0
        assert adoption_info["owner_user_id"]["pk"] == 1
        assert adoption_info["evidence_id"]["pk"] == 2
        assert adoption_info["reply_id"]["pk"] == 3
        assert batch_info["owner_user_id"]["notnull"] == 0
        assert batch_info["owner_user_id"]["pk"] == 1
        assert batch_info["reply_id"]["pk"] == 2
    finally:
        connection.close()


def test_schema_v4_migrates_legacy_rows_discards_cache_and_adds_owner_index(
    tmp_path: Path,
) -> None:
    path = tmp_path / "legacy-v4.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    storage.put_cache_entry(
        pack.request.request_fingerprint,
        pack.pack_id,
        owner_user_id=OWNER_A,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )
    connection = sqlite3.connect(path)
    try:
        _downgrade_adoption_tables_to_v4(connection, keep_batches=True)
        connection.execute("DROP INDEX data_gap_requests_owner_idx")
        connection.execute("ALTER TABLE data_gap_requests DROP COLUMN owner_user_id")
        connection.execute("DROP TABLE cache_entries")
        connection.execute(
            """
            CREATE TABLE cache_entries (
                fingerprint TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL,
                cached_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                hit_count INTEGER NOT NULL DEFAULT 0,
                last_hit_at TEXT,
                FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id)
            )
            """
        )
        connection.execute(
            "INSERT INTO cache_entries "
            "(fingerprint, pack_id, cached_at, expires_at) VALUES (?, ?, ?, ?)",
            (
                pack.request.request_fingerprint,
                pack.pack_id,
                NOW.isoformat(),
                (NOW + timedelta(hours=1)).isoformat(),
            ),
        )
        connection.execute("PRAGMA user_version = 4")
        connection.commit()
    finally:
        connection.close()

    db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert connection.execute(
            "SELECT owner_user_id FROM data_gap_requests WHERE request_id = ?",
            (pack.request.request_id,),
        ).fetchone() == (None,)
        assert connection.execute("SELECT COUNT(*) FROM cache_entries").fetchone()[0] == 0
        assert [
            row[2]
            for row in connection.execute(
                "PRAGMA index_info(data_gap_requests_owner_idx)"
            )
        ] == ["owner_user_id"]
    finally:
        connection.close()


@pytest.mark.parametrize(
    "owner_index_sql",
    [
        "CREATE UNIQUE INDEX data_gap_requests_owner_idx "
        "ON data_gap_requests(owner_user_id)",
        "CREATE INDEX data_gap_requests_owner_idx "
        "ON data_gap_requests(owner_user_id) WHERE owner_user_id IS NOT NULL",
    ],
    ids=["unique", "partial"],
)
def test_initialization_rejects_unsafe_owner_index_without_setting_v5(
    tmp_path: Path, owner_index_sql: str,
) -> None:
    path = tmp_path / "wrong-owner-index.sqlite3"
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            CREATE TABLE data_gap_requests (
                request_id TEXT PRIMARY KEY,
                owner_user_id TEXT,
                fingerprint TEXT NOT NULL,
                requesting_agent TEXT NOT NULL,
                question TEXT NOT NULL,
                decision_context TEXT NOT NULL,
                freshness_json TEXT NOT NULL,
                existing_evidence_ids_json TEXT NOT NULL,
                timeout_seconds INTEGER NOT NULL,
                source_scope_json TEXT NOT NULL,
                canonical_json TEXT NOT NULL
            )
            """
        )
        connection.execute(owner_index_sql)
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="invalid Jinyiwei schema v5"):
        db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 0
    finally:
        connection.close()


@pytest.mark.parametrize("owner_user_id", ["", "   "])
def test_new_request_writes_reject_empty_owner(
    tmp_path: Path, owner_user_id: str
) -> None:
    path = tmp_path / "missing-owner.sqlite3"

    with pytest.raises(ValueError, match="owner_user_id must be nonempty"):
        storage.store_data_gap_request(
            _request(), owner_user_id=owner_user_id, db_path=path
        )


def test_owner_scopes_summary_list_detail_and_hides_cross_owner(
    tmp_path: Path,
) -> None:
    path = tmp_path / "owner-reads.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        evidence_id="evidence-2",
    )
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_B, db_path=path)

    summary = storage.get_investigation_summary(owner_user_id=OWNER_A, db_path=path)
    page = storage.list_investigations(owner_user_id=OWNER_A, db_path=path)
    detail = storage.get_investigation_detail(
        first.investigation_id, owner_user_id=OWNER_A, db_path=path
    )

    assert summary.total_investigations == 1
    assert summary.distinct_evidence_count == 2
    assert page.total == 1
    assert [item.investigation_id for item in page.items] == [first.investigation_id]
    assert detail.investigation_id == first.investigation_id
    with pytest.raises(storage.InvestigationNotFoundError, match="investigation not found"):
        storage.get_investigation_detail(
            second.investigation_id, owner_user_id=OWNER_A, db_path=path
        )


def test_shared_evidence_adoptions_are_owner_scoped_and_legacy_rows_hidden(
    tmp_path: Path,
) -> None:
    path = tmp_path / "shared-evidence-adoptions.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
    )
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_B, db_path=path)
    storage.upsert_evidence_adoption(
        "evidence-1",
        "reply-a",
        "PENDING",
        owner_user_id=OWNER_A,
        at=NOW,
        db_path=path,
    )
    storage.upsert_evidence_adoption(
        "evidence-1",
        "reply-b",
        "CONFIRMED",
        owner_user_id=OWNER_B,
        at=NOW,
        db_path=path,
    )
    connection = db.get_connection(path)
    try:
        connection.execute(
            "INSERT INTO adoption_batches "
            "(owner_user_id, reply_id, evidence_ids_json, batch_fingerprint, "
            "created_at, updated_at) VALUES (NULL, ?, ?, ?, ?, ?)",
            (
                "reply-legacy",
                '["evidence-1"]',
                "legacy-fingerprint",
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.execute(
            "INSERT INTO evidence_adoptions "
            "(owner_user_id, evidence_id, reply_id, status, created_at, updated_at, "
            "confirmed_at) VALUES (NULL, ?, ?, 'CONFIRMED', ?, ?, ?)",
            (
                "evidence-1",
                "reply-legacy",
                NOW.isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.commit()
    finally:
        connection.close()

    summary = storage.get_investigation_summary(owner_user_id=OWNER_A, db_path=path)
    page = storage.list_investigations(owner_user_id=OWNER_A, db_path=path)
    detail = storage.get_investigation_detail(
        first.investigation_id, owner_user_id=OWNER_A, db_path=path
    )

    assert summary.pending_adoption_count == 1
    assert summary.confirmed_adoption_count == 0
    assert page.items[0].linked_reply_count == 1
    assert [(item.reply_id, item.status) for item in detail.adoptions] == [
        ("reply-a", "PENDING")
    ]


def test_cache_is_partitioned_by_owner_without_changing_request_fingerprint(
    tmp_path: Path,
) -> None:
    path = tmp_path / "owner-cache.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        evidence_id="evidence-2",
    )
    assert first.request.request_fingerprint == second.request.request_fingerprint
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_B, db_path=path)
    storage.put_cache_entry(
        first.request.request_fingerprint,
        first.pack_id,
        owner_user_id=OWNER_A,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )
    storage.put_cache_entry(
        second.request.request_fingerprint,
        second.pack_id,
        owner_user_id=OWNER_B,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )

    first_hit = storage.lookup_cached_pack(
        first.request.request_fingerprint,
        owner_user_id=OWNER_A,
        now=NOW,
        db_path=path,
    )
    second_hit = storage.lookup_cached_pack(
        second.request.request_fingerprint,
        owner_user_id=OWNER_B,
        now=NOW,
        db_path=path,
    )

    assert first_hit is not None and first_hit.pack_id == first.pack_id
    assert second_hit is not None and second_hit.pack_id == second.pack_id
    connection = db.get_connection(path)
    try:
        rows = connection.execute(
            "SELECT owner_user_id, fingerprint FROM cache_entries ORDER BY owner_user_id"
        ).fetchall()
        assert [tuple(row) for row in rows] == [
            (OWNER_A, first.request.request_fingerprint),
            (OWNER_B, second.request.request_fingerprint),
        ]
        request_row = connection.execute(
            "SELECT canonical_json FROM data_gap_requests WHERE request_id = ?",
            (first.request.request_id,),
        ).fetchone()
        assert "owner_user_id" not in json.loads(request_row["canonical_json"])
    finally:
        connection.close()


def test_cache_entry_rejects_pack_owned_by_another_user_atomically(
    tmp_path: Path,
) -> None:
    path = tmp_path / "cross-owner-cache.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_B, db_path=path)

    with pytest.raises(storage.JinyiweiStorageError, match="failed to store cache entry"):
        storage.put_cache_entry(
            pack.request.request_fingerprint,
            pack.pack_id,
            owner_user_id=OWNER_A,
            cached_at=NOW,
            expires_at=NOW + timedelta(hours=1),
            db_path=path,
        )

    connection = db.get_connection(path)
    try:
        assert connection.execute("SELECT COUNT(*) FROM cache_entries").fetchone()[0] == 0
    finally:
        connection.close()


def test_cache_lookup_rejects_entry_pointing_to_another_owner_pack(
    tmp_path: Path,
) -> None:
    path = tmp_path / "corrupt-cross-owner-cache.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_B, db_path=path)
    connection = db.get_connection(path)
    try:
        connection.execute(
            "INSERT INTO cache_entries "
            "(owner_user_id, fingerprint, pack_id, cached_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                OWNER_A,
                pack.request.request_fingerprint,
                pack.pack_id,
                NOW.isoformat(),
                (NOW + timedelta(hours=1)).isoformat(),
            ),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError, match="failed to read cache"):
        storage.lookup_cached_pack(
            pack.request.request_fingerprint,
            owner_user_id=OWNER_A,
            now=NOW,
            db_path=path,
        )


def test_fresh_and_idempotent_initialization_configures_schema(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "jinyiwei.sqlite3"

    db.initialize_database(path)
    db.initialize_database(path)

    connection = db.get_connection(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] > 0
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert {
            "investigations",
            "requested_fact_slots",
            "source_attempts",
            "evidence_items",
            "evidence_packs",
            "pack_items",
            "cache_entries",
            "evidence_adoptions",
            "adoption_batches",
        } <= tables
        evidence_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(evidence_items)").fetchall()
        }
        assert "investigation_id" not in evidence_columns
        assert "model_json" in evidence_columns
    finally:
        connection.close()


def test_schema_v2_to_v3_backfills_legacy_adoption_batch_identity(
    tmp_path: Path,
) -> None:
    path = tmp_path / "legacy-v2.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    storage.write_pending_adoptions(
        ("evidence-1-conflict", "evidence-1"),
        "reply-legacy",
        owner_user_id=OWNER_A,
        at=NOW,
        db_path=path,
    )
    connection = sqlite3.connect(path)
    try:
        _downgrade_adoption_tables_to_v4(connection, keep_batches=False)
        connection.execute("ALTER TABLE source_attempts DROP COLUMN call_audits_json")
        connection.execute("DROP INDEX data_gap_requests_owner_idx")
        connection.execute("ALTER TABLE data_gap_requests DROP COLUMN owner_user_id")
        connection.execute("DROP TABLE cache_entries")
        connection.execute(
            """
            CREATE TABLE cache_entries (
                fingerprint TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL,
                cached_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                hit_count INTEGER NOT NULL DEFAULT 0,
                last_hit_at TEXT,
                FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id)
            )
            """
        )
        connection.execute("PRAGMA user_version = 2")
        connection.commit()
    finally:
        connection.close()

    db.initialize_database(path)
    db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT evidence_ids_json, batch_fingerprint "
            "FROM adoption_batches WHERE reply_id = 'reply-legacy'"
        ).fetchone()
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert json.loads(row[0]) == ["evidence-1", "evidence-1-conflict"]
        assert len(row[1]) == 64
    finally:
        connection.close()


def test_default_database_is_independent_from_shiguan() -> None:
    assert db.DEFAULT_DB_PATH.name == "jinyiwei.sqlite3"
    assert db.DEFAULT_DB_PATH != db.SHIGUAN_DB_PATH


def test_mcp_call_audit_round_trips_without_request_or_response_body(
    tmp_path: Path,
) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    pack = _pack()
    attempt = pack.source_attempts[0].model_copy(
        update={
            "source_type": SourceType.PUBLIC_API,
            "call_audits": (
                McpCallAudit(
                    server_id="westock",
                    tool_name="data_quote",
                    approval_version="v1",
                    duration_ms=12,
                    arguments_hash="a" * 64,
                    response_bytes=128,
                    response_hash="b" * 64,
                    mapping_outcome="mapped",
                    cache_hit=False,
                ),
            ),
        }
    )
    pack = pack.model_copy(
        update={"source_attempts": (attempt, *pack.source_attempts[1:])}
    )

    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    restored = storage.get_evidence_pack(pack.pack_id, db_path=path)

    assert restored.source_attempts[0].call_audits == attempt.call_audits
    connection = db.get_connection(path)
    try:
        raw = connection.execute(
            "SELECT call_audits_json FROM source_attempts "
            "WHERE investigation_id = ? AND ordinal = 0",
            (pack.investigation_id,),
        ).fetchone()[0]
    finally:
        connection.close()
    assert "sz002594" not in raw
    assert "price" not in raw


def test_shiguan_path_aliases_are_rejected_before_open_and_leave_file_untouched(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    shiguan_path = tmp_path / "backend" / "data" / "shiguan.sqlite3"
    shiguan_path.parent.mkdir(parents=True)
    sentinel = b"existing-shiguan-database"
    shiguan_path.write_bytes(sentinel)
    monkeypatch.setattr(db, "SHIGUAN_DB_PATH", shiguan_path)
    monkeypatch.chdir(tmp_path)
    relative_alias = Path("backend") / "data" / "shiguan.sqlite3"
    aliases = (
        shiguan_path,
        shiguan_path.parent / "." / shiguan_path.name,
        shiguan_path.parent / "nested" / ".." / shiguan_path.name,
        relative_alias,
    )

    for alias in aliases:
        with pytest.raises(db.ForbiddenDatabasePathError):
            db.initialize_database(alias)
        with pytest.raises(db.ForbiddenDatabasePathError):
            db.get_connection(alias)
        assert shiguan_path.read_bytes() == sentinel


def test_connection_enforces_foreign_keys(tmp_path: Path) -> None:
    connection = db.get_connection(tmp_path / "foreign-keys.sqlite3")
    try:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT INTO pack_items(pack_id, evidence_id, fact_key, ordinal) "
                "VALUES ('missing-pack', 'missing-item', 'fact', 0)"
            )
    finally:
        connection.close()


def test_request_and_complete_pack_round_trip_without_semantic_loss(
    tmp_path: Path,
) -> None:
    path = tmp_path / "round-trip.sqlite3"
    request = _request()
    pack = _pack()

    storage.store_data_gap_request(request, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)

    assert _canonical(storage.get_data_gap_request(request.request_id, db_path=path)) == (
        _canonical(request)
    )
    restored = storage.get_evidence_pack(pack.pack_id, db_path=path)
    assert _canonical(restored) == _canonical(pack)
    assert list(restored.evidence_by_fact) == ["amount", "reason"]
    assert restored.conflicts == pack.conflicts
    assert restored.source_attempts == pack.source_attempts
    assert restored.cache == pack.cache


def test_identical_global_evidence_can_belong_to_multiple_packs(
    tmp_path: Path,
) -> None:
    path = tmp_path / "shared-evidence.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        retrieved_at="2026-07-20T08:05:00+00:00",
    )

    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_A, db_path=path)

    restored_first = storage.get_evidence_pack(first.pack_id, db_path=path)
    restored_second = storage.get_evidence_pack(second.pack_id, db_path=path)
    assert _canonical(restored_first) == _canonical(first)
    assert _canonical(restored_second) == _canonical(second)
    assert restored_first.evidence_by_fact["amount"][0].retrieved_at == (
        "2026-07-20T07:50:00+00:00"
    )
    assert restored_second.evidence_by_fact["amount"][0].retrieved_at == (
        "2026-07-20T08:05:00+00:00"
    )
    connection = db.get_connection(path)
    try:
        assert connection.execute("SELECT COUNT(*) FROM evidence_items").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM pack_items").fetchone()[0] == 4
        global_row = connection.execute(
            "SELECT retrieved_at, model_json FROM evidence_items WHERE evidence_id = ?",
            ("evidence-1",),
        ).fetchone()
        assert global_row["retrieved_at"] == "2026-07-20T07:50:00+00:00"
        assert json.loads(global_row["model_json"])["retrieved_at"] == ("2026-07-20T07:50:00+00:00")
    finally:
        connection.close()


def test_global_evidence_id_rejects_different_content_atomically(
    tmp_path: Path,
) -> None:
    path = tmp_path / "evidence-conflict.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    conflicting = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        publisher="Different Authority",
    )

    with pytest.raises(storage.ImmutableEvidenceConflictError):
        storage.store_evidence_pack(conflicting, owner_user_id=OWNER_A, db_path=path)

    connection = db.get_connection(path)
    try:
        assert connection.execute("SELECT COUNT(*) FROM investigations").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM evidence_packs").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM evidence_items").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM pack_items").fetchone()[0] == 2
    finally:
        connection.close()


def test_pack_write_rolls_back_every_table_on_failure(tmp_path: Path) -> None:
    path = tmp_path / "rollback.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    conflicting = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        evidence_id="evidence-1",
        value=99,
    )

    with pytest.raises(storage.JinyiweiStorageError):
        storage.store_evidence_pack(conflicting, owner_user_id=OWNER_A, db_path=path)

    connection = db.get_connection(path)
    try:
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM investigations WHERE investigation_id = ?",
                ("investigation-2",),
            ).fetchone()[0]
            == 0
        )
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM evidence_packs WHERE pack_id = ?", ("pack-2",)
            ).fetchone()[0]
            == 0
        )
    finally:
        connection.close()


def test_immutable_pack_is_idempotent_and_rejects_changed_content(
    tmp_path: Path,
) -> None:
    path = tmp_path / "immutable.sqlite3"
    original = _pack()
    storage.store_evidence_pack(original, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(original, owner_user_id=OWNER_A, db_path=path)

    changed = _pack(value=99)
    with pytest.raises(storage.ImmutablePackConflictError):
        storage.store_evidence_pack(changed, owner_user_id=OWNER_A, db_path=path)

    assert _canonical(storage.get_evidence_pack("pack-1", db_path=path)) == _canonical(original)


def test_request_content_conflict_explicitly_rolls_back_and_is_atomic(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "request-conflict.sqlite3"
    original = _request()
    storage.store_data_gap_request(original, owner_user_id=OWNER_A, db_path=path)
    changed = original.model_copy(update={"question": "A different question"})
    real_connection = db.get_connection(path)

    class RollbackTrackingConnection:
        def __init__(self, connection: sqlite3.Connection) -> None:
            self.connection = connection
            self.rollback_calls = 0

        def __getattr__(self, name: str) -> object:
            return getattr(self.connection, name)

        def rollback(self) -> None:
            self.rollback_calls += 1
            self.connection.rollback()

    tracked = RollbackTrackingConnection(real_connection)
    monkeypatch.setattr(storage.db, "get_connection", lambda path=None: tracked)

    with pytest.raises(storage.RequestContentConflictError):
        storage.store_data_gap_request(changed, owner_user_id=OWNER_A, db_path=path)

    assert tracked.rollback_calls == 1
    check = sqlite3.connect(path)
    try:
        assert check.execute("SELECT COUNT(*) FROM data_gap_requests").fetchone()[0] == 1
        assert check.execute("SELECT COUNT(*) FROM requested_fact_slots").fetchone()[0] == 2
        assert check.execute(
            "SELECT canonical_json FROM data_gap_requests WHERE request_id = ?",
            (original.request_id,),
        ).fetchone()[0] == _canonical(original)
    finally:
        check.close()


def test_pack_request_conflict_explicitly_rolls_back_all_partial_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "pack-request-conflict.sqlite3"
    original = _pack()
    storage.store_data_gap_request(
        original.request, owner_user_id=OWNER_A, db_path=path
    )
    changed_request = original.request.model_copy(update={"question": "A different question"})
    conflicting = original.model_copy(
        update={
            "pack_id": "pack-2",
            "investigation_id": "investigation-2",
            "request": changed_request,
        }
    )
    real_connection = db.get_connection(path)

    class RollbackTrackingConnection:
        def __init__(self, connection: sqlite3.Connection) -> None:
            self.connection = connection
            self.rollback_calls = 0

        def __getattr__(self, name: str) -> object:
            return getattr(self.connection, name)

        def rollback(self) -> None:
            self.rollback_calls += 1
            self.connection.rollback()

    tracked = RollbackTrackingConnection(real_connection)
    monkeypatch.setattr(storage.db, "get_connection", lambda path=None: tracked)

    with pytest.raises(storage.RequestContentConflictError):
        storage.store_evidence_pack(conflicting, owner_user_id=OWNER_A, db_path=path)

    assert tracked.rollback_calls == 1
    check = sqlite3.connect(path)
    try:
        assert check.execute("SELECT COUNT(*) FROM investigations").fetchone()[0] == 0
        assert check.execute("SELECT COUNT(*) FROM evidence_packs").fetchone()[0] == 0
        assert check.execute("SELECT COUNT(*) FROM evidence_items").fetchone()[0] == 0
    finally:
        check.close()


def test_cache_hit_miss_expiry_and_corruption_fail_closed(tmp_path: Path) -> None:
    path = tmp_path / "cache.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    storage.put_cache_entry(
        pack.request.request_fingerprint,
        pack.pack_id,
        owner_user_id=OWNER_A,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )

    hit = storage.lookup_cached_pack(
        pack.request.request_fingerprint,
        owner_user_id=OWNER_A,
        now=NOW,
        db_path=path,
    )
    assert hit is not None
    assert hit.cache.hit is True
    assert hit.cache.cache_key == pack.request.request_fingerprint
    assert (
        storage.lookup_cached_pack(
            "missing", owner_user_id=OWNER_A, now=NOW, db_path=path
        )
        is None
    )
    assert (
        storage.lookup_cached_pack(
            pack.request.request_fingerprint,
            owner_user_id=OWNER_A,
            now=NOW + timedelta(hours=2),
            db_path=path,
        )
        is None
    )

    connection = db.get_connection(path)
    try:
        connection.execute(
            "UPDATE evidence_packs SET canonical_json = '{broken' WHERE pack_id = ?",
            (pack.pack_id,),
        )
        connection.commit()
    finally:
        connection.close()
    assert (
        storage.lookup_cached_pack(
            pack.request.request_fingerprint,
            owner_user_id=OWNER_A,
            now=NOW,
            db_path=path,
        )
        is None
    )


@pytest.mark.parametrize(
    ("column", "corrupt_value"),
    [
        ("expires_at", "not-a-timestamp"),
        ("expires_at", "2026-07-20T09:00:00"),
        ("cached_at", "not-a-timestamp"),
    ],
)
def test_corrupt_cache_timestamps_fail_closed(
    tmp_path: Path, column: str, corrupt_value: str
) -> None:
    path = tmp_path / f"corrupt-{column}.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    storage.put_cache_entry(
        pack.request.request_fingerprint,
        pack.pack_id,
        owner_user_id=OWNER_A,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )
    connection = db.get_connection(path)
    try:
        connection.execute(
            f"UPDATE cache_entries SET {column} = ? WHERE fingerprint = ?",
            (corrupt_value, pack.request.request_fingerprint),
        )
        connection.commit()
    finally:
        connection.close()

    assert (
        storage.lookup_cached_pack(
            pack.request.request_fingerprint,
            owner_user_id=OWNER_A,
            now=NOW,
            db_path=path,
        )
        is None
    )


@pytest.mark.parametrize("failure_point", ["select", "begin", "update", "commit"])
def test_cache_operational_sqlite_failures_raise_typed_error_and_rollback(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure_point: str,
) -> None:
    path = tmp_path / f"cache-operational-{failure_point}.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)
    storage.put_cache_entry(
        pack.request.request_fingerprint,
        pack.pack_id,
        owner_user_id=OWNER_A,
        cached_at=NOW,
        expires_at=NOW + timedelta(hours=1),
        db_path=path,
    )
    real_connection = db.get_connection(path)

    class FailingConnection:
        def __init__(self, connection: sqlite3.Connection) -> None:
            self.connection = connection
            self.rollback_calls = 0

        def execute(self, sql: str, parameters: object = ()) -> sqlite3.Cursor:
            normalized = " ".join(sql.split()).upper()
            if failure_point == "select" and normalized.startswith("SELECT C.CACHED_AT"):
                raise sqlite3.OperationalError("select failed")
            if failure_point == "begin" and normalized == "BEGIN IMMEDIATE":
                raise sqlite3.OperationalError("begin failed")
            if failure_point == "update" and normalized.startswith("UPDATE CACHE_ENTRIES"):
                raise sqlite3.OperationalError("update failed")
            return self.connection.execute(sql, parameters)

        def commit(self) -> None:
            if failure_point == "commit":
                raise sqlite3.OperationalError("commit failed")
            self.connection.commit()

        def rollback(self) -> None:
            self.rollback_calls += 1
            self.connection.rollback()

        def close(self) -> None:
            self.connection.close()

    tracked = FailingConnection(real_connection)
    monkeypatch.setattr(storage.db, "get_connection", lambda path=None: tracked)

    with pytest.raises(storage.JinyiweiStorageError, match="failed to read cache"):
        storage.lookup_cached_pack(
            pack.request.request_fingerprint,
            owner_user_id=OWNER_A,
            now=NOW,
            db_path=path,
        )
    assert tracked.rollback_calls == 1


def test_adoption_upsert_is_monotonic_idempotent_and_deterministic(
    tmp_path: Path,
) -> None:
    path = tmp_path / "adoption.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)

    first = storage.upsert_evidence_adoption(
        "evidence-1", "reply-b", "PENDING",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )
    storage.upsert_evidence_adoption(
        "evidence-1", "reply-b", "PENDING",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )
    confirmed = storage.upsert_evidence_adoption(
        "evidence-1",
        "reply-b",
        "CONFIRMED",
        owner_user_id=OWNER_A,
        at=NOW + timedelta(minutes=1),
        db_path=path,
    )
    not_regressed = storage.upsert_evidence_adoption(
        "evidence-1",
        "reply-b",
        "PENDING",
        owner_user_id=OWNER_A,
        at=NOW + timedelta(minutes=2),
        db_path=path,
    )
    storage.upsert_evidence_adoption(
        "evidence-1-conflict", "reply-a", "PENDING",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )

    assert first.created_at == first.updated_at
    assert confirmed.status == "CONFIRMED"
    assert confirmed.confirmed_at == NOW + timedelta(minutes=1)
    assert not_regressed == confirmed
    assert [
        item.reply_id
        for item in storage.list_adoptions_by_investigation(
            pack.investigation_id, owner_user_id=OWNER_A, db_path=path
        )
    ] == ["reply-a", "reply-b"]
    assert [
        item.evidence_id
        for item in storage.list_adoptions_by_reply(
            "reply-b", owner_user_id=OWNER_A, db_path=path
        )
    ] == ["evidence-1"]


def test_read_summary_uses_independent_counts_without_join_multiplication(
    tmp_path: Path,
) -> None:
    path = tmp_path / "read-summary.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    storage.upsert_evidence_adoption(
        "evidence-1", "reply-1", "PENDING",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )
    storage.upsert_evidence_adoption(
        "evidence-1-conflict", "reply-2", "CONFIRMED",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )

    summary = storage.get_investigation_summary(owner_user_id=OWNER_A, db_path=path)

    assert summary.model_dump(mode="json") == {
        "total_investigations": 1,
        "resolved_count": 0,
        "partial_count": 1,
        "blocked_count": 0,
        "unavailable_count": 0,
        "distinct_evidence_count": 2,
        "pending_adoption_count": 1,
        "confirmed_adoption_count": 1,
    }


def test_read_list_is_filtered_paginated_and_uses_distinct_aggregates(
    tmp_path: Path,
) -> None:
    path = tmp_path / "read-list.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        evidence_id="evidence-2",
    )
    second_payload = json.loads(_canonical(second))
    second_payload["investigation_started_at"] = "2026-07-20T08:00:00+00:00"
    second_payload["investigation_completed_at"] = "2026-07-20T08:05:00+00:00"
    second = EvidencePack.model_validate(second_payload)
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_A, db_path=path)
    storage.write_pending_adoptions(
        ("evidence-2", "evidence-2-conflict"),
        "reply-1",
        owner_user_id=OWNER_A,
        at=NOW,
        db_path=path,
    )

    page = storage.list_investigations(
        owner_user_id=OWNER_A, status="PARTIAL", limit=1, offset=0, db_path=path
    )

    assert page.total == 2
    assert page.limit == 1
    assert page.offset == 0
    assert [item.investigation_id for item in page.items] == ["investigation-2"]
    assert page.items[0].source_attempt_count == 2
    assert page.items[0].evidence_count == 2
    assert page.items[0].linked_reply_count == 1


def test_read_detail_uses_canonical_pack_local_retrieval_time_and_adoptions(
    tmp_path: Path,
) -> None:
    path = tmp_path / "read-detail.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        retrieved_at="2026-07-20T08:05:00+00:00",
    )
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(second, owner_user_id=OWNER_A, db_path=path)
    storage.upsert_evidence_adoption(
        "evidence-1", "reply-1", "CONFIRMED",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )

    detail = storage.get_investigation_detail(
        "investigation-2", owner_user_id=OWNER_A, db_path=path
    )

    assert detail.evidence_by_fact["amount"][0].retrieved_at == "2026-07-20T08:05:00+00:00"
    assert detail.resolved_facts == ("amount",)
    assert detail.unresolved_facts == ("reason",)
    assert detail.conflicts[0].fact_key == "amount"
    assert [(item.evidence_id, item.reply_id, item.status) for item in detail.adoptions] == [
        ("evidence-1", "reply-1", "CONFIRMED")
    ]


def test_read_detail_preserves_optional_evidence_source_metadata(tmp_path: Path) -> None:
    path = tmp_path / "read-detail-source-metadata.sqlite3"
    payload = json.loads(_canonical(_pack()))
    evidence = payload["evidence_by_fact"]["amount"][0]
    evidence.update(
        {
            "published_at": "2026-07-20T07:44:00+00:00",
            "coverage": ["CN", "Shenzhen"],
            "license_note": "Free public quotation feed.",
        }
    )
    storage.store_evidence_pack(
        EvidencePack.model_validate(payload), owner_user_id=OWNER_A, db_path=path
    )

    detail = storage.get_investigation_detail(
        "investigation-1", owner_user_id=OWNER_A, db_path=path
    )

    restored = detail.evidence_by_fact["amount"][0]
    assert restored.published_at == "2026-07-20T07:44:00+00:00"
    assert restored.coverage == ("CN", "Shenzhen")
    assert restored.license_note == "Free public quotation feed."


def test_mcp_evidence_round_trip_preserves_current_and_historical_metadata(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mcp-round-trip.sqlite3"
    payload = json.loads(_canonical(_pack()))
    payload["request"]["source_scope"] = ["SHIGUAN", "MCP"]
    payload["investigation_plan"]["source_scope"] = ["SHIGUAN", "MCP"]
    current = payload["evidence_by_fact"]["amount"][0]
    current.update(
        {
            "source_type": "MCP",
            "coverage": ["CN", "MARKET_QUOTE"],
            "license_note": "Approved read-only MCP source.",
        }
    )
    payload["evidence_by_fact"]["amount"] = [current]
    payload["conflicts"] = []
    payload["source_attempts"][0]["source_type"] = "MCP"
    payload["source_attempts"][1]["source_type"] = "SHIGUAN"
    historical = dict(current)
    historical.update(
        {
            "evidence_id": "historical-1",
            "source_type": "SHIGUAN",
            "source_url": "internal://shiguan/evidence/historical-1",
            "publisher": "Shiguan",
            "as_of": "2026-07-19T07:45:00+00:00",
            "retrieved_at": "2026-07-20T07:40:00+00:00",
            "coverage": ["CN", "BUSINESS_ARCHIVE"],
            "license_note": "Internal adopted evidence.",
        }
    )
    payload["historical_evidence_by_fact"]["amount"] = [historical]
    pack = EvidencePack.model_validate(payload)

    storage.store_evidence_pack(pack, owner_user_id=OWNER_A, db_path=path)

    restored_pack = storage.get_evidence_pack(pack.pack_id, db_path=path)
    current_item = restored_pack.evidence_by_fact["amount"][0]
    assert current_item.source_type.value == "MCP"
    assert current_item.coverage == ("CN", "MARKET_QUOTE")
    detail = storage.get_investigation_detail(
        pack.investigation_id, owner_user_id=OWNER_A, db_path=path
    )
    historical_item = detail.historical_evidence_by_fact["amount"][0]
    assert historical_item.source_type.value == "SHIGUAN"
    assert historical_item.coverage == ("CN", "BUSINESS_ARCHIVE")


@pytest.mark.parametrize("operation", ["read", "idempotent_write"])
@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("question", "CORRUPT"),
        ("fingerprint", "0" * 64),
        ("freshness_json", '{"max_age_seconds":999}'),
        ("source_scope_json", '["PUBLIC_WEB"]'),
    ],
)
def test_independent_request_operations_reject_divergent_request_columns(
    tmp_path: Path, operation: str, column: str, value: str
) -> None:
    path = tmp_path / f"request-{operation}-{column}.sqlite3"
    request = _request()
    storage.store_data_gap_request(request, owner_user_id=OWNER_A, db_path=path)
    connection = db.get_connection(path)
    try:
        connection.execute(
            f"UPDATE data_gap_requests SET {column} = ? WHERE request_id = ?",
            (value, request.request_id),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError):
        if operation == "read":
            storage.get_data_gap_request(request.request_id, db_path=path)
        else:
            storage.store_data_gap_request(
                request, owner_user_id=OWNER_A, db_path=path
            )


@pytest.mark.parametrize("operation", ["read", "idempotent_write"])
@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("category", "NEWS_EVENT"),
        ("data_scope", "INTERNAL_BUSINESS"),
        ("subject", "CORRUPT"),
        ("jurisdiction", "US"),
    ],
)
def test_independent_request_operations_reject_divergent_fact_identity(
    tmp_path: Path, operation: str, column: str, value: str
) -> None:
    path = tmp_path / f"fact-{operation}-{column}.sqlite3"
    request = _request()
    storage.store_data_gap_request(request, owner_user_id=OWNER_A, db_path=path)
    connection = db.get_connection(path)
    try:
        connection.execute(
            f"UPDATE requested_fact_slots SET {column} = ? "
            "WHERE request_id = ? AND ordinal = 0",
            (value, request.request_id),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError):
        if operation == "read":
            storage.get_data_gap_request(request.request_id, db_path=path)
        else:
            storage.store_data_gap_request(
                request, owner_user_id=OWNER_A, db_path=path
            )


@pytest.mark.parametrize(
    ("sql", "parameters"),
    [
        ("UPDATE evidence_packs SET content_hash = ? WHERE pack_id = ?", ("0" * 64, "pack-1")),
        (
            "UPDATE investigations SET status = ? WHERE investigation_id = ?",
            ("RESOLVED", "investigation-1"),
        ),
        (
            "UPDATE requested_fact_slots SET fact_key = ? WHERE request_id = ? AND ordinal = 0",
            ("wrong", "request-1"),
        ),
        ("UPDATE data_gap_requests SET question = ? WHERE request_id = ?", ("wrong", "request-1")),
        (
            "UPDATE source_attempts SET started_at = ? WHERE investigation_id = ? AND ordinal = 0",
            ("not-a-time", "investigation-1"),
        ),
        (
            "UPDATE pack_items SET fact_key = ? WHERE pack_id = ? AND ordinal = 0",
            ("wrong", "pack-1"),
        ),
        ("UPDATE evidence_items SET publisher = ? WHERE evidence_id = ?", ("wrong", "evidence-1")),
        (
            "UPDATE evidence_items SET model_json = ? WHERE evidence_id = ?",
            ("{broken", "evidence-1"),
        ),
    ],
)
def test_read_detail_fails_closed_on_corruption(
    tmp_path: Path, sql: str, parameters: tuple[str, ...]
) -> None:
    path = tmp_path / "read-corrupt.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    connection = db.get_connection(path)
    try:
        connection.execute(sql, parameters)
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError, match="investigation data unavailable"):
        storage.get_investigation_detail(
            "investigation-1", owner_user_id=OWNER_A, db_path=path
        )


def test_read_detail_has_explicit_not_found_error(tmp_path: Path) -> None:
    with pytest.raises(storage.InvestigationNotFoundError):
        storage.get_investigation_detail(
            "missing",
            owner_user_id=OWNER_A,
            db_path=tmp_path / "missing.sqlite3",
        )


def test_read_detail_treats_existing_investigation_without_pack_as_corruption(
    tmp_path: Path,
) -> None:
    path = tmp_path / "missing-pack.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    connection = db.get_connection(path)
    try:
        connection.execute("DELETE FROM pack_items WHERE pack_id = ?", ("pack-1",))
        connection.execute("DELETE FROM evidence_packs WHERE pack_id = ?", ("pack-1",))
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError, match="investigation data unavailable"):
        storage.get_investigation_detail(
            "investigation-1", owner_user_id=OWNER_A, db_path=path
        )


def test_read_list_fails_closed_for_corrupt_request_outside_current_page(
    tmp_path: Path,
) -> None:
    path = tmp_path / "list-orphan-request.sqlite3"
    first = _pack()
    second = _pack(
        pack_id="pack-2",
        investigation_id="investigation-2",
        request_id="request-2",
        evidence_id="evidence-2",
    )
    second_payload = json.loads(_canonical(second))
    second_payload["investigation_started_at"] = "2026-07-20T08:00:00+00:00"
    second_payload["investigation_completed_at"] = "2026-07-20T08:05:00+00:00"
    storage.store_evidence_pack(first, owner_user_id=OWNER_A, db_path=path)
    storage.store_evidence_pack(
        EvidencePack.model_validate(second_payload),
        owner_user_id=OWNER_A,
        db_path=path,
    )
    connection = sqlite3.connect(path)
    try:
        connection.execute("DELETE FROM requested_fact_slots WHERE request_id = ?", ("request-1",))
        connection.execute("DELETE FROM data_gap_requests WHERE request_id = ?", ("request-1",))
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError, match="investigation data unavailable"):
        storage.list_investigations(
            owner_user_id=OWNER_A,
            status="PARTIAL",
            limit=1,
            offset=0,
            db_path=path,
        )


def test_read_detail_rejects_invalid_adoption_transition_metadata(tmp_path: Path) -> None:
    path = tmp_path / "invalid-adoption.sqlite3"
    storage.store_evidence_pack(_pack(), owner_user_id=OWNER_A, db_path=path)
    storage.upsert_evidence_adoption(
        "evidence-1", "reply-1", "PENDING",
        owner_user_id=OWNER_A, at=NOW, db_path=path
    )
    connection = db.get_connection(path)
    try:
        connection.execute(
            "UPDATE evidence_adoptions SET confirmed_at = ? WHERE evidence_id = ? AND reply_id = ?",
            (NOW.isoformat(), "evidence-1", "reply-1"),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(storage.JinyiweiStorageError, match="investigation data unavailable"):
        storage.get_investigation_detail(
            "investigation-1", owner_user_id=OWNER_A, db_path=path
        )


@pytest.mark.parametrize("operation", ["summary", "list", "detail"])
def test_read_queries_map_connection_failures_to_storage_error(
    monkeypatch: pytest.MonkeyPatch, operation: str
) -> None:
    monkeypatch.setattr(
        storage.db,
        "get_connection",
        lambda _path=None: (_ for _ in ()).throw(sqlite3.OperationalError("private path")),
    )

    with pytest.raises(storage.JinyiweiStorageError, match="investigation data unavailable"):
        if operation == "summary":
            storage.get_investigation_summary(owner_user_id=OWNER_A)
        elif operation == "list":
            storage.list_investigations(owner_user_id=OWNER_A)
        else:
            storage.get_investigation_detail(
                "investigation-1", owner_user_id=OWNER_A
            )
