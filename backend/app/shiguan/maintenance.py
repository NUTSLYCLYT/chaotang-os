"""Explicit, local-only maintenance for the Shiguan runtime database.

This module deliberately keeps schema migration outside request and service
startup paths. Operators can inspect a database without opening it for write,
then explicitly back up and migrate a healthy legacy database to the current schema.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import stat
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from app.operations import sqlite_backup as governed_sqlite_backup
from app.operations.runtime_data_registry import (
    RUNTIME_DATA_ENTRIES,
    SHIGUAN_V6_PREDECESSOR,
    is_verified_migration_state,
    schema_contract_digest_connection,
)
from app.shiguan import db
from app.shiguan.errors import ShiguanStorageError

_V2_REQUIRED_TABLES = {
    "archives",
    "archive_evidence",
    "archive_relations",
    "archive_review_status",
}
_V3_REQUIRED_TABLES = _V2_REQUIRED_TABLES | {"archive_evidence_references"}
_V4_REQUIRED_TABLES = _V3_REQUIRED_TABLES | {
    "daily_memorial_runs",
    "daily_memorial_fact_snapshots",
    "daily_memorial_stage_results",
}
_V5_REQUIRED_TABLES = _V4_REQUIRED_TABLES | {"archive_decisions"}


def _current_shiguan_entry():
    return next(
        entry for entry in RUNTIME_DATA_ENTRIES if entry.name == "shiguan.sqlite3"
    )


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


def _inspect_runtime_connection(
    connection: sqlite3.Connection, *, database_path: str
) -> RuntimeDatabaseReport:
    """Inspect one already-open SQLite identity without reopening its pathname."""

    version = connection.execute("PRAGMA user_version").fetchone()[0]
    integrity_ok = connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    entry = _current_shiguan_entry()
    triggers = tuple(
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name"
        ).fetchall()
    )
    schema_digest = schema_contract_digest_connection(connection)
    required_tables_ok = (
        tuple(sorted(tables - {"sqlite_sequence"})) == entry.required_tables
        and triggers == entry.required_triggers
        and schema_digest == entry.schema_contract_digest
    )
    verification = None
    if "schema_migration_verification" in tables:
        verification = connection.execute(
            "SELECT id, status, verified_at FROM schema_migration_verification"
        ).fetchall()
    foreign_keys_ok = not connection.execute("PRAGMA foreign_key_check").fetchall()
    return RuntimeDatabaseReport(
        database_path=database_path,
        exists=True,
        version=version,
        integrity_ok=integrity_ok,
        required_tables_ok=required_tables_ok,
        ready=(
            version == entry.user_version
            and integrity_ok
            and foreign_keys_ok
            and required_tables_ok
            and verification is not None
            and is_verified_migration_state(verification)
        ),
    )


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
        return _inspect_runtime_connection(
            connection,
            database_path=str(target),
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


def _sqlite_backup_snapshot(source_descriptor: int, backup: Path) -> None:
    """Create a non-overwriting snapshot through held descriptors only."""

    directory_descriptor = -1
    destination_descriptor = -1
    try:
        directory_descriptor, directory_status = governed_sqlite_backup._open_directory(
            backup.parent
        )
        flags = (
            os.O_RDWR
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_CLOEXEC", 0)
            | getattr(os, "O_NOFOLLOW", 0)
        )
        destination_descriptor = governed_sqlite_backup._open_at_path(
            directory_descriptor, backup.name, flags, 0o600
        )
        if governed_sqlite_backup._is_windows():
            destination_descriptor = governed_sqlite_backup._remember_fd(
                destination_descriptor, backup
            )
        destination_status = os.fstat(destination_descriptor)
        if (
            not stat.S_ISREG(destination_status.st_mode)
            or destination_status.st_nlink != 1
        ):
            raise governed_sqlite_backup.BackupError("unsafe_backup_identity")
        with sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(source_descriptor, "ro"),
            uri=True,
        ) as source, sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(
                destination_descriptor, "rw"
            ),
            uri=True,
        ) as destination:
            source.backup(destination)
            destination.execute("PRAGMA journal_mode = DELETE")
        governed_sqlite_backup._assert_entry_identity(
            directory_descriptor, backup.name, destination_status
        )
        governed_sqlite_backup._assert_directory_identity(
            backup.parent, directory_status
        )
        os.fsync(destination_descriptor)
        governed_sqlite_backup._fsync_directory_descriptor(directory_descriptor)
    except (OSError, sqlite3.Error, governed_sqlite_backup.BackupError) as exc:
        raise ShiguanStorageError("史馆运行库备份创建失败") from exc
    finally:
        if destination_descriptor >= 0:
            governed_sqlite_backup._close_fd(destination_descriptor)
        if directory_descriptor >= 0:
            governed_sqlite_backup._close_fd(directory_descriptor)


def _validate_v5_snapshot(
    path: Path, expected_content: dict[str, tuple[int, str]]
) -> None:
    connection: sqlite3.Connection | None = None
    try:
        descriptor, expected = governed_sqlite_backup._open_regular_readonly(path)
        try:
            connection = sqlite3.connect(
                governed_sqlite_backup._sqlite_uri_for_file(descriptor, "ro"), uri=True
            )
        finally:
            os.close(descriptor)
        governed_sqlite_backup._assert_path_identity(path, expected)
        connection.execute("PRAGMA foreign_keys = ON")
        db._validate_v5_predecessor(connection)
        if db._legacy_content_snapshot(connection) != expected_content:
            raise ValueError("schema-v5 backup content mismatch")
    except (OSError, sqlite3.Error, ValueError) as exc:
        raise ShiguanStorageError("史馆运行库备份验证失败") from exc
    finally:
        if connection is not None:
            connection.close()


def _validate_current_v6(connection: sqlite3.Connection) -> None:
    if (
        connection.execute("PRAGMA user_version").fetchone()[0]
        != SHIGUAN_V6_PREDECESSOR.user_version
    ):
        raise ValueError("invalid schema-v6 version")
    db._validate_v6_schema(connection)
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("invalid schema-v6 integrity")
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("invalid schema-v6 foreign keys")
    digest = schema_contract_digest_connection(connection)
    if digest != SHIGUAN_V6_PREDECESSOR.schema_contract_digest:
        raise ValueError("invalid schema-v6 digest")


def _validate_v6_snapshot(
    path: Path, expected_content: dict[str, tuple[int, str]]
) -> None:
    connection: sqlite3.Connection | None = None
    try:
        descriptor, expected = governed_sqlite_backup._open_regular_readonly(path)
        try:
            connection = sqlite3.connect(
                governed_sqlite_backup._sqlite_uri_for_file(descriptor, "ro"), uri=True
            )
        finally:
            os.close(descriptor)
        governed_sqlite_backup._assert_path_identity(path, expected)
        connection.execute("PRAGMA foreign_keys = ON")
        _validate_current_v6(connection)
        verification = connection.execute(
            "SELECT id, status, verified_at FROM schema_migration_verification"
        ).fetchall()
        if not is_verified_migration_state(verification):
            raise ValueError("schema-v6 backup is not verified")
        if db._v6_content_snapshot(connection) != expected_content:
            raise ValueError("schema-v6 backup content mismatch")
    except (OSError, sqlite3.Error, ValueError) as exc:
        raise ShiguanStorageError("史馆运行库备份验证失败") from exc
    finally:
        if connection is not None:
            connection.close()


def _validate_current_v7(connection: sqlite3.Connection) -> None:
    entry = _current_shiguan_entry()
    if connection.execute("PRAGMA user_version").fetchone()[0] != entry.user_version:
        raise ValueError("invalid schema-v7 version")
    db._validate_v7_schema(connection)
    if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("invalid schema-v7 integrity")
    if connection.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("invalid schema-v7 foreign keys")
    if schema_contract_digest_connection(connection) != entry.schema_contract_digest:
        raise ValueError("invalid schema-v7 digest")


def _verify_v6_readback(
    path: Path,
    expected_content: dict[str, tuple[int, str]],
    *,
    source_descriptor: int,
    source_directory_descriptor: int,
    source_status: os.stat_result,
    source_directory_status: os.stat_result,
) -> None:
    """Read back and verify the same committed inode, not merely its pathname."""

    connection: sqlite3.Connection | None = None
    try:
        governed_sqlite_backup._assert_directory_identity(
            path.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, path.name, source_status
        )
        connection = sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(source_descriptor, "rw"),
            uri=True,
            timeout=0,
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        _validate_current_v6(connection)
        if db._legacy_content_snapshot(connection) != expected_content:
            raise ValueError("schema-v5 content changed after migration")
        verification = connection.execute(
            "SELECT id, status, verified_at FROM schema_migration_verification"
        ).fetchall()
        if verification != [(1, "PENDING_VERIFICATION", None)]:
            raise ValueError("invalid pending migration verification")
        user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if connection.execute("SELECT COUNT(*) FROM tenants").fetchone()[0] != user_count:
            raise ValueError("tenant backfill mismatch")
        if connection.execute(
            "SELECT COUNT(*) FROM tenant_memberships"
        ).fetchone()[0] != user_count:
            raise ValueError("membership backfill mismatch")
        if connection.execute(
            "SELECT COUNT(*) FROM users AS users "
            "LEFT JOIN tenant_memberships AS memberships "
            "ON memberships.user_id=users.id AND memberships.revoked_at IS NULL "
            "LEFT JOIN tenants AS tenants ON tenants.id=memberships.tenant_id "
            "AND tenants.kind='PERSONAL' "
            "WHERE memberships.id IS NULL OR memberships.role!='OWNER' "
            "OR tenants.id IS NULL"
        ).fetchone()[0]:
            raise ValueError("active principal backfill mismatch")
        if connection.execute(
            "SELECT COUNT(*) FROM auth_sessions AS sessions "
            "LEFT JOIN tenant_memberships AS memberships "
            "ON memberships.id=sessions.membership_id "
            "AND memberships.user_id=sessions.user_id "
            "AND memberships.revoked_at IS NULL AND memberships.role='OWNER' "
            "LEFT JOIN tenants AS tenants ON tenants.id=memberships.tenant_id "
            "AND tenants.kind='PERSONAL' "
            "WHERE memberships.id IS NULL OR tenants.id IS NULL"
        ).fetchone()[0]:
            raise ValueError("session binding mismatch")
        governed_sqlite_backup._assert_directory_identity(
            path.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, path.name, source_status
        )
        connection.execute(
            "UPDATE schema_migration_verification "
            "SET status='VERIFIED', "
            "verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1"
        )
        connection.commit()
        governed_sqlite_backup._assert_directory_identity(
            path.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, path.name, source_status
        )
    except ShiguanStorageError:
        if connection is not None:
            connection.rollback()
        raise
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆运行库迁移后验证失败") from exc
    finally:
        if connection is not None:
            connection.close()


def _verify_v7_readback(
    path: Path,
    expected_content: dict[str, tuple[int, str]],
    *,
    backup_path: Path,
    source_descriptor: int,
    source_directory_descriptor: int,
    source_status: os.stat_result,
    source_directory_status: os.stat_result,
) -> tuple[RuntimeDatabaseReport, int]:
    """Inspect the held PENDING v7 inode fully, then promote it as the last write."""

    connection: sqlite3.Connection | None = None
    promoted = False
    try:
        governed_sqlite_backup._assert_directory_identity(
            path.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, path.name, source_status
        )
        connection = sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(source_descriptor, "rw"),
            uri=True,
            timeout=0,
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        _validate_current_v7(connection)
        if db._v6_content_snapshot(connection) != expected_content:
            raise ValueError("schema-v6 content changed after migration")
        if connection.execute("SELECT COUNT(*) FROM outcome_events").fetchone() != (0,):
            raise ValueError("outcome table is not empty after migration")
        verification = connection.execute(
            "SELECT id, status, verified_at FROM schema_migration_verification"
        ).fetchall()
        if verification != [(1, "PENDING_VERIFICATION", None)]:
            raise ValueError("invalid pending migration verification")
        pending_report = _inspect_runtime_connection(
            connection,
            database_path=str(path),
        )
        if not (
            pending_report.exists
            and pending_report.version == 7
            and pending_report.integrity_ok
            and pending_report.required_tables_ok
            and not pending_report.ready
        ):
            raise ValueError("invalid pending schema-v7 inspection")
        archive_count = connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
        final_report = RuntimeDatabaseReport(
            **{
                **pending_report.to_payload(),
                "ready": True,
                "migrated": True,
                "backup_path": str(backup_path),
                "archive_count": archive_count,
            }
        )
        governed_sqlite_backup._assert_directory_identity(
            path.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, path.name, source_status
        )
        promotion = connection.execute(
            "UPDATE schema_migration_verification "
            "SET status='VERIFIED', "
            "verified_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1"
        )
        if promotion.rowcount != 1:
            raise ValueError("schema-v7 verification promotion failed")
        connection.commit()
        promoted = True
        return final_report, archive_count
    except ShiguanStorageError:
        if connection is not None:
            connection.rollback()
        raise
    except (OSError, sqlite3.Error, ValueError) as exc:
        if connection is not None:
            connection.rollback()
        raise ShiguanStorageError("史馆运行库迁移后验证失败") from exc
    finally:
        if connection is not None:
            try:
                connection.close()
            except Exception:
                if not promoted:
                    raise


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
    if after.version != 3 or not after.integrity_ok:
        raise ShiguanStorageError("史馆运行库迁移后预检失败")
    connection = None
    try:
        connection = _readonly_connection(target)
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        archive_count = connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
    except sqlite3.Error as exc:
        raise ShiguanStorageError("史馆运行库迁移后预检失败") from exc
    finally:
        if connection is not None:
            connection.close()
    if not _V3_REQUIRED_TABLES <= tables:
        raise ShiguanStorageError("史馆运行库迁移后预检失败")
    return RuntimeDatabaseReport(
        **{
            **after.to_payload(),
            "migrated": True,
            "backup_path": str(backup),
            "archive_count": archive_count,
        }
    )


def migrate_runtime_v3_to_v4(path: Path) -> RuntimeDatabaseReport:
    """Back up, migrate and read back one healthy schema-v3 database."""

    target = path.resolve()
    before = inspect_runtime_database(target)
    if not before.exists or before.version != 3 or not before.integrity_ok:
        raise ShiguanStorageError("史馆运行库不满足 v3 迁移条件")

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
    if not _V3_REQUIRED_TABLES <= tables or tables & {
        "daily_memorial_runs",
        "daily_memorial_fact_snapshots",
        "daily_memorial_stage_results",
    }:
        raise ShiguanStorageError("史馆运行库不满足 v3 迁移条件")

    backup = target.with_name(f"{target.name}.v3-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")
    _copy_backup(target, backup)

    db.migrate_v3_to_v4(target)
    after = inspect_runtime_database(target)
    if after.version != 4 or not after.integrity_ok:
        raise ShiguanStorageError("史馆运行库迁移后预检失败")
    connection = None
    try:
        connection = _readonly_connection(target)
        archive_count = connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
    except sqlite3.Error as exc:
        raise ShiguanStorageError("史馆运行库迁移后预检失败") from exc
    finally:
        if connection is not None:
            connection.close()
    return RuntimeDatabaseReport(
        **{
            **after.to_payload(),
            "migrated": True,
            "backup_path": str(backup),
            "archive_count": archive_count,
        }
    )


def migrate_runtime_v4_to_v5(path: Path) -> RuntimeDatabaseReport:
    """Back up, migrate and read back one healthy schema-v4 database."""

    target = path.resolve()
    before = inspect_runtime_database(target)
    if not before.exists or before.version != 4 or not before.integrity_ok:
        raise ShiguanStorageError("史馆运行库不满足 v4 迁移条件")

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
    if not _V4_REQUIRED_TABLES <= tables or "archive_decisions" in tables:
        raise ShiguanStorageError("史馆运行库不满足 v4 迁移条件")

    backup = target.with_name(f"{target.name}.v4-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")
    _copy_backup(target, backup)

    db.migrate_v4_to_v5(target)
    after = inspect_runtime_database(target)
    if after.version != 5 or not after.integrity_ok:
        raise ShiguanStorageError("史馆运行库迁移后预检失败")
    connection = None
    try:
        connection = _readonly_connection(target)
        archive_count = connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
    except sqlite3.Error as exc:
        raise ShiguanStorageError("史馆运行库迁移后计数失败") from exc
    finally:
        if connection is not None:
            connection.close()
    return RuntimeDatabaseReport(
        **{
            **after.to_payload(),
            "migrated": True,
            "backup_path": str(backup),
            "archive_count": archive_count,
        }
    )


def migrate_runtime_v5_to_v6(path: Path) -> RuntimeDatabaseReport:
    """Offline-only v5 migration with a locked, verified SQLite snapshot."""

    target = path.absolute()
    try:
        governed_sqlite_backup._require_regular_file(target)
    except governed_sqlite_backup.BackupError as exc:
        raise ShiguanStorageError("史馆运行库不满足 v5 迁移条件") from exc
    backup = target.with_name(f"{target.name}.v5-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")

    connection: sqlite3.Connection | None = None
    source_directory_descriptor = -1
    source_descriptor = -1
    verification_directory_descriptor = -1
    verification_source_descriptor = -1
    source_directory_status: os.stat_result | None = None
    source_status: os.stat_result | None = None
    legacy_content: dict[str, tuple[int, str]]
    committed = False
    try:
        source_directory_descriptor, source_directory_status = (
            governed_sqlite_backup._open_directory(target.parent)
        )
        source_descriptor, source_status = governed_sqlite_backup._open_regular_rw_at(
            source_directory_descriptor, target.name
        )
        connection = sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(source_descriptor, "rw"),
            uri=True,
            timeout=0,
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, target.name, source_status
        )
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("BEGIN IMMEDIATE")
        try:
            db._validate_v5_predecessor(connection)
            db._validate_v5_identity_namespace(connection)
        except (sqlite3.Error, ValueError) as exc:
            raise ShiguanStorageError("史馆运行库不满足 v5 迁移条件") from exc
        legacy_content = db._legacy_content_snapshot(connection)
        _sqlite_backup_snapshot(source_descriptor, backup)
        _validate_v5_snapshot(backup, legacy_content)
        db._migrate_v5_to_v6_connection(connection)
        connection.commit()
        committed = True
        verification_source_descriptor = governed_sqlite_backup._dup_descriptor(
            source_descriptor
        )
        try:
            verification_directory_descriptor = governed_sqlite_backup._dup_descriptor(
                source_directory_descriptor
            )
        except OSError:
            os.close(verification_source_descriptor)
            verification_source_descriptor = -1
            raise
    except ShiguanStorageError:
        if connection is not None and not committed:
            connection.rollback()
        raise
    except (
        OSError,
        sqlite3.Error,
        ValueError,
        governed_sqlite_backup.BackupError,
    ) as exc:
        if connection is not None and not committed:
            connection.rollback()
        raise ShiguanStorageError("史馆运行库 v5 到 v6 迁移失败") from exc
    finally:
        if connection is not None:
            connection.close()
        if source_descriptor >= 0:
            governed_sqlite_backup._close_fd(source_descriptor)
        if source_directory_descriptor >= 0:
            governed_sqlite_backup._close_fd(source_directory_descriptor)

    # This is deliberately post-commit. Failure leaves PENDING persisted and
    # retains the independently verified v5 snapshot for governed recovery.
    readback: sqlite3.Connection | None = None
    try:
        if source_status is None or source_directory_status is None:
            raise ShiguanStorageError("史馆运行库迁移后验证失败")
        _verify_v6_readback(
            target,
            legacy_content,
            source_descriptor=verification_source_descriptor,
            source_directory_descriptor=verification_directory_descriptor,
            source_status=source_status,
            source_directory_status=source_directory_status,
        )
        governed_sqlite_backup._assert_directory_identity(
            target.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            verification_directory_descriptor, target.name, source_status
        )
        after = inspect_runtime_database(target)
        if after.version != 6 or not after.integrity_ok:
            raise ShiguanStorageError("史馆运行库迁移后验证失败")
        governed_sqlite_backup._assert_directory_identity(
            target.parent, source_directory_status
        )
        governed_sqlite_backup._assert_entry_identity(
            verification_directory_descriptor, target.name, source_status
        )
        readback = sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(
                verification_source_descriptor, "ro"
            ),
            uri=True,
        )
        _validate_current_v6(readback)
        verification = readback.execute(
            "SELECT id, status, verified_at FROM schema_migration_verification"
        ).fetchall()
        if not is_verified_migration_state(verification):
            raise ShiguanStorageError("史馆运行库迁移后验证失败")
        archive_count = readback.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
    except (OSError, sqlite3.Error, governed_sqlite_backup.BackupError) as exc:
        raise ShiguanStorageError("史馆运行库迁移后计数失败") from exc
    finally:
        if readback is not None:
            readback.close()
        if verification_source_descriptor >= 0:
            governed_sqlite_backup._close_fd(verification_source_descriptor)
        if verification_directory_descriptor >= 0:
            governed_sqlite_backup._close_fd(verification_directory_descriptor)
    return RuntimeDatabaseReport(
        **{
            **after.to_payload(),
            "migrated": True,
            "backup_path": str(backup),
            "archive_count": archive_count,
        }
    )


def migrate_runtime_v6_to_v7(path: Path) -> RuntimeDatabaseReport:
    """Offline-only v6 migration with a locked, verified SQLite snapshot."""

    target = path.absolute()
    try:
        governed_sqlite_backup._require_regular_file(target)
    except governed_sqlite_backup.BackupError as exc:
        raise ShiguanStorageError("史馆运行库不满足 v6 迁移条件") from exc
    backup = target.with_name(f"{target.name}.v6-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")

    connection: sqlite3.Connection | None = None
    source_directory_descriptor = -1
    source_descriptor = -1
    verification_directory_descriptor = -1
    verification_source_descriptor = -1
    source_directory_status: os.stat_result | None = None
    source_status: os.stat_result | None = None
    predecessor_content: dict[str, tuple[int, str]]
    committed = False
    try:
        source_directory_descriptor, source_directory_status = (
            governed_sqlite_backup._open_directory(target.parent)
        )
        source_descriptor, source_status = governed_sqlite_backup._open_regular_rw_at(
            source_directory_descriptor, target.name
        )
        connection = sqlite3.connect(
            governed_sqlite_backup._sqlite_uri_for_file(source_descriptor, "rw"),
            uri=True,
            timeout=0,
        )
        governed_sqlite_backup._assert_entry_identity(
            source_directory_descriptor, target.name, source_status
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN IMMEDIATE")
        try:
            _validate_current_v6(connection)
            verification = connection.execute(
                "SELECT id, status, verified_at FROM schema_migration_verification"
            ).fetchall()
            if not is_verified_migration_state(verification):
                raise ValueError("schema-v6 is not verified")
        except (sqlite3.Error, ValueError) as exc:
            raise ShiguanStorageError("史馆运行库不满足 v6 迁移条件") from exc
        predecessor_content = db._v6_content_snapshot(connection)
        _sqlite_backup_snapshot(source_descriptor, backup)
        _validate_v6_snapshot(backup, predecessor_content)
        db._migrate_v6_to_v7_connection(connection)
        connection.commit()
        committed = True
        verification_source_descriptor = governed_sqlite_backup._dup_descriptor(
            source_descriptor
        )
        try:
            verification_directory_descriptor = governed_sqlite_backup._dup_descriptor(
                source_directory_descriptor
            )
        except OSError:
            os.close(verification_source_descriptor)
            verification_source_descriptor = -1
            raise
    except ShiguanStorageError:
        if connection is not None and not committed:
            connection.rollback()
        raise
    except (
        OSError,
        sqlite3.Error,
        ValueError,
        governed_sqlite_backup.BackupError,
    ) as exc:
        if connection is not None and not committed:
            connection.rollback()
        raise ShiguanStorageError("史馆运行库 v6 到 v7 迁移失败") from exc
    finally:
        if connection is not None:
            connection.close()
        if source_descriptor >= 0:
            governed_sqlite_backup._close_fd(source_descriptor)
        if source_directory_descriptor >= 0:
            governed_sqlite_backup._close_fd(source_directory_descriptor)

    verified = False
    try:
        if source_status is None or source_directory_status is None:
            raise ShiguanStorageError("史馆运行库迁移后验证失败")
        after, archive_count = _verify_v7_readback(
            target,
            predecessor_content,
            backup_path=backup,
            source_descriptor=verification_source_descriptor,
            source_directory_descriptor=verification_directory_descriptor,
            source_status=source_status,
            source_directory_status=source_directory_status,
        )
        verified = True
    except (OSError, sqlite3.Error, governed_sqlite_backup.BackupError) as exc:
        raise ShiguanStorageError("史馆运行库迁移后计数失败") from exc
    finally:
        if verification_source_descriptor >= 0:
            try:
                governed_sqlite_backup._close_fd(verification_source_descriptor)
            except OSError:
                if not verified:
                    raise
        if verification_directory_descriptor >= 0:
            try:
                governed_sqlite_backup._close_fd(verification_directory_descriptor)
            except OSError:
                if not verified:
                    raise
    return after


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect or migrate the local Shiguan database")
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--check", action="store_true")
    actions.add_argument("--migrate-v2-to-v3", action="store_true")
    actions.add_argument("--migrate-v3-to-v4", action="store_true")
    actions.add_argument("--migrate-v4-to-v5", action="store_true")
    actions.add_argument("--migrate-v5-to-v6", action="store_true")
    actions.add_argument("--migrate-v6-to-v7", action="store_true")
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
        if args.migrate_v6_to_v7:
            report = migrate_runtime_v6_to_v7(args.database)
        elif args.migrate_v5_to_v6:
            report = migrate_runtime_v5_to_v6(args.database)
        elif args.migrate_v4_to_v5:
            report = migrate_runtime_v4_to_v5(args.database)
        elif args.migrate_v3_to_v4:
            report = migrate_runtime_v3_to_v4(args.database)
        else:
            report = migrate_runtime_v2_to_v3(args.database)
    except ShiguanStorageError:
        report = inspect_runtime_database(args.database)
        print(json.dumps(report.to_payload(), ensure_ascii=False, sort_keys=True))
        return 1
    print(json.dumps(report.to_payload(), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
