"""Schema-v1 to schema-v2 migration safety tests."""

from __future__ import annotations

import hashlib
import json
import secrets
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from app.jinyiwei import db as jinyiwei_db
from app.jinyiwei.models import DataGapRequest
from app.shiguan import db, maintenance, storage
from app.shiguan.errors import ShiguanStorageError

BACKEND_ROOT = Path(__file__).resolve().parents[1]

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

REAL_HISTORICAL_V1_BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS archives (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL,
    lessons_learned TEXT,
    pitfalls TEXT,
    participating_departments TEXT,
    decision_process TEXT,
    decision_conclusion TEXT,
    decision_time TEXT,
    responsible_owner TEXT
);
CREATE TABLE IF NOT EXISTS archive_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    source TEXT NOT NULL,
    reality_label TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS archive_relations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    UNIQUE (archive_id, related_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id),
    FOREIGN KEY (related_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS archive_review_status (
    archive_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
"""

REAL_HISTORICAL_V1_AUTH_SCHEMA = """
CREATE TABLE IF NOT EXISTS archives (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL,
    lessons_learned TEXT,
    pitfalls TEXT,
    participating_departments TEXT,
    decision_process TEXT,
    decision_conclusion TEXT,
    decision_time TEXT,
    responsible_owner TEXT,
    owner_user_id TEXT
);
CREATE TABLE IF NOT EXISTS archive_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    source TEXT NOT NULL,
    reality_label TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS archive_relations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    UNIQUE (archive_id, related_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id),
    FOREIGN KEY (related_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS archive_review_status (
    archive_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (archive_id) REFERENCES archives(id)
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
ON auth_sessions (id, user_id, expires_at)
WHERE revoked_at IS NULL;
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


def _parse_maintenance_result(result: subprocess.CompletedProcess[str]) -> dict:
    if result.returncode != 0:
        stderr_bytes = result.stderr.encode("utf-8")
        stderr_sha256 = hashlib.sha256(stderr_bytes).hexdigest()
        raise AssertionError(
            "maintenance subprocess failed; "
            f"returncode={result.returncode}; "
            f"stderr_utf8_bytes={len(stderr_bytes)}; "
            f"stderr_sha256={stderr_sha256}"
        )
    if not result.stdout.strip():
        raise AssertionError("maintenance subprocess succeeded but stdout was empty")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            "maintenance subprocess succeeded but stdout was not valid JSON"
        ) from exc


def _run_maintenance_check(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
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
        cwd=BACKEND_ROOT,
        text=True,
    )


def test_parse_maintenance_result_reports_nonzero_without_stderr_body():
    stderr = (
        'Traceback: File "/srv/private/app.py", line 7\n'
        "failed opening \\\\server\\private\\shiguan.sqlite3\n"
        "Authorization: Bearer bearer-secret\n"
        "token=sk-super-secret\n"
        "DATABASE_URL=postgresql://user:database-password@db.example/app\n"
        "failed opening C:\\private\\shiguan.sqlite3\n"
        "非 ASCII 密钥"
    )
    stderr_bytes = stderr.encode("utf-8")
    result = subprocess.CompletedProcess(
        args=["maintenance"],
        returncode=7,
        stdout="",
        stderr=stderr,
    )

    with pytest.raises(AssertionError) as exc_info:
        _parse_maintenance_result(result)

    message = str(exc_info.value)
    assert message == (
        "maintenance subprocess failed; returncode=7; "
        f"stderr_utf8_bytes={len(stderr_bytes)}; "
        f"stderr_sha256={hashlib.sha256(stderr_bytes).hexdigest()}"
    )
    for sensitive_fragment in (
        "/srv/private/app.py",
        "server",
        "shiguan.sqlite3",
        "Bearer",
        "bearer-secret",
        "sk-super-secret",
        "postgresql",
        "database-password",
        "C:\\private",
        "非 ASCII 密钥",
    ):
        assert sensitive_fragment not in message


def test_parse_maintenance_result_parses_successful_json():
    result = subprocess.CompletedProcess(
        args=["maintenance"],
        returncode=0,
        stdout='{"ready": true}',
        stderr="",
    )

    assert _parse_maintenance_result(result) == {"ready": True}


@pytest.mark.parametrize(
    ("stdout", "message"),
    [
        ("", "maintenance subprocess succeeded but stdout was empty"),
        (
            "not-json",
            "maintenance subprocess succeeded but stdout was not valid JSON",
        ),
    ],
)
def test_parse_maintenance_result_reports_stable_success_output_errors(stdout, message):
    result = subprocess.CompletedProcess(
        args=["maintenance"],
        returncode=0,
        stdout=stdout,
        stderr="ignored because the subprocess succeeded",
    )

    with pytest.raises(AssertionError, match=f"^{message}$"):
        _parse_maintenance_result(result)


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
            "decision-1",
            archive_type,
            "办理回奏",
            "办理结果",
            "赈灾",
            "丞相府",
            "2026-07-17T10:00:00+00:00",
            "经验",
            "风险",
            json.dumps(["户部"], ensure_ascii=False),
            "办理过程",
            "准奏",
            "2026-07-17T10:00:00+00:00",
            "丞相",
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
def test_jinyiwei_v1_migration_rejects_divergent_request_columns(tmp_path, column, value):
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
            row[1] for row in connection.execute("PRAGMA table_info(requested_fact_slots)")
        }
    finally:
        connection.close()


def test_jinyiwei_v1_migration_rolls_back_all_rows_when_later_row_is_invalid(
    tmp_path,
):
    path = tmp_path / "jinyiwei-multi-row-invalid.sqlite3"
    first = _jinyiwei_request()
    second = first.model_copy(update={"request_id": "request-2", "question": "Second request"})
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
        assert (
            connection.execute(
                "SELECT * FROM requested_fact_slots ORDER BY request_id, ordinal"
            ).fetchall()
            == before
        )
        assert (
            connection.execute(
                "SELECT name FROM sqlite_master WHERE name = 'requested_fact_slots_v2'"
            ).fetchone()
            is None
        )
    finally:
        connection.close()


def test_jinyiwei_future_schema_version_is_rejected_without_rewrite(tmp_path):
    path = tmp_path / "jinyiwei-future.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE future_marker (value TEXT NOT NULL)")
    connection.execute("INSERT INTO future_marker VALUES ('preserve-me')")
    connection.execute("PRAGMA user_version = 6")
    connection.commit()
    schema_before = connection.execute(
        "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
    ).fetchall()
    connection.close()

    with pytest.raises(sqlite3.DatabaseError, match="unsupported Jinyiwei schema version"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 6
        assert (
            connection.execute(
                "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
            ).fetchall()
            == schema_before
        )
        assert connection.execute("SELECT value FROM future_marker").fetchone() == (
            "preserve-me",
        )
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
        columns = {row[1] for row in connection.execute("PRAGMA table_info(requested_fact_slots)")}
        assert {"category", "data_scope", "subject", "jurisdiction"} <= columns
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        request_info = {
            row[1]: row for row in connection.execute("PRAGMA table_info(data_gap_requests)")
        }
        cache_info = {
            row[1]: row for row in connection.execute("PRAGMA table_info(cache_entries)")
        }
        assert request_info["owner_user_id"][3] == 0
        assert cache_info["owner_user_id"][3] == 1
        assert cache_info["owner_user_id"][5] == 1
        assert cache_info["fingerprint"][5] == 2
        assert tuple(
            row[2]
            for row in connection.execute(
                "PRAGMA index_info(data_gap_requests_owner_idx)"
            )
        ) == ("owner_user_id",)
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
            "SELECT category, data_scope, subject, jurisdiction FROM requested_fact_slots"
        ).fetchone()
        assert row == ("MARKET_QUOTE", "EXTERNAL_PUBLIC", "002594.SZ", "CN")
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert connection.execute(
            "SELECT owner_user_id FROM data_gap_requests WHERE request_id = 'request-1'"
        ).fetchone() == (None,)
    finally:
        connection.close()


def test_jinyiwei_v1_migration_rolls_back_invalid_legacy_fact_slot(tmp_path):
    path = tmp_path / "jinyiwei-invalid-v1.sqlite3"
    _make_jinyiwei_v1(path, canonical_json="{}")

    with pytest.raises(sqlite3.DatabaseError, match="^invalid legacy fact slot$"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(requested_fact_slots)")}
        assert "category" not in columns
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
    finally:
        connection.close()


def test_jinyiwei_v1_to_v5_failure_rolls_back_entire_chain(tmp_path, monkeypatch):
    path = tmp_path / "jinyiwei-v1-forced-failure.sqlite3"
    _make_jinyiwei_v1(path)
    connection = sqlite3.connect(path)
    schema_before = connection.execute(
        "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
    ).fetchall()
    rows_before = connection.execute(
        "SELECT * FROM requested_fact_slots ORDER BY request_id, ordinal"
    ).fetchall()
    connection.close()

    def fail_v5_assertion(_connection):
        raise sqlite3.DatabaseError("forced v5 assertion failure")

    monkeypatch.setattr(jinyiwei_db, "_assert_v5_schema", fail_v5_assertion)

    with pytest.raises(sqlite3.DatabaseError, match="^forced v5 assertion failure$"):
        jinyiwei_db.initialize_database(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
        assert (
            connection.execute(
                "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
            ).fetchall()
            == schema_before
        )
        assert (
            connection.execute(
                "SELECT * FROM requested_fact_slots ORDER BY request_id, ordinal"
            ).fetchall()
            == rows_before
        )
        assert connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE name LIKE '%_v5' OR name = 'data_gap_requests_owner_idx'"
        ).fetchall() == []
    finally:
        connection.close()


def test_new_database_is_created_directly_at_verified_schema_v7(tmp_path):
    path = tmp_path / "new.sqlite3"
    conn = db.get_connection(path)
    try:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 7
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
        assert conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='archive_decisions'"
        ).fetchone()[0] == "archive_decisions"
        assert [
            tuple(row)
            for row in conn.execute("PRAGMA table_info(tenants)").fetchall()
        ] == [
            (0, "id", "TEXT", 0, None, 1),
            (1, "kind", "TEXT", 1, None, 0),
            (2, "created_at", "TEXT", 1, None, 0),
        ]
        assert [row[1] for row in conn.execute("PRAGMA table_info(tenant_memberships)")] == [
            "id",
            "user_id",
            "tenant_id",
            "role",
            "created_at",
            "revoked_at",
        ]
        assert [row[1] for row in conn.execute("PRAGMA table_info(auth_sessions)")] == [
            "id",
            "user_id",
            "membership_id",
            "created_at",
            "expires_at",
            "revoked_at",
        ]
        assert conn.execute(
            "SELECT status, verified_at FROM schema_migration_verification WHERE id=1"
        ).fetchone()[0] == "VERIFIED"
        trigger_names = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='trigger'"
            )
        }
        assert trigger_names == {
            "archive_decisions_no_delete",
            "archive_decisions_no_update",
            "auth_sessions_guard_insert",
            "auth_sessions_guard_update",
            "outcome_events_guard_insert",
            "outcome_events_no_delete",
            "outcome_events_no_update",
            "schema_migration_verification_guard_insert",
            "schema_migration_verification_guard_update",
            "schema_migration_verification_no_delete",
            "tenant_memberships_guard_insert",
            "tenant_memberships_guard_update",
            "tenant_memberships_no_delete",
            "tenants_guard_insert",
            "tenants_guard_update",
            "tenants_no_delete",
        }
    finally:
        conn.close()


