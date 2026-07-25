"""Explicit, local-only maintenance for the Shiguan runtime database.

This module deliberately keeps schema migration outside request and service
startup paths. Operators can inspect a database without opening it for write,
then explicitly back up and migrate a healthy v2 database to v3.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from app.shiguan import db, storage
from app.shiguan.errors import ShiguanStorageError

_V2_REQUIRED_TABLES = {
    "archives",
    "archive_evidence",
    "archive_relations",
    "archive_review_status",
}
_V3_REQUIRED_TABLES = _V2_REQUIRED_TABLES | {"archive_evidence_references"}


@dataclass(frozen=True)
class RuntimeDatabaseReport:
    """Desensitized schema-health result suitable for local operator output."""

    database_path: str
    exists: bool
    version: int | None
    integrity_ok: bool
    required_tables_ok: bool
    ready: bool
    migrated: bool = False
    backup_path: str | None = None
    archive_count: int | None = None

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


def _readonly_connection(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)


def inspect_runtime_database(path: Path) -> RuntimeDatabaseReport:
    """Inspect schema health without creating or modifying the database."""

    target = path.resolve()
    if not target.is_file():
        return RuntimeDatabaseReport(
            database_path=str(target),
            exists=False,
            version=None,
            integrity_ok=False,
            required_tables_ok=False,
            ready=False,
        )

    connection: sqlite3.Connection | None = None
    try:
        connection = _readonly_connection(target)
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        integrity_ok = connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        required_tables_ok = _V3_REQUIRED_TABLES <= tables
        return RuntimeDatabaseReport(
            database_path=str(target),
            exists=True,
            version=version,
            integrity_ok=integrity_ok,
            required_tables_ok=required_tables_ok,
            ready=version == 3 and integrity_ok and required_tables_ok,
        )
    except sqlite3.Error:
        return RuntimeDatabaseReport(
            database_path=str(target),
            exists=True,
            version=None,
            integrity_ok=False,
            required_tables_ok=False,
            ready=False,
        )
    finally:
        if connection is not None:
            connection.close()


def _copy_backup(path: Path, backup: Path) -> None:
    try:
        with path.open("rb") as source, backup.open("xb") as destination:
            shutil.copyfileobj(source, destination)
        shutil.copystat(path, backup)
    except OSError as exc:
        raise ShiguanStorageError("史馆运行库备份创建失败") from exc


def migrate_runtime_v2_to_v3(path: Path) -> RuntimeDatabaseReport:
    """Back up, migrate and read back one healthy schema-v2 database."""

    target = path.resolve()
    before = inspect_runtime_database(target)
    if (
        not before.exists
        or before.version != 2
        or not before.integrity_ok
    ):
        raise ShiguanStorageError("史馆运行库不满足 v2 迁移条件")

    connection: sqlite3.Connection | None = None
    try:
        connection = _readonly_connection(target)
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
    except sqlite3.Error as exc:
        raise ShiguanStorageError("史馆运行库预检失败") from exc
    finally:
        if connection is not None:
            connection.close()
    if not _V2_REQUIRED_TABLES <= tables or "archive_evidence_references" in tables:
        raise ShiguanStorageError("史馆运行库不满足 v2 迁移条件")

    backup = target.with_name(f"{target.name}.v2-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")
    _copy_backup(target, backup)

    db.migrate_v2_to_v3(target)
    after = inspect_runtime_database(target)
    if not after.ready:
        raise ShiguanStorageError("史馆运行库迁移后预检失败")
    archive_count = len(storage.list_archives(db_path=target))
    return RuntimeDatabaseReport(
        **{
            **after.to_payload(),
            "migrated": True,
            "backup_path": str(backup),
            "archive_count": archive_count,
        }
    )


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect or migrate the local Shiguan database")
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--check", action="store_true")
    actions.add_argument("--migrate-v2-to-v3", action="store_true")
    parser.add_argument("--database", type=Path, default=db._DEFAULT_DB_PATH)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Run the maintenance command and return a process exit code."""

    args = _parse_args(argv)
    if args.check:
        report = inspect_runtime_database(args.database)
        print(json.dumps(report.to_payload(), ensure_ascii=False, sort_keys=True))
        return 0 if report.ready else 1

    try:
        report = migrate_runtime_v2_to_v3(args.database)
    except ShiguanStorageError:
        report = inspect_runtime_database(args.database)
        print(json.dumps(report.to_payload(), ensure_ascii=False, sort_keys=True))
        return 1
    print(json.dumps(report.to_payload(), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
