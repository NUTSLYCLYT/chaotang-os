"""P5: an unversioned legacy database may be adopted only after strict proof."""

from __future__ import annotations

import sqlite3
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

    assert result.current_revision == "014_tenant_identity_tables"
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