def _make_verified_v6(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.executescript(db._V6_SCHEMA_STATEMENTS)
        connection.commit()
    finally:
        connection.close()


def test_runtime_v6_to_v7_uses_verified_backup_and_publishes_current_schema(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v6.sqlite3"
    _make_verified_v6(path)
    monkeypatch.setattr(
        maintenance,
        "_copy_backup",
        lambda *_args: (_ for _ in ()).throw(AssertionError("raw copy forbidden")),
    )

    report = maintenance.migrate_runtime_v6_to_v7(path)

    backup = path.with_name("schema-v6.sqlite3.v6-backup")
    assert report.version == 7
    assert report.ready is True
    assert report.migrated is True
    assert report.backup_path == str(backup)
    assert report.archive_count == 0
    assert backup.stat().st_mode & 0o777 == 0o600
    with sqlite3.connect(backup) as backup_connection:
        assert backup_connection.execute("PRAGMA user_version").fetchone() == (6,)
        db._validate_v6_schema(backup_connection)
    with db.get_connection(path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 7
        assert connection.execute("SELECT COUNT(*) FROM outcome_events").fetchone()[0] == 0


def test_runtime_v6_to_v7_path_replacement_keeps_all_inodes_pending_and_unrunnable(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v6-path-replacement.sqlite3"
    displaced = tmp_path / "schema-v7-original-inode.sqlite3"
    replacement = tmp_path / "schema-v7-replacement-inode.sqlite3"
    _make_verified_v6(path)
    real_inspect = maintenance._inspect_runtime_connection
    replaced = False

    def _replace_before_final_report(connection, *, database_path):
        nonlocal replaced
        if Path(database_path) == path and not replaced:
            shutil.copy2(path, replacement)
            path.rename(displaced)
            replacement.rename(path)
            replaced = True
        return real_inspect(connection, database_path=database_path)

    monkeypatch.setattr(
        maintenance, "_inspect_runtime_connection", _replace_before_final_report
    )

    with pytest.raises(ShiguanStorageError):
        maintenance.migrate_runtime_v6_to_v7(path)
    assert replaced is True
    for candidate in (path, displaced):
        with sqlite3.connect(candidate) as connection:
            assert connection.execute(
                "SELECT status, verified_at FROM schema_migration_verification WHERE id=1"
            ).fetchone() == ("PENDING_VERIFICATION", None)
        with pytest.raises(ShiguanStorageError, match="验证"):
            db.get_connection(candidate)


def test_runtime_v6_to_v7_report_materialization_failure_keeps_database_pending(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v6-report-materialization.sqlite3"
    _make_verified_v6(path)
    real_to_payload = maintenance.RuntimeDatabaseReport.to_payload

    def _fail_pending_v7_report(report):
        if report.version == 7 and not report.ready:
            raise RuntimeError("report materialization failed")
        return real_to_payload(report)

    monkeypatch.setattr(
        maintenance.RuntimeDatabaseReport, "to_payload", _fail_pending_v7_report
    )

    with pytest.raises(RuntimeError, match="report materialization failed"):
        maintenance.migrate_runtime_v6_to_v7(path)
    with sqlite3.connect(path) as connection:
        assert connection.execute(
            "SELECT status, verified_at FROM schema_migration_verification WHERE id=1"
        ).fetchone() == ("PENDING_VERIFICATION", None)
    with pytest.raises(ShiguanStorageError, match="验证"):
        db.get_connection(path)


def test_direct_v6_to_v7_is_pending_until_maintenance_readback(tmp_path):
    path = tmp_path / "schema-v6-direct.sqlite3"
    _make_verified_v6(path)

    db.migrate_v6_to_v7(path)

    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone() == (7,)
        assert connection.execute(
            "SELECT status, verified_at FROM schema_migration_verification WHERE id=1"
        ).fetchone() == ("PENDING_VERIFICATION", None)
    with pytest.raises(ShiguanStorageError, match="验证"):
        db.get_connection(path)


def _make_v5_with_principal_data(path):
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(db._V5_SCHEMA_STATEMENTS)
    connection.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?, ?)",
        (
            "user-1",
            "court",
            "court@example.com",
            "password-hash",
            "2026-08-28T00:00:00+00:00",
        ),
    )
    connection.execute(
        "INSERT INTO auth_sessions VALUES (?, ?, ?, ?, NULL)",
        (
            "session-1",
            "user-1",
            "2026-08-28T00:00:00+00:00",
            "2026-08-29T00:00:00+00:00",
        ),
    )
    connection.execute(
        "INSERT INTO archives "
        "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
        "VALUES ('archive-1', 'MEMORIAL', 'title', 'content', 'matter', '户部', "
        "'2026-08-28T00:00:00+00:00', 'user-1')"
    )
    connection.execute(
        "INSERT INTO archive_decisions VALUES "
        "('archive-1', 'user-1', 'user-1', 'APPROVED', "
        "'2026-08-28T01:00:00+00:00')"
    )
    connection.commit()
    connection.close()


def _add_v5_user_with_cross_principal_identifier_collision(
    path, *, first_username: str, second_email: str
) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE users SET username = ? WHERE id = 'user-1'",
            (first_username,),
        )
        connection.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?, ?)",
            (
                "user-2",
                "other",
                second_email,
                "password-hash-2",
                "2026-08-28T00:00:00+00:00",
            ),
        )
        connection.commit()
    finally:
        connection.close()


