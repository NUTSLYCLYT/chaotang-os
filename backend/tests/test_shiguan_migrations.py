"""Schema-v1 to schema-v2 migration safety tests."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import sys

import pytest

from app.jinyiwei import db as jinyiwei_db
from app.jinyiwei.models import DataGapRequest
from app.shiguan import db, maintenance, storage
from app.shiguan.errors import ArchiveNotFoundError, ShiguanStorageError

V1_SCHEMA = """
CREATE TABLE archives (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
    content TEXT NOT NULL, matter_type TEXT NOT NULL, department TEXT NOT NULL,
    created_at TEXT NOT NULL, lessons_learned TEXT, pitfalls TEXT,
    participating_departments TEXT, decision_process TEXT,
    decision_conclusion TEXT, decision_time TEXT, responsible_owner TEXT
);
CREATE TABLE archive_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT, archive_id TEXT NOT NULL,
    source TEXT NOT NULL, reality_label TEXT NOT NULL, note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
CREATE TABLE archive_relations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, archive_id TEXT NOT NULL,
    related_id TEXT NOT NULL, UNIQUE (archive_id, related_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id),
    FOREIGN KEY (related_id) REFERENCES archives(id)
);
CREATE TABLE archive_review_status (
    archive_id TEXT PRIMARY KEY, status TEXT NOT NULL, reviewed_at TEXT NOT NULL,
    note TEXT, FOREIGN KEY (archive_id) REFERENCES archives(id)
);
PRAGMA user_version = 1;
"""

JINYIWEI_V1_SCHEMA = """
CREATE TABLE data_gap_requests (
    request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
    requesting_agent TEXT NOT NULL, question TEXT NOT NULL,
    decision_context TEXT NOT NULL, freshness_json TEXT NOT NULL,
    existing_evidence_ids_json TEXT NOT NULL, timeout_seconds INTEGER NOT NULL,
    source_scope_json TEXT NOT NULL, canonical_json TEXT NOT NULL
);
CREATE TABLE requested_fact_slots (
    request_id TEXT NOT NULL, ordinal INTEGER NOT NULL, fact_key TEXT NOT NULL,
    description TEXT NOT NULL, expected_unit TEXT, expected_shape TEXT,
    PRIMARY KEY (request_id, ordinal), UNIQUE (request_id, fact_key),
    FOREIGN KEY (request_id) REFERENCES data_gap_requests(request_id)
);
PRAGMA user_version = 1;
"""


def _make_v1(path, *, archive_type="DECISION", related_id="memorial-1"):
    conn = sqlite3.connect(path)
    conn.executescript(V1_SCHEMA)
    common = ("赈灾", "户部", "2026-07-17T09:00:00+00:00", None, None)
    conn.execute(
        "INSERT INTO archives VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("memorial-1", "MEMORIAL", "旨意原文", "请赈济灾民", *common, None, None, None, None, None),
    )
    conn.execute(
        "INSERT INTO archives VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "decision-1", archive_type, "办理回奏", "办理结果", "赈灾", "丞相府",
            "2026-07-17T10:00:00+00:00", "经验", "风险",
            json.dumps(["户部"], ensure_ascii=False), "办理过程", "准奏",
            "2026-07-17T10:00:00+00:00", "丞相",
        ),
    )
    conn.execute(
        "INSERT INTO archive_relations (archive_id, related_id) VALUES (?, ?)",
        ("decision-1", related_id),
    )
    conn.execute(
        "INSERT INTO archive_evidence (archive_id, source, reality_label) VALUES (?, ?, ?)",
        ("memorial-1", "原旨", "LIVE"),
    )
    conn.execute(
        "INSERT INTO archive_review_status VALUES (?, ?, ?, ?)",
        ("memorial-1", "OBSERVING", "2026-07-17T11:00:00+00:00", None),
    )
    conn.commit()
    conn.close()


def _snapshot(path):
    conn = sqlite3.connect(path)
    try:
        return {
            "version": conn.execute("PRAGMA user_version").fetchone()[0],
            "archives": conn.execute("SELECT * FROM archives ORDER BY id").fetchall(),
            "relations": conn.execute("SELECT * FROM archive_relations ORDER BY seq").fetchall(),
        }
    finally:
        conn.close()


def _jinyiwei_request() -> DataGapRequest:
    return DataGapRequest.model_validate(
        {
            "request_id": "request-1",
            "requesting_agent": "hubu",
            "question": "比亚迪当前股价是多少？",
            "required_facts": [
                {
                    "key": "quote",
                    "description": "Current BYD share price",
                    "category": "MARKET_QUOTE",
                    "data_scope": "EXTERNAL_PUBLIC",
                    "subject": "002594.SZ",
                    "jurisdiction": "CN",
                    "expected_unit": "CNY",
                    "expected_shape": "number",
                    "market_metric": "LAST_PRICE",
                }
            ],
            "decision_context": "Investment briefing",
            "freshness": {"max_age_seconds": 60},
            "timeout_seconds": 30,
            "source_scope": ["SHIGUAN", "MCP"],
        }
    )


def _make_jinyiwei_v1(path, *, canonical_json: str | None = None) -> None:
    request = _jinyiwei_request()
    canonical = canonical_json or request.model_dump_json()
    connection = sqlite3.connect(path)
    connection.executescript(JINYIWEI_V1_SCHEMA)
    _insert_jinyiwei_v1_request(connection, request, canonical)
    connection.commit()
    connection.close()


def _insert_jinyiwei_v1_request(connection, request, canonical_json=None) -> None:
    canonical = canonical_json or request.model_dump_json()
    connection.execute(
        "INSERT INTO data_gap_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            request.request_id,
            request.request_fingerprint,
            request.requesting_agent,
            request.question,
            request.decision_context,
            json.dumps(request.freshness.model_dump(mode="json")),
            "[]",
            request.timeout_seconds,
            json.dumps([item.value for item in request.source_scope]),
            canonical,
        ),
    )
    fact = request.required_facts[0]
    connection.execute(
        "INSERT INTO requested_fact_slots VALUES (?, ?, ?, ?, ?, ?)",
        (
            request.request_id,
            0,
            fact.key,
            fact.description,
            fact.expected_unit,
            fact.expected_shape,
        ),
    )


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("question", "CORRUPT"),
        ("fingerprint", "0" * 64),
        ("freshness_json", '{"max_age_seconds":999}'),
        ("source_scope_json", '["PUBLIC_WEB"]'),
    ],
)
def test_jinyiwei_v1_migration_rejects_divergent_request_columns(
    tmp_path, column, value
):
    path = tmp_path / f"jinyiwei-divergent-{column}.sqlite3"
    _make_jinyiwei_v1(path)
    connection = sqlite3.connect(path)
    connection.execute(f"UPDATE data_gap_requests SET {column} = ?", (value,))
    connection.commit()
    connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="^invalid legacy fact slot$"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
        assert "category" not in {
            row[1]
            for row in connection.execute("PRAGMA table_info(requested_fact_slots)")
        }
    finally:
        connection.close()


def test_jinyiwei_v1_migration_rolls_back_all_rows_when_later_row_is_invalid(
    tmp_path,
):
    path = tmp_path / "jinyiwei-multi-row-invalid.sqlite3"
    first = _jinyiwei_request()
    second = first.model_copy(
        update={"request_id": "request-2", "question": "Second request"}
    )
    connection = sqlite3.connect(path)
    connection.executescript(JINYIWEI_V1_SCHEMA)
    _insert_jinyiwei_v1_request(connection, first)
    _insert_jinyiwei_v1_request(connection, second, "{}")
    connection.commit()
    before = connection.execute(
        "SELECT * FROM requested_fact_slots ORDER BY request_id, ordinal"
    ).fetchall()
    connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="^invalid legacy fact slot$"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
        assert connection.execute(
            "SELECT * FROM requested_fact_slots ORDER BY request_id, ordinal"
        ).fetchall() == before
        assert connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'requested_fact_slots_v2'"
        ).fetchone() is None
    finally:
        connection.close()


def test_jinyiwei_future_schema_version_is_rejected_without_rewrite(tmp_path):
    path = tmp_path / "jinyiwei-future.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA user_version = 5")
    connection.commit()
    connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="unsupported Jinyiwei schema version"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
    finally:
        connection.close()


def test_jinyiwei_incomplete_v2_schema_is_rejected(tmp_path):
    path = tmp_path / "jinyiwei-incomplete-v2.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute(
        "CREATE TABLE requested_fact_slots ("
        "category TEXT, data_scope TEXT, subject TEXT, jurisdiction TEXT)"
    )
    connection.execute("PRAGMA user_version = 2")
    connection.commit()
    connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="invalid Jinyiwei schema v2"):
        jinyiwei_db.initialize_database(path)


def test_jinyiwei_schema_v3_normalizes_required_fact_identity(tmp_path):
    path = tmp_path / "jinyiwei.sqlite3"

    jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(requested_fact_slots)")
        }
        assert {"category", "data_scope", "subject", "jurisdiction"} <= columns
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    finally:
        connection.close()


def test_jinyiwei_v1_migration_strictly_backfills_fact_identity(tmp_path):
    path = tmp_path / "jinyiwei-v1.sqlite3"
    _make_jinyiwei_v1(path)

    jinyiwei_db.initialize_database(path)
    jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT category, data_scope, subject, jurisdiction "
            "FROM requested_fact_slots"
        ).fetchone()
        assert row == ("MARKET_QUOTE", "EXTERNAL_PUBLIC", "002594.SZ", "CN")
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    finally:
        connection.close()


def test_jinyiwei_v1_migration_rolls_back_invalid_legacy_fact_slot(tmp_path):
    path = tmp_path / "jinyiwei-invalid-v1.sqlite3"
    _make_jinyiwei_v1(path, canonical_json="{}")

    with pytest.raises(sqlite3.DatabaseError, match="^invalid legacy fact slot$"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(requested_fact_slots)")
        }
        assert "category" not in columns
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
    finally:
        connection.close()


def test_new_database_is_created_directly_at_schema_v3(tmp_path):
    path = tmp_path / "new.sqlite3"
    conn = db.get_connection(path)
    try:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 3
        columns = {row[1] for row in conn.execute("PRAGMA table_info(archives)")}
        reply_columns = {
            "source_kind",
            "source_text",
            "reply_process",
            "reply_conclusion",
            "reply_time",
            "respondent",
        }
        assert reply_columns <= columns
        assert "decision_process" not in columns
    finally:
        conn.close()


def test_get_connection_fails_closed_for_v1_database(tmp_path):
    path = tmp_path / "legacy.sqlite3"
    _make_v1(path)
    with pytest.raises(ShiguanStorageError, match="显式迁移"):
        db.get_connection(path)


def test_explicit_confirmed_pair_migration_merges_fake_memorial_into_reply(tmp_path):
    path = tmp_path / "legacy.sqlite3"
    _make_v1(path)

    db.migrate_v1_to_v2(path, confirmed_pairs={"decision-1": "memorial-1"})

    db.migrate_v2_to_v3(path)
    reply = storage.get_archive("decision-1", db_path=path)
    assert reply.type == "REPLY"
    assert reply.source_kind == "DECREE"
    assert reply.source_text == "请赈济灾民"
    assert reply.reply_process == "办理过程"
    assert reply.reply_conclusion == "准奏"
    assert reply.reply_time == "2026-07-17T10:00:00+00:00"
    assert reply.respondent == "丞相"
    assert reply.related_archive_ids == []
    with pytest.raises(ArchiveNotFoundError):
        storage.get_archive("memorial-1", db_path=path)

    conn = db.get_connection(path)
    try:
        evidence_count = conn.execute(
            "SELECT COUNT(*) FROM archive_evidence WHERE archive_id = 'memorial-1'"
        ).fetchone()[0]
        review_count = conn.execute(
            "SELECT COUNT(*) FROM archive_review_status WHERE archive_id = 'memorial-1'"
        ).fetchone()[0]
        assert evidence_count == 0
        assert review_count == 0
    finally:
        conn.close()


@pytest.mark.parametrize(
    "confirmed_pairs,mutation",
    [
        ({}, None),
        ({"decision-1": "wrong-memorial"}, None),
        ({"decision-1": "memorial-1"}, "unsupported"),
        ({"decision-1": "memorial-1", "decision-2": "memorial-1"}, "shared"),
    ],
)
def test_invalid_or_incomplete_confirmation_rolls_back_entire_migration(
    tmp_path, confirmed_pairs, mutation
):
    path = tmp_path / "legacy.sqlite3"
    _make_v1(path)
    conn = sqlite3.connect(path)
    if mutation == "unsupported":
        conn.execute("UPDATE archives SET type = 'TASK_RESULT' WHERE id = 'decision-1'")
    elif mutation == "shared":
        conn.execute(
            """INSERT INTO archives
            SELECT 'decision-2', type, title, content, matter_type, department,
                   created_at, lessons_learned, pitfalls, participating_departments,
                   decision_process, decision_conclusion, decision_time, responsible_owner
            FROM archives WHERE id = 'decision-1'"""
        )
        conn.execute(
            "INSERT INTO archive_relations (archive_id, related_id) VALUES (?, ?)",
            ("decision-2", "memorial-1"),
        )
    conn.commit()
    conn.close()
    before = _snapshot(path)

    with pytest.raises(ShiguanStorageError, match="无法迁移"):
        db.migrate_v1_to_v2(path, confirmed_pairs=confirmed_pairs)

    assert _snapshot(path) == before


def _make_v2(path):
    connection = db.get_connection(path)
    connection.close()
    connection = sqlite3.connect(path)
    connection.execute("DROP TABLE archive_evidence_references")
    connection.execute("PRAGMA user_version = 2")
    connection.commit()
    connection.close()


def test_runtime_preflight_reports_healthy_v2_as_not_ready(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _make_v2(path)

    report = maintenance.inspect_runtime_database(path)

    assert report.exists is True
    assert report.version == 2
    assert report.integrity_ok is True
    assert report.required_tables_ok is False
    assert report.ready is False


def test_runtime_migration_backs_up_v2_and_reads_archives(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _make_v2(path)

    report = maintenance.migrate_runtime_v2_to_v3(path)

    backup = path.with_name("shiguan.sqlite3.v2-backup")
    assert report.ready is True
    assert report.migrated is True
    assert report.backup_path == str(backup)
    assert backup.exists()
    assert storage.list_archives(db_path=path) == []


def test_runtime_migration_refuses_to_overwrite_existing_backup(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _make_v2(path)
    path.with_name("shiguan.sqlite3.v2-backup").write_bytes(b"backup")

    with pytest.raises(ShiguanStorageError, match="备份已存在"):
        maintenance.migrate_runtime_v2_to_v3(path)

    assert maintenance.inspect_runtime_database(path).version == 2


def test_maintenance_check_emits_desensitized_json(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    db.get_connection(path).close()

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.shiguan.maintenance",
            "--check",
            "--database",
            str(path),
        ],
        capture_output=True,
        check=False,
        text=True,
    )

    payload = json.loads(result.stdout)
    assert result.returncode == 0
    assert payload["ready"] is True
    assert set(payload) == {
        "archive_count",
        "backup_path",
        "database_path",
        "exists",
        "integrity_ok",
        "migrated",
        "ready",
        "required_tables_ok",
        "version",
    }
