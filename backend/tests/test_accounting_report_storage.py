from __future__ import annotations

import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import (
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
)


def _storage(tmp_path: Path) -> ArtifactStorage:
    return ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )


def _pending_file(tmp_path: Path, name: str = "pending.xlsx") -> tuple[Path, str]:
    del name
    path = tmp_path / "report_artifacts" / f".{uuid4().hex}.xlsx"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = b"synthetic workbook bytes"
    path.write_bytes(payload)
    return path, hashlib.sha256(payload).hexdigest()


def _create_pending(
    storage: ArtifactStorage,
    tmp_path: Path,
    *,
    owner: str = "owner-a",
    run_id: str = "run-a",
    report_type: str = "management",
):
    path, file_hash = _pending_file(tmp_path, f"{owner}-{run_id}-{report_type}.xlsx")
    return storage.create_pending(
        owner_user_id=owner,
        run_id=run_id,
        report_type=report_type,
        display_name="2024年度会计管理报告.xlsx",
        period=ReportPeriod(2024, 2024),
        source_hashes=("a" * 64,),
        file_sha256=file_hash,
        pending_path=path,
    )


def test_new_artifact_is_pending_and_requires_complete_metadata(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    artifact = _create_pending(storage, tmp_path)

    assert storage.get_state(artifact.artifact_id) == "PENDING"
    assert artifact.owner_user_id == "owner-a"
    assert artifact.run_id == "run-a"
    assert artifact.period == ReportPeriod(2024, 2024)
    assert artifact.source_sha256
    assert artifact.file_sha256

    path, file_hash = _pending_file(tmp_path, "invalid.xlsx")
    with pytest.raises((TypeError, ValueError, ArtifactStorageError)):
        storage.create_pending(
            owner_user_id="",
            run_id="run-b",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=(),
            file_sha256=file_hash,
            pending_path=path,
        )


def test_publish_moves_to_opaque_final_path_and_is_idempotent(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)
    old_path = pending.file_path

    first = storage.publish_run(
        owner_user_id="owner-a", run_id="run-a", reply_id="reply-a"
    )
    second = storage.publish_run(
        owner_user_id="owner-a", run_id="run-a", reply_id="reply-a"
    )

    assert first == second
    assert len(first) == 1
    published = first[0]
    assert published.generated_at.tzinfo is not None
    assert second[0].generated_at == published.generated_at
    assert published.artifact_id == pending.artifact_id
    assert published.reply_id == "reply-a"
    assert published.file_path.name == f"{pending.artifact_id}.xlsx"
    assert published.file_path.exists()
    assert not old_path.exists()
    assert storage.get_state(pending.artifact_id) == "PUBLISHED"


def test_owner_isolation_and_hash_verification_fail_closed(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)
    published = storage.publish_run("owner-a", "run-a", "reply-a")[0]

    assert storage.get_published(pending.artifact_id, "owner-a") == published
    with pytest.raises(ArtifactNotFound):
        storage.get_published(pending.artifact_id, "owner-b")

    published.file_path.write_bytes(b"tampered")
    with pytest.raises(ArtifactStorageError) as error:
        storage.get_published(pending.artifact_id, "owner-a")
    assert str(published.file_path) not in str(error.value)


def test_abort_removes_only_pending_files_for_owner_and_run(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    published_pending = _create_pending(storage, tmp_path, run_id="published-run")
    published = storage.publish_run(
        "owner-a", "published-run", "reply-published"
    )[0]
    aborted = _create_pending(storage, tmp_path, run_id="abort-run")
    other_owner = _create_pending(
        storage, tmp_path, owner="owner-b", run_id="abort-run"
    )

    storage.abort_run("owner-a", "abort-run")

    assert storage.get_state(aborted.artifact_id) == "ABORTED"
    assert not aborted.file_path.exists()
    assert storage.get_state(other_owner.artifact_id) == "PENDING"
    assert other_owner.file_path.exists()
    assert storage.get_state(published_pending.artifact_id) == "PUBLISHED"
    assert published.file_path.exists()


def test_database_rejects_duplicate_official_artifact(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    _create_pending(storage, tmp_path, report_type="management")
    storage.publish_run("owner-a", "run-a", "reply-a")
    _create_pending(
        storage,
        tmp_path,
        run_id="run-b",
        report_type="management",
    )

    with pytest.raises(sqlite3.IntegrityError):
        storage.publish_run("owner-a", "run-b", "reply-a")


class _FaultingConnection:
    def __init__(
        self,
        connection: sqlite3.Connection,
        *,
        execute_marker: str | None = None,
        fail_commit: bool = False,
    ) -> None:
        self._connection = connection
        self._execute_marker = execute_marker
        self._fail_commit = fail_commit

    def execute(self, sql: str, parameters=()):
        if self._execute_marker and self._execute_marker in " ".join(sql.split()):
            raise sqlite3.OperationalError("synthetic execute failure")
        return self._connection.execute(sql, parameters)

    def commit(self) -> None:
        if self._fail_commit:
            self._fail_commit = False
            raise sqlite3.OperationalError("synthetic commit failure")
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


@pytest.mark.parametrize("failure", ["execute", "commit"])
def test_create_pending_restores_input_after_database_failure(
    tmp_path: Path, monkeypatch, failure: str
) -> None:
    storage = _storage(tmp_path)
    incoming, file_hash = _pending_file(tmp_path, f"{failure}.xlsx")
    if failure == "execute":
        with sqlite3.connect(storage.db_path) as connection:
            connection.execute(
                """
                CREATE TRIGGER fail_pending_insert
                BEFORE INSERT ON report_artifacts
                BEGIN
                    SELECT RAISE(ABORT, 'synthetic execute failure');
                END
                """
            )
    else:
        with sqlite3.connect(storage.db_path) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript(
                """
                CREATE TABLE commit_guard_parent (id TEXT PRIMARY KEY);
                CREATE TABLE commit_guard_child (
                    id TEXT REFERENCES commit_guard_parent(id)
                        DEFERRABLE INITIALLY DEFERRED
                );
                CREATE TRIGGER fail_pending_commit
                AFTER INSERT ON report_artifacts
                BEGIN
                    INSERT INTO commit_guard_child(id) VALUES (NEW.artifact_id);
                END;
                """
            )
        real_connect = storage._connect

        def connect_with_foreign_keys():
            connection = real_connect()
            connection.execute("PRAGMA foreign_keys = ON")
            return connection

        monkeypatch.setattr(storage, "_connect", connect_with_foreign_keys)

    with pytest.raises(ArtifactStorageError):
        storage.create_pending(
            owner_user_id="owner-a",
            run_id="run-a",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=("a" * 64,),
            file_sha256=file_hash,
            pending_path=incoming,
        )

    assert incoming.read_bytes() == b"synthetic workbook bytes"
    assert tuple((tmp_path / "report_artifacts").glob("*.pending.xlsx")) == ()
    with sqlite3.connect(storage.db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM report_artifacts").fetchone()[0] == 0


def test_create_pending_connect_failure_does_not_move_input(
    tmp_path: Path, monkeypatch
) -> None:
    storage = _storage(tmp_path)
    incoming, file_hash = _pending_file(tmp_path, "connect-failure.xlsx")
    monkeypatch.setattr(
        storage,
        "_connect",
        lambda: (_ for _ in ()).throw(sqlite3.OperationalError("synthetic connect failure")),
    )

    with pytest.raises(ArtifactStorageError):
        storage.create_pending(
            owner_user_id="owner-a",
            run_id="run-a",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=("a" * 64,),
            file_sha256=file_hash,
            pending_path=incoming,
        )

    assert incoming.read_bytes() == b"synthetic workbook bytes"
    assert tuple((tmp_path / "report_artifacts").glob("*.pending.xlsx")) == ()


def test_create_pending_double_compensation_failure_is_registered_and_recovered(
    tmp_path: Path, monkeypatch
) -> None:
    storage = _storage(tmp_path)
    incoming, file_hash = _pending_file(tmp_path, "double-failure.xlsx")
    with sqlite3.connect(storage.db_path) as connection:
        connection.execute(
            """
            CREATE TRIGGER fail_pending_insert
            BEFORE INSERT ON report_artifacts
            BEGIN
                SELECT RAISE(ABORT, 'synthetic execute failure');
            END
            """
        )
    original_replace = Path.replace
    original_unlink = Path.unlink

    def fail_restore(source: Path, target: Path):
        if source.name.endswith(".pending.xlsx") and target == incoming:
            raise OSError("synthetic restore failure")
        return original_replace(source, target)

    def fail_canonical_unlink(path: Path, *args, **kwargs):
        if path.name.endswith(".pending.xlsx"):
            raise OSError("synthetic unlink failure")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "replace", fail_restore)
    monkeypatch.setattr(Path, "unlink", fail_canonical_unlink)

    with pytest.raises(ArtifactStorageError) as error:
        storage.create_pending(
            owner_user_id="owner-a",
            run_id="run-a",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=("a" * 64,),
            file_sha256=file_hash,
            pending_path=incoming,
        )

    assert str(error.value) == "artifact_unavailable"
    assert len(tuple(storage.artifact_dir.glob("*.pending.xlsx"))) == 1
    assert len(tuple(storage.artifact_dir.glob("*.orphan.json"))) == 1
    monkeypatch.setattr(Path, "replace", original_replace)
    monkeypatch.setattr(Path, "unlink", original_unlink)
    with sqlite3.connect(storage.db_path) as connection:
        connection.execute("DROP TRIGGER fail_pending_insert")

    recovered = storage.create_pending(
        owner_user_id="owner-a",
        run_id="run-a",
        report_type="management",
        display_name="report.xlsx",
        period=ReportPeriod(2024, 2024),
        source_hashes=("a" * 64,),
        file_sha256=file_hash,
        pending_path=incoming,
    )

    assert recovered.file_path.exists()
    assert tuple(storage.artifact_dir.glob("*.orphan.json")) == ()
    assert len(tuple(storage.artifact_dir.glob("*.pending.xlsx"))) == 1


@pytest.mark.parametrize("target_state", ["PUBLISHED", "PENDING"])
def test_forged_orphan_marker_cannot_delete_another_artifact(
    tmp_path: Path, target_state: str
) -> None:
    storage = _storage(tmp_path)
    target = _create_pending(
        storage,
        tmp_path,
        owner="victim",
        run_id=f"victim-{target_state.lower()}",
    )
    target_path = target.file_path
    if target_state == "PUBLISHED":
        target_path = storage.publish_run(
            "victim",
            "victim-published",
            "victim-reply",
        )[0].file_path
    target_bytes = target_path.read_bytes()
    incoming, file_hash = _pending_file(tmp_path)
    forged_id = "f" * 32
    marker = storage.artifact_dir / f"{forged_id}.orphan.json"
    marker.write_text(
        json.dumps(
            {
                "version": 1,
                "kind": "create_pending_recovery",
                "artifact_id": forged_id,
                "canonical": target_path.name,
                "original": incoming.name,
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ArtifactStorageError) as error:
        storage.create_pending(
            owner_user_id="attacker",
            run_id="attacker-run",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=("a" * 64,),
            file_sha256=file_hash,
            pending_path=incoming,
        )

    assert str(error.value) == "artifact_unavailable"
    assert marker.exists()
    assert target_path.read_bytes() == target_bytes
    assert storage.get_state(target.artifact_id) == target_state


def test_create_pending_rejects_non_service_temporary_name(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    incoming = storage.artifact_dir / "user-chosen.xlsx"
    payload = b"synthetic workbook bytes"
    incoming.write_bytes(payload)

    with pytest.raises(ArtifactStorageError):
        storage.create_pending(
            owner_user_id="owner-a",
            run_id="run-a",
            report_type="management",
            display_name="report.xlsx",
            period=ReportPeriod(2024, 2024),
            source_hashes=("a" * 64,),
            file_sha256=hashlib.sha256(payload).hexdigest(),
            pending_path=incoming,
        )

    assert incoming.read_bytes() == payload


def test_publish_compensation_failure_is_recovered_by_retry(
    tmp_path: Path, monkeypatch
) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)
    real_connect = storage._connect
    monkeypatch.setattr(
        storage,
        "_connect",
        lambda: _FaultingConnection(real_connect(), fail_commit=True),
    )
    original_replace = Path.replace
    compensation_failed = False

    def fail_compensation(source: Path, target: Path):
        nonlocal compensation_failed
        if (
            source.name == f"{pending.artifact_id}.xlsx"
            and target.name == f"{pending.artifact_id}.pending.xlsx"
        ):
            compensation_failed = True
            raise OSError("synthetic compensation failure")
        return original_replace(source, target)

    monkeypatch.setattr(Path, "replace", fail_compensation)

    with pytest.raises(ArtifactStorageError):
        storage.publish_run("owner-a", "run-a", "reply-a")

    assert compensation_failed
    assert storage.get_state(pending.artifact_id) == "PENDING"
    assert (storage.artifact_dir / f"{pending.artifact_id}.xlsx").exists()
    monkeypatch.setattr(storage, "_connect", real_connect)

    published = storage.publish_run("owner-a", "run-a", "reply-a")

    assert len(published) == 1
    assert storage.get_state(pending.artifact_id) == "PUBLISHED"
    assert published[0].file_path.exists()


def test_abort_database_failure_restores_pending_file(
    tmp_path: Path, monkeypatch
) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)
    real_connect = storage._connect
    monkeypatch.setattr(
        storage,
        "_connect",
        lambda: _FaultingConnection(real_connect(), fail_commit=True),
    )

    with pytest.raises(ArtifactStorageError):
        storage.abort_run("owner-a", "run-a")

    assert storage.get_state(pending.artifact_id) == "PENDING"
    assert pending.file_path.read_bytes() == b"synthetic workbook bytes"


def test_abort_compensation_failure_is_recovered_by_retry(
    tmp_path: Path, monkeypatch
) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)
    real_connect = storage._connect
    monkeypatch.setattr(
        storage,
        "_connect",
        lambda: _FaultingConnection(real_connect(), fail_commit=True),
    )
    original_replace = Path.replace

    def fail_compensation(source: Path, target: Path):
        if (
            source.name == f"{pending.artifact_id}.aborting.xlsx"
            and target.name == f"{pending.artifact_id}.pending.xlsx"
        ):
            raise OSError("synthetic compensation failure")
        return original_replace(source, target)

    monkeypatch.setattr(Path, "replace", fail_compensation)

    with pytest.raises(ArtifactStorageError):
        storage.abort_run("owner-a", "run-a")

    assert storage.get_state(pending.artifact_id) == "PENDING"
    aborting = storage.artifact_dir / f"{pending.artifact_id}.aborting.xlsx"
    assert aborting.exists()
    monkeypatch.setattr(storage, "_connect", real_connect)

    storage.abort_run("owner-a", "run-a")

    assert storage.get_state(pending.artifact_id) == "ABORTED"
    assert not aborting.exists()


def test_publish_and_abort_race_has_one_complete_terminal_state(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    pending = _create_pending(storage, tmp_path)

    with ThreadPoolExecutor(max_workers=2) as executor:
        publish = executor.submit(storage.publish_run, "owner-a", "run-a", "reply-a")
        abort = executor.submit(storage.abort_run, "owner-a", "run-a")
        publish.result()
        abort.result()

    state = storage.get_state(pending.artifact_id)
    pending_path = storage.artifact_dir / f"{pending.artifact_id}.pending.xlsx"
    final_path = storage.artifact_dir / f"{pending.artifact_id}.xlsx"
    assert state in {"PUBLISHED", "ABORTED"}
    assert (state, pending_path.exists(), final_path.exists()) in {
        ("PUBLISHED", False, True),
        ("ABORTED", False, False),
    }
