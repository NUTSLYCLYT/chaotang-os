"""P5: an unversioned legacy database may be adopted only after strict proof."""

from __future__ import annotations

import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

alembic_command = pytest.importorskip("alembic.command")
alembic_config = pytest.importorskip("alembic.config")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def _config(path: Path, monkeypatch):
    monkeypatch.setenv("DB_URL", f"sqlite:///{path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    return alembic_config.Config(str(_ALEMBIC_INI))


def _unversioned_011_database(path: Path, monkeypatch) -> None:
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "011_archive_outcome_events")
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "INSERT INTO decision_tasks "
            "(id, user_id, raw_question, status, source_label, risk_flags_json, "
            "known_facts_json, unknown_gaps_json, recommended_departments_json, "
            "created_at, updated_at) "
            "VALUES ('legacy-task', '1', 'legacy', 'awaiting_decision', 'LIVE', "
            "'[]', '[]', '[]', '[]', 'now', 'now')"
        )
        conn.execute(
            "INSERT INTO emperor_decisions "
            "(id, task_id, action, human_confirmed, created_at) "
            "VALUES ('legacy-decision', 'legacy-task', 'approve', 1, 'now')"
        )
        conn.execute("DROP TABLE alembic_version")
        conn.commit()
    finally:
        conn.close()

