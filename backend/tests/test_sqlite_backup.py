"""Closed-registry SQLite backup, verification, and rehearsal tests."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import threading
import uuid
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

import app.operations.sqlite_backup as sqlite_backup
from app.accounting_reports.storage import ArtifactStorage
from app.agents.runtime_skills.execution_ledger import RuntimeBindingLedger
from app.decree_jobs.storage import DecreeJobStore
from app.fusion.task_token_budget import TaskTokenBudget
from app.jinyiwei import db as jinyiwei_db
from app.junjichu_cases import storage as junjichu_storage
from app.mingshuo import storage as mingshuo_storage
from app.operations.runtime_data_registry import (
    RUNTIME_DATA_ENTRIES,
    schema_contract_digest_connection,
)
from app.operations.sqlite_backup import (
    BACKUP_MANIFEST_NAME,
    DATABASE_REGISTRY,
    BackupError,
    backup_runtime,
    probe_synthetic_retention,
    rehearse_restore,
    verify_backup,
)
from app.qintianjian import storage as qintianjian_storage
from app.scene_packs import storage as scene_packs_storage
from app.shiguan import db as shiguan_db

BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DECREE_SCHEMA_OLD = (
    "sha256:374ba3999e8e333f6ef236dccdf418506f222ebe1f07dbe1627c3a0d1b483e05"
)
_DECREE_SCHEMA_NEW = (
    "sha256:3c3599af569b192c3cd038a43038a071b2e3575c4cdc34bf748938ae1b2f3fb2"
)
_DECREE_SCHEMA_WITH_TASK_BUDGET = (
    "sha256:b22124059f732c39b895302cd28a704150399301692133b47542e8e50efb8b30"
)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _resign_manifest(manifest: dict[str, object], *, snapshot: bool = False) -> None:
    if snapshot:
        manifest["sourceSnapshotIdentity"] = sqlite_backup._snapshot_identity(
            manifest["mode"],
            manifest["sourceRootIdentity"],
            manifest["databases"],
            manifest["artifacts"],
        )
    manifest["manifestDigest"] = sqlite_backup._digest_canonical(
        {key: value for key, value in manifest.items() if key != "manifestDigest"}
    )


def _writer_stop_evidence(source: Path) -> dict[str, object]:
    status = source.stat()
    runner_session_id = str(uuid.UUID("11111111-1111-4111-8111-111111111111"))
    container_id = "2" * 64
    image_digest = f"sha256:{'3' * 64}"
    lock = {
        "device": 1,
        "inode": 2,
        "mode": 384,
        "nlink": 1,
        "uid": getattr(os, "getuid", lambda: 0)(),
    }
    lock["lockDigest"] = sqlite_backup._digest_canonical(
        {
            "schemaVersion": "chaotang.rollout-lock-identity.v1",
            "runnerSessionId": runner_session_id,
            **{key: lock[key] for key in ("device", "inode", "uid", "mode", "nlink")},
        }
    )
    event = {
        "action": "die",
        "containerId": container_id,
        "imageDigest": image_digest,
        "timeNano": "1787270405000000000",
    }
    event["eventDigest"] = sqlite_backup._digest_canonical(
        {"schemaVersion": "chaotang.docker-writer-event.v1", **event}
    )
    root_identity = {"device": status.st_dev, "inode": status.st_ino, "type": "DIRECTORY"}
    evidence = {
        "backendContainerId": container_id,
        "backendImageDigest": image_digest,
        "daemonIdentity": {"apiVersion": "1.52", "daemonId": "daemon-a"},
        "dataRootIdentityAfter": root_identity,
        "dataRootIdentityBefore": root_identity,
        "eventStreamSessionId": "22222222-2222-4222-8222-222222222222",
        "expectedStopEvent": event,
        "observedAtAfter": "2026-08-21T00:00:11.000000Z",
        "observedAtBefore": "2026-08-21T00:00:06.000000Z",
        "postStopWriterEvents": [],
        "rolloutLockIdentity": lock,
        "runnerSessionId": runner_session_id,
        "schemaVersion": "chaotang.writer-stop-evidence.v1",
        "stateAfter": "STOPPED",
        "stateBefore": "STOPPED",
        "stoppedWatermark": "1787270405500000000",
        "streamCompletedAt": "2026-08-21T00:00:12.000000Z",
        "streamStartedAt": "2026-08-21T00:00:04.000000Z",
    }
    evidence["evidenceDigest"] = sqlite_backup._digest_canonical(evidence)
    return evidence


def _current_writer_stop_evidence(source: Path) -> dict[str, object]:
    evidence = _writer_stop_evidence(source)
    completed = datetime.now(UTC) - timedelta(milliseconds=100)
    started = completed - timedelta(seconds=5)
    event_at = started + timedelta(seconds=1)
    watermark = event_at + timedelta(milliseconds=100)
    observed_before = watermark + timedelta(milliseconds=100)
    observed_after = observed_before + timedelta(seconds=2)

    def canonical(value: datetime) -> str:
        return value.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    def nanoseconds(value: datetime) -> str:
        delta = value - datetime(1970, 1, 1, tzinfo=UTC)
        return str(
            (delta.days * 86_400 + delta.seconds) * 1_000_000_000
            + value.microsecond * 1_000
        )

    evidence["streamStartedAt"] = canonical(started)
    evidence["observedAtBefore"] = canonical(observed_before)
    evidence["observedAtAfter"] = canonical(observed_after)
    evidence["streamCompletedAt"] = canonical(completed)
    evidence["stoppedWatermark"] = nanoseconds(watermark)
    event = evidence["expectedStopEvent"]
    assert isinstance(event, dict)
    event["timeNano"] = nanoseconds(event_at)
    event["eventDigest"] = sqlite_backup._digest_canonical(
        {"schemaVersion": "chaotang.docker-writer-event.v1", **{
            key: event[key] for key in ("containerId", "imageDigest", "action", "timeNano")
        }}
    )
    evidence["evidenceDigest"] = sqlite_backup._digest_canonical(
        {key: value for key, value in evidence.items() if key != "evidenceDigest"}
    )
    return evidence


def _writer_stop_before(evidence: dict[str, object]) -> dict[str, object]:
    before = {
        "backendContainerId": evidence["backendContainerId"],
        "backendImageDigest": evidence["backendImageDigest"],
        "daemonIdentity": evidence["daemonIdentity"],
        "dataRootIdentityBefore": evidence["dataRootIdentityBefore"],
        "eventStreamSessionId": evidence["eventStreamSessionId"],
        "expectedStopEvent": evidence["expectedStopEvent"],
        "observedAtBefore": evidence["observedAtBefore"],
        "rolloutLockIdentity": evidence["rolloutLockIdentity"],
        "runnerSessionId": evidence["runnerSessionId"],
        "schemaVersion": "chaotang.writer-stop-before.v1",
        "stateBefore": evidence["stateBefore"],
        "stoppedWatermark": evidence["stoppedWatermark"],
        "streamStartedAt": evidence["streamStartedAt"],
    }
    before["beforeDigest"] = sqlite_backup._digest_canonical(before)
    return before


def _insert_runtime_binding(connection: sqlite3.Connection, value: str) -> None:
    connection.execute(
        "INSERT INTO runtime_resource_bindings VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            value,
            "owner-a",
            value,
            value,
            None,
            "evidence_pack",
            value,
            "v1",
            "a" * 64,
            "{}",
            "2026-08-21T00:00:00+00:00",
        ),
    )


def _create_runtime(root: Path, *, with_artifact: bool = True) -> Path:
    root.mkdir()
    DecreeJobStore(root / "decree_jobs.sqlite3")
    jinyiwei_db.initialize_database(root / "jinyiwei.sqlite3")
    mingshuo_storage.initialize_database(root / "mingshuo.sqlite3")
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
    scene_connection = scene_packs_storage._connect(root / "scene_packs.sqlite3")
    scene_connection.commit()
    scene_connection.close()
    RuntimeBindingLedger(root / "runtime_bindings.sqlite3")
    with closing(sqlite3.connect(root / "runtime_bindings.sqlite3")) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        _insert_runtime_binding(connection, "baseline-binding")
        connection.commit()
    shiguan_connection = shiguan_db.get_connection(root / "shiguan.sqlite3")
    shiguan_connection.close()
    if with_artifact:
        content = b"synthetic workbook bytes"
        artifact_id = "artifact-a"
        (artifact_storage.artifact_dir / f"{artifact_id}.xlsx").write_bytes(content)
        with closing(sqlite3.connect(root / "report_artifacts.sqlite3")) as connection:
            connection.execute(
                "INSERT INTO report_artifacts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    artifact_id,
                    "owner-a",
                    "run-a",
                    "reply-a",
                    "accounting",
                    "Synthetic",
                    1,
                    1,
                    "[]",
                    _sha256(content),
                    "PUBLISHED",
                    "2026-08-21T00:00:00+00:00",
                    "2026-08-21T00:00:00+00:00",
                ),
            )
            connection.commit()
    return root


def _replace_decree_schema_with_canonical_new(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA foreign_keys = OFF")
        existing = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_schema WHERE type = 'table'"
            )
        }
        if "decree_job_idempotency_keys" in existing:
            connection.execute("DROP TABLE decree_job_idempotency_keys")
        if "decree_jobs" in existing:
            connection.execute("DROP TABLE decree_jobs")
        connection.execute(
            """
                CREATE TABLE main.decree_jobs (
                    job_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    draft_fingerprint TEXT NOT NULL,
                    decree_text TEXT NOT NULL,
                    approved_route_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_limit INTEGER NOT NULL DEFAULT 8,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    result_json TEXT,
                    reply_id TEXT,
                    error_code TEXT,
                    error_stage TEXT,
                    error_category TEXT,
                    authority_committed INTEGER NOT NULL DEFAULT 1,
                    acceptance_committed INTEGER NOT NULL DEFAULT 1,
                    deadline_at TEXT NOT NULL,
                    retry_at TEXT,
                    lease_owner TEXT,
                    lease_expires_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    claim_evidence_commitment_json TEXT,
                    UNIQUE(owner_user_id, idempotency_key),
                    UNIQUE(owner_user_id, draft_fingerprint)
                )
                """
        )
        connection.execute(
            """
                CREATE TABLE main.decree_job_idempotency_keys (
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    job_id TEXT NOT NULL REFERENCES decree_jobs(job_id),
                    PRIMARY KEY(owner_user_id, idempotency_key)
                )
                """
        )
        connection.execute(
            """
                CREATE TABLE IF NOT EXISTS main.decree_job_history_annotations (
                    job_id TEXT PRIMARY KEY REFERENCES decree_jobs(job_id),
                    archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
                    updated_at TEXT NOT NULL
                )
                """
        )
        connection.commit()


def _replace_decree_schema_with_canonical_old(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA foreign_keys = OFF")
        existing = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_schema WHERE type = 'table'"
            )
        }
        if "decree_job_idempotency_keys" in existing:
            connection.execute("DROP TABLE decree_job_idempotency_keys")
        if "decree_jobs" in existing:
            connection.execute("DROP TABLE decree_jobs")
        connection.execute(
            """
                CREATE TABLE main.decree_jobs (
                    job_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    draft_fingerprint TEXT NOT NULL,
                    decree_text TEXT NOT NULL,
                    approved_route_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_count INTEGER NOT NULL DEFAULT 0,
                    provider_request_limit INTEGER NOT NULL DEFAULT 8,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    result_json TEXT,
                    reply_id TEXT,
                    error_code TEXT,
                    error_stage TEXT,
                    error_category TEXT,
                    authority_committed INTEGER NOT NULL DEFAULT 1,
                    acceptance_committed INTEGER NOT NULL DEFAULT 1,
                    deadline_at TEXT NOT NULL,
                    retry_at TEXT,
                    lease_owner TEXT,
                    lease_expires_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(owner_user_id, idempotency_key),
                    UNIQUE(owner_user_id, draft_fingerprint)
                )
                """
        )
        connection.execute(
            """
                CREATE TABLE main.decree_job_idempotency_keys (
                    owner_user_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    job_id TEXT NOT NULL REFERENCES decree_jobs(job_id),
                    PRIMARY KEY(owner_user_id, idempotency_key)
                )
                """
        )
        connection.execute(
            """
                CREATE TABLE IF NOT EXISTS main.decree_job_history_annotations (
                    job_id TEXT PRIMARY KEY REFERENCES decree_jobs(job_id),
                    archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
                    updated_at TEXT NOT NULL
                )
                """
        )
        connection.commit()


def _decree_manifest_record(backup: Path) -> tuple[Path, dict[str, object], dict[str, object]]:
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    record = next(
        item for item in manifest["databases"] if item["name"] == "decree_jobs.sqlite3"
    )
    return manifest_path, manifest, record


def _make_pending_shiguan_schema(path: Path):
    with sqlite3.connect(path) as connection:
        connection.execute("DROP TRIGGER schema_migration_verification_guard_update")
        connection.execute(
            "UPDATE schema_migration_verification "
            "SET status = 'PENDING_VERIFICATION', verified_at = NULL WHERE id = 1"
        )
        digest = schema_contract_digest_connection(connection)
        triggers = tuple(
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name"
            )
        )
    current = next(item for item in RUNTIME_DATA_ENTRIES if item.name == path.name)
    return replace(current, required_triggers=triggers, schema_contract_digests=(digest,))


def _registry_with_shiguan(registration):
    return tuple(
        registration if item.name == "shiguan.sqlite3" else item
        for item in RUNTIME_DATA_ENTRIES
    )


def test_backup_verify_and_rehearse_closed_runtime(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    backup = tmp_path / "backup"
    restored = tmp_path / "restored"
    result = backup_runtime(source, backup)

    assert result.destination == backup
    assert result.manifest_path == backup / BACKUP_MANIFEST_NAME
    verified = verify_backup(backup)
    rehearsed = rehearse_restore(backup, restored)
    assert verified.source_snapshot_identity == result.source_snapshot_identity
    assert rehearsed.source_snapshot_identity == result.source_snapshot_identity
    assert (restored / "report_artifacts" / "artifact-a.xlsx").read_bytes() == (
        b"synthetic workbook bytes"
    )


def test_backup_and_restore_preserve_mingshuo_delivery_intent(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    with sqlite3.connect(source / "mingshuo.sqlite3") as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            "INSERT INTO mingshuo_projects VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                "b" * 32,
                "tenant-a",
                "owner-a",
                "Synthetic project",
                "[]",
                "[]",
                "[]",
                1,
                "2026-09-13T00:00:00Z",
                "2026-09-13T00:00:00Z",
            ),
        )
        connection.execute(
            "INSERT INTO mingshuo_requirement_revisions VALUES "
            "(?,?,?,?,?,?,?,?)",
            (
                "4" * 32,
                "tenant-a",
                "owner-a",
                "b" * 32,
                1,
                "Synthetic requirements",
                "sha256:" + "5" * 64,
                "2026-09-13T00:00:00Z",
            ),
        )
        connection.execute(
            "INSERT INTO mingshuo_fact_pack_revisions VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                "6" * 32,
                "tenant-a",
                "owner-a",
                "b" * 32,
                1,
                "4" * 32,
                b"{}",
                "sha256:" + "c" * 64,
                "PASS",
                "[]",
                "[]",
                "[]",
                "sha256:" + "7" * 64,
                "sha256:" + "8" * 64,
                "sha256:" + "9" * 64,
                "2026-09-13",
                "mingshuo.fact-pack.evaluator.v1",
                "mingshuo.project-fact-pack.v1",
                "2026-09-13T00:00:00Z",
            ),
        )
        connection.execute(
            "INSERT INTO mingshuo_draft_requests VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                "a" * 32,
                "tenant-a",
                "owner-a",
                "b" * 32,
                "synthetic-request",
                "sha256:" + "a" * 64,
                1,
                "sha256:" + "c" * 64,
                "NON_AUTHORIZING",
                "2026-09-13T00:00:00Z",
            ),
        )
        connection.execute(
            "INSERT INTO mingshuo_delivery_intents VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                "a" * 32,
                "tenant-a",
                "owner-a",
                "b" * 32,
                1,
                "sha256:" + "c" * 64,
                '{"schemaVersion":"mingshuo.delivery-binding.v1"}',
                "sha256:" + "d" * 64,
                "sha256:" + "e" * 64,
                "f" * 32,
                "1" * 32,
                "sha256:" + "2" * 64,
                "3" * 64,
                "WORK_PRODUCT_BOUND",
                "2026-09-13T00:00:00Z",
                "2026-09-13T00:00:02Z",
            ),
        )
    backup = tmp_path / "backup"
    restored = tmp_path / "restored"
    backup_runtime(source, backup)
    rehearse_restore(backup, restored)
    with sqlite3.connect(restored / "mingshuo.sqlite3") as connection:
        row = connection.execute(
            "SELECT draft_request_id,state,binding_digest "
            "FROM mingshuo_delivery_intents"
        ).fetchone()
    assert row == ("a" * 32, "WORK_PRODUCT_BOUND", "sha256:" + "d" * 64)


@pytest.mark.parametrize("canonical_new", [False, True])
def test_backup_manifest_binds_the_actual_allowed_decree_schema(
    tmp_path: Path, canonical_new: bool
) -> None:
    source = _create_runtime(tmp_path / "source")
    if canonical_new:
        _replace_decree_schema_with_canonical_new(source / "decree_jobs.sqlite3")
    else:
        _replace_decree_schema_with_canonical_old(source / "decree_jobs.sqlite3")
    expected = _DECREE_SCHEMA_NEW if canonical_new else _DECREE_SCHEMA_OLD
    with sqlite3.connect(source / "decree_jobs.sqlite3") as connection:
        assert schema_contract_digest_connection(connection) == expected

    backup = tmp_path / "backup"
    result = backup_runtime(source, backup)
    _, _, record = _decree_manifest_record(backup)

    assert record["schemaContractDigest"] == expected
    assert verify_backup(backup).source_snapshot_identity == result.source_snapshot_identity
    assert rehearse_restore(backup, tmp_path / "restored").source_snapshot_identity == (
        result.source_snapshot_identity
    )


def test_backup_and_restore_accept_the_exact_task_budget_schema(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    TaskTokenBudget(
        source / "decree_jobs.sqlite3",
        owner_id="owner-a",
        task_id="task-a",
        max_tokens=20_000,
    )
    with sqlite3.connect(source / "decree_jobs.sqlite3") as connection:
        assert schema_contract_digest_connection(connection) == _DECREE_SCHEMA_WITH_TASK_BUDGET

    backup = tmp_path / "backup"
    restored = tmp_path / "restored"
    result = backup_runtime(source, backup)
    verified = verify_backup(backup)
    rehearsed = rehearse_restore(backup, restored)

    assert verified.source_snapshot_identity == result.source_snapshot_identity
    assert rehearsed.source_snapshot_identity == result.source_snapshot_identity
    DecreeJobStore(restored / "decree_jobs.sqlite3")


@pytest.mark.parametrize(
    ("canonical_new", "forged_digest"),
    [(False, _DECREE_SCHEMA_NEW), (True, _DECREE_SCHEMA_OLD)],
)
def test_verify_rejects_allowed_but_spliced_decree_manifest_digest(
    tmp_path: Path, canonical_new: bool, forged_digest: str
) -> None:
    source = _create_runtime(tmp_path / "source")
    if canonical_new:
        _replace_decree_schema_with_canonical_new(source / "decree_jobs.sqlite3")
    else:
        _replace_decree_schema_with_canonical_old(source / "decree_jobs.sqlite3")
    expected = _DECREE_SCHEMA_NEW if canonical_new else _DECREE_SCHEMA_OLD
    with sqlite3.connect(source / "decree_jobs.sqlite3") as connection:
        assert schema_contract_digest_connection(connection) == expected
    backup = tmp_path / "backup"
    backup_runtime(source, backup)
    manifest_path, manifest, record = _decree_manifest_record(backup)
    record["schemaContractDigest"] = forged_digest
    _resign_manifest(manifest, snapshot=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
        newline="\n",
    )

    with pytest.raises(BackupError, match="database_(manifest|schema)_mismatch"):
        verify_backup(backup)


@pytest.mark.parametrize("source_is_new", [False, True])
def test_backup_rejects_allowed_but_spliced_source_and_snapshot_schemas(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, source_is_new: bool
) -> None:
    if os.name == "nt":
        pytest.skip("Windows SQLite sharing prevents replacing an opened snapshot file")
    source = _create_runtime(tmp_path / "source")
    if source_is_new:
        _replace_decree_schema_with_canonical_new(source / "decree_jobs.sqlite3")
    else:
        _replace_decree_schema_with_canonical_old(source / "decree_jobs.sqlite3")
    source_digest = _DECREE_SCHEMA_NEW if source_is_new else _DECREE_SCHEMA_OLD
    snapshot_digest = _DECREE_SCHEMA_OLD if source_is_new else _DECREE_SCHEMA_NEW
    with sqlite3.connect(source / "decree_jobs.sqlite3") as connection:
        assert schema_contract_digest_connection(connection) == source_digest
    original_snapshot = sqlite_backup._snapshot_sqlite_at

    def splice_snapshot(*args, **kwargs):
        observed = original_snapshot(*args, **kwargs)
        destination_directory = args[2]
        destination_name = args[3]
        registration = args[4]
        if registration.name == "decree_jobs.sqlite3":
            destination_root = (
                sqlite_backup._path_for_fd(destination_directory)
                if os.name == "nt"
                else Path(f"/proc/self/fd/{destination_directory}").resolve()
            )
            destination = destination_root / destination_name
            destination.unlink()
            if source_is_new:
                _replace_decree_schema_with_canonical_old(destination)
            else:
                _replace_decree_schema_with_canonical_new(destination)
            with sqlite3.connect(destination) as connection:
                assert schema_contract_digest_connection(connection) == snapshot_digest
        return observed

    monkeypatch.setattr(sqlite_backup, "_snapshot_sqlite_at", splice_snapshot)

    with pytest.raises(BackupError, match="schema_mismatch:decree_jobs.sqlite3"):
        backup_runtime(source, tmp_path / "backup")


def test_backup_and_probe_fail_closed_on_pending_migration_verification(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    sqlite_backup._create_synthetic_runtime(source)
    pending = _make_pending_shiguan_schema(source / "shiguan.sqlite3")
    monkeypatch.setattr(sqlite_backup, "DATABASE_REGISTRY", _registry_with_shiguan(pending))

    with pytest.raises(BackupError, match=r"schema_mismatch:shiguan\.sqlite3"):
        backup_runtime(source, tmp_path / "backup")
    with pytest.raises(BackupError, match=r"schema_mismatch:shiguan\.sqlite3"):
        probe_synthetic_retention(source)


def test_verify_backup_fails_closed_on_pending_migration_verification(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    sqlite_backup._create_synthetic_runtime(source)
    backup = tmp_path / "backup"
    backup_runtime(source, backup)

    shiguan_path = backup / "shiguan.sqlite3"
    pending = _make_pending_shiguan_schema(shiguan_path)
    monkeypatch.setattr(sqlite_backup, "DATABASE_REGISTRY", _registry_with_shiguan(pending))
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    record = next(item for item in manifest["databases"] if item["name"] == shiguan_path.name)
    content = shiguan_path.read_bytes()
    record["bytes"] = len(content)
    record["schemaContractDigest"] = pending.schema_contract_digest
    record["sha256"] = f"sha256:{_sha256(content)}"
    _resign_manifest(manifest, snapshot=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    with pytest.raises(BackupError, match=r"schema_mismatch:shiguan\.sqlite3"):
        verify_backup(backup)


def test_backup_preserves_registered_absent_database_shape(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    (source / "runtime_bindings.sqlite3").unlink()

    result = backup_runtime(source, tmp_path / "backup")
    manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
    runtime_record = next(
        item for item in manifest["databases"] if item["name"] == "runtime_bindings.sqlite3"
    )

    assert runtime_record["presence"] == "ABSENT"
    assert not (result.destination / "runtime_bindings.sqlite3").exists()
    restored = rehearse_restore(result.destination, tmp_path / "restored")
    assert not (restored.destination / "runtime_bindings.sqlite3").exists()


def test_public_backup_api_rejects_forged_writer_stop_evidence(
    tmp_path: Path,
) -> None:
    source = _create_runtime(tmp_path / "source")
    with pytest.raises(BackupError, match="writer_stop_evidence_required"):
        backup_runtime(source, tmp_path / "missing-evidence", mode="COLD_RELEASE")
    with pytest.raises(BackupError, match="writer_stop_evidence_forbidden"):
        backup_runtime(
            source,
            tmp_path / "online-with-evidence",
            writer_stop_evidence=_writer_stop_evidence(source),
        )

    with pytest.raises(BackupError, match="writer_stop_evidence_forbidden"):
        backup_runtime(
            source,
            tmp_path / "cold-dict",
            mode="COLD_RELEASE",
            writer_stop_evidence=_writer_stop_evidence(source),
        )
    with pytest.raises(BackupError, match="writer_stop_evidence_forbidden"):
        backup_runtime(
            source,
            tmp_path / "cold-lambda",
            mode="COLD_RELEASE",
            writer_stop_evidence_provider=lambda _stage, _payload: _writer_stop_evidence(source),
        )


def test_cold_release_rejects_writer_event_identity_and_time_drift(
    tmp_path: Path,
) -> None:
    source = _create_runtime(tmp_path / "source")
    evidence = _writer_stop_evidence(source)
    evidence["expectedStopEvent"]["containerId"] = "9" * 64
    evidence["evidenceDigest"] = sqlite_backup._digest_canonical(
        {key: value for key, value in evidence.items() if key != "evidenceDigest"}
    )
    with pytest.raises(BackupError, match="writer_stop_evidence_forbidden"):
        backup_runtime(
            source,
            tmp_path / "cold",
            mode="COLD_RELEASE",
            writer_stop_evidence=evidence,
        )


def test_backup_reserves_capacity_and_rejects_insufficient_space(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = _create_runtime(tmp_path / "source")
    calls: list[int] = []
    if os.name == "nt":
        original = os.ftruncate

        def record_ftruncate(descriptor: int, length: int) -> None:
            calls.append(length)
            original(descriptor, length)

        monkeypatch.setattr(os, "ftruncate", record_ftruncate)
    else:
        original = os.posix_fallocate

        def record_fallocate(descriptor: int, offset: int, length: int) -> None:
            calls.append(length)
            original(descriptor, offset, length)

        monkeypatch.setattr(os, "posix_fallocate", record_fallocate)
    destination = tmp_path / "backup"
    backup_runtime(source, destination)
    assert calls and calls[0] > 0
    assert not (destination / ".backup-reservation").exists()

    if os.name == "nt":
        usage = shutil.disk_usage(tmp_path)
        monkeypatch.setattr(
            sqlite_backup.shutil,
            "disk_usage",
            lambda _path: usage._replace(free=0),
        )
    else:
        statvfs = os.statvfs(tmp_path)
        monkeypatch.setattr(
            os,
            "statvfs",
            lambda _path: type(
                "LowSpace",
                (),
                {"f_bavail": 0, "f_frsize": statvfs.f_frsize},
            )(),
        )
    blocked = tmp_path / "blocked"
    with pytest.raises(BackupError, match="insufficient_destination_space"):
        backup_runtime(source, blocked)
    assert not blocked.exists()


def test_backup_uses_sqlite_api_to_capture_committed_wal_pages(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    db_path = source / "runtime_bindings.sqlite3"
    writer = sqlite3.connect(db_path)
    try:
        assert writer.execute("PRAGMA journal_mode = WAL").fetchone() == ("wal",)
        _insert_runtime_binding(writer, "committed-in-wal")
        writer.commit()
        assert Path(f"{db_path}-wal").exists()
        backup_runtime(source, tmp_path / "backup")
        with sqlite3.connect(tmp_path / "backup" / db_path.name) as snapshot:
            values = {
                row[0]
                for row in snapshot.execute("SELECT binding_id FROM runtime_resource_bindings")
            }
        assert "committed-in-wal" in values
        assert not (tmp_path / "backup" / f"{db_path.name}-wal").exists()
    finally:
        writer.close()


@pytest.mark.parametrize("suffix", ["-wal", "-shm"])
def test_backup_rejects_hardlinked_sqlite_sidecars(tmp_path: Path, suffix: str) -> None:
    source = _create_runtime(tmp_path / "source")
    database = source / "runtime_bindings.sqlite3"
    writer = sqlite3.connect(database)
    try:
        assert writer.execute("PRAGMA journal_mode = WAL").fetchone() == ("wal",)
        _insert_runtime_binding(writer, "wal-row")
        writer.commit()
        sidecar = Path(f"{database}{suffix}")
        assert sidecar.exists()
        os.link(sidecar, tmp_path / sidecar.name)
        with pytest.raises(BackupError, match="hardlink_forbidden"):
            backup_runtime(source, tmp_path / "backup")
    finally:
        writer.close()


def test_backup_rejects_sidecar_hardlink_created_during_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = _create_runtime(tmp_path / "source")
    database = source / "runtime_bindings.sqlite3"
    writer = sqlite3.connect(database)
    original_verify = sqlite_backup._verify_sqlite_sidecars_at
    injected = False
    matching_calls = 0
    try:
        assert writer.execute("PRAGMA journal_mode = WAL").fetchone() == ("wal",)
        _insert_runtime_binding(writer, "wal-row")
        writer.commit()

        def inject_hardlink(
            directory_descriptor: int,
            database_name: str,
            held: list[tuple[str, int, os.stat_result]],
        ) -> None:
            nonlocal injected, matching_calls
            original_verify(directory_descriptor, database_name, held)
            if database_name == database.name and held:
                matching_calls += 1
            if not injected and matching_calls == 2:
                injected = True
                os.link(
                    Path(f"{database}-wal"),
                    tmp_path / "late-wal-hardlink",
                )

        monkeypatch.setattr(sqlite_backup, "_verify_sqlite_sidecars_at", inject_hardlink)
        with pytest.raises(BackupError, match="hardlink_forbidden"):
            backup_runtime(source, tmp_path / "backup")
        assert injected
    finally:
        writer.close()


def test_backup_remains_integral_during_concurrent_wal_commits(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    db_path = source / "runtime_bindings.sqlite3"
    with sqlite3.connect(db_path) as setup:
        setup.execute("PRAGMA journal_mode = WAL")
    started = threading.Event()
    stop = threading.Event()
    writer_errors: list[Exception] = []

    def write_rows() -> None:
        try:
            with sqlite3.connect(db_path) as connection:
                for index in range(500):
                    _insert_runtime_binding(connection, f"row-{index}")
                    connection.commit()
                    started.set()
                    if stop.is_set():
                        break
        except Exception as error:  # pragma: no cover - asserted below
            writer_errors.append(error)

    thread = threading.Thread(target=write_rows)
    thread.start()
    assert started.wait(timeout=5)
    try:
        backup_runtime(source, tmp_path / "backup")
    finally:
        stop.set()
        thread.join(timeout=5)
    assert not thread.is_alive()
    assert writer_errors == []
    with sqlite3.connect(tmp_path / "backup" / db_path.name) as snapshot:
        assert snapshot.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert snapshot.execute("SELECT COUNT(*) FROM runtime_resource_bindings").fetchone()[0] >= 2


def test_online_backup_retries_once_from_a_new_empty_target_after_registry_drift(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = _create_runtime(tmp_path / "source")
    destination = tmp_path / "backup"
    original = sqlite_backup._validate_source_registry_at
    calls = 0

    def drift_once(source_descriptor: int) -> set[str]:
        nonlocal calls
        calls += 1
        observed = original(source_descriptor)
        if calls == 2:
            return observed - {"runtime_bindings.sqlite3"}
        return observed

    monkeypatch.setattr(sqlite_backup, "_validate_source_registry_at", drift_once)
    result = backup_runtime(source, destination)

    assert calls == 4
    assert result.destination == destination
    assert not (destination / ".backup-reservation").exists()
    assert verify_backup(destination).source_snapshot_identity == result.source_snapshot_identity


def test_online_backup_stops_after_two_registry_drift_attempts_without_partial_target(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = _create_runtime(tmp_path / "source")
    destination = tmp_path / "backup"
    original = sqlite_backup._validate_source_registry_at
    calls = 0

    def always_drift(source_descriptor: int) -> set[str]:
        nonlocal calls
        calls += 1
        observed = original(source_descriptor)
        if calls % 2 == 0:
            return observed - {"runtime_bindings.sqlite3"}
        return observed

    monkeypatch.setattr(sqlite_backup, "_validate_source_registry_at", always_drift)
    with pytest.raises(BackupError, match="source_registry_changed_during_backup"):
        backup_runtime(source, destination)

    assert calls == 4
    assert not destination.exists()


@pytest.mark.parametrize("kind", ["source", "destination"])
def test_rejects_symlink_roots(tmp_path: Path, kind: str) -> None:
    real_source = _create_runtime(tmp_path / "real-source")
    source = real_source
    destination = tmp_path / "backup"
    if kind == "source":
        source = tmp_path / "source-link"
        source.symlink_to(real_source, target_is_directory=True)
    else:
        destination.symlink_to(tmp_path / "elsewhere", target_is_directory=True)
    with pytest.raises(BackupError):
        backup_runtime(source, destination)


def test_rejects_existing_destination_without_overwrite(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    destination = tmp_path / "backup"
    destination.mkdir()
    marker = destination / "preserve"
    marker.write_bytes(b"preserve")
    with pytest.raises(FileExistsError):
        backup_runtime(source, destination)
    assert marker.read_bytes() == b"preserve"


def test_new_root_closes_descriptor_when_final_binding_check_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = (
        set(sqlite_backup._FD_PATHS)
        if os.name == "nt"
        else set(os.listdir("/proc/self/fd"))
    )

    def fail_binding(*_args: object) -> None:
        raise BackupError("directory_replaced_during_operation")

    monkeypatch.setattr(sqlite_backup, "_assert_directory_identity", fail_binding)
    with pytest.raises(BackupError, match="directory_replaced_during_operation"):
        sqlite_backup._create_new_root_open(tmp_path / "new-root")
    after = (
        set(sqlite_backup._FD_PATHS)
        if os.name == "nt"
        else set(os.listdir("/proc/self/fd"))
    )
    assert after == before


def test_backup_refuses_destination_nested_inside_source(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    database = source / "runtime_bindings.sqlite3"
    before = _sha256(database.read_bytes())
    destination = source / "nested-backup"
    with pytest.raises(BackupError, match="source_destination_overlap"):
        backup_runtime(source, destination)
    assert not destination.exists()
    assert _sha256(database.read_bytes()) == before


def test_rejects_unknown_database_and_future_schema(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    sqlite3.connect(source / "unknown.sqlite3").close()
    with pytest.raises(BackupError, match="unknown_entry"):
        backup_runtime(source, tmp_path / "unknown-backup")
    (source / "unknown.sqlite3").unlink()
    with sqlite3.connect(source / "decree_jobs.sqlite3") as connection:
        connection.execute("PRAGMA user_version = 1")
    with pytest.raises(BackupError, match="future_schema"):
        backup_runtime(source, tmp_path / "future-backup")


@pytest.mark.parametrize("name", ["extra.db", "secrets.txt", "decree_jobs.sqlite3-journal"])
def test_rejects_every_unknown_runtime_entry(tmp_path: Path, name: str) -> None:
    source = _create_runtime(tmp_path / "source")
    (source / name).write_bytes(b"must not be silently omitted")
    with pytest.raises(BackupError, match="unknown_entry"):
        backup_runtime(source, tmp_path / "backup")


def test_rejects_orphan_sidecar_for_absent_database(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    (source / "qintianjian.sqlite3").unlink()
    (source / "qintianjian.sqlite3-wal").write_bytes(b"orphan")
    with pytest.raises(BackupError, match="orphan_sqlite_sidecar"):
        backup_runtime(source, tmp_path / "backup")


def test_rejects_hardlinks_and_special_files(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    linked = tmp_path / "linked.sqlite3"
    os.link(source / "decree_jobs.sqlite3", linked)
    with pytest.raises(BackupError, match="hardlink"):
        backup_runtime(source, tmp_path / "hardlink-backup")
    linked.unlink()
    (source / "decree_jobs.sqlite3").unlink()
    if os.name == "nt":
        pytest.skip("Windows has no os.mkfifo; FIFO rejection is covered on POSIX")
    os.mkfifo(source / "decree_jobs.sqlite3")
    with pytest.raises(BackupError, match="regular_file"):
        backup_runtime(source, tmp_path / "fifo-backup")


def test_rejects_hardlinked_or_unreferenced_artifact(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    artifact = source / "report_artifacts" / "artifact-a.xlsx"
    linked = tmp_path / "linked.xlsx"
    os.link(artifact, linked)
    with pytest.raises(BackupError, match="hardlink"):
        backup_runtime(source, tmp_path / "hardlink-backup")
    linked.unlink()
    (source / "report_artifacts" / "extra.xlsx").write_bytes(b"unreferenced")
    with pytest.raises(BackupError, match="unexpected_artifact"):
        backup_runtime(source, tmp_path / "extra-backup")


def test_rejects_pending_artifact_in_release_backup(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    published = source / "report_artifacts" / "artifact-a.xlsx"
    pending = source / "report_artifacts" / "artifact-a.pending.xlsx"
    published.rename(pending)
    with sqlite3.connect(source / "report_artifacts.sqlite3") as connection:
        connection.execute(
            "UPDATE report_artifacts SET state = 'PENDING' WHERE artifact_id = 'artifact-a'"
        )

    with pytest.raises(BackupError, match="artifact_not_published"):
        backup_runtime(source, tmp_path / "backup")


def test_ignores_aborted_artifact_history_without_a_file(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    artifact = source / "report_artifacts" / "artifact-a.xlsx"
    artifact.unlink()
    with sqlite3.connect(source / "report_artifacts.sqlite3") as connection:
        connection.execute(
            "UPDATE report_artifacts SET state = 'ABORTED' WHERE artifact_id = 'artifact-a'"
        )

    result = backup_runtime(source, tmp_path / "backup")

    assert result.source_snapshot_identity.startswith("sha256:")


@pytest.mark.parametrize("kind", ["symlink", "hardlink", "fifo"])
def test_verify_rejects_unsafe_backup_entries(tmp_path: Path, kind: str) -> None:
    if os.name == "nt" and kind == "hardlink":
        pytest.skip("Windows sharing semantics do not permit moving this opened backup file")
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    target = backup / "decree_jobs.sqlite3"
    original = tmp_path / "original.sqlite3"
    target.replace(original)
    if kind == "symlink":
        target.symlink_to(original)
    elif kind == "hardlink":
        os.link(original, target)
    else:
        if os.name == "nt":
            pytest.skip("Windows has no os.mkfifo; FIFO rejection is covered on POSIX")
        os.mkfifo(target)
    with pytest.raises(BackupError):
        verify_backup(backup)


@pytest.mark.parametrize("target", ["database", "artifact", "manifest"])
def test_verify_rejects_tampering(tmp_path: Path, target: str) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    if target == "database":
        path = backup / "decree_jobs.sqlite3"
        path.write_bytes(path.read_bytes() + b"tamper")
    elif target == "artifact":
        (backup / "report_artifacts" / "artifact-a.xlsx").write_bytes(b"tamper")
    else:
        manifest_path = backup / BACKUP_MANIFEST_NAME
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["sourceSnapshotIdentity"] = "0" * 64
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8", newline="\n")
    with pytest.raises(BackupError):
        verify_backup(backup)


@pytest.mark.parametrize("mutation", ["missing", "extra"])
def test_verify_rejects_missing_or_extra_files(tmp_path: Path, mutation: str) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    if mutation == "missing":
        (backup / "junjichu_cases.sqlite3").unlink()
    else:
        (backup / "extra.txt").write_text("extra", encoding="utf-8")
    with pytest.raises(BackupError):
        verify_backup(backup)


def test_verify_rejects_manifest_path_traversal(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["artifacts"][0]["relativePath"] = "report_artifacts/../escape.xlsx"
    _resign_manifest(manifest)
    manifest_path.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with pytest.raises(BackupError, match="artifact_path_invalid"):
        verify_backup(backup)


@pytest.mark.parametrize("mutation", ["whitespace", "artifact-order"])
def test_verify_rejects_noncanonical_manifest(tmp_path: Path, mutation: str) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if mutation == "artifact-order":
        manifest["artifacts"].append(
            {
                "databaseName": "report_artifacts.sqlite3",
                "relativePath": "report_artifacts/z.xlsx",
                "sha256": "0" * 64,
                "size": 0,
            }
        )
        manifest["artifacts"].reverse()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8", newline="\n")
    with pytest.raises(BackupError, match="manifest_not_canonical"):
        verify_backup(backup)


def test_sqlite_metadata_rejects_database_replacement_during_connect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if os.name == "nt":
        pytest.skip("Windows sharing semantics prevent replacing an opened SQLite file")
    source = _create_runtime(tmp_path / "source")
    database = source / "decree_jobs.sqlite3"
    original_connect = sqlite_backup.sqlite3.connect
    replaced = False

    def replacing_connect(*args: object, **kwargs: object) -> sqlite3.Connection:
        nonlocal replaced
        if not replaced and "/proc/self/fd/" in str(args[0]):
            replaced = True
            database.replace(source / "original.sqlite3")
            sqlite3.connect(database).close()
        return original_connect(*args, **kwargs)

    monkeypatch.setattr(sqlite_backup.sqlite3, "connect", replacing_connect)
    with pytest.raises(BackupError, match="file_replaced_during_operation"):
        sqlite_backup._sqlite_metadata(database)


def test_snapshot_reads_held_database_inode_during_aba_name_swap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if os.name == "nt":
        pytest.skip("Windows path-backed SQLite URI cannot reproduce POSIX held-inode ABA test")
    source = _create_runtime(tmp_path / "source")
    database = source / "runtime_bindings.sqlite3"
    attack = tmp_path / "attack.payload"
    RuntimeBindingLedger(attack)
    with sqlite3.connect(attack) as connection:
        _insert_runtime_binding(connection, "ABA-ATTACK-SNAPSHOT")
    original_connect = sqlite_backup.sqlite3.connect
    calls = 0

    def aba_connect(*args: object, **kwargs: object) -> sqlite3.Connection:
        nonlocal calls
        calls += 1
        if calls != 2:
            return original_connect(*args, **kwargs)
        original = source / "held-original.sqlite3"
        used_attack = tmp_path / "used-attack.payload"
        database.rename(original)
        attack.rename(database)
        connection = original_connect(*args, **kwargs)
        database.rename(used_attack)
        original.rename(database)
        return connection

    monkeypatch.setattr(sqlite_backup.sqlite3, "connect", aba_connect)
    backup_runtime(source, tmp_path / "backup")
    with sqlite3.connect(tmp_path / "backup" / database.name) as snapshot:
        values = {
            row[0] for row in snapshot.execute("SELECT binding_id FROM runtime_resource_bindings")
        }
    assert "ABA-ATTACK-SNAPSHOT" not in values
    assert "baseline-binding" in values


def test_manifest_read_rejects_path_replacement(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if os.name == "nt":
        pytest.skip("Windows file sharing prevents replacing an opened manifest")
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest = backup / BACKUP_MANIFEST_NAME
    original_read = sqlite_backup.os.read
    replaced = False

    def replacing_read(descriptor: int, size: int) -> bytes:
        nonlocal replaced
        content = original_read(descriptor, size)
        if not replaced and content:
            replaced = True
            manifest.replace(backup / "original-manifest.json")
            manifest.write_bytes(content)
        return content

    monkeypatch.setattr(sqlite_backup.os, "read", replacing_read)
    with pytest.raises(BackupError, match="file_replaced_during_operation"):
        sqlite_backup._load_manifest(backup)


def test_backup_rejects_destination_root_replacement(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if os.name == "nt":
        pytest.skip("Windows directory sharing semantics differ from POSIX descriptor replacement")
    source = _create_runtime(tmp_path / "source")
    destination = tmp_path / "backup"
    original_snapshot = sqlite_backup._snapshot_sqlite_at
    replaced = False

    def replacing_snapshot(*args: object, **kwargs: object) -> str:
        nonlocal replaced
        if not replaced:
            replaced = True
            destination.rename(tmp_path / "original-backup-root")
            destination.mkdir(mode=0o700)
        return original_snapshot(*args, **kwargs)

    monkeypatch.setattr(sqlite_backup, "_snapshot_sqlite_at", replacing_snapshot)
    with pytest.raises(BackupError, match="directory_replaced_during_operation"):
        backup_runtime(source, destination)
    assert list(destination.iterdir()) == []
    assert (tmp_path / "original-backup-root" / "decree_jobs.sqlite3").exists()


def test_verify_rejects_canonical_reversed_artifact_order(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["artifacts"].append(
        {
            "artifactId": "z",
            "bytes": 0,
            "capturedAt": manifest["capturedAt"],
            "relativePath": "report_artifacts/z.xlsx",
            "sha256": f"sha256:{'0' * 64}",
        }
    )
    manifest["artifacts"].reverse()
    _resign_manifest(manifest, snapshot=True)
    manifest_path.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with pytest.raises(BackupError, match="artifact_manifest_mismatch"):
        verify_backup(backup)


def test_verify_rejects_non_string_artifact_path_with_stable_error(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["artifacts"][0]["relativePath"] = 1
    _resign_manifest(manifest)
    manifest_path.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with pytest.raises(BackupError, match="artifact_path_invalid"):
        verify_backup(backup)


def test_verify_rejects_boolean_user_version_even_with_recomputed_identity(
    tmp_path: Path,
) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    manifest_path = backup / BACKUP_MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["databases"][0]["userVersion"] = False
    _resign_manifest(manifest, snapshot=True)
    manifest_path.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with pytest.raises(BackupError, match="database_manifest_mismatch"):
        verify_backup(backup)


def test_rehearse_refuses_nonempty_or_existing_target(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    restore = tmp_path / "restore"
    restore.mkdir()
    marker = restore / "preserve"
    marker.write_bytes(b"preserve")
    with pytest.raises(FileExistsError):
        rehearse_restore(backup, restore)
    assert marker.read_bytes() == b"preserve"


def test_rehearse_refuses_destination_nested_inside_backup(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    destination = backup / "nested-restore"
    with pytest.raises(BackupError, match="source_destination_overlap"):
        rehearse_restore(backup, destination)
    assert not destination.exists()
    verify_backup(backup)


def test_backup_manifest_is_closed_and_deterministically_ordered(tmp_path: Path) -> None:
    backup = tmp_path / "backup"
    result = backup_runtime(_create_runtime(tmp_path / "source"), backup)
    raw = result.manifest_path.read_bytes()
    manifest = json.loads(raw)
    assert raw.endswith(b"\n")
    assert raw == (json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n").encode()
    assert set(manifest) == {
        "artifacts",
        "capturedAt",
        "databases",
        "manifestDigest",
        "mode",
        "schemaVersion",
        "sourceRootIdentity",
        "sourceSnapshotIdentity",
        "writerStopEvidence",
    }
    assert manifest["schemaVersion"] == "chaotang.sqlite-backup.v2"
    assert manifest["mode"] == "ONLINE_PER_DATABASE"
    assert manifest["writerStopEvidence"] is None
    assert manifest["sourceSnapshotIdentity"].startswith("sha256:")
    assert manifest["manifestDigest"].startswith("sha256:")
    assert [entry["name"] for entry in manifest["databases"]] == [
        entry.name for entry in DATABASE_REGISTRY
    ]
    assert len(manifest["databases"]) == len(DATABASE_REGISTRY)
    assert all(entry["presence"] == "PRESENT" for entry in manifest["databases"])


def test_synthetic_cli_runs_real_backup_verify_and_rehearse(tmp_path: Path) -> None:
    root = tmp_path / "synthetic"
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "synthetic",
            "--root",
            os.fspath(root),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode == 0, completed.stderr
    summary = json.loads(completed.stdout)
    assert set(summary) == {"manifestSha256", "sourceSnapshotIdentity"}
    assert len(summary["manifestSha256"]) == 64
    assert len(summary["sourceSnapshotIdentity"]) == 71
    assert summary["sourceSnapshotIdentity"].startswith("sha256:")
    assert completed.stdout == json.dumps(summary, sort_keys=True, separators=(",", ":")) + "\n"
    assert (
        verify_backup(root / "backup").source_snapshot_identity == summary["sourceSnapshotIdentity"]
    )
    assert (
        verify_backup(root / "rehearsed").source_snapshot_identity
        == summary["sourceSnapshotIdentity"]
    )
    sentinel_queries = {
        "decree_jobs.sqlite3": "SELECT COUNT(*) FROM decree_jobs",
        "shiguan.sqlite3": "SELECT COUNT(*) FROM archives",
        "shiguan.sqlite3#user": (
            "SELECT COUNT(*) FROM users WHERE id = 'synthetic-owner'"
        ),
        "shiguan.sqlite3#tenant": (
            "SELECT COUNT(*) FROM tenants "
            "WHERE id = 'rc1-synthetic-tenant' AND kind = 'PERSONAL'"
        ),
        "shiguan.sqlite3#membership": (
            "SELECT COUNT(*) FROM tenant_memberships "
            "WHERE id = 'rc1-synthetic-membership' "
            "AND user_id = 'synthetic-owner' "
            "AND tenant_id = 'rc1-synthetic-tenant' "
            "AND role = 'OWNER' AND revoked_at IS NULL"
        ),
        "shiguan.sqlite3#session": (
            "SELECT COUNT(*) FROM auth_sessions "
            "WHERE id = 'rc1-synthetic-session' "
            "AND user_id = 'synthetic-owner' "
            "AND membership_id = 'rc1-synthetic-membership' "
            "AND revoked_at IS NULL"
        ),
        "report_artifacts.sqlite3": "SELECT COUNT(*) FROM confirmation_receipts",
        "runtime_bindings.sqlite3": "SELECT COUNT(*) FROM runtime_resource_bindings",
    }
    for database_key, query in sentinel_queries.items():
        database_name = database_key.split("#", 1)[0]
        with sqlite3.connect(root / "source" / database_name) as connection:
            assert connection.execute(query).fetchone()[0] == 1
    source_probe = probe_synthetic_retention(root / "source")
    restored_probe = probe_synthetic_retention(root / "rehearsed")
    assert source_probe == restored_probe
    assert source_probe["schemaVersion"] == "chaotang.rc1-retention-probe.v1"
    assert source_probe["retentionDigest"].startswith("sha256:")


def test_retention_probe_fails_closed_when_any_required_sentinel_is_missing(
    tmp_path: Path,
) -> None:
    root = tmp_path / "synthetic"
    assert subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "synthetic",
            "--root",
            os.fspath(root),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    ).returncode == 0
    with sqlite3.connect(root / "source" / "decree_jobs.sqlite3") as connection:
        connection.execute(
            "DELETE FROM decree_job_idempotency_keys WHERE job_id = ?",
            ("rc1-synthetic-job",),
        )
        connection.execute(
            "DELETE FROM decree_jobs WHERE job_id = ?", ("rc1-synthetic-job",)
        )

    with pytest.raises(BackupError, match="synthetic_retention_probe_failed"):
        probe_synthetic_retention(root / "source")


@pytest.mark.parametrize(
    "statement,parameters",
    [
        (
            "UPDATE users SET username = ? WHERE id = ?",
            ("substituted-owner", "synthetic-owner"),
        ),
        (
            "UPDATE tenant_memberships SET revoked_at = ? WHERE id = ?",
            ("2026-08-22T00:00:00+00:00", "rc1-synthetic-membership"),
        ),
        (
            "UPDATE auth_sessions SET revoked_at = ? WHERE id = ?",
            ("2026-08-22T00:00:00+00:00", "rc1-synthetic-session"),
        ),
    ],
)
def test_retention_probe_rejects_substituted_principal_sentinels(
    tmp_path: Path, statement: str, parameters: tuple[str, str]
) -> None:
    source = tmp_path / "source"
    sqlite_backup._create_synthetic_runtime(source)
    with sqlite3.connect(source / "shiguan.sqlite3") as connection:
        connection.execute(statement, parameters)

    with pytest.raises(BackupError, match="synthetic_retention_probe_failed"):
        probe_synthetic_retention(source)


def test_retention_probe_rejects_missing_synthetic_tenant(tmp_path: Path) -> None:
    source = tmp_path / "source"
    sqlite_backup._create_synthetic_runtime(source)
    with sqlite3.connect(source / "shiguan.sqlite3") as connection:
        trigger_sql = connection.execute(
            "SELECT sql FROM sqlite_master "
            "WHERE type = 'trigger' AND name = 'tenants_no_delete'"
        ).fetchone()[0]
        connection.execute("DROP TRIGGER tenants_no_delete")
        connection.execute(
            "DELETE FROM tenants WHERE id = ?", ("rc1-synthetic-tenant",)
        )
        connection.execute(trigger_sql)

    with pytest.raises(BackupError, match="sqlite_foreign_key_check_failed"):
        probe_synthetic_retention(source)


def test_cli_rejects_a_prebuilt_cold_writer_session(tmp_path: Path) -> None:
    if os.name == "nt":
        pytest.skip("COLD_RELEASE writer session currently requires POSIX /proc evidence")
    runner = BACKEND_ROOT.parent / "scripts/run_rc1_release_acceptance.mjs"
    assert sqlite_backup._TRUSTED_RUNNER_SHA256 == (
        "sha256:" + hashlib.sha256(runner.read_bytes()).hexdigest()
    )
    source = _create_runtime(tmp_path / "source")
    backup = tmp_path / "cold-backup"
    session = tmp_path / "writer-stop-session"
    session.mkdir(mode=0o700)
    evidence = _current_writer_stop_evidence(source)
    (session / "before.json").write_text(
        json.dumps(
            _writer_stop_before(evidence),
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    backup_completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "backup",
            "--source",
            os.fspath(source),
            "--destination",
            os.fspath(backup),
            "--mode",
            "COLD_RELEASE",
            "--writer-stop-session",
            os.fspath(session),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert backup_completed.returncode != 0
    assert backup_completed.stdout == ""
    assert not backup.exists()


def test_cli_rejects_duplicate_writer_evidence_keys_without_creating_backup(tmp_path: Path) -> None:
    source = _create_runtime(tmp_path / "source")
    destination = tmp_path / "must-not-exist"
    session = tmp_path / "writer-stop-session"
    session.mkdir(mode=0o700)
    (session / "before.json").write_text(
        '{"schemaVersion":"first","schemaVersion":"second"}\n',
        encoding="utf-8",
    )

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "backup",
            "--source",
            os.fspath(source),
            "--destination",
            os.fspath(destination),
            "--mode",
            "COLD_RELEASE",
            "--writer-stop-session",
            os.fspath(session),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode != 0
    assert completed.stdout == ""
    assert not destination.exists()


def test_synthetic_cli_refuses_existing_target_without_overwrite(tmp_path: Path) -> None:
    root = tmp_path / "existing"
    root.mkdir()
    marker = root / "preserve"
    marker.write_bytes(b"preserve")
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "synthetic",
            "--root",
            os.fspath(root),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode != 0
    assert completed.stdout == ""
    assert marker.read_bytes() == b"preserve"


def test_rehearsal_failure_removes_only_its_new_destination(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    backup = tmp_path / "backup"
    backup_runtime(_create_runtime(tmp_path / "source"), backup)
    destination = tmp_path / "failed-rehearsal"
    original = sqlite_backup._copy_regular_at
    calls = 0

    def fail_after_first_copy(*args: object, **kwargs: object) -> tuple[str, int]:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise BackupError("injected_rehearsal_failure")
        return original(*args, **kwargs)

    monkeypatch.setattr(sqlite_backup, "_copy_regular_at", fail_after_first_copy)
    with pytest.raises(BackupError, match="injected_rehearsal_failure"):
        rehearse_restore(backup, destination)

    assert not destination.exists()


def test_synthetic_cli_refuses_repository_or_production_path() -> None:
    forbidden = BACKEND_ROOT / "data" / "rc1-synthetic-must-not-exist"
    assert not forbidden.exists()
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "synthetic",
            "--root",
            os.fspath(forbidden),
        ],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode != 0
    assert completed.stdout == ""
    assert not forbidden.exists()


def test_synthetic_cli_ignores_untrusted_tmpdir_override() -> None:
    forbidden = BACKEND_ROOT / "data" / "rc1-env-temp-must-not-exist"
    assert not forbidden.exists()
    environment = os.environ.copy()
    environment["TMPDIR"] = os.fspath(BACKEND_ROOT / "data")
    environment["TEMP"] = os.fspath(BACKEND_ROOT / "data")
    environment["TMP"] = os.fspath(BACKEND_ROOT / "data")
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.operations.sqlite_backup",
            "synthetic",
            "--root",
            os.fspath(forbidden),
        ],
        cwd=BACKEND_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode != 0
    assert completed.stdout == ""
    assert not forbidden.exists()


def test_synthetic_cli_has_no_default_command_or_root() -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "app.operations.sqlite_backup", "synthetic"],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert completed.returncode == 2
    assert completed.stdout == ""
