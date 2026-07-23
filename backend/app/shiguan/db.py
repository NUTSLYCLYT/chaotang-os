"""sqlite3 connection management for the 史馆 (Shiguan) domain.

Design notes:

- Python's standard library ``sqlite3`` is used directly -- no new
  production dependency (see ``docs/decisions/0015-shiguan-archive-persistence.md``).
- ``get_connection()`` opens a **short-lived connection per call**. There is
  no global connection singleton and no connection is ever reused across
  threads/requests; callers are responsible for closing the connection they
  receive (see ``app.shiguan.storage``, which always does so in a
  ``finally`` block).
- The default database path is resolved from this module's own file
  location (not the process working directory), mirroring the pattern used
  by ``app.langgraph_runtime.deepseek_env._DEFAULT_DOTENV_PATH``. Tests must
  monkeypatch the module-level ``_DEFAULT_DB_PATH`` attribute (not a
  captured default argument) to a ``tmp_path``-backed file so they never
  touch a real, shared runtime database file.
- Every call to ``get_connection()`` ensures the on-disk schema exists
  (``CREATE TABLE IF NOT EXISTS`` -- idempotent), so "first access to a
  given path auto-creates the schema" holds without needing a separate
  migration step.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.shiguan.errors import ShiguanStorageError

# backend/app/shiguan/db.py -> parents[2] == backend/
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "shiguan.sqlite3"

_V2_SCHEMA_STATEMENTS = """
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
    source_kind TEXT,
    source_text TEXT,
    participating_departments TEXT,
    reply_process TEXT,
    reply_conclusion TEXT,
    reply_time TEXT,
    respondent TEXT
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
PRAGMA user_version = 2;
"""

_EVIDENCE_REFERENCES_SCHEMA = """
CREATE TABLE archive_evidence_references (
    archive_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    evidence_id TEXT NOT NULL,
    pack_id TEXT NOT NULL,
    investigation_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    PRIMARY KEY (archive_id, ordinal),
    UNIQUE (archive_id, evidence_id),
    FOREIGN KEY (archive_id) REFERENCES archives(id)
)
"""

_SCHEMA_STATEMENTS = (
    _V2_SCHEMA_STATEMENTS.replace("PRAGMA user_version = 2;", "")
    + _EVIDENCE_REFERENCES_SCHEMA
    + ";\nPRAGMA user_version = 3;\n"
)

_LEGACY_MIGRATION_ERROR = "史馆旧库无法迁移；请核对已确认档案对后重试"


def get_connection(path: Path | None = None) -> sqlite3.Connection:
    """Open a new short-lived sqlite3 connection, ensuring schema exists.

    Args:
        path: Optional override path to the sqlite database file. Defaults
            to the module-level ``_DEFAULT_DB_PATH``, read at call time so
            tests can monkeypatch it.

    Returns:
        A new ``sqlite3.Connection`` with ``row_factory = sqlite3.Row`` and
        foreign keys enabled. The caller owns this connection and must
        close it.

    Raises:
        ShiguanStorageError: The database directory could not be created,
            or the connection/schema setup otherwise failed. The message is
            fixed and generic -- it never includes the underlying
            exception's ``str()`` or the resolved filesystem path.
    """

    target = path if path is not None else _DEFAULT_DB_PATH
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(target)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'archives'"
        ).fetchone()
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if has_schema and version != 3:
            connection.close()
            raise ShiguanStorageError("史馆旧库需要显式迁移后才能使用")
        if not has_schema:
            connection.executescript(_SCHEMA_STATEMENTS)
            connection.commit()
    except (OSError, sqlite3.Error) as exc:
        raise ShiguanStorageError("史馆存储暂时不可用，请稍后再试") from exc
    return connection


def _validate_v3_table(connection: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in connection.execute(
            "PRAGMA table_info(archive_evidence_references)"
        ).fetchall()
    }
    expected = {
        "archive_id",
        "ordinal",
        "evidence_id",
        "pack_id",
        "investigation_id",
        "snapshot_json",
        "snapshot_hash",
    }
    if columns != expected:
        raise ValueError("invalid archive evidence reference schema")


def migrate_v2_to_v3(path: Path) -> None:
    """Atomically add immutable evidence-reference snapshots to a v2 database."""

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='archives'"
        ).fetchone()
        if version != 2 or has_schema is None:
            raise ValueError("not a schema-v2 database")
        connection.execute(_EVIDENCE_REFERENCES_SCHEMA)
        _validate_v3_table(connection)
        connection.execute("PRAGMA user_version = 3")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆 v2 到 v3 无法迁移") from exc
    finally:
        if connection is not None:
            connection.close()


def migrate_v1_to_v2(path: Path, *, confirmed_pairs: dict[str, str]) -> None:
    """Explicitly migrate confirmed generated MEMORIAL+DECISION pairs.

    No relationship is inferred. Every legacy DECISION must appear in
    ``confirmed_pairs`` and its mapped MEMORIAL must be its sole relation,
    be unshared, and exist as a MEMORIAL. Any mismatch rolls back the whole
    migration.
    """

    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")

        version = connection.execute("PRAGMA user_version").fetchone()[0]
        has_schema = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'archives'"
        ).fetchone()
        if not has_schema or version not in (0, 1):
            raise ValueError("not a supported v1 database")

        type_rows = connection.execute("SELECT DISTINCT type FROM archives").fetchall()
        archive_types = {row["type"] for row in type_rows}
        if not archive_types <= {"MEMORIAL", "DECISION"}:
            raise ValueError("unsupported legacy archive type")

        decision_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM archives WHERE type = 'DECISION'"
            ).fetchall()
        }
        if set(confirmed_pairs) != decision_ids:
            raise ValueError("every decision requires explicit confirmation")
        if len(set(confirmed_pairs.values())) != len(confirmed_pairs):
            raise ValueError("a memorial cannot be shared")

        source_text_by_decision: dict[str, str] = {}
        for decision_id, memorial_id in confirmed_pairs.items():
            relation_rows = connection.execute(
                "SELECT related_id FROM archive_relations WHERE archive_id = ?",
                (decision_id,),
            ).fetchall()
            if [row["related_id"] for row in relation_rows] != [memorial_id]:
                raise ValueError("confirmed pair does not match its sole relation")
            memorial = connection.execute(
                "SELECT type, content FROM archives WHERE id = ?", (memorial_id,)
            ).fetchone()
            if memorial is None or memorial["type"] != "MEMORIAL":
                raise ValueError("confirmed source is not a memorial")
            reference_count = connection.execute(
                "SELECT COUNT(*) FROM archive_relations WHERE related_id = ?",
                (memorial_id,),
            ).fetchone()[0]
            outgoing_count = connection.execute(
                "SELECT COUNT(*) FROM archive_relations WHERE archive_id = ?",
                (memorial_id,),
            ).fetchone()[0]
            if reference_count != 1 or outgoing_count != 0:
                raise ValueError("confirmed memorial has ambiguous relations")
            source_text_by_decision[decision_id] = memorial["content"]

        connection.execute("ALTER TABLE archives ADD COLUMN source_kind TEXT")
        connection.execute("ALTER TABLE archives ADD COLUMN source_text TEXT")
        connection.execute("ALTER TABLE archives RENAME COLUMN decision_process TO reply_process")
        connection.execute(
            "ALTER TABLE archives RENAME COLUMN decision_conclusion TO reply_conclusion"
        )
        connection.execute("ALTER TABLE archives RENAME COLUMN decision_time TO reply_time")
        connection.execute("ALTER TABLE archives RENAME COLUMN responsible_owner TO respondent")

        for decision_id, memorial_id in confirmed_pairs.items():
            connection.execute(
                "UPDATE archives SET type = 'REPLY', source_kind = 'DECREE', source_text = ? "
                "WHERE id = ?",
                (source_text_by_decision[decision_id], decision_id),
            )
            connection.execute(
                "DELETE FROM archive_evidence WHERE archive_id = ?", (memorial_id,)
            )
            connection.execute(
                "DELETE FROM archive_review_status WHERE archive_id = ?", (memorial_id,)
            )
            connection.execute(
                "DELETE FROM archive_relations WHERE archive_id = ? OR related_id = ?",
                (memorial_id, memorial_id),
            )
            connection.execute("DELETE FROM archives WHERE id = ?", (memorial_id,))

        connection.execute("PRAGMA user_version = 2")
        connection.commit()
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError(_LEGACY_MIGRATION_ERROR) from exc
    finally:
        if connection is not None:
            connection.close()