@pytest.mark.parametrize("entrypoint", ["direct", "maintenance"])
@pytest.mark.parametrize(
    ("first_username", "second_email"),
    [
        ("court", "court"),
        ("court", " COURT "),
        ("straße", "STRASSE"),
    ],
)
def test_v5_to_v6_rejects_cross_principal_identifier_ambiguity_before_writes(
    tmp_path, entrypoint, first_username, second_email
):
    path = tmp_path / (
        f"schema-v5-ambiguous-{entrypoint}-{first_username.encode().hex()}.sqlite3"
    )
    _make_v5_with_principal_data(path)
    _add_v5_user_with_cross_principal_identifier_collision(
        path,
        first_username=first_username,
        second_email=second_email,
    )
    bytes_before = path.read_bytes()
    with sqlite3.connect(path) as connection:
        rows_before = connection.execute(
            "SELECT id, username, email FROM users ORDER BY id"
        ).fetchall()

    with pytest.raises(ShiguanStorageError):
        if entrypoint == "direct":
            db.migrate_v5_to_v6(path)
        else:
            maintenance.migrate_runtime_v5_to_v6(path)

    assert path.read_bytes() == bytes_before
    assert not path.with_name(f"{path.name}.v5-backup").exists()
    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone() == (5,)
        assert connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'"
        ).fetchone() is None
        assert connection.execute(
            "SELECT id, username, email FROM users ORDER BY id"
        ).fetchall() == rows_before
    finally:
        connection.close()