def test_check_only_proves_legacy_revision_without_writing(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-check.db"
    _unversioned_011_database(path, monkeypatch)
    before = path.read_bytes()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is True
    assert report.adopt_revision == "011_archive_outcome_events"
    assert report.mismatches == ()
    assert path.read_bytes() == before


@pytest.mark.parametrize("as_uri", [False, True])
def test_check_rejects_a_missing_sqlite_file_without_creating_it(
    tmp_path: Path,
    as_uri: bool,
) -> None:
    from src.schema_adoption import AdoptionError, inspect_unversioned_database

    path = tmp_path / "missing.db"
    db_url = f"sqlite:///file:{path}?uri=true" if as_uri else f"sqlite:///{path}"

    with pytest.raises(AdoptionError, match="does not exist"):
        inspect_unversioned_database(db_url)

    assert not path.exists()


def test_check_selects_highest_compatible_revision_when_011_table_is_absent(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-at-010.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("DROP TABLE archive_outcome_events")
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is True
    assert report.adopt_revision == "010_final_memorial_quality_gate"


def test_apply_adopts_compatible_legacy_database_and_preserves_rows(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import adopt_unversioned_database

    path = tmp_path / "legacy-apply.db"
    _unversioned_011_database(path, monkeypatch)

    result = adopt_unversioned_database(
        f"sqlite:///{path}",
        alembic_ini=_ALEMBIC_INI,
        backup_path=tmp_path / "legacy-apply.backup.db",
        apply=True,
    )

    assert result.current_revision == "015_schema_contract_guard"
    assert result.backup_sha256
    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == result.current_revision
        assert conn.execute("SELECT id FROM decision_tasks").fetchone()[0] == "legacy-task"
        assert conn.execute("SELECT kind FROM emperor_decisions").fetchone()[0] == "final_verdict"
        assert conn.execute("SELECT tenant_id FROM decision_tasks").fetchone()[0] is None
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {"tenants", "users", "invites"} <= tables
    finally:
        conn.close()


def test_apply_accepts_valid_legacy_identity_tables_and_adds_optional_email(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import adopt_unversioned_database

    path = tmp_path / "legacy-identity-without-email.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                role TEXT NOT NULL DEFAULT 'user',
                display_name TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                max_uses INTEGER NOT NULL DEFAULT 1,
                used_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        conn.commit()
    finally:
        conn.close()

    result = adopt_unversioned_database(
        f"sqlite:///{path}",
        alembic_ini=_ALEMBIC_INI,
        backup_path=tmp_path / "legacy-identity.backup.db",
        apply=True,
    )

    assert result.current_revision == "015_schema_contract_guard"
    conn = sqlite3.connect(path)
    try:
        assert "email" in {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    finally:
        conn.close()


def test_incompatible_unversioned_database_is_rejected_without_stamp_or_partial_ddl(
    tmp_path: Path, monkeypatch
) -> None:
    from src.schema_adoption import AdoptionError, adopt_unversioned_database

    path = tmp_path / "legacy-incompatible.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("DROP TABLE final_memorials")
        conn.commit()
    finally:
        conn.close()
    before = path.read_bytes()

    with pytest.raises(AdoptionError, match="final_memorials"):
        adopt_unversioned_database(
            f"sqlite:///{path}",
            alembic_ini=_ALEMBIC_INI,
            backup_path=tmp_path / "must-not-exist.db",
            apply=True,
        )

    assert path.read_bytes() == before
    conn = sqlite3.connect(path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert "alembic_version" not in tables
        assert "tenant_id" not in {row[1] for row in conn.execute("PRAGMA table_info(decision_tasks)")}
    finally:
        conn.close()


def test_apply_requires_an_explicit_backup_destination(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import AdoptionError, adopt_unversioned_database

    path = tmp_path / "legacy-no-backup.db"
    _unversioned_011_database(path, monkeypatch)

    with pytest.raises(AdoptionError, match="backup_path"):
        adopt_unversioned_database(
            f"sqlite:///{path}",
            alembic_ini=_ALEMBIC_INI,
            apply=True,
        )


def test_check_rejects_an_unknown_legacy_column(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-extra-column.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("ALTER TABLE tasks ADD COLUMN surprise_payload TEXT")
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is False
    assert any("tasks" in item and "unexpected columns" in item for item in report.mismatches)


def test_check_rejects_a_named_index_with_the_wrong_shape(tmp_path: Path, monkeypatch) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-wrong-index.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("DROP INDEX ix_jinyiwei_evidence_tenant_query")
        conn.execute(
            "CREATE INDEX ix_jinyiwei_evidence_tenant_query "
            "ON jinyiwei_evidence (tenant_id, claim_key)"
        )
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is False
    assert any("ix_jinyiwei_evidence_tenant_query" in item for item in report.mismatches)


def test_check_rejects_unknown_preexisting_emperor_kind_before_stamp(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-unknown-kind.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("ALTER TABLE emperor_decisions ADD COLUMN kind TEXT")
        conn.execute("UPDATE emperor_decisions SET kind = 'poisoned_kind'")
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is False
    assert any("emperor_decisions unknown kinds" in item for item in report.mismatches)


def test_check_rejects_a_wrong_preexisting_emperor_kind_constraint(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-wrong-kind-check.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            ALTER TABLE emperor_decisions RENAME TO emperor_decisions_old;
            CREATE TABLE emperor_decisions (
                id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                action TEXT NOT NULL,
                kind TEXT NOT NULL,
                reason TEXT,
                human_confirmed BOOLEAN NOT NULL,
                confirmation_record_json TEXT,
                created_at TEXT NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT ck_emperor_decisions_kind
                    CHECK (kind IN ('final_verdict', 'poisoned_kind'))
            );
            INSERT INTO emperor_decisions (
                id, task_id, action, kind, reason, human_confirmed,
                confirmation_record_json, created_at
            )
            SELECT id, task_id, action, 'final_verdict', reason, human_confirmed,
                   confirmation_record_json, created_at
            FROM emperor_decisions_old;
            DROP TABLE emperor_decisions_old;
            CREATE INDEX ix_emperor_decisions_task_created
                ON emperor_decisions (task_id, created_at);
            """
        )
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is False
    assert any("emperor_decisions check constraints mismatch" in item for item in report.mismatches)


def test_apply_rejects_a_table_without_its_primary_and_unique_contract_before_backup_or_stamp(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import AdoptionError, adopt_unversioned_database

    path = tmp_path / "legacy-malformed-tasks.db"
    backup = tmp_path / "must-not-exist.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("ALTER TABLE tasks RENAME TO tasks_valid")
        conn.execute("CREATE TABLE tasks AS SELECT * FROM tasks_valid")
        conn.execute("DROP TABLE tasks_valid")
        conn.commit()
    finally:
        conn.close()

    before = path.read_bytes()

    with pytest.raises(AdoptionError, match="tasks"):
        adopt_unversioned_database(
            f"sqlite:///{path}",
            alembic_ini=_ALEMBIC_INI,
            backup_path=backup,
            apply=True,
        )

    assert not backup.exists()
    assert path.read_bytes() == before
    conn = sqlite3.connect(path)
    try:
        assert "alembic_version" not in {
            row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
    finally:
        conn.close()


def test_check_does_not_fall_back_to_010_when_existing_archive_table_is_malformed(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import inspect_unversioned_database

    path = tmp_path / "legacy-malformed-archive.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute("ALTER TABLE archive_outcome_events RENAME TO archive_valid")
        conn.execute("CREATE TABLE archive_outcome_events AS SELECT * FROM archive_valid")
        conn.execute("DROP TABLE archive_valid")
        conn.commit()
    finally:
        conn.close()

    report = inspect_unversioned_database(f"sqlite:///{path}")

    assert report.compatible is False
    assert any("archive_outcome_events" in item for item in report.mismatches)


def test_apply_rejects_malformed_existing_identity_table_before_backup(
    tmp_path: Path,
    monkeypatch,
) -> None:
    from src.schema_adoption import AdoptionError, adopt_unversioned_database

    path = tmp_path / "legacy-malformed-identity.db"
    backup = tmp_path / "must-not-exist.db"
    _unversioned_011_database(path, monkeypatch)
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            "CREATE TABLE invites (id INTEGER, code TEXT, max_uses INTEGER, "
            "used_count INTEGER, expires_at TEXT, created_at TEXT)"
        )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(AdoptionError, match="invites"):
        adopt_unversioned_database(
            f"sqlite:///{path}",
            alembic_ini=_ALEMBIC_INI,
            backup_path=backup,
            apply=True,
        )

    assert not backup.exists()


def test_cli_accepts_explicit_check_and_reports_missing_file_without_traceback(
    tmp_path: Path,
) -> None:
    script = _BACKEND_ROOT / "scripts" / "adopt_unversioned_database.py"
    path = tmp_path / "missing.db"

    completed = subprocess.run(
        [sys.executable, str(script), "--db-url", f"sqlite:///{path}", "--check"],
        cwd=_BACKEND_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 2
    assert '"mode": "check"' in completed.stdout
    assert "does not exist" in completed.stdout
    assert "Traceback" not in completed.stderr
    assert not path.exists()


def test_cli_reports_an_invalid_url_without_traceback() -> None:
    script = _BACKEND_ROOT / "scripts" / "adopt_unversioned_database.py"

    completed = subprocess.run(
        [sys.executable, str(script), "--db-url", "not-a-database-url", "--check"],
        cwd=_BACKEND_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 2
    assert '"mode": "check"' in completed.stdout
    assert "database URL" in completed.stdout
    assert "Traceback" not in completed.stderr


def test_cli_reports_alembic_apply_failure_without_traceback(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "legacy-cli-apply-error.db"
    backup = tmp_path / "legacy-cli-apply-error.backup.db"
    _unversioned_011_database(path, monkeypatch)
    script = _BACKEND_ROOT / "scripts" / "adopt_unversioned_database.py"

    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--db-url",
            f"sqlite:///{path}",
            "--apply",
            "--backup",
            str(backup),
            "--alembic-ini",
            str(tmp_path / "missing.ini"),
        ],
        cwd=_BACKEND_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 2
    assert '"mode": "apply"' in completed.stdout
    assert "Alembic configuration" in completed.stdout
    assert "Traceback" not in completed.stderr
    assert not backup.exists()
    conn = sqlite3.connect(path)
    try:
        assert "alembic_version" not in {
            row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
    finally:
        conn.close()
