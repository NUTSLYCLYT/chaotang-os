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

_SCHEMA_STATEMENTS = """
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
    respondent TEXT,
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

_CURRENT_ARCHIVE_COLUMNS = {
    "source_kind": "TEXT",
    "source_text": "TEXT",
    "reply_process": "TEXT",
    "reply_conclusion": "TEXT",
    "reply_time": "TEXT",
    "respondent": "TEXT",
    "owner_user_id": "TEXT",
}


def _add_missing_archive_columns(connection: sqlite3.Connection) -> None:
    """Extend pre-existing archive tables without rewriting their records."""

    existing_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(archives)")
    }
    for name, column_type in _CURRENT_ARCHIVE_COLUMNS.items():
        if name not in existing_columns:
            connection.execute(f"ALTER TABLE archives ADD COLUMN {name} {column_type}")


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
        existing_archives = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'archives'"
        ).fetchone()
        connection.executescript(_SCHEMA_STATEMENTS)
        if existing_archives is not None:
            _add_missing_archive_columns(connection)
        if existing_archives is None:
            connection.execute("PRAGMA user_version = 2")
        connection.commit()
    except (OSError, sqlite3.Error) as exc:
        raise ShiguanStorageError("史馆存储暂时不可用，请稍后再试") from exc
    return connection