def test_v5_to_v6_allows_same_principal_to_share_one_identifier_key(tmp_path):
    from app.auth.passwords import hash_password
    from app.auth.storage import authenticate_and_create_session, configure_auth_db

    login_value = secrets.token_urlsafe(32)
    path = tmp_path / "schema-v5-same-principal-identifier.sqlite3"
    _make_v5_with_principal_data(path)
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE users SET username = ?, email = ?, password_hash = ? WHERE id = ?",
            (
                "same@example.test",
                " SAME@EXAMPLE.TEST ",
                hash_password(login_value),
                "user-1",
            ),
        )
        connection.commit()
    finally:
        connection.close()

    report = maintenance.migrate_runtime_v5_to_v6(path)

    assert report.ready is False
    maintenance.migrate_runtime_v6_to_v7(path)
    configure_auth_db(path)
    try:
        authenticated = authenticate_and_create_session("same@example.test", login_value)
    finally:
        configure_auth_db(None)
    assert authenticated is not None
    principal, _session_id = authenticated
    assert principal.id == "user-1"


def _make_real_historical_v1(path, *, evolved_from_base):
    connection = sqlite3.connect(path)
    if evolved_from_base:
        connection.executescript(REAL_HISTORICAL_V1_BASE_SCHEMA)
        connection.executescript(REAL_HISTORICAL_V1_AUTH_SCHEMA)
        connection.execute("ALTER TABLE archives ADD COLUMN owner_user_id TEXT")
    else:
        connection.executescript(REAL_HISTORICAL_V1_AUTH_SCHEMA)
    connection.execute(
        "INSERT INTO users VALUES (?,?,?,?,?)",
        ("u1", "court", "court@example.test", "hash", "2026-01-01"),
    )
    connection.execute(
        "INSERT INTO auth_sessions VALUES (?,?,?,?,?)",
        ("s1", "u1", "2026-01-01", "2027-01-01", None),
    )
    connection.executemany(
        "INSERT INTO archives VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                "m1",
                "MEMORIAL",
                "m",
                "decree text",
                "matter",
                "户部",
                "2026-01-01",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "u1",
            ),
            (
                "d1",
                "DECISION",
                "d",
                "reply",
                "matter",
                "户部",
                "2026-01-01",
                None,
                None,
                None,
                "process",
                "done",
                "2026-01-02",
                "丞相",
                "u1",
            ),
        ],
    )
    connection.execute(
        "INSERT INTO archive_relations (archive_id, related_id) VALUES (?,?)",
        ("d1", "m1"),
    )
    connection.execute("PRAGMA user_version = 1")
    connection.commit()
    connection.close()


@pytest.mark.parametrize(
    ("evolved_from_base", "expected_v5_digest"),
    [
        (
            False,
            "sha256:5e94f8c4540705e1bce67e012af857691aa6d9bb3b4e7ce77e332dc1ece5077f",
        ),
        (
            True,
            "sha256:0fba339d71e9e0eea0c5605a4b9b2fb49f919c9d7504242660cf6a83eb1c2b8e",
        ),
    ],
)
def test_real_historical_v1_layouts_migrate_to_verified_v7(
    tmp_path, evolved_from_base, expected_v5_digest
):
    from app.operations.runtime_data_registry import schema_contract_digest

    path = tmp_path / "real-historical-v1.sqlite3"
    _make_real_historical_v1(path, evolved_from_base=evolved_from_base)
    db.migrate_v1_to_v2(path, confirmed_pairs={"d1": "m1"})
    db.migrate_v2_to_v3(path)
    db.migrate_v3_to_v4(path)
    db.migrate_v4_to_v5(path)
    assert schema_contract_digest(path) == expected_v5_digest

    intermediate = maintenance.migrate_runtime_v5_to_v6(path)
    assert intermediate.version == 6
    assert intermediate.ready is False
    report = maintenance.migrate_runtime_v6_to_v7(path)

    assert report.ready is True
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone() == (1,)
        assert connection.execute(
            "SELECT status FROM schema_migration_verification WHERE id=1"
        ).fetchone() == ("VERIFIED",)


