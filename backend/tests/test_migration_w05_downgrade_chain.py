"""W05 downgrade guards must refuse before SQLite performs destructive DDL."""

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


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _insert_task(conn: sqlite3.Connection, *, with_scope: bool) -> None:
    columns = (
        ", contract_scope_json"
        if with_scope
        else ""
    )
    values = (
        ", '{\"jurisdiction\":\"CN_MAINLAND\"}'"
        if with_scope
        else ""
    )
    conn.execute(
        f"""
        INSERT INTO decision_tasks (
            id, tenant_id, user_id, raw_question, status, source_label,
            risk_flags_json, known_facts_json, unknown_gaps_json,
            recommended_departments_json, created_at, updated_at{columns}
        ) VALUES (
            'task-w05-downgrade', 1, '1', '审查合同', 'awaiting_evidence',
            'LIVE', '[]', '[]', '[]', '[]', '2026-07-24T00:00:00+00:00',
            '2026-07-24T00:00:00+00:00'{values}
        )
        """
    )


def _insert_generation(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        INSERT INTO outbox_events (
            id, tenant_id, task_id, decision_id, event_type, generation,
            idempotency_key, status, attempts, max_attempts, payload_json,
            created_at, updated_at
        ) VALUES (
            'outbox-w05-downgrade', 1, 'task-w05-downgrade',
            'decision-w05-downgrade', 'evidence.rework', 2,
            'evidence-rework:downgrade', 'awaiting_evidence', 0, 3, '{}',
            '2026-07-24T00:00:00+00:00', '2026-07-24T00:00:00+00:00'
        )
        """
    )


def _insert_version_history(conn: sqlite3.Connection) -> None:
    insert_sql = """
        INSERT INTO final_memorials (
            id, tenant_id, task_id, review_id, swarm_run_id, quality_result_id,
            status, source_label, memorial_json, content_hash, created_at,
            version, supersedes_id, is_current
        ) VALUES (?, 1, 'task-w05-downgrade', ?, ?, ?, ?, 'LIVE_SWARM',
                  '{}', ?, '2026-07-24T00:00:00+00:00', ?, ?, ?)
    """
    conn.execute(
        insert_sql,
        (
            "formal-w05-v1",
            "review-w05-v1",
            "run-w05-v1",
            "quality-w05-v1",
            "superseded",
            "a" * 64,
            1,
            None,
            0,
        ),
    )
    conn.execute(
        insert_sql,
        (
            "formal-w05-v2",
            "review-w05-v2",
            "run-w05-v2",
            "quality-w05-v2",
            "ready_for_decision",
            "b" * 64,
            2,
            "formal-w05-v1",
            1,
        ),
    )


@pytest.mark.parametrize(
    "target",
    ["019_outbox_rework_generation", "018_canonical_completion_identity_fields"],
)
def test_head_downgrade_refuses_before_losing_any_w05_fact(
    tmp_path: Path,
    monkeypatch,
    target: str,
) -> None:
    path = tmp_path / f"head-to-{target[:3]}.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "head")

    conn = sqlite3.connect(path)
    try:
        _insert_task(conn, with_scope=True)
        _insert_generation(conn)
        _insert_version_history(conn)
        conn.execute(
            """
            INSERT INTO shiguan_archives (
                id, tenant_id, task_id, raw_question, refined_edict,
                final_memorial_json, emperor_decision_json,
                evidence_chain_json, source_label, synthetic_flag, created_at,
                final_memorial_id, final_memorial_version,
                final_memorial_content_hash
            ) VALUES (
                'archive-w05-downgrade', 1, 'task-w05-downgrade', '原问', '拟旨',
                '{}', '{}', '[]', 'LIVE', 0,
                '2026-07-24T00:00:00+00:00',
                'formal-w05-v2', 2, ?
            )
            """,
            ("b" * 64,),
        )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(RuntimeError, match="refusing downgrade.*R0-W05"):
        alembic_command.downgrade(cfg, target)

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "022_shiguan_memorial_identity",
        )
        assert {
            "final_memorial_id",
            "final_memorial_version",
            "final_memorial_content_hash",
        } <= _columns(conn, "shiguan_archives")
        assert "contract_scope_json" in _columns(conn, "decision_tasks")
        assert {"generation", "idempotency_key"} <= _columns(conn, "outbox_events")
        assert {"version", "supersedes_id", "is_current"} <= _columns(
            conn, "final_memorials"
        )
        assert conn.execute(
            """
            SELECT final_memorial_id, final_memorial_version,
                   final_memorial_content_hash
            FROM shiguan_archives
            WHERE id='archive-w05-downgrade'
            """
        ).fetchone() == ("formal-w05-v2", 2, "b" * 64)
        assert conn.execute(
            """
            SELECT contract_scope_json
            FROM decision_tasks
            WHERE id='task-w05-downgrade'
            """
        ).fetchone() == ('{"jurisdiction":"CN_MAINLAND"}',)
        assert conn.execute(
            """
            SELECT generation, idempotency_key
            FROM outbox_events
            WHERE id='outbox-w05-downgrade'
            """
        ).fetchone() == (2, "evidence-rework:downgrade")
        assert conn.execute(
            """
            SELECT id, version, supersedes_id, is_current
            FROM final_memorials
            ORDER BY version
            """
        ).fetchall() == [
            ("formal-w05-v1", 1, None, 0),
            ("formal-w05-v2", 2, "formal-w05-v1", 1),
        ]
    finally:
        conn.close()


def test_021_refuses_scope_loss_before_drop_column(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "021-scope.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "021_decision_task_contract_scope")
    conn = sqlite3.connect(path)
    try:
        _insert_task(conn, with_scope=True)
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(RuntimeError, match="R0-W05.*contract scope"):
        alembic_command.downgrade(cfg, "020_final_memorial_versions")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "021_decision_task_contract_scope",
        )
        assert "contract_scope_json" in _columns(conn, "decision_tasks")
    finally:
        conn.close()


def test_020_refuses_outbox_identity_before_chained_019_drop(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "020-outbox.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "020_final_memorial_versions")
    conn = sqlite3.connect(path)
    try:
        _insert_task(conn, with_scope=False)
        _insert_generation(conn)
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(RuntimeError, match="R0-W05.*outbox generation identity"):
        alembic_command.downgrade(cfg, "018_canonical_completion_identity_fields")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "020_final_memorial_versions",
        )
        assert {"generation", "idempotency_key"} <= _columns(conn, "outbox_events")
    finally:
        conn.close()


def test_019_refuses_populated_generation_identity_before_drop(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "019-outbox.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "019_outbox_rework_generation")
    conn = sqlite3.connect(path)
    try:
        _insert_task(conn, with_scope=False)
        _insert_generation(conn)
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(RuntimeError, match="R0-W05.*outbox generation identity"):
        alembic_command.downgrade(cfg, "018_canonical_completion_identity_fields")

    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "019_outbox_rework_generation",
        )
        assert conn.execute(
            """
            SELECT generation, idempotency_key
            FROM outbox_events
            WHERE id='outbox-w05-downgrade'
            """
        ).fetchone() == (2, "evidence-rework:downgrade")
    finally:
        conn.close()
