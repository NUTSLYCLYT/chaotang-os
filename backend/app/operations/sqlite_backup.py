"""Closed-registry SQLite snapshot, verification, and restore rehearsal.

The module has no production defaults: callers must provide both roots.  It
never restores in place and deliberately accepts only the RC1 registry.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import stat
import subprocess
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.operations.runtime_data_registry import (
    RUNTIME_DATA_ENTRIES,
    RUNTIME_DATA_REGISTRY_DIGEST,
    RuntimeDataEntry,
    schema_contract_digest_connection,
    validated_registered_schema_digest_connection,
)

BACKUP_MANIFEST_NAME = "backup-manifest.json"
_MANIFEST_SCHEMA = "chaotang.sqlite-backup.v2"
_MANIFEST_MAX_BYTES = 1_048_576
_HASH_CHUNK_BYTES = 1024 * 1024
_TRUSTED_SYNTHETIC_ROOT = Path("/tmp")
_ONLINE_MODE = "ONLINE_PER_DATABASE"
_COLD_MODE = "COLD_RELEASE"
_BACKUP_MODES = {_ONLINE_MODE, _COLD_MODE}
_TRUSTED_RUNNER_SHA256 = (
    "sha256:9731695663de08fd4bb65ee2f02d36ed85b3d1355cc54e263a94b2c506946c07"
)
_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
_HEX_64_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_NANOSECOND_PATTERN = re.compile(r"^[1-9][0-9]{0,18}$")
_GIB = 1024 * 1024 * 1024
_MAX_DATABASE_BYTES = 8 * _GIB
_MAX_DATABASE_TOTAL_BYTES = 32 * _GIB
_MAX_ARTIFACT_COUNT = 100_000
_MAX_ARTIFACT_BYTES = 2 * _GIB
_MAX_ARTIFACT_TOTAL_BYTES = 32 * _GIB
_MAX_BACKUP_BYTES = 64 * _GIB
_SPACE_RESERVE_BYTES = _GIB
_RESERVATION_NAME = ".backup-reservation"


class BackupError(RuntimeError):
    """A stable, fail-closed backup contract violation."""


DATABASE_REGISTRY = RUNTIME_DATA_ENTRIES


@dataclass(frozen=True)
class BackupResult:
    destination: Path
    manifest_path: Path
    source_snapshot_identity: str


def _lexists(path: Path) -> bool:
    return os.path.lexists(os.fspath(path))


def _reject_symlink_components(path: Path) -> None:
    absolute = path.absolute()
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current /= part
        if not _lexists(current):
            break
        if stat.S_ISLNK(current.lstat().st_mode):
            raise BackupError("symlink_path")


def _require_directory(path: Path) -> os.stat_result:
    _reject_symlink_components(path)
    try:
        status = path.lstat()
    except FileNotFoundError:
        raise BackupError("missing_directory") from None
    if not stat.S_ISDIR(status.st_mode):
        raise BackupError("directory_required")
    return status


def _assert_directory_identity(path: Path, expected: os.stat_result) -> None:
    try:
        actual = path.lstat()
    except FileNotFoundError:
        raise BackupError("directory_replaced_during_operation") from None
    if not stat.S_ISDIR(actual.st_mode) or not _same_identity(actual, expected):
        raise BackupError("directory_replaced_during_operation")


def _require_regular_file(path: Path) -> os.stat_result:
    _reject_symlink_components(path)
    try:
        status = path.lstat()
    except FileNotFoundError:
        raise BackupError("missing_regular_file") from None
    if not stat.S_ISREG(status.st_mode):
        raise BackupError("regular_file_required")
    if status.st_nlink != 1:
        raise BackupError("hardlink_forbidden")
    return status


def _same_identity(left: os.stat_result, right: os.stat_result) -> bool:
    return (left.st_dev, left.st_ino) == (right.st_dev, right.st_ino)


def _assert_path_identity(path: Path, expected: os.stat_result) -> None:
    try:
        actual = path.lstat()
    except FileNotFoundError:
        raise BackupError("file_replaced_during_operation") from None
    if not stat.S_ISREG(actual.st_mode) or not _same_identity(actual, expected):
        raise BackupError("file_replaced_during_operation")


def _open_directory(path: Path) -> tuple[int, os.stat_result]:
    expected = _require_directory(path)
    flags = (
        os.O_RDONLY
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )
    try:
        descriptor = os.open(path, flags)
    except OSError:
        raise BackupError("safe_directory_open_failed") from None
    actual = os.fstat(descriptor)
    if not stat.S_ISDIR(actual.st_mode) or not _same_identity(actual, expected):
        os.close(descriptor)
        raise BackupError("directory_changed_during_open")
    return descriptor, actual


def _open_directory_at(directory_descriptor: int, name: str) -> tuple[int, os.stat_result]:
    if not name or "/" in name or name in {".", ".."}:
        raise BackupError("unsafe_relative_name")
    flags = (
        os.O_RDONLY
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )
    try:
        descriptor = os.open(name, flags, dir_fd=directory_descriptor)
    except OSError:
        raise BackupError("safe_directory_open_failed") from None
    status = os.fstat(descriptor)
    if not stat.S_ISDIR(status.st_mode):
        os.close(descriptor)
        raise BackupError("directory_required")
    return descriptor, status


def _open_regular_at(directory_descriptor: int, name: str) -> tuple[int, os.stat_result]:
    if not name or "/" in name or name in {".", ".."}:
        raise BackupError("unsafe_relative_name")
    flags = (
        os.O_RDONLY
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NOFOLLOW", 0)
        | getattr(os, "O_NONBLOCK", 0)
    )
    try:
        descriptor = os.open(name, flags, dir_fd=directory_descriptor)
    except OSError:
        raise BackupError("safe_open_failed") from None
    status = os.fstat(descriptor)
    if not stat.S_ISREG(status.st_mode):
        os.close(descriptor)
        raise BackupError("regular_file_required")
    if status.st_nlink != 1:
        os.close(descriptor)
        raise BackupError("hardlink_forbidden")
    return descriptor, status


def _assert_entry_identity(directory_descriptor: int, name: str, expected: os.stat_result) -> None:
    try:
        actual = os.stat(name, dir_fd=directory_descriptor, follow_symlinks=False)
    except OSError:
        raise BackupError("file_replaced_during_operation") from None
    if not stat.S_ISREG(actual.st_mode) or not _same_identity(actual, expected):
        raise BackupError("file_replaced_during_operation")


def _open_regular_readonly(path: Path) -> tuple[int, os.stat_result]:
    expected = _require_regular_file(path)
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError:
        raise BackupError("safe_open_failed") from None
    actual = os.fstat(descriptor)
    identity = (expected.st_dev, expected.st_ino, expected.st_size)
    if not stat.S_ISREG(actual.st_mode) or actual.st_nlink != 1:
        os.close(descriptor)
        raise BackupError("unsafe_file_identity")
    if (actual.st_dev, actual.st_ino, actual.st_size) != identity:
        os.close(descriptor)
        raise BackupError("file_changed_during_open")
    return descriptor, actual


def _sha256_file(path: Path) -> tuple[str, int]:
    directory_descriptor, _ = _open_directory(path.parent)
    try:
        return _sha256_regular_at(directory_descriptor, path.name)
    finally:
        os.close(directory_descriptor)


def _sha256_regular_at(directory_descriptor: int, name: str) -> tuple[str, int]:
    descriptor, status = _open_regular_at(directory_descriptor, name)
    digest = hashlib.sha256()
    try:
        while chunk := os.read(descriptor, _HASH_CHUNK_BYTES):
            digest.update(chunk)
        if os.fstat(descriptor).st_size != status.st_size:
            raise BackupError("file_changed_during_read")
        _assert_entry_identity(directory_descriptor, name, status)
    finally:
        os.close(descriptor)
    return digest.hexdigest(), status.st_size


def _copy_regular_at(
    source_directory: int,
    source_name: str,
    destination_directory: int,
    destination_name: str,
) -> tuple[str, int]:
    source_descriptor, source_status = _open_regular_at(source_directory, source_name)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
    try:
        destination_descriptor = os.open(
            destination_name,
            flags | getattr(os, "O_NOFOLLOW", 0),
            0o600,
            dir_fd=destination_directory,
        )
    except OSError:
        os.close(source_descriptor)
        raise BackupError("destination_create_failed") from None
    digest = hashlib.sha256()
    size = 0
    try:
        while chunk := os.read(source_descriptor, _HASH_CHUNK_BYTES):
            digest.update(chunk)
            size += len(chunk)
            view = memoryview(chunk)
            while view:
                written = os.write(destination_descriptor, view)
                view = view[written:]
        os.fsync(destination_descriptor)
        if os.fstat(source_descriptor).st_size != source_status.st_size:
            raise BackupError("file_changed_during_copy")
        _assert_entry_identity(source_directory, source_name, source_status)
    finally:
        os.close(source_descriptor)
        os.close(destination_descriptor)
    return digest.hexdigest(), size


def _write_all(descriptor: int, content: bytes) -> None:
    view = memoryview(content)
    while view:
        written = os.write(descriptor, view)
        view = view[written:]


def _fsync_directory_descriptor(descriptor: int) -> None:
    os.fsync(descriptor)


def _sqlite_uri_for_file(file_descriptor: int, mode: str) -> str:
    return f"file:/proc/self/fd/{file_descriptor}?mode={mode}"


def _validate_sqlite_sidecars_at(directory_descriptor: int, name: str) -> None:
    for suffix in ("-wal", "-shm"):
        sidecar = f"{name}{suffix}"
        try:
            status = os.stat(sidecar, dir_fd=directory_descriptor, follow_symlinks=False)
        except FileNotFoundError:
            continue
        if not stat.S_ISREG(status.st_mode):
            raise BackupError("regular_file_required")
        if status.st_nlink != 1:
            raise BackupError("hardlink_forbidden")


def _hold_sqlite_sidecars_at(
    directory_descriptor: int, name: str
) -> list[tuple[str, int, os.stat_result]]:
    held: list[tuple[str, int, os.stat_result]] = []
    try:
        for suffix in ("-wal", "-shm"):
            sidecar = f"{name}{suffix}"
            try:
                descriptor, status = _open_regular_at(directory_descriptor, sidecar)
            except BackupError as error:
                try:
                    os.stat(
                        sidecar,
                        dir_fd=directory_descriptor,
                        follow_symlinks=False,
                    )
                except FileNotFoundError:
                    continue
                raise error
            held.append((sidecar, descriptor, status))
        return held
    except Exception:
        for _, descriptor, _ in held:
            os.close(descriptor)
        raise


def _verify_sqlite_sidecars_at(
    directory_descriptor: int,
    database_name: str,
    held: list[tuple[str, int, os.stat_result]],
) -> None:
    for name, descriptor, expected in held:
        actual = os.fstat(descriptor)
        if not stat.S_ISREG(actual.st_mode) or actual.st_nlink != 1:
            raise BackupError("hardlink_forbidden")
        _assert_entry_identity(directory_descriptor, name, expected)
    _validate_sqlite_sidecars_at(directory_descriptor, database_name)


def _close_sqlite_sidecars(
    held: list[tuple[str, int, os.stat_result]],
) -> None:
    for _, descriptor, _ in held:
        os.close(descriptor)


def _sqlite_metadata(path: Path) -> tuple[int, str]:
    directory_descriptor, _ = _open_directory(path.parent)
    try:
        return _sqlite_metadata_at(directory_descriptor, path.name)
    finally:
        os.close(directory_descriptor)


def _sqlite_metadata_at(directory_descriptor: int, name: str) -> tuple[int, str]:
    file_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        file_descriptor, expected = _open_regular_at(directory_descriptor, name)
        sidecars = _hold_sqlite_sidecars_at(directory_descriptor, name)
        with sqlite3.connect(_sqlite_uri_for_file(file_descriptor, "ro"), uri=True) as connection:
            _assert_entry_identity(directory_descriptor, name, expected)
            connection.execute("PRAGMA query_only = ON")
            user_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            rows = connection.execute("PRAGMA integrity_check").fetchall()
            _assert_entry_identity(directory_descriptor, name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, name, sidecars)
    except sqlite3.Error:
        raise BackupError("sqlite_open_or_integrity_failed") from None
    finally:
        if file_descriptor >= 0:
            os.close(file_descriptor)
        _close_sqlite_sidecars(sidecars)
    if rows != [("ok",)]:
        raise BackupError("sqlite_integrity_failed")
    return user_version, "ok"


def _sqlite_schema_digest_at(directory_descriptor: int, name: str) -> str:
    file_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        file_descriptor, expected = _open_regular_at(directory_descriptor, name)
        sidecars = _hold_sqlite_sidecars_at(directory_descriptor, name)
        with sqlite3.connect(_sqlite_uri_for_file(file_descriptor, "ro"), uri=True) as connection:
            _assert_entry_identity(directory_descriptor, name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, name, sidecars)
            digest = schema_contract_digest_connection(connection)
            _assert_entry_identity(directory_descriptor, name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, name, sidecars)
        return digest
    except sqlite3.Error:
        raise BackupError("sqlite_schema_unreadable") from None
    finally:
        if file_descriptor >= 0:
            os.close(file_descriptor)
        _close_sqlite_sidecars(sidecars)


def _validate_registered_sqlite_at(
    directory_descriptor: int,
    registration: RuntimeDataEntry,
) -> tuple[int, str, str]:
    """Validate one registered database, including current semantic state."""

    file_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        file_descriptor, expected = _open_regular_at(
            directory_descriptor, registration.name
        )
        sidecars = _hold_sqlite_sidecars_at(directory_descriptor, registration.name)
        with sqlite3.connect(
            _sqlite_uri_for_file(file_descriptor, "ro"), uri=True
        ) as connection:
            _assert_entry_identity(directory_descriptor, registration.name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, registration.name, sidecars)
            user_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            if user_version != registration.user_version:
                reason = (
                    "future_schema"
                    if user_version > registration.user_version
                    else "schema_mismatch"
                )
                raise BackupError(f"{reason}:{registration.name}")
            actual_schema_digest = validated_registered_schema_digest_connection(
                connection, registration
            )
            if actual_schema_digest is None:
                raise BackupError(f"schema_mismatch:{registration.name}")
            integrity_rows = connection.execute("PRAGMA integrity_check").fetchall()
            foreign_key_rows = connection.execute("PRAGMA foreign_key_check").fetchall()
            _assert_entry_identity(directory_descriptor, registration.name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, registration.name, sidecars)
    except sqlite3.Error:
        raise BackupError("sqlite_open_or_integrity_failed") from None
    finally:
        if file_descriptor >= 0:
            os.close(file_descriptor)
        _close_sqlite_sidecars(sidecars)
    if integrity_rows != [("ok",)]:
        raise BackupError("sqlite_integrity_failed")
    if foreign_key_rows:
        raise BackupError("sqlite_foreign_key_check_failed")
    return user_version, "ok", actual_schema_digest


def _sqlite_page_bytes_at(directory_descriptor: int, name: str) -> int:
    file_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        file_descriptor, expected = _open_regular_at(directory_descriptor, name)
        sidecars = _hold_sqlite_sidecars_at(directory_descriptor, name)
        with sqlite3.connect(_sqlite_uri_for_file(file_descriptor, "ro"), uri=True) as connection:
            connection.execute("PRAGMA query_only = ON")
            page_count = int(connection.execute("PRAGMA page_count").fetchone()[0])
            page_size = int(connection.execute("PRAGMA page_size").fetchone()[0])
            _assert_entry_identity(directory_descriptor, name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, name, sidecars)
    except sqlite3.Error:
        raise BackupError("sqlite_budget_unreadable") from None
    finally:
        if file_descriptor >= 0:
            os.close(file_descriptor)
        _close_sqlite_sidecars(sidecars)
    result = page_count * page_size
    if result < 0 or result > _MAX_DATABASE_BYTES:
        raise BackupError("database_budget_exceeded")
    return result


def _estimate_backup_upper_bound(source_descriptor: int, present_databases: set[str]) -> int:
    database_total = sum(
        _sqlite_page_bytes_at(source_descriptor, registration.name)
        for registration in DATABASE_REGISTRY
        if registration.name in present_databases
    )
    if database_total > _MAX_DATABASE_TOTAL_BYTES:
        raise BackupError("database_budget_exceeded")
    artifact_total = 0
    artifact_count = 0
    if "report_artifacts.sqlite3" in present_databases:
        artifact_descriptor, _ = _open_directory_at(source_descriptor, "report_artifacts")
        try:
            for item in os.scandir(artifact_descriptor):
                descriptor, status = _open_regular_at(artifact_descriptor, item.name)
                os.close(descriptor)
                artifact_count += 1
                if artifact_count > _MAX_ARTIFACT_COUNT or status.st_size > _MAX_ARTIFACT_BYTES:
                    raise BackupError("artifact_budget_exceeded")
                artifact_total += status.st_size
                if artifact_total > _MAX_ARTIFACT_TOTAL_BYTES:
                    raise BackupError("artifact_budget_exceeded")
        finally:
            os.close(artifact_descriptor)
    total = database_total + artifact_total
    if total > _MAX_BACKUP_BYTES:
        raise BackupError("backup_budget_exceeded")
    return total


def _require_destination_capacity(parent: Path, upper_bound: int) -> None:
    try:
        filesystem = os.statvfs(parent)
    except OSError:
        raise BackupError("destination_capacity_unavailable") from None
    available = filesystem.f_bavail * filesystem.f_frsize
    if available < upper_bound + _SPACE_RESERVE_BYTES:
        raise BackupError("insufficient_destination_space")


def _snapshot_sqlite_at(
    source_directory: int,
    source_name: str,
    destination_directory: int,
    destination_name: str,
    registration: RuntimeDataEntry,
) -> str:
    source_descriptor = -1
    destination_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        source_descriptor, source_status = _open_regular_at(source_directory, source_name)
        sidecars = _hold_sqlite_sidecars_at(source_directory, source_name)
        flags = (
            os.O_RDWR
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_CLOEXEC", 0)
            | getattr(os, "O_NOFOLLOW", 0)
        )
        destination_descriptor = os.open(
            destination_name, flags, 0o600, dir_fd=destination_directory
        )
        destination_status = os.fstat(destination_descriptor)
        with sqlite3.connect(
            _sqlite_uri_for_file(source_descriptor, "ro"), uri=True
        ) as source_connection:
            _assert_entry_identity(source_directory, source_name, source_status)
            _verify_sqlite_sidecars_at(source_directory, source_name, sidecars)
            source_schema_digest = validated_registered_schema_digest_connection(
                source_connection, registration
            )
            if source_schema_digest is None:
                raise BackupError(f"schema_mismatch:{registration.name}")
            with sqlite3.connect(
                _sqlite_uri_for_file(destination_descriptor, "rw"), uri=True
            ) as destination_connection:
                source_connection.backup(destination_connection)
                destination_connection.execute("PRAGMA journal_mode = DELETE")
            _assert_entry_identity(destination_directory, destination_name, destination_status)
            _assert_entry_identity(source_directory, source_name, source_status)
            _verify_sqlite_sidecars_at(source_directory, source_name, sidecars)
        os.fsync(destination_descriptor)
        return source_schema_digest
    except FileExistsError:
        raise BackupError("destination_create_failed") from None
    except OSError:
        raise BackupError("destination_create_failed") from None
    except sqlite3.Error:
        raise BackupError("sqlite_backup_failed") from None
    finally:
        if source_descriptor >= 0:
            os.close(source_descriptor)
        if destination_descriptor >= 0:
            os.close(destination_descriptor)
        _close_sqlite_sidecars(sidecars)


def _referenced_artifacts(database: Path) -> list[dict[str, Any]]:
    directory_descriptor, _ = _open_directory(database.parent)
    try:
        return _referenced_artifacts_at(directory_descriptor, database.name)
    finally:
        os.close(directory_descriptor)


def _referenced_artifacts_at(directory_descriptor: int, database_name: str) -> list[dict[str, Any]]:
    file_descriptor = -1
    sidecars: list[tuple[str, int, os.stat_result]] = []
    try:
        file_descriptor, expected = _open_regular_at(directory_descriptor, database_name)
        sidecars = _hold_sqlite_sidecars_at(directory_descriptor, database_name)
        with sqlite3.connect(_sqlite_uri_for_file(file_descriptor, "ro"), uri=True) as connection:
            _assert_entry_identity(directory_descriptor, database_name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, database_name, sidecars)
            connection.execute("PRAGMA query_only = ON")
            rows = connection.execute(
                "SELECT artifact_id, file_sha256, state FROM report_artifacts ORDER BY artifact_id"
            ).fetchall()
            _assert_entry_identity(directory_descriptor, database_name, expected)
            _verify_sqlite_sidecars_at(directory_descriptor, database_name, sidecars)
    except sqlite3.Error:
        raise BackupError("artifact_registry_unreadable") from None
    finally:
        if file_descriptor >= 0:
            os.close(file_descriptor)
        _close_sqlite_sidecars(sidecars)
    references: list[dict[str, Any]] = []
    for artifact_id, expected_hash, state_name in rows:
        if (
            not isinstance(artifact_id, str)
            or not artifact_id
            or any(
                character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
                for character in artifact_id
            )
        ):
            raise BackupError("artifact_id_invalid")
        if not isinstance(expected_hash, str) or len(expected_hash) != 64:
            raise BackupError("artifact_digest_invalid")
        try:
            int(expected_hash, 16)
        except ValueError:
            raise BackupError("artifact_digest_invalid") from None
        if state_name not in {"PUBLISHED", "PENDING", "ABORTED"}:
            raise BackupError("artifact_state_invalid")
        if state_name == "PENDING":
            raise BackupError("artifact_not_published")
        if state_name == "ABORTED":
            continue
        references.append(
            {
                "artifactId": artifact_id,
                "databaseName": "report_artifacts.sqlite3",
                "expectedSha256": expected_hash,
                "relativePath": f"report_artifacts/{artifact_id}.xlsx",
            }
        )
    return references


def _canonical_bytes(value: Any) -> bytes:
    encoded = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return f"{encoded}\n".encode()


def _canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode()


def _digest_canonical(value: Any) -> str:
    return f"sha256:{hashlib.sha256(_canonical_json_bytes(value)).hexdigest()}"


def _canonical_now(clock: Any | None = None) -> str:
    value = (clock or (lambda: datetime.now(UTC)))()
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise BackupError("clock_invalid")
    value = value.astimezone(UTC)
    return value.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _root_identity(status: os.stat_result) -> dict[str, Any]:
    return {"device": status.st_dev, "inode": status.st_ino, "type": "DIRECTORY"}


def _epoch_nanoseconds(value: str) -> int:
    if not _is_canonical_time(value):
        raise BackupError("writer_stop_evidence_invalid")
    parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    delta = parsed - datetime(1970, 1, 1, tzinfo=UTC)
    return (delta.days * 86_400 + delta.seconds) * 1_000_000_000 + parsed.microsecond * 1_000


def _validate_writer_stop_evidence(
    evidence: Any,
    source_root_identity: dict[str, Any],
    *,
    captured_at: str | None = None,
) -> dict[str, Any]:
    if not isinstance(evidence, dict):
        raise BackupError("writer_stop_evidence_invalid")
    _require_keys(
        evidence,
        {
            "backendContainerId",
            "backendImageDigest",
            "daemonIdentity",
            "dataRootIdentityAfter",
            "dataRootIdentityBefore",
            "eventStreamSessionId",
            "evidenceDigest",
            "expectedStopEvent",
            "observedAtAfter",
            "observedAtBefore",
            "postStopWriterEvents",
            "rolloutLockIdentity",
            "runnerSessionId",
            "schemaVersion",
            "stateAfter",
            "stateBefore",
            "stoppedWatermark",
            "streamCompletedAt",
            "streamStartedAt",
        },
        "writer_stop_evidence_invalid",
    )
    if (
        evidence["schemaVersion"] != "chaotang.writer-stop-evidence.v1"
        or not isinstance(evidence["runnerSessionId"], str)
        or not _UUID_PATTERN.fullmatch(evidence["runnerSessionId"])
        or not isinstance(evidence["eventStreamSessionId"], str)
        or not _UUID_PATTERN.fullmatch(evidence["eventStreamSessionId"])
        or not isinstance(evidence["backendContainerId"], str)
        or not _HEX_64_PATTERN.fullmatch(evidence["backendContainerId"])
        or not _is_sha256(evidence["backendImageDigest"])
        or evidence["stateBefore"] != "STOPPED"
        or evidence["stateAfter"] != "STOPPED"
        or evidence["postStopWriterEvents"] != []
    ):
        raise BackupError("writer_stop_evidence_invalid")
    for key in ("dataRootIdentityBefore", "dataRootIdentityAfter"):
        if evidence[key] != source_root_identity:
            raise BackupError("writer_stop_evidence_invalid")
    _require_keys(
        evidence["daemonIdentity"],
        {"apiVersion", "daemonId"},
        "writer_stop_evidence_invalid",
    )
    if not all(
        isinstance(evidence["daemonIdentity"][key], str)
        and 0 < len(evidence["daemonIdentity"][key]) <= 128
        for key in ("apiVersion", "daemonId")
    ):
        raise BackupError("writer_stop_evidence_invalid")
    lock = evidence["rolloutLockIdentity"]
    _require_keys(
        lock,
        {"device", "inode", "uid", "mode", "nlink", "lockDigest"},
        "writer_stop_evidence_invalid",
    )
    if not all(
        _is_nonnegative_int(lock[key]) for key in ("device", "inode", "uid", "mode", "nlink")
    ):
        raise BackupError("writer_stop_evidence_invalid")
    expected_lock_digest = _digest_canonical(
        {
            "schemaVersion": "chaotang.rollout-lock-identity.v1",
            "runnerSessionId": evidence["runnerSessionId"],
            **{key: lock[key] for key in ("device", "inode", "uid", "mode", "nlink")},
        }
    )
    if lock["lockDigest"] != expected_lock_digest:
        raise BackupError("writer_stop_evidence_invalid")
    event = evidence["expectedStopEvent"]
    _require_keys(
        event,
        {"action", "containerId", "eventDigest", "imageDigest", "timeNano"},
        "writer_stop_evidence_invalid",
    )
    if (
        event["action"] != "die"
        or event["containerId"] != evidence["backendContainerId"]
        or event["imageDigest"] != evidence["backendImageDigest"]
        or not isinstance(event["timeNano"], str)
        or not _NANOSECOND_PATTERN.fullmatch(event["timeNano"])
    ):
        raise BackupError("writer_stop_evidence_invalid")
    event_nanoseconds = int(event["timeNano"])
    if event_nanoseconds > 9_223_372_036_854_775_807:
        raise BackupError("writer_stop_evidence_invalid")
    if event["eventDigest"] != _digest_canonical(
        {
            "schemaVersion": "chaotang.docker-writer-event.v1",
            "containerId": event["containerId"],
            "imageDigest": event["imageDigest"],
            "action": event["action"],
            "timeNano": event["timeNano"],
        }
    ):
        raise BackupError("writer_stop_evidence_invalid")
    watermark = evidence["stoppedWatermark"]
    if not isinstance(watermark, str) or not _NANOSECOND_PATTERN.fullmatch(watermark):
        raise BackupError("writer_stop_evidence_invalid")
    watermark_nanoseconds = int(watermark)
    if watermark_nanoseconds > 9_223_372_036_854_775_807:
        raise BackupError("writer_stop_evidence_invalid")
    timestamps = [
        evidence["streamStartedAt"],
        evidence["observedAtBefore"],
        evidence["observedAtAfter"],
        evidence["streamCompletedAt"],
    ]
    if captured_at is not None:
        timestamps.append(captured_at)
    values = [_epoch_nanoseconds(value) for value in timestamps]
    if not (
        values[0]
        < event_nanoseconds
        <= watermark_nanoseconds
        <= values[1]
        <= values[2]
        <= values[3]
        and (captured_at is None or values[3] <= values[4])
    ):
        raise BackupError("writer_stop_evidence_invalid")
    if evidence["evidenceDigest"] != _digest_canonical(
        {key: value for key, value in evidence.items() if key != "evidenceDigest"}
    ):
        raise BackupError("writer_stop_evidence_invalid")
    return evidence


def _validate_writer_stop_before(
    evidence: Any,
    source_root_identity: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(evidence, dict):
        raise BackupError("writer_stop_evidence_invalid")
    _require_keys(
        evidence,
        {
            "backendContainerId",
            "backendImageDigest",
            "beforeDigest",
            "daemonIdentity",
            "dataRootIdentityBefore",
            "eventStreamSessionId",
            "expectedStopEvent",
            "observedAtBefore",
            "rolloutLockIdentity",
            "runnerProcessIdentity",
            "runnerSessionId",
            "schemaVersion",
            "stateBefore",
            "stoppedWatermark",
            "streamStartedAt",
        },
        "writer_stop_evidence_invalid",
    )
    if (
        evidence["schemaVersion"] != "chaotang.writer-stop-before.v1"
        or not isinstance(evidence["runnerSessionId"], str)
        or not _UUID_PATTERN.fullmatch(evidence["runnerSessionId"])
        or not isinstance(evidence["eventStreamSessionId"], str)
        or not _UUID_PATTERN.fullmatch(evidence["eventStreamSessionId"])
        or not isinstance(evidence["backendContainerId"], str)
        or not _HEX_64_PATTERN.fullmatch(evidence["backendContainerId"])
        or not _is_sha256(evidence["backendImageDigest"])
        or evidence["stateBefore"] != "STOPPED"
        or evidence["dataRootIdentityBefore"] != source_root_identity
    ):
        raise BackupError("writer_stop_evidence_invalid")
    process_identity = evidence["runnerProcessIdentity"]
    _require_keys(
        process_identity,
        {
            "argumentsDigest",
            "candidateCommit",
            "candidateTree",
            "executable",
            "moduleDigests",
            "pid",
            "privilegeModel",
            "repositoryRoot",
            "scriptArgument",
            "scriptPath",
            "scriptSha256",
            "uid",
        },
        "writer_stop_evidence_invalid",
    )
    parent_pid = os.getppid()
    try:
        parent_root = Path(f"/proc/{parent_pid}")
        executable = Path(os.readlink(parent_root / "exe")).resolve(strict=True)
        parent_cwd = Path(os.readlink(parent_root / "cwd")).resolve(strict=True)
        command = (parent_root / "cmdline").read_bytes()
        arguments = [
            value.decode("utf-8", errors="strict")
            for value in command.split(b"\0")
            if value
        ]
        environment_entries = [
            value.decode("utf-8", errors="strict")
            for value in (parent_root / "environ").read_bytes().split(b"\0")
            if value
        ]
        environment_keys: set[str] = set()
        for entry in environment_entries:
            if "=" not in entry:
                raise ValueError("invalid parent environment")
            key = entry.split("=", 1)[0]
            if key in environment_keys:
                raise ValueError("duplicate parent environment")
            environment_keys.add(key)
        if environment_keys.intersection(
            {
                "DYLD_INSERT_LIBRARIES",
                "DYLD_LIBRARY_PATH",
                "LD_LIBRARY_PATH",
                "LD_PRELOAD",
                "NODE_OPTIONS",
                "NODE_PATH",
            }
        ):
            raise ValueError("injected parent environment")
        status_lines = (parent_root / "status").read_text(encoding="utf-8").splitlines()
        uid_line = next(line for line in status_lines if line.startswith("Uid:"))
        effective_uid = int(uid_line.split()[2])
        script_path = Path(process_identity["scriptPath"])
        repository_root = Path(process_identity["repositoryRoot"])
        script_argument = process_identity["scriptArgument"]
        argument_path = Path(script_argument)
        if not argument_path.is_absolute():
            argument_path = parent_cwd / argument_path
        script_digest, _ = _sha256_file(script_path)
        git_environment = {
            "PATH": "/usr/bin:/bin",
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_CONFIG_SYSTEM": "/dev/null",
            "GIT_OPTIONAL_LOCKS": "0",
            "LC_ALL": "C",
        }
        git_base = [
            "/usr/bin/git",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.hooksPath=/dev/null",
            "--no-replace-objects",
        ]
        candidate_commit = subprocess.run(
            [*git_base, "rev-parse", "HEAD^{commit}"],
            cwd=repository_root,
            env=git_environment,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        candidate_tree = subprocess.run(
            [*git_base, "rev-parse", "HEAD^{tree}"],
            cwd=repository_root,
            env=git_environment,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        repository_info = repository_root.lstat()
        module_digests = process_identity["moduleDigests"]
        expected_modules = {
            "scripts/build_offline_release.mjs",
            "scripts/execution_authority_ext.mjs",
            "scripts/product-authority.mjs",
            "scripts/run_rc1_release_acceptance.mjs",
            "scripts/verify_offline_release.mjs",
        }
        if not isinstance(module_digests, list) or len(module_digests) != len(expected_modules):
            raise ValueError("runner module set invalid")
        observed_modules: set[str] = set()
        for module in module_digests:
            _require_keys(
                module,
                {"relativePath", "sha256"},
                "writer_stop_evidence_invalid",
            )
            relative_path = module["relativePath"]
            if relative_path not in expected_modules or relative_path in observed_modules:
                raise ValueError("runner module set invalid")
            observed_modules.add(relative_path)
            module_path = repository_root / relative_path
            module_info = module_path.lstat()
            module_digest, _ = _sha256_file(module_path)
            committed_module = subprocess.run(
                [*git_base, "show", f"{candidate_commit}:{relative_path}"],
                cwd=repository_root,
                env=git_environment,
                check=True,
                capture_output=True,
            ).stdout
            if (
                not stat.S_ISREG(module_info.st_mode)
                or module_info.st_nlink != 1
                or module_info.st_uid != 0
                or module_info.st_mode & 0o022
                or module_path.resolve(strict=True) != module_path
                or module["sha256"] != f"sha256:{module_digest}"
                or hashlib.sha256(committed_module).hexdigest() != module_digest
            ):
                raise ValueError("runner module identity invalid")
    except (
        OSError,
        subprocess.SubprocessError,
        UnicodeDecodeError,
        TypeError,
        ValueError,
        StopIteration,
    ):
        raise BackupError("writer_stop_evidence_invalid") from None
    allowed_cli_keys = {
        "--candidate",
        "--tree",
        "--source-date-epoch",
        "--docker-endpoint",
        "--docker-context",
        "--docker-context-config-dir",
        "--evidence-dir",
        "--egress-evidence",
        "--release-expectation",
        "--release-phase",
        "--rounds",
        "--repository",
    }
    remaining_arguments = arguments[2:]
    operator_cli = (
        len(remaining_arguments) == 2
        and remaining_arguments[0] == "--operator-inputs"
        and Path(remaining_arguments[1]).is_absolute()
    )
    acceptance_cli = (
        len(remaining_arguments) == len(allowed_cli_keys) * 2
        and set(remaining_arguments[::2]) == allowed_cli_keys
        and len(set(remaining_arguments[::2])) == len(allowed_cli_keys)
        and all(remaining_arguments[index] for index in range(1, len(remaining_arguments), 2))
    )
    if (
        process_identity["pid"] != parent_pid
        or process_identity["uid"] != effective_uid
        or effective_uid < 0
        or process_identity["privilegeModel"]
        != (
            "TRUSTED_ROOT_ORCHESTRATOR"
            if effective_uid == 0
            else "SEALED_NON_ROOT_RUNNER"
        )
        or process_identity["executable"] != os.fspath(executable)
        or len(arguments) < 4
        or Path(arguments[0]).resolve(strict=True) != executable
        or arguments[1] != script_argument
        or not (operator_cli or acceptance_cli)
        or process_identity["argumentsDigest"]
        != "sha256:" + hashlib.sha256("\0".join(arguments).encode("utf-8")).hexdigest()
        or script_path != repository_root / "scripts/run_rc1_release_acceptance.mjs"
        or script_path.name != "run_rc1_release_acceptance.mjs"
        or script_path.resolve(strict=True) != argument_path.resolve(strict=True)
        or parent_cwd != repository_root
        or not stat.S_ISDIR(repository_info.st_mode)
        or repository_info.st_uid != 0
        or repository_info.st_mode & 0o022
        or observed_modules != expected_modules
        or process_identity["scriptSha256"] != f"sha256:{script_digest}"
        or process_identity["scriptSha256"] != _TRUSTED_RUNNER_SHA256
        or process_identity["candidateCommit"] != candidate_commit
        or process_identity["candidateTree"] != candidate_tree
    ):
        raise BackupError("writer_stop_evidence_invalid")
    _require_keys(
        evidence["daemonIdentity"],
        {"apiVersion", "daemonId"},
        "writer_stop_evidence_invalid",
    )
    if not all(
        isinstance(evidence["daemonIdentity"][key], str)
        and 0 < len(evidence["daemonIdentity"][key]) <= 128
        for key in ("apiVersion", "daemonId")
    ):
        raise BackupError("writer_stop_evidence_invalid")
    lock = evidence["rolloutLockIdentity"]
    _require_keys(
        lock,
        {"device", "inode", "uid", "mode", "nlink", "lockDigest"},
        "writer_stop_evidence_invalid",
    )
    if not all(
        _is_nonnegative_int(lock[key])
        for key in ("device", "inode", "uid", "mode", "nlink")
    ):
        raise BackupError("writer_stop_evidence_invalid")
    expected_lock_digest = _digest_canonical(
        {
            "schemaVersion": "chaotang.rollout-lock-identity.v1",
            "runnerSessionId": evidence["runnerSessionId"],
            **{key: lock[key] for key in ("device", "inode", "uid", "mode", "nlink")},
        }
    )
    if lock["lockDigest"] != expected_lock_digest:
        raise BackupError("writer_stop_evidence_invalid")
    event = evidence["expectedStopEvent"]
    _require_keys(
        event,
        {"action", "containerId", "eventDigest", "imageDigest", "timeNano"},
        "writer_stop_evidence_invalid",
    )
    if (
        event["action"] != "die"
        or event["containerId"] != evidence["backendContainerId"]
        or event["imageDigest"] != evidence["backendImageDigest"]
        or not isinstance(event["timeNano"], str)
        or not _NANOSECOND_PATTERN.fullmatch(event["timeNano"])
        or int(event["timeNano"]) > 9_223_372_036_854_775_807
        or event["eventDigest"]
        != _digest_canonical(
            {
                "schemaVersion": "chaotang.docker-writer-event.v1",
                "containerId": event["containerId"],
                "imageDigest": event["imageDigest"],
                "action": event["action"],
                "timeNano": event["timeNano"],
            }
        )
    ):
        raise BackupError("writer_stop_evidence_invalid")
    watermark = evidence["stoppedWatermark"]
    if (
        not isinstance(watermark, str)
        or not _NANOSECOND_PATTERN.fullmatch(watermark)
        or int(watermark) > 9_223_372_036_854_775_807
    ):
        raise BackupError("writer_stop_evidence_invalid")
    stream_started = _epoch_nanoseconds(evidence["streamStartedAt"])
    observed_before = _epoch_nanoseconds(evidence["observedAtBefore"])
    if not stream_started < int(event["timeNano"]) <= int(watermark) <= observed_before:
        raise BackupError("writer_stop_evidence_invalid")
    if evidence["beforeDigest"] != _digest_canonical(
        {key: value for key, value in evidence.items() if key != "beforeDigest"}
    ):
        raise BackupError("writer_stop_evidence_invalid")
    return evidence


def _match_writer_stop_final(before: dict[str, Any], final: dict[str, Any]) -> None:
    mapping = {
        "backendContainerId": "backendContainerId",
        "backendImageDigest": "backendImageDigest",
        "daemonIdentity": "daemonIdentity",
        "dataRootIdentityBefore": "dataRootIdentityBefore",
        "eventStreamSessionId": "eventStreamSessionId",
        "expectedStopEvent": "expectedStopEvent",
        "observedAtBefore": "observedAtBefore",
        "rolloutLockIdentity": "rolloutLockIdentity",
        "runnerSessionId": "runnerSessionId",
        "stateBefore": "stateBefore",
        "stoppedWatermark": "stoppedWatermark",
        "streamStartedAt": "streamStartedAt",
    }
    if any(before[left] != final[right] for left, right in mapping.items()):
        raise BackupError("writer_stop_evidence_invalid")


def _snapshot_identity(
    mode: str,
    source_root_identity: dict[str, Any],
    databases: list[dict[str, Any]],
    artifacts: list[dict[str, Any]],
) -> str:
    return _digest_canonical(
        {
            "artifacts": artifacts,
            "databases": databases,
            "mode": mode,
            "runtimeRegistryDigest": RUNTIME_DATA_REGISTRY_DIGEST,
            "sourceRootIdentity": source_root_identity,
        }
    )


def _validate_source_registry_at(source_descriptor: int) -> set[str]:
    expected = {entry.name for entry in DATABASE_REGISTRY}
    allowed_sidecars = {f"{name}{suffix}" for name in expected for suffix in ("-wal", "-shm")}
    allowed = expected | allowed_sidecars | {"report_artifacts"}
    present = {entry.name for entry in os.scandir(source_descriptor)}
    unknown = sorted(present - allowed)
    if unknown:
        if unknown[0] == "credentials":
            raise BackupError("sensitive_entry_present")
        raise BackupError(f"unknown_entry:{unknown[0]}")
    present_databases = expected & present
    for registration in DATABASE_REGISTRY:
        if registration.name in present_databases:
            _validate_registered_sqlite_at(source_descriptor, registration)
    for name in sorted(present & allowed_sidecars):
        if name.removesuffix("-wal").removesuffix("-shm") not in present_databases:
            raise BackupError(f"orphan_sqlite_sidecar:{name}")
        descriptor, _ = _open_regular_at(source_descriptor, name)
        os.close(descriptor)
    report_database_present = "report_artifacts.sqlite3" in present_databases
    artifact_root_present = "report_artifacts" in present
    if report_database_present != artifact_root_present:
        raise BackupError("artifact_presence_mismatch")
    if artifact_root_present:
        artifact_descriptor, _ = _open_directory_at(source_descriptor, "report_artifacts")
        os.close(artifact_descriptor)
    return present_databases


def _validate_source_registry(source_root: Path) -> os.stat_result:
    source_descriptor, source_status = _open_directory(source_root)
    try:
        _validate_source_registry_at(source_descriptor)
        _assert_directory_identity(source_root, source_status)
    finally:
        os.close(source_descriptor)
    return source_status


def _create_new_root_open(path: Path) -> tuple[int, os.stat_result]:
    _reject_symlink_components(path.parent)
    parent_descriptor, _ = _open_directory(path.parent)
    try:
        try:
            existing = os.stat(path.name, dir_fd=parent_descriptor, follow_symlinks=False)
        except FileNotFoundError:
            existing = None
        if existing is not None:
            if stat.S_ISLNK(existing.st_mode):
                raise BackupError("symlink_path")
            raise FileExistsError(path)
        try:
            os.mkdir(path.name, mode=0o700, dir_fd=parent_descriptor)
        except FileExistsError:
            raise
        except OSError:
            raise BackupError("destination_create_failed") from None
        descriptor, status = _open_directory_at(parent_descriptor, path.name)
    finally:
        os.close(parent_descriptor)
    try:
        _assert_directory_identity(path, status)
    except Exception:
        os.close(descriptor)
        raise
    return descriptor, status


def _create_new_root(path: Path) -> os.stat_result:
    descriptor, status = _create_new_root_open(path)
    os.close(descriptor)
    return status


def _require_disjoint_roots(source: Path, destination: Path) -> None:
    try:
        canonical_source = source.resolve(strict=True)
        canonical_destination = destination.parent.resolve(strict=True) / destination.name
    except OSError:
        raise BackupError("root_path_invalid") from None
    if canonical_destination.is_relative_to(canonical_source) or canonical_source.is_relative_to(
        canonical_destination
    ):
        raise BackupError("source_destination_overlap")


def _remove_directory_contents_at(directory_descriptor: int) -> None:
    for entry in os.scandir(directory_descriptor):
        status = entry.stat(follow_symlinks=False)
        if stat.S_ISREG(status.st_mode):
            os.unlink(entry.name, dir_fd=directory_descriptor)
            continue
        if stat.S_ISDIR(status.st_mode):
            child_descriptor, child_status = _open_directory_at(
                directory_descriptor, entry.name
            )
            try:
                _remove_directory_contents_at(child_descriptor)
                current = os.stat(
                    entry.name, dir_fd=directory_descriptor, follow_symlinks=False
                )
                if not stat.S_ISDIR(current.st_mode) or not _same_identity(
                    current, child_status
                ):
                    raise BackupError("backup_cleanup_failed")
            finally:
                os.close(child_descriptor)
            os.rmdir(entry.name, dir_fd=directory_descriptor)
            continue
        raise BackupError("backup_cleanup_failed")


def _remove_created_backup_root(
    destination: Path, expected_status: os.stat_result
) -> None:
    parent_descriptor, _ = _open_directory(destination.parent)
    root_descriptor = -1
    try:
        actual = os.stat(destination.name, dir_fd=parent_descriptor, follow_symlinks=False)
        if not stat.S_ISDIR(actual.st_mode) or not _same_identity(actual, expected_status):
            raise BackupError("backup_cleanup_failed")
        root_descriptor, opened = _open_directory_at(parent_descriptor, destination.name)
        if not _same_identity(opened, expected_status):
            raise BackupError("backup_cleanup_failed")
        _remove_directory_contents_at(root_descriptor)
        _fsync_directory_descriptor(root_descriptor)
        os.close(root_descriptor)
        root_descriptor = -1
        current = os.stat(
            destination.name, dir_fd=parent_descriptor, follow_symlinks=False
        )
        if not stat.S_ISDIR(current.st_mode) or not _same_identity(
            current, expected_status
        ):
            raise BackupError("backup_cleanup_failed")
        os.rmdir(destination.name, dir_fd=parent_descriptor)
        _fsync_directory_descriptor(parent_descriptor)
    except (BackupError, OSError):
        raise BackupError("backup_cleanup_failed") from None
    finally:
        if root_descriptor >= 0:
            os.close(root_descriptor)
        os.close(parent_descriptor)


def _backup_runtime_once(
    source_root: Path,
    destination: Path,
    *,
    mode: str = _ONLINE_MODE,
    writer_stop_session: _WriterStopSession | None = None,
    clock: Any | None = None,
) -> BackupResult:
    """Snapshot the complete approved runtime registry into a new root."""
    if mode not in _BACKUP_MODES:
        raise BackupError("backup_mode_invalid")
    if mode == _ONLINE_MODE and writer_stop_session is not None:
        raise BackupError("writer_stop_evidence_forbidden")
    if mode == _COLD_MODE and type(writer_stop_session) is not _WriterStopSession:
        raise BackupError("writer_stop_evidence_required")
    source_root = Path(source_root)
    destination = Path(destination)
    _require_disjoint_roots(source_root, destination)
    source_descriptor, source_status = _open_directory(source_root)
    destination_descriptor = -1
    destination_status: os.stat_result | None = None
    source_artifact_descriptor = -1
    destination_artifact_descriptor = -1
    reservation_descriptor = -1
    reservation_status: os.stat_result | None = None
    reservation_remaining = 0
    result: BackupResult | None = None
    failure: Exception | None = None
    writer_stop_before: dict[str, Any] | None = None
    writer_stop_evidence: dict[str, Any] | None = None
    try:
        present_databases = _validate_source_registry_at(source_descriptor)
        upper_bound = _estimate_backup_upper_bound(source_descriptor, present_databases)
        _require_destination_capacity(destination.parent, upper_bound)
        source_root_identity = _root_identity(source_status)
        if mode == _COLD_MODE:
            writer_stop_before = writer_stop_session(
                "before", {"sourceRootIdentity": source_root_identity}
            )
            writer_stop_before = json.loads(_canonical_json_bytes(writer_stop_before))
            _validate_writer_stop_before(writer_stop_before, source_root_identity)
        destination_descriptor, destination_status = _create_new_root_open(destination)
        reservation_descriptor = os.open(
            _RESERVATION_NAME,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_CLOEXEC", 0)
            | getattr(os, "O_NOFOLLOW", 0),
            0o600,
            dir_fd=destination_descriptor,
        )
        reservation_status = os.fstat(reservation_descriptor)
        try:
            os.posix_fallocate(reservation_descriptor, 0, upper_bound)
        except (AttributeError, OSError):
            raise BackupError("destination_reservation_failed") from None
        reservation_remaining = upper_bound

        def release_reservation(written: int) -> None:
            nonlocal reservation_remaining
            reservation_remaining = max(0, reservation_remaining - written)
            os.ftruncate(reservation_descriptor, reservation_remaining)

        if "report_artifacts.sqlite3" in present_databases:
            os.mkdir("report_artifacts", mode=0o700, dir_fd=destination_descriptor)
            source_artifact_descriptor, _ = _open_directory_at(
                source_descriptor, "report_artifacts"
            )
            destination_artifact_descriptor, _ = _open_directory_at(
                destination_descriptor, "report_artifacts"
            )

        def assert_roots() -> None:
            _assert_directory_identity(source_root, source_status)
            _assert_directory_identity(destination, destination_status)

        assert_roots()
        database_manifest: list[dict[str, Any]] = []
        for registration in DATABASE_REGISTRY:
            if registration.name not in present_databases:
                database_manifest.append(
                    {
                        "name": registration.name,
                        "presence": "ABSENT",
                    }
                )
                continue
            capture_started_at = _canonical_now(clock)
            source_version, _, source_schema_digest = _validate_registered_sqlite_at(
                source_descriptor, registration
            )
            snapshot_source_schema_digest = _snapshot_sqlite_at(
                source_descriptor,
                registration.name,
                destination_descriptor,
                registration.name,
                registration,
            )
            user_version, integrity, destination_schema_digest = (
                _validate_registered_sqlite_at(destination_descriptor, registration)
            )
            if (
                user_version != source_version
                or source_schema_digest != snapshot_source_schema_digest
                or snapshot_source_schema_digest != destination_schema_digest
            ):
                raise BackupError(f"schema_mismatch:{registration.name}")
            digest, size = _sha256_regular_at(destination_descriptor, registration.name)
            release_reservation(size)
            capture_completed_at = _canonical_now(clock)
            database_manifest.append(
                {
                    "bytes": size,
                    "captureCompletedAt": capture_completed_at,
                    "captureStartedAt": capture_started_at,
                    "integrityCheck": integrity,
                    "name": registration.name,
                    "presence": "PRESENT",
                    "relativePath": registration.name,
                    "schemaContractDigest": destination_schema_digest,
                    "sha256": f"sha256:{digest}",
                    "userVersion": user_version,
                }
            )

        references = (
            _referenced_artifacts_at(destination_descriptor, "report_artifacts.sqlite3")
            if "report_artifacts.sqlite3" in present_databases
            else []
        )
        expected_names = {Path(reference["relativePath"]).name for reference in references}
        actual_names: set[str] = set()
        if source_artifact_descriptor >= 0:
            for item in os.scandir(source_artifact_descriptor):
                actual_names.add(item.name)
                artifact_descriptor, _ = _open_regular_at(source_artifact_descriptor, item.name)
                os.close(artifact_descriptor)
        unexpected = sorted(actual_names - expected_names)
        missing = sorted(expected_names - actual_names)
        if unexpected:
            raise BackupError(f"unexpected_artifact:report_artifacts/{unexpected[0]}")
        if missing:
            raise BackupError(f"missing_artifact:report_artifacts/{missing[0]}")

        artifact_manifest: list[dict[str, Any]] = []
        for reference in references:
            relative = reference["relativePath"]
            name = Path(relative).name
            digest, size = _copy_regular_at(
                source_artifact_descriptor,
                name,
                destination_artifact_descriptor,
                name,
            )
            if digest != reference["expectedSha256"]:
                raise BackupError(f"artifact_digest_mismatch:{relative}")
            release_reservation(size)
            artifact_manifest.append(
                {
                    "artifactId": reference["artifactId"],
                    "bytes": size,
                    "capturedAt": _canonical_now(clock),
                    "relativePath": relative,
                    "sha256": f"sha256:{digest}",
                }
            )

        identity = _snapshot_identity(
            mode, source_root_identity, database_manifest, artifact_manifest
        )
        capture_completed_at = _canonical_now(clock)
        if mode == _COLD_MODE:
            writer_stop_evidence = writer_stop_session(
                "after",
                {
                    "captureCompletedAt": capture_completed_at,
                    "sourceRootIdentity": source_root_identity,
                },
            )
            writer_stop_evidence = json.loads(_canonical_json_bytes(writer_stop_evidence))
            _match_writer_stop_final(writer_stop_before, writer_stop_evidence)
        captured_at = _canonical_now(clock)
        if mode == _COLD_MODE:
            _validate_writer_stop_evidence(
                writer_stop_evidence,
                source_root_identity,
                captured_at=captured_at,
            )
        manifest_without_digest = {
            "artifacts": artifact_manifest,
            "capturedAt": captured_at,
            "databases": database_manifest,
            "mode": mode,
            "schemaVersion": _MANIFEST_SCHEMA,
            "sourceRootIdentity": source_root_identity,
            "sourceSnapshotIdentity": identity,
            "writerStopEvidence": writer_stop_evidence,
        }
        manifest = {
            **manifest_without_digest,
            "manifestDigest": _digest_canonical(manifest_without_digest),
        }
        manifest_descriptor = os.open(
            BACKUP_MANIFEST_NAME,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_CLOEXEC", 0)
            | getattr(os, "O_NOFOLLOW", 0),
            0o600,
            dir_fd=destination_descriptor,
        )
        try:
            _write_all(manifest_descriptor, _canonical_bytes(manifest))
            os.fsync(manifest_descriptor)
        finally:
            os.close(manifest_descriptor)
        os.ftruncate(reservation_descriptor, 0)
        os.fsync(reservation_descriptor)
        _assert_entry_identity(destination_descriptor, _RESERVATION_NAME, reservation_status)
        os.close(reservation_descriptor)
        reservation_descriptor = -1
        os.unlink(_RESERVATION_NAME, dir_fd=destination_descriptor)
        if destination_artifact_descriptor >= 0:
            _fsync_directory_descriptor(destination_artifact_descriptor)
        _fsync_directory_descriptor(destination_descriptor)
        assert_roots()
        verified_manifest = _load_manifest_at(destination_descriptor)
        if _verify_backup_tree_at(destination_descriptor, verified_manifest) != identity:
            raise BackupError("snapshot_identity_mismatch")
        final_presence = _validate_source_registry_at(source_descriptor)
        if final_presence != present_databases:
            raise BackupError("source_registry_changed_during_backup")
        final_artifacts = (
            {item.name for item in os.scandir(source_artifact_descriptor)}
            if source_artifact_descriptor >= 0
            else set()
        )
        if final_artifacts != expected_names:
            raise BackupError("source_registry_changed_during_backup")
        assert_roots()
        result = BackupResult(destination, destination / BACKUP_MANIFEST_NAME, identity)
    except Exception as error:
        failure = error
    finally:
        for descriptor in (
            reservation_descriptor,
            destination_artifact_descriptor,
            source_artifact_descriptor,
            destination_descriptor,
            source_descriptor,
        ):
            if descriptor >= 0:
                os.close(descriptor)
    if failure is not None:
        if destination_status is not None:
            try:
                _remove_created_backup_root(destination, destination_status)
            except BackupError as cleanup_error:
                raise failure from cleanup_error
        raise failure
    if result is None:  # pragma: no cover - defensive invariant
        raise BackupError("backup_internal_error")
    return result


def backup_runtime(
    source_root: Path,
    destination: Path,
    *,
    mode: str = _ONLINE_MODE,
    writer_stop_evidence: dict[str, Any] | None = None,
    writer_stop_evidence_provider: Callable[[str, dict[str, Any]], dict[str, Any]] | None = None,
    clock: Any | None = None,
) -> BackupResult:
    """Snapshot the approved registry, retrying only bounded online drift."""
    if writer_stop_evidence is not None or writer_stop_evidence_provider is not None:
        raise BackupError("writer_stop_evidence_forbidden")
    if mode == _COLD_MODE:
        raise BackupError("writer_stop_evidence_required")
    attempts = 2 if mode == _ONLINE_MODE else 1
    for attempt in range(attempts):
        try:
            return _backup_runtime_once(
                source_root,
                destination,
                mode=mode,
                clock=clock,
            )
        except BackupError as error:
            if str(error) != "source_registry_changed_during_backup" or attempt + 1 >= attempts:
                raise
    raise BackupError("backup_internal_error")  # pragma: no cover


def _backup_runtime_with_session(
    source_root: Path,
    destination: Path,
    *,
    writer_stop_session: _WriterStopSession,
    clock: Any | None = None,
) -> BackupResult:
    if type(writer_stop_session) is not _WriterStopSession:
        raise BackupError("writer_stop_evidence_required")
    return _backup_runtime_once(
        source_root,
        destination,
        mode=_COLD_MODE,
        writer_stop_session=writer_stop_session,
        clock=clock,
    )


def _closed_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise BackupError("duplicate_manifest_key")
        result[key] = value
    return result


def _load_manifest_at(root_descriptor: int) -> dict[str, Any]:
    descriptor, status = _open_regular_at(root_descriptor, BACKUP_MANIFEST_NAME)
    try:
        if status.st_size > _MANIFEST_MAX_BYTES:
            raise BackupError("manifest_too_large")
        chunks: list[bytes] = []
        remaining = status.st_size
        while remaining:
            chunk = os.read(descriptor, min(_HASH_CHUNK_BYTES, remaining))
            if not chunk:
                raise BackupError("manifest_invalid")
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.fstat(descriptor).st_size != status.st_size:
            raise BackupError("manifest_changed_during_read")
        _assert_entry_identity(root_descriptor, BACKUP_MANIFEST_NAME, status)
        raw = b"".join(chunks)
        value = json.loads(raw, object_pairs_hook=_closed_object)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        raise BackupError("manifest_invalid") from None
    finally:
        os.close(descriptor)
    if not isinstance(value, dict):
        raise BackupError("manifest_invalid")
    if raw != _canonical_bytes(value):
        raise BackupError("manifest_not_canonical")
    return value


def _load_manifest(root: Path) -> dict[str, Any]:
    root_descriptor, _ = _open_directory(root)
    try:
        return _load_manifest_at(root_descriptor)
    finally:
        os.close(root_descriptor)


def _require_keys(value: dict[str, Any], expected: set[str], code: str) -> None:
    if set(value) != expected:
        raise BackupError(code)


def _is_sha256(value: Any) -> bool:
    if not isinstance(value, str) or len(value) != 71 or not value.startswith("sha256:"):
        return False
    return all(character in "0123456789abcdef" for character in value[7:])


def _is_canonical_time(value: Any) -> bool:
    if not isinstance(value, str) or len(value) != 27 or not value.endswith("Z"):
        return False
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    except ValueError:
        return False
    return parsed.strftime("%Y-%m-%dT%H:%M:%S.%fZ") == value


def _is_nonnegative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _verify_backup_tree_at(root_descriptor: int, manifest: dict[str, Any]) -> str:
    _require_keys(
        manifest,
        {
            "artifacts",
            "capturedAt",
            "databases",
            "manifestDigest",
            "mode",
            "schemaVersion",
            "sourceRootIdentity",
            "sourceSnapshotIdentity",
            "writerStopEvidence",
        },
        "manifest_schema_invalid",
    )
    if (
        manifest["schemaVersion"] != _MANIFEST_SCHEMA
        or manifest["mode"] not in _BACKUP_MODES
        or not _is_canonical_time(manifest["capturedAt"])
    ):
        raise BackupError("manifest_schema_invalid")
    if manifest["mode"] == _ONLINE_MODE and manifest["writerStopEvidence"] is not None:
        raise BackupError("manifest_schema_invalid")
    if manifest["mode"] == _COLD_MODE and not isinstance(manifest["writerStopEvidence"], dict):
        raise BackupError("manifest_schema_invalid")
    _require_keys(
        manifest["sourceRootIdentity"],
        {"device", "inode", "type"},
        "manifest_schema_invalid",
    )
    if (
        manifest["sourceRootIdentity"]["type"] != "DIRECTORY"
        or not _is_nonnegative_int(manifest["sourceRootIdentity"]["device"])
        or not _is_nonnegative_int(manifest["sourceRootIdentity"]["inode"])
    ):
        raise BackupError("manifest_schema_invalid")
    if manifest["mode"] == _COLD_MODE:
        _validate_writer_stop_evidence(
            manifest["writerStopEvidence"],
            manifest["sourceRootIdentity"],
            captured_at=manifest["capturedAt"],
        )
    if not _is_sha256(manifest["sourceSnapshotIdentity"]):
        raise BackupError("manifest_schema_invalid")
    if not _is_sha256(manifest["manifestDigest"]):
        raise BackupError("manifest_schema_invalid")
    manifest_without_digest = {
        key: value for key, value in manifest.items() if key != "manifestDigest"
    }
    if manifest["manifestDigest"] != _digest_canonical(manifest_without_digest):
        raise BackupError("manifest_digest_mismatch")
    if not isinstance(manifest["databases"], list) or not isinstance(manifest["artifacts"], list):
        raise BackupError("manifest_schema_invalid")

    databases = manifest["databases"]
    if len(databases) != len(DATABASE_REGISTRY):
        raise BackupError("database_manifest_mismatch")
    for registration, record in zip(DATABASE_REGISTRY, databases, strict=True):
        if not isinstance(record, dict):
            raise BackupError("database_manifest_mismatch")
        _require_keys(
            record,
            {"name", "presence"}
            if record.get("presence") == "ABSENT"
            else {
                "bytes",
                "captureCompletedAt",
                "captureStartedAt",
                "integrityCheck",
                "name",
                "presence",
                "relativePath",
                "schemaContractDigest",
                "sha256",
                "userVersion",
            },
            "database_manifest_mismatch",
        )
        if record["presence"] not in {"PRESENT", "ABSENT"}:
            raise BackupError("database_manifest_mismatch")
        if record["name"] != registration.name:
            raise BackupError("database_manifest_mismatch")
        if record["presence"] == "ABSENT":
            continue
        if (
            record["relativePath"] != registration.relative_path
            or record["schemaContractDigest"] not in registration.schema_contract_digests
            or record["integrityCheck"] != "ok"
            or not _is_sha256(record["sha256"])
            or not _is_nonnegative_int(record["bytes"])
            or not _is_nonnegative_int(record["userVersion"])
            or not _is_canonical_time(record["captureStartedAt"])
            or not _is_canonical_time(record["captureCompletedAt"])
            or record["captureStartedAt"] > record["captureCompletedAt"]
            or record["captureCompletedAt"] > manifest["capturedAt"]
        ):
            raise BackupError("database_manifest_mismatch")
        if manifest["mode"] == _COLD_MODE and not (
            manifest["writerStopEvidence"]["observedAtBefore"]
            <= record["captureStartedAt"]
            <= record["captureCompletedAt"]
            <= manifest["writerStopEvidence"]["observedAtAfter"]
        ):
            raise BackupError("writer_stop_evidence_invalid")
        digest, size = _sha256_regular_at(root_descriptor, registration.name)
        if f"sha256:{digest}" != record["sha256"] or size != record["bytes"]:
            raise BackupError("database_digest_mismatch")
        user_version, integrity, schema_digest = _validate_registered_sqlite_at(
            root_descriptor, registration
        )
        if user_version != record["userVersion"] or integrity != record["integrityCheck"]:
            raise BackupError("database_integrity_mismatch")
        if schema_digest != record["schemaContractDigest"]:
            raise BackupError("database_schema_mismatch")

    present_database_names = {
        record["name"] for record in databases if record["presence"] == "PRESENT"
    }
    expected_top = {BACKUP_MANIFEST_NAME} | present_database_names
    if "report_artifacts.sqlite3" in present_database_names:
        expected_top.add("report_artifacts")
    actual_top = {entry.name for entry in os.scandir(root_descriptor)}
    if actual_top != expected_top:
        raise BackupError("backup_tree_mismatch")

    artifacts = manifest["artifacts"]
    expected_artifacts: set[str] = set()
    artifact_paths: list[str] = []
    for record in artifacts:
        if not isinstance(record, dict):
            raise BackupError("artifact_manifest_mismatch")
        _require_keys(
            record,
            {"artifactId", "bytes", "capturedAt", "relativePath", "sha256"},
            "artifact_manifest_mismatch",
        )
        relative = record["relativePath"]
        if not isinstance(relative, str) or not relative.startswith("report_artifacts/"):
            raise BackupError("artifact_path_invalid")
        path = Path(relative)
        unsafe_part = any(part in {"", ".", ".."} for part in path.parts)
        if path.is_absolute() or len(path.parts) != 2 or unsafe_part:
            raise BackupError("artifact_path_invalid")
        artifact_paths.append(relative)
        if (
            not isinstance(record["artifactId"], str)
            or not record["artifactId"]
            or relative in expected_artifacts
        ):
            raise BackupError("artifact_manifest_mismatch")
        if (
            not _is_sha256(record["sha256"])
            or not _is_nonnegative_int(record["bytes"])
            or not _is_canonical_time(record["capturedAt"])
            or record["capturedAt"] > manifest["capturedAt"]
        ):
            raise BackupError("artifact_manifest_mismatch")
        if manifest["mode"] == _COLD_MODE and not (
            manifest["writerStopEvidence"]["observedAtBefore"]
            <= record["capturedAt"]
            <= manifest["writerStopEvidence"]["observedAtAfter"]
        ):
            raise BackupError("writer_stop_evidence_invalid")
        expected_artifacts.add(relative)
    if artifact_paths != sorted(artifact_paths):
        raise BackupError("artifact_manifest_mismatch")
    if "report_artifacts.sqlite3" not in present_database_names:
        if artifacts:
            raise BackupError("artifact_manifest_mismatch")
        identity = _snapshot_identity(
            manifest["mode"], manifest["sourceRootIdentity"], databases, artifacts
        )
        if manifest["sourceSnapshotIdentity"] != identity:
            raise BackupError("snapshot_identity_mismatch")
        return identity
    artifact_descriptor, _ = _open_directory_at(root_descriptor, "report_artifacts")
    try:
        for record in artifacts:
            digest, size = _sha256_regular_at(
                artifact_descriptor, Path(record["relativePath"]).name
            )
            if f"sha256:{digest}" != record["sha256"] or size != record["bytes"]:
                raise BackupError("artifact_digest_mismatch")

        actual_artifacts = {
            f"report_artifacts/{entry.name}" for entry in os.scandir(artifact_descriptor)
        }
        if actual_artifacts != expected_artifacts:
            raise BackupError("artifact_tree_mismatch")
        references = _referenced_artifacts_at(root_descriptor, "report_artifacts.sqlite3")
        reference_map = {
            entry["relativePath"]: f"sha256:{entry['expectedSha256']}" for entry in references
        }
        manifest_map = {entry["relativePath"]: entry["sha256"] for entry in artifacts}
        if reference_map != manifest_map:
            raise BackupError("artifact_reference_mismatch")
    finally:
        os.close(artifact_descriptor)

    identity = _snapshot_identity(
        manifest["mode"], manifest["sourceRootIdentity"], databases, artifacts
    )
    if manifest["sourceSnapshotIdentity"] != identity:
        raise BackupError("snapshot_identity_mismatch")
    return identity


def _verify_backup_tree(root: Path, manifest: dict[str, Any]) -> str:
    root_descriptor, root_status = _open_directory(root)
    try:
        identity = _verify_backup_tree_at(root_descriptor, manifest)
        _assert_directory_identity(root, root_status)
        return identity
    finally:
        os.close(root_descriptor)


def verify_backup(root: Path) -> BackupResult:
    """Read-only verification of a closed backup tree."""
    root = Path(root)
    root_descriptor, root_status = _open_directory(root)
    try:
        manifest = _load_manifest_at(root_descriptor)
        identity = _verify_backup_tree_at(root_descriptor, manifest)
        _assert_directory_identity(root, root_status)
        return BackupResult(root, root / BACKUP_MANIFEST_NAME, identity)
    finally:
        os.close(root_descriptor)


def rehearse_restore(backup_root: Path, destination: Path) -> BackupResult:
    """Copy a verified backup to a new root and verify the copy again."""
    backup_root = Path(backup_root)
    destination = Path(destination)
    _require_disjoint_roots(backup_root, destination)
    backup_descriptor, backup_status = _open_directory(backup_root)
    destination_descriptor = -1
    destination_status: os.stat_result | None = None
    backup_artifact_descriptor = -1
    destination_artifact_descriptor = -1
    result: BackupResult | None = None
    failure: Exception | None = None
    try:
        initial_manifest = _load_manifest_at(backup_descriptor)
        initial_identity = _verify_backup_tree_at(backup_descriptor, initial_manifest)
        destination_descriptor, destination_status = _create_new_root_open(destination)
        present_databases = {
            record["name"]
            for record in initial_manifest["databases"]
            if record["presence"] == "PRESENT"
        }
        if "report_artifacts.sqlite3" in present_databases:
            os.mkdir("report_artifacts", mode=0o700, dir_fd=destination_descriptor)
            backup_artifact_descriptor, _ = _open_directory_at(
                backup_descriptor, "report_artifacts"
            )
            destination_artifact_descriptor, _ = _open_directory_at(
                destination_descriptor, "report_artifacts"
            )
        for registration in DATABASE_REGISTRY:
            if registration.name not in present_databases:
                continue
            _copy_regular_at(
                backup_descriptor,
                registration.name,
                destination_descriptor,
                registration.name,
            )
        if backup_artifact_descriptor >= 0:
            for item in os.scandir(backup_artifact_descriptor):
                _copy_regular_at(
                    backup_artifact_descriptor,
                    item.name,
                    destination_artifact_descriptor,
                    item.name,
                )
        _copy_regular_at(
            backup_descriptor,
            BACKUP_MANIFEST_NAME,
            destination_descriptor,
            BACKUP_MANIFEST_NAME,
        )
        if destination_artifact_descriptor >= 0:
            _fsync_directory_descriptor(destination_artifact_descriptor)
        _fsync_directory_descriptor(destination_descriptor)
        restored_manifest = _load_manifest_at(destination_descriptor)
        restored_identity = _verify_backup_tree_at(destination_descriptor, restored_manifest)
        final_manifest = _load_manifest_at(backup_descriptor)
        final_source_identity = _verify_backup_tree_at(backup_descriptor, final_manifest)
        _assert_directory_identity(backup_root, backup_status)
        _assert_directory_identity(destination, destination_status)
        if not restored_identity == final_source_identity == initial_identity:
            raise BackupError("source_changed_during_rehearsal")
        result = BackupResult(
            destination,
            destination / BACKUP_MANIFEST_NAME,
            restored_identity,
        )
    except Exception as error:
        failure = error
    finally:
        for descriptor in (
            destination_artifact_descriptor,
            backup_artifact_descriptor,
            destination_descriptor,
            backup_descriptor,
        ):
            if descriptor >= 0:
                os.close(descriptor)
    if failure is not None:
        if destination_status is not None:
            try:
                _remove_created_backup_root(destination, destination_status)
            except BackupError as cleanup_error:
                raise failure from cleanup_error
        raise failure
    if result is None:  # pragma: no cover - defensive invariant
        raise BackupError("rehearsal_internal_error")
    return result


def _create_synthetic_runtime(root: Path) -> None:
    from app.accounting_reports.storage import ArtifactStorage
    from app.agents.runtime_skills.execution_ledger import (
        ExecutionScopeBinding,
        ResourceKind,
        RuntimeBindingLedger,
        RuntimeResourceBinding,
    )
    from app.decree_jobs.storage import DecreeJobStore
    from app.jinyiwei import db as jinyiwei_db
    from app.junjichu_cases import storage as junjichu_storage
    from app.qintianjian import storage as qintianjian_storage
    from app.shiguan import db as shiguan_db
    from app.work_products import (
        ArtifactGateReceipt,
        ArtifactManifestItem,
        ArtifactState,
        ConfirmationStatus,
        WorkProductEnvelope,
        WorkProductStatus,
    )

    root.mkdir(mode=0o700)
    artifact_content = b"RC1 synthetic report artifact\n"
    artifact_id = "rc1-synthetic-artifact"
    artifact_sha256 = hashlib.sha256(artifact_content).hexdigest()
    decree_store = DecreeJobStore(root / "decree_jobs.sqlite3")
    jinyiwei_db.initialize_database(root / "jinyiwei.sqlite3")
    junjichu_connection = junjichu_storage._connect(root / "junjichu_cases.sqlite3")
    junjichu_connection.close()
    previous_qintianjian_path = qintianjian_storage._DEFAULT_DB_PATH
    try:
        qintianjian_storage._DEFAULT_DB_PATH = root / "qintianjian.sqlite3"
        qintianjian_connection = qintianjian_storage._connect()
        qintianjian_connection.commit()
        qintianjian_connection.close()
    finally:
        qintianjian_storage._DEFAULT_DB_PATH = previous_qintianjian_path
    artifact_storage = ArtifactStorage(root / "report_artifacts", root / "report_artifacts.sqlite3")
    binding_ledger = RuntimeBindingLedger(root / "runtime_bindings.sqlite3")
    shiguan_connection = shiguan_db.get_connection(root / "shiguan.sqlite3")
    fixed_at = "2026-08-21T00:00:00+00:00"
    with shiguan_connection:
        shiguan_connection.execute(
            "INSERT INTO users (id,username,email,password_hash,created_at) "
            "VALUES (?,?,?,?,?)",
            (
                "synthetic-owner",
                "rc1-synthetic-owner",
                "rc1-synthetic-owner@example.invalid",
                "synthetic-not-a-real-password-hash",
                fixed_at,
            ),
        )
        shiguan_connection.execute(
            "INSERT INTO tenants (id,kind,created_at) VALUES (?,?,?)",
            ("rc1-synthetic-tenant", "PERSONAL", fixed_at),
        )
        shiguan_connection.execute(
            """
            INSERT INTO tenant_memberships (
                id,user_id,tenant_id,role,created_at,revoked_at
            ) VALUES (?,?,?,?,?,NULL)
            """,
            (
                "rc1-synthetic-membership",
                "synthetic-owner",
                "rc1-synthetic-tenant",
                "OWNER",
                fixed_at,
            ),
        )
        shiguan_connection.execute(
            """
            INSERT INTO auth_sessions (
                id,user_id,membership_id,created_at,expires_at,revoked_at
            ) VALUES (?,?,?,?,?,NULL)
            """,
            (
                "rc1-synthetic-session",
                "synthetic-owner",
                "rc1-synthetic-membership",
                fixed_at,
                "2027-08-21T00:00:00+00:00",
            ),
        )
        shiguan_connection.execute(
            """
            INSERT INTO archives (
                id, type, title, content, matter_type, department, created_at,
                lessons_learned, pitfalls, source_kind, source_text,
                participating_departments, reply_process, reply_conclusion,
                reply_time, respondent, owner_user_id
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                "rc1-synthetic-reply",
                "REPLY",
                "RC1 synthetic reply",
                "RC1 synthetic retention probe",
                "release_acceptance",
                "户部",
                fixed_at,
                None,
                None,
                "DECREE",
                "RC1 synthetic decree",
                '["户部"]',
                "synthetic acceptance",
                "retention probe",
                fixed_at,
                "丞相",
                "__system__",
            ),
        )
    shiguan_connection.close()
    with sqlite3.connect(decree_store.db_path) as connection:
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                attempt_count, provider_request_count, provider_request_limit,
                cancel_requested, result_json, reply_id, error_code,
                error_stage, error_category, authority_committed,
                acceptance_committed, deadline_at, retry_at, lease_owner,
                lease_expires_at, created_at, updated_at
            ) VALUES (
                :job_id, :owner, :idempotency_key, :request_hash,
                :draft_fingerprint, :decree_text, :approved_route_json,
                'SUCCEEDED', 1, 0, 8, 0, :result_json, :reply_id,
                NULL, NULL, NULL, 1, 1, :deadline_at, NULL, NULL, NULL,
                :created_at, :updated_at
            )
            """,
            {
                "job_id": "rc1-synthetic-job",
                "owner": "synthetic-owner",
                "idempotency_key": "rc1-synthetic-idempotency",
                "request_hash": "1" * 64,
                "draft_fingerprint": "2" * 64,
                "decree_text": "RC1 synthetic decree",
                "approved_route_json": "{}",
                "result_json": '{"status":"synthetic"}',
                "reply_id": "rc1-synthetic-reply",
                "deadline_at": "2026-08-22T00:00:00+00:00",
                "created_at": fixed_at,
                "updated_at": fixed_at,
            },
        )
        connection.execute(
            """
            INSERT INTO decree_job_idempotency_keys (
                owner_user_id, idempotency_key, request_hash, job_id
            ) VALUES (?,?,?,?)
            """,
            (
                "synthetic-owner",
                "rc1-synthetic-idempotency",
                "1" * 64,
                "rc1-synthetic-job",
            ),
        )
    with sqlite3.connect(root / "report_artifacts.sqlite3") as connection:
        connection.execute(
            "INSERT INTO report_artifacts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                artifact_id,
                "synthetic-owner",
                "synthetic-run",
                "synthetic-reply",
                "accounting",
                "RC1 synthetic",
                1,
                1,
                "[]",
                artifact_sha256,
                "PUBLISHED",
                "2026-08-21T00:00:00+00:00",
                "2026-08-21T00:00:00+00:00",
            ),
        )
    work_product = WorkProductEnvelope(
        work_product_id="rc1-synthetic-work-product",
        version=1,
        owner_user_id="synthetic-owner",
        run_id="synthetic-run",
        reply_id="rc1-synthetic-reply",
        capability_id="accounting-report",
        work_status=WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
        confirmation_status=ConfirmationStatus.PENDING,
        artifact_state=ArtifactState.PUBLISHED,
        decision="Confirm the RC1 synthetic report.",
        facts=({"fact_id": "rc1-synthetic-fact", "value": "1"},),
        assumptions=(),
        recommendations=("Confirm the recovery probe.",),
        evidence_used=("rc1-synthetic-source",),
        missing_evidence=(),
        conflicts=(),
        risk_register=("Synthetic data only.",),
        artifact_manifest=(
            ArtifactManifestItem(
                kind="management_report_xlsx",
                ref=f"report_artifacts/{artifact_id}.xlsx",
                content_digest=artifact_sha256,
                traceable=True,
            ),
        ),
        artifact_gate=ArtifactGateReceipt(
            status="PASSED",
            reason_codes=(),
            missing_kinds=(),
            unexpected_kinds=(),
        ),
        content_digest="3" * 64,
        created_at=datetime(2026, 8, 21, tzinfo=UTC),
    )
    artifact_storage.create_work_product(
        "synthetic-owner", artifact_id, work_product
    )
    with sqlite3.connect(root / "report_artifacts.sqlite3") as connection:
        connection.execute(
            """
            INSERT INTO confirmation_receipts (
                work_product_id, version, sequence, decision, actor_ref,
                structured_reason, created_at
            ) VALUES (?,?,?,?,?,?,?)
            """,
            (
                work_product.work_product_id,
                work_product.version,
                1,
                "CONFIRMED",
                "synthetic-owner",
                "RC1 synthetic confirmation",
                fixed_at,
            ),
        )
    scope = ExecutionScopeBinding(
        scope_mode="owner_only",
        tenant_id=None,
        owner_user_id="synthetic-owner",
        run_id="synthetic-run",
        decree_id="synthetic-run",
        case_id=None,
        draft_fingerprint="2" * 64,
        route_digest="4" * 64,
    )
    binding_ledger.append(
        RuntimeResourceBinding(
            binding_id="rc1-synthetic-binding",
            scope=scope,
            resource_kind=ResourceKind.ACCOUNTING_WORK_PRODUCT,
            resource_ref=work_product.work_product_id,
            resource_version="v1",
            content_digest=work_product.content_digest,
            created_at=datetime(2026, 8, 21, tzinfo=UTC),
        )
    )
    artifact_root = artifact_storage.artifact_dir
    (artifact_root / f"{artifact_id}.xlsx").write_bytes(artifact_content)


def _synthetic_root(path: Path) -> Path:
    path = path.absolute()
    if ".." in path.parts:
        raise BackupError("synthetic_root_invalid")
    _reject_symlink_components(path.parent)
    try:
        temporary_root = _TRUSTED_SYNTHETIC_ROOT.resolve(strict=True)
        candidate = path.parent.resolve(strict=True) / path.name
    except OSError:
        raise BackupError("synthetic_root_invalid") from None
    if candidate == temporary_root or not candidate.is_relative_to(temporary_root):
        raise BackupError("production_path_forbidden")
    return candidate


def run_synthetic_rehearsal(root: Path) -> dict[str, str]:
    """Run the complete synthetic flow under one new OS-temporary root."""
    root = _synthetic_root(Path(root))
    root_descriptor, root_status = _create_new_root_open(root)
    try:
        source = root / "source"
        _assert_directory_identity(root, root_status)
        _create_synthetic_runtime(source)
        _assert_directory_identity(root, root_status)
        result = backup_runtime(source, root / "backup")
        _assert_directory_identity(root, root_status)
        verify_backup(result.destination)
        _assert_directory_identity(root, root_status)
        rehearse_restore(result.destination, root / "rehearsed")
        _assert_directory_identity(root, root_status)
        manifest_sha256, _ = _sha256_file(result.manifest_path)
        return {
            "manifestSha256": manifest_sha256,
            "sourceSnapshotIdentity": result.source_snapshot_identity,
        }
    finally:
        os.close(root_descriptor)


def probe_synthetic_retention(root: Path) -> dict[str, str]:
    """Prove the fixed RC1 task/archive/confirmation/binding sentinels survive."""

    root = Path(root).absolute()
    try:
        if _lexists(root / BACKUP_MANIFEST_NAME):
            verify_backup(root)
        else:
            _validate_source_registry(root)

        def one(database: str, query: str, parameters: tuple[object, ...]) -> tuple[Any, ...]:
            path = (root / database).resolve(strict=True)
            connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
            try:
                rows = connection.execute(query, parameters).fetchall()
            finally:
                connection.close()
            if len(rows) != 1:
                raise BackupError("synthetic_retention_probe_failed")
            return tuple(rows[0])

        job = one(
            "decree_jobs.sqlite3",
            "SELECT job_id,state,reply_id FROM decree_jobs WHERE job_id = ?",
            ("rc1-synthetic-job",),
        )
        archive = one(
            "shiguan.sqlite3",
            "SELECT id,type,owner_user_id FROM archives WHERE id = ?",
            ("rc1-synthetic-reply",),
        )
        user = one(
            "shiguan.sqlite3",
            "SELECT id,username,email FROM users WHERE id = ?",
            ("synthetic-owner",),
        )
        tenant = one(
            "shiguan.sqlite3",
            "SELECT id,kind FROM tenants WHERE id = ?",
            ("rc1-synthetic-tenant",),
        )
        membership = one(
            "shiguan.sqlite3",
            """
            SELECT id,user_id,tenant_id,role,revoked_at
            FROM tenant_memberships WHERE id = ?
            """,
            ("rc1-synthetic-membership",),
        )
        session = one(
            "shiguan.sqlite3",
            """
            SELECT id,user_id,membership_id,revoked_at
            FROM auth_sessions WHERE id = ?
            """,
            ("rc1-synthetic-session",),
        )
        confirmation = one(
            "report_artifacts.sqlite3",
            """
            SELECT receipt.work_product_id,receipt.sequence,receipt.decision,
                   product.work_status,product.confirmation_status
            FROM confirmation_receipts AS receipt
            JOIN work_products AS product
              ON product.work_product_id = receipt.work_product_id
            WHERE receipt.work_product_id = ?
            """,
            ("rc1-synthetic-work-product",),
        )
        binding = one(
            "runtime_bindings.sqlite3",
            """
            SELECT binding_id,owner_user_id,run_id,resource_kind,resource_ref,
                   content_digest
            FROM runtime_resource_bindings WHERE binding_id = ?
            """,
            ("rc1-synthetic-binding",),
        )
        artifact = one(
            "report_artifacts.sqlite3",
            "SELECT artifact_id,state,file_sha256 FROM report_artifacts WHERE artifact_id = ?",
            ("rc1-synthetic-artifact",),
        )
        artifact_path = root / "report_artifacts/rc1-synthetic-artifact.xlsx"
        artifact_sha256, _ = _sha256_file(artifact_path)
    except BackupError:
        raise
    except (OSError, sqlite3.Error, ValueError):
        raise BackupError("synthetic_retention_probe_failed") from None

    expected = {
        "artifact": (
            "rc1-synthetic-artifact",
            "PUBLISHED",
            hashlib.sha256(b"RC1 synthetic report artifact\n").hexdigest(),
        ),
        "archive": ("rc1-synthetic-reply", "REPLY", "__system__"),
        "binding": (
            "rc1-synthetic-binding",
            "synthetic-owner",
            "synthetic-run",
            "accounting_work_product",
            "rc1-synthetic-work-product",
            "3" * 64,
        ),
        "confirmation": (
            "rc1-synthetic-work-product",
            1,
            "CONFIRMED",
            "READY_FOR_HUMAN_CONFIRMATION",
            "CONFIRMED",
        ),
        "job": ("rc1-synthetic-job", "SUCCEEDED", "rc1-synthetic-reply"),
        "membership": (
            "rc1-synthetic-membership",
            "synthetic-owner",
            "rc1-synthetic-tenant",
            "OWNER",
            None,
        ),
        "session": (
            "rc1-synthetic-session",
            "synthetic-owner",
            "rc1-synthetic-membership",
            None,
        ),
        "tenant": ("rc1-synthetic-tenant", "PERSONAL"),
        "user": (
            "synthetic-owner",
            "rc1-synthetic-owner",
            "rc1-synthetic-owner@example.invalid",
        ),
    }
    observed = {
        "artifact": artifact,
        "archive": archive,
        "binding": binding,
        "confirmation": confirmation,
        "job": job,
        "membership": membership,
        "session": session,
        "tenant": tenant,
        "user": user,
    }
    if observed != expected or artifact_sha256 != expected["artifact"][2]:
        raise BackupError("synthetic_retention_probe_failed")
    payload = {
        "schemaVersion": "chaotang.rc1-retention-facts.v1",
        "artifactSha256": artifact_sha256,
        "archiveId": archive[0],
        "bindingId": binding[0],
        "jobId": job[0],
        "membershipId": membership[0],
        "sessionId": session[0],
        "tenantId": tenant[0],
        "userId": user[0],
        "workProductId": confirmation[0],
    }
    return {
        "schemaVersion": "chaotang.rc1-retention-probe.v1",
        "retentionDigest": _digest_canonical(payload),
    }


def _read_canonical_json_at(directory_descriptor: int, name: str) -> dict[str, Any]:
    try:
        descriptor, status = _open_regular_at(directory_descriptor, name)
    except (BackupError, OSError):
        raise BackupError("writer_stop_evidence_invalid") from None
    try:
        if status.st_size <= 0 or status.st_size > _MANIFEST_MAX_BYTES:
            raise BackupError("writer_stop_evidence_invalid")
        chunks: list[bytes] = []
        remaining = status.st_size
        while remaining:
            chunk = os.read(descriptor, min(64 * 1024, remaining))
            if not chunk:
                raise BackupError("writer_stop_evidence_invalid")
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1) != b"":
            raise BackupError("writer_stop_evidence_invalid")
    finally:
        os.close(descriptor)

    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise BackupError("writer_stop_evidence_invalid")
            result[key] = value
        return result

    def reject_constant(_value: str) -> None:
        raise BackupError("writer_stop_evidence_invalid")

    try:
        raw = b"".join(chunks)
        document = json.loads(
            raw.decode("utf-8", errors="strict"),
            object_pairs_hook=reject_duplicates,
            parse_constant=reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
        raise BackupError("writer_stop_evidence_invalid") from None
    if not isinstance(document, dict) or raw != _canonical_bytes(document):
        raise BackupError("writer_stop_evidence_invalid")
    return document


class _WriterStopSession:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        if not self.path.is_absolute() or ".." in self.path.parts:
            raise BackupError("writer_stop_session_invalid")
        _reject_symlink_components(self.path.parent)
        try:
            before = os.lstat(self.path)
            descriptor = os.open(
                self.path,
                os.O_RDONLY
                | getattr(os, "O_CLOEXEC", 0)
                | getattr(os, "O_NOFOLLOW", 0)
                | getattr(os, "O_DIRECTORY", 0),
            )
            opened = os.fstat(descriptor)
        except OSError:
            raise BackupError("writer_stop_session_invalid") from None
        if (
            not stat.S_ISDIR(before.st_mode)
            or not _same_identity(before, opened)
            or before.st_uid != os.getuid()
            or before.st_mode & 0o077
            or self.path.resolve(strict=True) != self.path
        ):
            os.close(descriptor)
            raise BackupError("writer_stop_session_invalid")
        self.descriptor = descriptor
        self.status = opened
        if set(os.listdir(self.descriptor)) != {"before.json"}:
            self.close()
            raise BackupError("writer_stop_session_invalid")
        self.before_read = False
        self.after_read = False

    def close(self) -> None:
        if self.descriptor >= 0:
            os.close(self.descriptor)
            self.descriptor = -1

    def _assert_identity(self) -> None:
        if self.descriptor < 0:
            raise BackupError("writer_stop_session_invalid")
        try:
            actual = os.lstat(self.path)
            opened = os.fstat(self.descriptor)
        except OSError:
            raise BackupError("writer_stop_session_invalid") from None
        if not _same_identity(actual, self.status) or not _same_identity(opened, self.status):
            raise BackupError("writer_stop_session_invalid")

    def __call__(self, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._assert_identity()
        if stage == "before" and not self.before_read and not self.after_read:
            self.before_read = True
            return _read_canonical_json_at(self.descriptor, "before.json")
        if stage != "after" or not self.before_read or self.after_read:
            raise BackupError("writer_stop_session_invalid")
        self.after_read = True
        capture = {
            "schemaVersion": "chaotang.writer-stop-capture.v1",
            "captureCompletedAt": payload["captureCompletedAt"],
            "sourceRootIdentity": payload["sourceRootIdentity"],
        }
        capture["captureDigest"] = _digest_canonical(capture)
        try:
            descriptor = os.open(
                "capture.json",
                os.O_WRONLY
                | os.O_CREAT
                | os.O_EXCL
                | getattr(os, "O_CLOEXEC", 0)
                | getattr(os, "O_NOFOLLOW", 0),
                0o600,
                dir_fd=self.descriptor,
            )
            try:
                _write_all(descriptor, _canonical_bytes(capture))
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            _fsync_directory_descriptor(self.descriptor)
        except OSError:
            raise BackupError("writer_stop_session_invalid") from None
        deadline = time.monotonic() + 30
        while True:
            self._assert_identity()
            try:
                os.stat("final.json", dir_fd=self.descriptor, follow_symlinks=False)
            except FileNotFoundError:
                if time.monotonic() >= deadline:
                    raise BackupError("writer_stop_session_timeout") from None
                time.sleep(0.02)
                continue
            except OSError:
                raise BackupError("writer_stop_session_invalid") from None
            if set(os.listdir(self.descriptor)) != {
                "before.json",
                "capture.json",
                "final.json",
            }:
                raise BackupError("writer_stop_session_invalid")
            return _read_canonical_json_at(self.descriptor, "final.json")


def _cli_summary(result: BackupResult, *, include_manifest: bool) -> dict[str, str]:
    summary = {"sourceSnapshotIdentity": result.source_snapshot_identity}
    if include_manifest:
        manifest_sha256, _ = _sha256_file(result.manifest_path)
        summary["manifestSha256"] = manifest_sha256
    return summary


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.operations.sqlite_backup")
    subparsers = parser.add_subparsers(dest="command", required=True)
    synthetic = subparsers.add_parser("synthetic")
    synthetic.add_argument("--root", type=Path, required=True)
    retention = subparsers.add_parser("probe-synthetic-retention")
    retention.add_argument("--root", type=Path, required=True)
    backup = subparsers.add_parser("backup")
    backup.add_argument("--source", type=Path, required=True)
    backup.add_argument("--destination", type=Path, required=True)
    backup.add_argument("--mode", choices=sorted(_BACKUP_MODES), required=True)
    backup.add_argument("--writer-stop-session", type=Path)
    verify = subparsers.add_parser("verify")
    verify.add_argument("--backup", type=Path, required=True)
    rehearse = subparsers.add_parser("rehearse")
    rehearse.add_argument("--backup", type=Path, required=True)
    rehearse.add_argument("--destination", type=Path, required=True)
    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "synthetic":
            summary = run_synthetic_rehearsal(arguments.root)
        elif arguments.command == "probe-synthetic-retention":
            summary = probe_synthetic_retention(arguments.root)
        elif arguments.command == "backup":
            session = (
                _WriterStopSession(arguments.writer_stop_session)
                if arguments.writer_stop_session is not None
                else None
            )
            try:
                if arguments.mode == _ONLINE_MODE and session is not None:
                    raise BackupError("writer_stop_evidence_forbidden")
                result = (
                    _backup_runtime_with_session(
                        arguments.source,
                        arguments.destination,
                        writer_stop_session=session,
                    )
                    if arguments.mode == _COLD_MODE
                    else backup_runtime(arguments.source, arguments.destination)
                )
                summary = _cli_summary(result, include_manifest=True)
            finally:
                session and session.close()
        elif arguments.command == "verify":
            summary = _cli_summary(verify_backup(arguments.backup), include_manifest=False)
        elif arguments.command == "rehearse":
            summary = _cli_summary(
                rehearse_restore(arguments.backup, arguments.destination),
                include_manifest=False,
            )
        else:  # pragma: no cover - argparse owns this branch
            parser.error("unsupported command")
    except FileExistsError:
        parser.exit(1, f"{arguments.command}_target_exists\n")
    except BackupError:
        parser.exit(1, f"{arguments.command}_failed\n")
    print(json.dumps(summary, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through subprocess tests
    raise SystemExit(main())