def test_v5_to_v6_backfills_one_personal_owner_membership_and_binds_sessions(tmp_path):
    path = tmp_path / "schema-v5.sqlite3"
    _make_v5_with_principal_data(path)

    db.migrate_v5_to_v6(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 6
        assert connection.execute(
            "SELECT kind FROM tenants"
        ).fetchall() == [("PERSONAL",)]
        membership = connection.execute(
            "SELECT id, user_id, tenant_id, role, revoked_at FROM tenant_memberships"
        ).fetchone()
        assert membership[1:] == ("user-1", membership[2], "OWNER", None)
        assert connection.execute(
            "SELECT user_id, membership_id FROM auth_sessions"
        ).fetchall() == [("user-1", membership[0])]
        assert connection.execute(
            "SELECT status, verified_at FROM schema_migration_verification WHERE id=1"
        ).fetchone() == ("PENDING_VERIFICATION", None)
        assert connection.execute(
            "SELECT id, owner_user_id FROM archives"
        ).fetchall() == [("archive-1", "user-1")]
        assert connection.execute(
            "SELECT archive_id, decision FROM archive_decisions"
        ).fetchall() == [("archive-1", "APPROVED")]
    finally:
        connection.close()

    with pytest.raises(ShiguanStorageError, match="显式迁移"):
        db.get_connection(path)


def test_v5_to_v6_precommit_failure_restores_exact_v5_schema_and_rows(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v5-failure.sqlite3"
    _make_v5_with_principal_data(path)
    before = sqlite3.connect(path)
    try:
        schema_before = before.execute(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
        ).fetchall()
        rows_before = before.execute("SELECT * FROM auth_sessions").fetchall()
    finally:
        before.close()

    monkeypatch.setattr(
        db,
        "_validate_v6_schema",
        lambda _connection: (_ for _ in ()).throw(ValueError("forced")),
        raising=False,
    )
    with pytest.raises(ShiguanStorageError, match="v5 到 v6"):
        db.migrate_v5_to_v6(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert connection.execute(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
        ).fetchall() == schema_before
        assert connection.execute("SELECT * FROM auth_sessions").fetchall() == rows_before
    finally:
        connection.close()


def test_v6_constraints_make_membership_identity_immutable_and_revocation_one_way(
    tmp_path,
):
    path = tmp_path / "constraints.sqlite3"
    connection = db.get_connection(path)
    try:
        connection.execute(
            "INSERT INTO users VALUES ('user-1','court','court@example.com','hash','now')"
        )
        connection.execute(
            "INSERT INTO tenants VALUES ('tenant-1','PERSONAL','now')"
        )
        connection.execute(
            "INSERT INTO tenant_memberships VALUES "
            "('membership-1','user-1','tenant-1','OWNER','now',NULL)"
        )
        connection.commit()
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE tenant_memberships SET tenant_id='tenant-2' WHERE id='membership-1'"
            )
        connection.execute(
            "UPDATE tenant_memberships SET revoked_at='later' WHERE id='membership-1'"
        )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE tenant_memberships SET revoked_at=NULL WHERE id='membership-1'"
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "DELETE FROM tenant_memberships WHERE id='membership-1'"
            )
    finally:
        connection.close()


def test_v6_constraints_reject_replace_reactivation_and_session_rebinding(tmp_path):
    path = tmp_path / "replace-constraints.sqlite3"
    connection = db.get_connection(path)
    try:
        connection.executescript(
            """
            INSERT INTO users VALUES ('user-1','court','court@example.com','hash','now');
            INSERT INTO users VALUES ('user-2','court2','court2@example.com','hash','now');
            INSERT INTO tenants VALUES ('tenant-1','PERSONAL','now');
            INSERT INTO tenants VALUES ('tenant-2','PERSONAL','now');
            INSERT INTO tenant_memberships VALUES
                ('membership-1','user-1','tenant-1','OWNER','now',NULL);
            INSERT INTO tenant_memberships VALUES
                ('membership-2','user-2','tenant-2','OWNER','now',NULL);
            INSERT INTO auth_sessions VALUES
                ('session-1','user-1','membership-1','now','later',NULL);
            UPDATE tenant_memberships SET revoked_at='revoked' WHERE id='membership-1';
            """
        )
        connection.commit()

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT OR REPLACE INTO tenant_memberships VALUES "
                "('membership-1','user-1','tenant-1','OWNER','now',NULL)"
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT OR REPLACE INTO auth_sessions VALUES "
                "('session-1','user-2','membership-2','now','later',NULL)"
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT OR REPLACE INTO tenants VALUES "
                "('tenant-1','PERSONAL','changed')"
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE auth_sessions SET expires_at='extended' WHERE id='session-1'"
            )

        assert tuple(connection.execute(
            "SELECT user_id, tenant_id, revoked_at FROM tenant_memberships "
            "WHERE id='membership-1'"
        ).fetchone()) == ("user-1", "tenant-1", "revoked")
        assert tuple(connection.execute(
            "SELECT user_id, membership_id FROM auth_sessions WHERE id='session-1'"
        ).fetchone()) == ("user-1", "membership-1")
        assert tuple(connection.execute(
            "SELECT created_at FROM tenants WHERE id='tenant-1'"
        ).fetchone()) == ("now",)
        indexes = {
            row[1]: tuple(
                item[2]
                for item in connection.execute(f"PRAGMA index_info({row[1]})")
            )
            for row in connection.execute("PRAGMA index_list(auth_sessions)")
        }
        assert indexes["idx_auth_sessions_active_user"][0] == "user_id"
        assert indexes["idx_auth_sessions_membership_user"] == (
            "membership_id",
            "user_id",
        )
    finally:
        connection.close()


@pytest.mark.parametrize("verified_at", ["", "   "])
def test_v6_rejects_blank_verified_timestamp_consistently(tmp_path, verified_at):
    path = tmp_path / "blank-verification.sqlite3"
    connection = sqlite3.connect(path)
    pending_script = db._V6_SCHEMA_STATEMENTS.replace(
        "VALUES (1, 'VERIFIED', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));",
        "VALUES (1, 'PENDING_VERIFICATION', NULL);",
    )
    connection.executescript(pending_script)
    connection.execute("PRAGMA ignore_check_constraints = ON")
    connection.execute(
        "UPDATE schema_migration_verification SET status='VERIFIED', verified_at=?",
        (verified_at,),
    )
    connection.commit()
    connection.close()

    with pytest.raises(ShiguanStorageError, match="显式迁移"):
        db.get_connection(path)
    assert maintenance.inspect_runtime_database(path).ready is False


def test_get_connection_rejects_schema_drift_without_repairing_it(tmp_path):
    path = tmp_path / "schema-drift.sqlite3"
    db.get_connection(path).close()
    connection = sqlite3.connect(path)
    connection.execute("ALTER TABLE archives DROP COLUMN respondent")
    connection.commit()
    before = connection.execute(
        "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
    ).fetchall()
    connection.close()

    with pytest.raises(ShiguanStorageError):
        db.get_connection(path)

    readback = sqlite3.connect(path)
    try:
        after = readback.execute(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
        ).fetchall()
        assert after == before
        assert "respondent" not in {
            row[1] for row in readback.execute("PRAGMA table_info(archives)")
        }
    finally:
        readback.close()


def test_get_connection_rejects_nonempty_unknown_database_without_writing_identity(tmp_path):
    path = tmp_path / "forged.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE unrelated (id TEXT PRIMARY KEY)")
    connection.commit()
    connection.close()

    with pytest.raises(ShiguanStorageError):
        db.get_connection(path)

    readback = sqlite3.connect(path)
    try:
        tables = {
            row[0]
            for row in readback.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        assert tables == {"unrelated"}
        assert readback.execute("PRAGMA user_version").fetchone()[0] == 0
    finally:
        readback.close()


def test_v4_to_v5_preserves_archives_and_adds_empty_decision_table(tmp_path):
    path = tmp_path / "schema-v4.sqlite3"
    connection = sqlite3.connect(path)
    connection.executescript(db._V5_SCHEMA_STATEMENTS)
    connection.execute(
        "INSERT INTO archives "
        "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
        "VALUES ('archive-1', 'MEMORIAL', 'title', 'content', 'matter', '户部', "
        "'2026-08-09T00:00:00+00:00', 'owner-1')"
    )
    connection.commit()
    connection.execute("DROP TABLE IF EXISTS archive_decisions")
    connection.execute("PRAGMA user_version = 4")
    connection.commit()
    connection.close()

    db.migrate_v4_to_v5(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert connection.execute(
            "SELECT id, owner_user_id FROM archives WHERE id = 'archive-1'"
        ).fetchone() == ("archive-1", "owner-1")
        assert connection.execute("SELECT COUNT(*) FROM archive_decisions").fetchone()[0] == 0
    finally:
        connection.close()


def test_v4_to_v5_failure_rolls_back_schema_and_version(tmp_path, monkeypatch):
    path = tmp_path / "schema-v4-failure.sqlite3"
    connection = sqlite3.connect(path)
    connection.executescript(db._V5_SCHEMA_STATEMENTS)
    connection.execute("DROP TABLE IF EXISTS archive_decisions")
    connection.execute("PRAGMA user_version = 4")
    connection.commit()
    connection.close()

    def fail_validation(_connection):
        raise ValueError("forced validation failure")

    monkeypatch.setattr(db, "_validate_v5_table", fail_validation, raising=False)
    with pytest.raises(ShiguanStorageError):
        db.migrate_v4_to_v5(path)

    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
        assert connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='archive_decisions'"
        ).fetchone() is None
    finally:
        connection.close()


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
    db.migrate_v3_to_v4(path)
    db.migrate_v4_to_v5(path)
    report = maintenance.migrate_runtime_v5_to_v6(path)
    assert report.version == 6
    assert report.ready is False
    current = maintenance.migrate_runtime_v6_to_v7(path)
    assert current.version == 7
    assert current.ready is True
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        reply = conn.execute("SELECT * FROM archives WHERE id = 'decision-1'").fetchone()
        assert reply["type"] == "REPLY"
        assert reply["source_kind"] == "DECREE"
        assert reply["source_text"] == "请赈济灾民"
        assert reply["reply_process"] == "办理过程"
        assert reply["reply_conclusion"] == "准奏"
        assert reply["reply_time"] == "2026-07-17T10:00:00+00:00"
        assert reply["respondent"] == "丞相"
        assert reply["owner_user_id"] is None
        assert conn.execute(
            "SELECT COUNT(*) FROM archives WHERE id = 'memorial-1'"
        ).fetchone()[0] == 0
        evidence_count = conn.execute(
            "SELECT COUNT(*) FROM archive_evidence WHERE archive_id = 'memorial-1'"
        ).fetchone()[0]
        review_count = conn.execute(
            "SELECT COUNT(*) FROM archive_review_status WHERE archive_id = 'memorial-1'"
        ).fetchone()[0]
        assert evidence_count == 0
        assert review_count == 0
        assert conn.execute(
            "SELECT status FROM schema_migration_verification WHERE id=1"
        ).fetchone()[0] == "VERIFIED"
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
    connection = sqlite3.connect(path)
    connection.executescript(db._V2_SCHEMA_STATEMENTS)
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
    assert report.version == 3
    assert report.ready is False
    assert report.migrated is True
    assert report.backup_path == str(backup)
    assert backup.exists()
    upgraded = maintenance.migrate_runtime_v3_to_v4(path)
    assert upgraded.version == 4
    assert upgraded.ready is False
    current = maintenance.migrate_runtime_v4_to_v5(path)
    assert current.version == 5
    assert current.ready is False
    verified = maintenance.migrate_runtime_v5_to_v6(path)
    assert verified.version == 6
    assert verified.ready is False
    latest = maintenance.migrate_runtime_v6_to_v7(path)
    assert latest.version == 7
    assert latest.ready is True
    assert storage.list_archives(db_path=path) == []


def test_runtime_v4_to_v5_report_counts_every_owner_archive_past_list_limit(tmp_path):
    path = tmp_path / "schema-v4-many-archives.sqlite3"
    connection = sqlite3.connect(path)
    connection.executescript(db._V5_SCHEMA_STATEMENTS)
    connection.executemany(
        "INSERT INTO archives "
        "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
        "VALUES (?, 'MEMORIAL', ?, 'content', 'matter', '户部', "
        "'2026-08-09T00:00:00+00:00', ?)",
        [
            (f"archive-{index:03d}", f"title-{index:03d}", f"owner-{index % 3}")
            for index in range(105)
        ],
    )
    connection.commit()
    connection.execute("DROP TABLE archive_decisions")
    connection.execute("PRAGMA user_version = 4")
    connection.commit()
    connection.close()

    report = maintenance.migrate_runtime_v4_to_v5(path)

    assert report.ready is False
    assert report.archive_count == 105
    connection = sqlite3.connect(path)
    try:
        assert connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 105
    finally:
        connection.close()


def test_runtime_migration_refuses_to_overwrite_existing_backup(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _make_v2(path)
    path.with_name("shiguan.sqlite3.v2-backup").write_bytes(b"backup")

    with pytest.raises(ShiguanStorageError, match="备份已存在"):
        maintenance.migrate_runtime_v2_to_v3(path)

    assert maintenance.inspect_runtime_database(path).version == 2


def test_runtime_v5_to_v6_uses_sqlite_backup_and_marks_verified(tmp_path, monkeypatch):
    path = tmp_path / "schema-v5.sqlite3"
    _make_v5_with_principal_data(path)
    monkeypatch.setattr(
        maintenance,
        "_copy_backup",
        lambda *_args: (_ for _ in ()).throw(AssertionError("raw copy forbidden")),
    )

    report = maintenance.migrate_runtime_v5_to_v6(path)

    backup = path.with_name("schema-v5.sqlite3.v5-backup")
    assert report.version == 6
    assert report.ready is False
    assert report.migrated is True
    assert report.backup_path == str(backup)
    assert report.archive_count == 1
    assert backup.exists()
    assert backup.stat().st_mode & 0o777 == 0o600
    backup_connection = sqlite3.connect(backup)
    try:
        assert backup_connection.execute("PRAGMA user_version").fetchone()[0] == 5
        assert backup_connection.execute("SELECT * FROM auth_sessions").fetchall() == [
            (
                "session-1",
                "user-1",
                "2026-08-28T00:00:00+00:00",
                "2026-08-29T00:00:00+00:00",
                None,
            )
        ]
    finally:
        backup_connection.close()
    reopened = sqlite3.connect(path)
    try:
        maintenance._validate_current_v6(reopened)
        assert reopened.execute(
            "SELECT status FROM schema_migration_verification WHERE id=1"
        ).fetchone()[0] == "VERIFIED"
    finally:
        reopened.close()


def test_runtime_v5_to_v6_rejects_schema_drift_before_backup(tmp_path):
    path = tmp_path / "schema-v5-drift.sqlite3"
    _make_v5_with_principal_data(path)
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE forged_tenant_data (id TEXT PRIMARY KEY)")
    connection.commit()
    connection.close()

    with pytest.raises(ShiguanStorageError, match="迁移条件"):
        maintenance.migrate_runtime_v5_to_v6(path)

    assert not path.with_name("schema-v5-drift.sqlite3.v5-backup").exists()
    assert maintenance.inspect_runtime_database(path).version == 5


def test_runtime_v5_to_v6_rejects_concurrent_writer_before_backup(tmp_path):
    path = tmp_path / "schema-v5-locked.sqlite3"
    _make_v5_with_principal_data(path)
    writer = sqlite3.connect(path)
    writer.execute("BEGIN IMMEDIATE")
    try:
        with pytest.raises(ShiguanStorageError, match="迁移失败"):
            maintenance.migrate_runtime_v5_to_v6(path)
        assert not path.with_name("schema-v5-locked.sqlite3.v5-backup").exists()
    finally:
        writer.rollback()
        writer.close()
    assert maintenance.inspect_runtime_database(path).version == 5


def test_runtime_v5_to_v6_refuses_to_overwrite_existing_backup(tmp_path):
    path = tmp_path / "schema-v5-existing-backup.sqlite3"
    _make_v5_with_principal_data(path)
    backup = path.with_name("schema-v5-existing-backup.sqlite3.v5-backup")
    backup.write_bytes(b"operator-owned-evidence")

    with pytest.raises(ShiguanStorageError, match="备份已存在"):
        maintenance.migrate_runtime_v5_to_v6(path)

    assert backup.read_bytes() == b"operator-owned-evidence"
    assert maintenance.inspect_runtime_database(path).version == 5


def test_runtime_v5_to_v6_rejects_backup_path_replacement_without_touching_victim(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v5-backup-race.sqlite3"
    _make_v5_with_principal_data(path)
    backup = path.with_name("schema-v5-backup-race.sqlite3.v5-backup")
    victim = tmp_path / "victim.sqlite3"
    victim.write_bytes(b"operator-owned")
    real_connect = maintenance.sqlite3.connect
    replaced = False

    def replace_destination_path(database, *args, **kwargs):
        nonlocal replaced
        if not replaced and backup.exists() and "/proc/self/fd/" in str(database):
            replaced = True
            backup.unlink()
            backup.symlink_to(victim)
        return real_connect(database, *args, **kwargs)

    monkeypatch.setattr(maintenance.sqlite3, "connect", replace_destination_path)

    with pytest.raises(ShiguanStorageError, match="备份创建失败"):
        maintenance.migrate_runtime_v5_to_v6(path)

    assert replaced is True
    assert victim.read_bytes() == b"operator-owned"
    assert maintenance.inspect_runtime_database(path).version == 5


def test_postcommit_readback_failure_keeps_pending_database_and_backup(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v5-readback-failure.sqlite3"
    _make_v5_with_principal_data(path)
    monkeypatch.setattr(
        maintenance,
        "_verify_v6_readback",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ShiguanStorageError("forced readback")
        ),
        raising=False,
    )

    with pytest.raises(ShiguanStorageError, match="forced readback"):
        maintenance.migrate_runtime_v5_to_v6(path)

    backup = path.with_name("schema-v5-readback-failure.sqlite3.v5-backup")
    assert backup.exists()
    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 6
        assert connection.execute(
            "SELECT status FROM schema_migration_verification WHERE id=1"
        ).fetchone()[0] == "PENDING_VERIFICATION"
    finally:
        connection.close()
    with pytest.raises(ShiguanStorageError, match="显式迁移"):
        db.get_connection(path)


def test_postcommit_readback_rejects_revoked_backfilled_membership(
    tmp_path, monkeypatch
):
    path = tmp_path / "schema-v5-revoked-backfill.sqlite3"
    _make_v5_with_principal_data(path)
    real_verify = maintenance._verify_v6_readback

    def revoke_before_readback(target, expected_content, **identity):
        with sqlite3.connect(target) as connection:
            connection.execute(
                "UPDATE tenant_memberships SET revoked_at = 'tampered'"
            )
        real_verify(target, expected_content, **identity)

    monkeypatch.setattr(maintenance, "_verify_v6_readback", revoke_before_readback)

    with pytest.raises(ShiguanStorageError, match="迁移后验证失败"):
        maintenance.migrate_runtime_v5_to_v6(path)

    with sqlite3.connect(path) as connection:
        assert connection.execute(
            "SELECT status FROM schema_migration_verification WHERE id=1"
        ).fetchone() == ("PENDING_VERIFICATION",)


def test_postcommit_readback_rejects_source_path_replacement(tmp_path, monkeypatch):
    path = tmp_path / "schema-v5-source-race.sqlite3"
    displaced = tmp_path / "schema-v6-original-inode.sqlite3"
    replacement = tmp_path / "schema-v6-replacement.sqlite3"
    _make_v5_with_principal_data(path)
    _make_v5_with_principal_data(replacement)
    db.migrate_v5_to_v6(replacement)
    real_verify = maintenance._verify_v6_readback

    def replace_before_readback(target, expected_content, **identity):
        target.rename(displaced)
        replacement.rename(target)
        return real_verify(target, expected_content, **identity)

    monkeypatch.setattr(maintenance, "_verify_v6_readback", replace_before_readback)

    with pytest.raises(ShiguanStorageError):
        maintenance.migrate_runtime_v5_to_v6(path)

    for pending_path in (path, displaced):
        with sqlite3.connect(pending_path) as connection:
            assert connection.execute(
                "SELECT status FROM schema_migration_verification WHERE id=1"
            ).fetchone() == ("PENDING_VERIFICATION",)


def test_schema_validators_preserve_caller_query_only_state(tmp_path):
    v5_path = tmp_path / "schema-v5-query-only.sqlite3"
    _make_v5_with_principal_data(v5_path)
    with sqlite3.connect(v5_path) as connection:
        connection.execute("PRAGMA query_only = ON")
        db._validate_v5_predecessor(connection)
        assert connection.execute("PRAGMA query_only").fetchone() == (1,)

    v6_path = tmp_path / "schema-v6-query-only.sqlite3"
    _make_verified_v6(v6_path)
    with sqlite3.connect(v6_path) as connection:
        connection.execute("PRAGMA query_only = ON")
        db._validate_v6_schema(connection)
        assert connection.execute("PRAGMA query_only").fetchone() == (1,)


def test_maintenance_check_emits_desensitized_json_without_ambient_import_path(
    tmp_path, monkeypatch
):
    path = tmp_path / "shiguan.sqlite3"
    db.get_connection(path).close()
    repository_root = Path(__file__).resolve().parents[2]
    monkeypatch.chdir(repository_root)
    monkeypatch.delenv("PYTHONPATH", raising=False)
    real_subprocess_run = subprocess.run

    def run_with_isolation_assertion(*args, **kwargs):
        assert kwargs.get("cwd") == BACKEND_ROOT
        return real_subprocess_run(*args, **kwargs)

    monkeypatch.setattr(subprocess, "run", run_with_isolation_assertion)

    result = _run_maintenance_check(path)

    payload = _parse_maintenance_result(result)
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
