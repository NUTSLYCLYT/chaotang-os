from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.work_products import (
    ArtifactState,
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
)

from .models import PendingReportArtifact, PublishedReportArtifact, ReportPeriod

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "report_artifacts.sqlite3"
DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "data" / "report_artifacts"
_ARTIFACT_ID_PATTERN = re.compile(r"[0-9a-f]{32}")
_CREATE_TEMP_PATTERN = re.compile(r"\.[0-9a-f]{32}\.xlsx")
_ORPHAN_VERSION = 1
_ORPHAN_KIND = "create_pending_recovery"


class ArtifactNotFound(LookupError):
    pass


class ArtifactStorageError(RuntimeError):
    pass


def _required(value: str, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} is required")
    return value.strip()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError:
        raise ArtifactStorageError("artifact_unavailable") from None
    return digest.hexdigest()


def _source_digest(source_hashes: tuple[str, ...]) -> str:
    return hashlib.sha256(
        json.dumps(source_hashes, ensure_ascii=True, separators=(",", ":")).encode()
    ).hexdigest()


class ArtifactStorage:
    def __init__(
        self,
        artifact_dir: Path | None = None,
        db_path: Path | None = None,
    ) -> None:
        self.artifact_dir = Path(
            DEFAULT_ARTIFACT_DIR if artifact_dir is None else artifact_dir
        ).resolve()
        self.db_path = Path(DEFAULT_DB_PATH if db_path is None else db_path)
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with closing(self._connect()) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS report_artifacts (
                    artifact_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    reply_id TEXT,
                    report_type TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    period_start INTEGER NOT NULL,
                    period_end INTEGER NOT NULL,
                    source_hashes_json TEXT NOT NULL,
                    file_sha256 TEXT NOT NULL,
                    state TEXT NOT NULL
                        CHECK (state IN ('PENDING', 'PUBLISHED', 'ABORTED')),
                    created_at TEXT NOT NULL,
                    published_at TEXT
                );
                CREATE UNIQUE INDEX IF NOT EXISTS uq_official_report_artifact
                ON report_artifacts(owner_user_id, reply_id, report_type)
                WHERE state = 'PUBLISHED';

                CREATE TABLE IF NOT EXISTS work_products (
                    work_product_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    capability_id TEXT NOT NULL,
                    version INTEGER NOT NULL CHECK (version > 0),
                    work_status TEXT NOT NULL CHECK (
                        work_status IN (
                            'NEEDS_DATA',
                            'NEEDS_REVIEW',
                            'BLOCKED',
                            'READY_FOR_HUMAN_CONFIRMATION',
                            'REVISION_REQUIRED'
                        )
                    ),
                    confirmation_status TEXT NOT NULL CHECK (
                        confirmation_status IN (
                            'PENDING',
                            'CONFIRMED',
                            'REVISION_REQUIRED',
                            'ESCALATED'
                        )
                    ),
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE (owner_user_id, run_id, capability_id, version)
                );
                CREATE TABLE IF NOT EXISTS work_product_artifacts (
                    work_product_id TEXT NOT NULL REFERENCES work_products(work_product_id),
                    artifact_id TEXT NOT NULL REFERENCES report_artifacts(artifact_id),
                    PRIMARY KEY (work_product_id, artifact_id)
                );
                CREATE TABLE IF NOT EXISTS confirmation_receipts (
                    work_product_id TEXT NOT NULL REFERENCES work_products(work_product_id),
                    version INTEGER NOT NULL CHECK (version > 0),
                    sequence INTEGER NOT NULL CHECK (sequence > 0),
                    decision TEXT NOT NULL CHECK (
                        decision IN ('CONFIRMED', 'REVISION_REQUIRED', 'ESCALATED')
                    ),
                    actor_ref TEXT NOT NULL,
                    structured_reason TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (work_product_id, sequence)
                );
                DROP TRIGGER IF EXISTS confirmation_receipts_guard_insert;
                CREATE TRIGGER confirmation_receipts_guard_insert
                BEFORE INSERT ON confirmation_receipts
                WHEN NOT EXISTS (
                    SELECT 1 FROM work_products AS parent
                    WHERE parent.work_product_id = NEW.work_product_id
                      AND parent.version = NEW.version
                      AND parent.work_status = 'READY_FOR_HUMAN_CONFIRMATION'
                      AND parent.confirmation_status = 'PENDING'
                )
                BEGIN
                    SELECT RAISE(ABORT, 'receipt parent version is invalid');
                END;
                CREATE TRIGGER IF NOT EXISTS confirmation_receipts_apply_decision
                AFTER INSERT ON confirmation_receipts
                BEGIN
                    UPDATE work_products
                    SET confirmation_status = NEW.decision,
                        work_status = CASE
                            WHEN NEW.decision = 'REVISION_REQUIRED'
                            THEN 'REVISION_REQUIRED'
                            ELSE work_status
                        END
                    WHERE work_product_id = NEW.work_product_id
                      AND version = NEW.version
                      AND confirmation_status = 'PENDING';
                END;
                CREATE TRIGGER IF NOT EXISTS confirmation_receipts_no_update
                BEFORE UPDATE ON confirmation_receipts
                BEGIN
                    SELECT RAISE(ABORT, 'confirmation receipts are append-only');
                END;
                CREATE TRIGGER IF NOT EXISTS confirmation_receipts_no_delete
                BEFORE DELETE ON confirmation_receipts
                BEGIN
                    SELECT RAISE(ABORT, 'confirmation receipts are append-only');
                END;
                DROP TRIGGER IF EXISTS work_products_guard_update;
                CREATE TRIGGER work_products_guard_update
                BEFORE UPDATE ON work_products
                WHEN NOT (
                    NEW.work_product_id IS OLD.work_product_id
                    AND NEW.owner_user_id IS OLD.owner_user_id
                    AND NEW.run_id IS OLD.run_id
                    AND NEW.capability_id IS OLD.capability_id
                    AND NEW.version IS OLD.version
                    AND NEW.payload_json IS OLD.payload_json
                    AND NEW.created_at IS OLD.created_at
                    AND OLD.work_status = 'READY_FOR_HUMAN_CONFIRMATION'
                    AND OLD.confirmation_status = 'PENDING'
                    AND NEW.confirmation_status IN (
                        'CONFIRMED', 'REVISION_REQUIRED', 'ESCALATED'
                    )
                    AND (
                        (
                            NEW.confirmation_status = 'REVISION_REQUIRED'
                            AND NEW.work_status = 'REVISION_REQUIRED'
                        )
                        OR (
                            NEW.confirmation_status IN ('CONFIRMED', 'ESCALATED')
                            AND NEW.work_status IS OLD.work_status
                        )
                    )
                    AND EXISTS (
                        SELECT 1 FROM confirmation_receipts AS receipt
                        WHERE receipt.work_product_id = OLD.work_product_id
                          AND receipt.version = OLD.version
                          AND receipt.decision = NEW.confirmation_status
                    )
                )
                BEGIN
                    SELECT RAISE(ABORT, 'work product mutation is not allowed');
                END;
                CREATE TRIGGER IF NOT EXISTS work_products_no_delete
                BEFORE DELETE ON work_products
                BEGIN
                    SELECT RAISE(ABORT, 'work products cannot be deleted');
                END;
                CREATE TRIGGER IF NOT EXISTS work_product_artifacts_no_update
                BEFORE UPDATE ON work_product_artifacts
                BEGIN
                    SELECT RAISE(ABORT, 'artifact bindings are immutable');
                END;
                CREATE TRIGGER IF NOT EXISTS work_product_artifacts_no_delete
                BEFORE DELETE ON work_product_artifacts
                BEGIN
                    SELECT RAISE(ABORT, 'artifact bindings are immutable');
                END;
                """
            )
            connection.commit()

    @staticmethod
    def _work_product_from_row(row: sqlite3.Row) -> WorkProductEnvelope:
        try:
            payload = WorkProductEnvelope.model_validate_json(row["payload_json"])
            return payload.model_copy(
                update={
                    "work_status": WorkProductStatus(row["work_status"]),
                    "confirmation_status": ConfirmationStatus(
                        row["confirmation_status"]
                    ),
                }
            )
        except (KeyError, TypeError, ValueError):
            raise ArtifactStorageError("artifact_unavailable") from None

    def create_work_product(
        self,
        owner_user_id: str,
        artifact_id: str,
        payload: WorkProductEnvelope,
    ) -> WorkProductEnvelope:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        artifact_id = _required(artifact_id, "artifact_id")
        if not isinstance(payload, WorkProductEnvelope):
            raise TypeError("payload must be a WorkProductEnvelope")
        if payload.owner_user_id != owner_user_id:
            raise ValueError("payload owner does not match owner_user_id")
        if payload.confirmation_status is not ConfirmationStatus.PENDING:
            raise ValueError("new work product confirmation_status must be PENDING")
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        with closing(connection):
            try:
                connection.execute("BEGIN IMMEDIATE")
                artifact = connection.execute(
                    """
                    SELECT artifact_id FROM report_artifacts
                    WHERE artifact_id = ? AND owner_user_id = ?
                    """,
                    (artifact_id, owner_user_id),
                ).fetchone()
                if artifact is None:
                    raise ArtifactNotFound
                connection.execute(
                    """
                    INSERT INTO work_products (
                        work_product_id, owner_user_id, run_id, capability_id,
                        version, work_status, confirmation_status, payload_json,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        payload.work_product_id,
                        owner_user_id,
                        payload.run_id,
                        payload.capability_id,
                        payload.version,
                        payload.work_status.value,
                        payload.confirmation_status.value,
                        payload.model_dump_json(),
                        payload.created_at.isoformat(),
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO work_product_artifacts (work_product_id, artifact_id)
                    VALUES (?, ?)
                    """,
                    (payload.work_product_id, artifact_id),
                )
                connection.commit()
            except ArtifactNotFound:
                connection.rollback()
                raise
            except Exception:
                connection.rollback()
                raise ArtifactStorageError("artifact_unavailable") from None
        return payload

    def get_work_product(
        self, owner_user_id: str, work_product_id: str
    ) -> WorkProductEnvelope:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        work_product_id = _required(work_product_id, "work_product_id")
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        with closing(connection):
            try:
                row = connection.execute(
                    """
                    SELECT * FROM work_products
                    WHERE owner_user_id = ? AND work_product_id = ?
                    """,
                    (owner_user_id, work_product_id),
                ).fetchone()
            except sqlite3.Error:
                raise ArtifactStorageError("artifact_unavailable") from None
        if row is None:
            raise ArtifactNotFound
        return self._work_product_from_row(row)

    def get_work_product_for_artifact(
        self, owner_user_id: str, artifact_id: str
    ) -> WorkProductEnvelope:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        artifact_id = _required(artifact_id, "artifact_id")
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        with closing(connection):
            try:
                row = connection.execute(
                    """
                    SELECT product.*, artifact.state AS artifact_state
                    FROM work_products AS product
                    JOIN work_product_artifacts AS binding
                      ON binding.work_product_id = product.work_product_id
                    JOIN report_artifacts AS artifact
                      ON artifact.artifact_id = binding.artifact_id
                    WHERE product.owner_user_id = ?
                      AND artifact.owner_user_id = ?
                      AND artifact.artifact_id = ?
                    """,
                    (owner_user_id, owner_user_id, artifact_id),
                ).fetchone()
            except sqlite3.Error:
                raise ArtifactStorageError("artifact_unavailable") from None
        if row is None:
            raise ArtifactNotFound
        payload = self._work_product_from_row(row)
        return payload.model_copy(
            update={"artifact_state": ArtifactState(row["artifact_state"])}
        )

    def append_confirmation(
        self,
        owner_user_id: str,
        work_product_id: str,
        decision: str | ConfirmationStatus,
        actor_ref: str,
        structured_reason: str,
    ) -> ConfirmationReceipt:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        work_product_id = _required(work_product_id, "work_product_id")
        actor_ref = _required(actor_ref, "actor_ref")
        structured_reason = _required(structured_reason, "structured_reason")
        decision = ConfirmationStatus(decision)
        if decision is ConfirmationStatus.PENDING:
            raise ValueError("confirmation decision cannot be PENDING")
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        with closing(connection):
            try:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    """
                    SELECT * FROM work_products
                    WHERE owner_user_id = ? AND work_product_id = ?
                    """,
                    (owner_user_id, work_product_id),
                ).fetchone()
                if row is None:
                    raise ArtifactNotFound
                if (
                    row["work_status"]
                    != WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION.value
                    or row["confirmation_status"]
                    != ConfirmationStatus.PENDING.value
                ):
                    raise ArtifactStorageError("confirmation_transition_invalid")
                sequence = connection.execute(
                    """
                    SELECT COALESCE(MAX(sequence), 0) + 1
                    FROM confirmation_receipts WHERE work_product_id = ?
                    """,
                    (work_product_id,),
                ).fetchone()[0]
                receipt = ConfirmationReceipt(
                    work_product_id=work_product_id,
                    version=row["version"],
                    sequence=sequence,
                    decision=decision,
                    actor_ref=actor_ref,
                    structured_reason=structured_reason,
                    created_at=datetime.now(UTC),
                )
                connection.execute(
                    """
                    INSERT INTO confirmation_receipts (
                        work_product_id, version, sequence, decision, actor_ref,
                        structured_reason, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        receipt.work_product_id,
                        receipt.version,
                        receipt.sequence,
                        receipt.decision.value,
                        receipt.actor_ref,
                        receipt.structured_reason,
                        receipt.created_at.isoformat(),
                    ),
                )
                connection.commit()
            except (ArtifactNotFound, ArtifactStorageError):
                connection.rollback()
                raise
            except Exception:
                connection.rollback()
                raise ArtifactStorageError("artifact_unavailable") from None
        return receipt

    def list_confirmation_receipts(
        self, owner_user_id: str, work_product_id: str
    ) -> tuple[ConfirmationReceipt, ...]:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        work_product_id = _required(work_product_id, "work_product_id")
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        with closing(connection):
            try:
                owner_row = connection.execute(
                    """
                    SELECT 1 FROM work_products
                    WHERE owner_user_id = ? AND work_product_id = ?
                    """,
                    (owner_user_id, work_product_id),
                ).fetchone()
                if owner_row is None:
                    raise ArtifactNotFound
                rows = connection.execute(
                    """
                    SELECT * FROM confirmation_receipts
                    WHERE work_product_id = ? ORDER BY sequence
                    """,
                    (work_product_id,),
                ).fetchall()
            except ArtifactNotFound:
                raise
            except sqlite3.Error:
                raise ArtifactStorageError("artifact_unavailable") from None
        try:
            return tuple(
                ConfirmationReceipt(
                    work_product_id=row["work_product_id"],
                    version=row["version"],
                    sequence=row["sequence"],
                    decision=row["decision"],
                    actor_ref=row["actor_ref"],
                    structured_reason=row["structured_reason"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for row in rows
            )
        except (KeyError, TypeError, ValueError):
            raise ArtifactStorageError("artifact_unavailable") from None

    def _contained(self, path: Path, *, must_exist: bool = True) -> Path:
        try:
            resolved = path.resolve(strict=must_exist)
            resolved.relative_to(self.artifact_dir)
        except (OSError, ValueError):
            raise ArtifactStorageError("artifact_unavailable") from None
        return resolved

    def _recover_create_orphans(self) -> None:
        for marker in sorted(self.artifact_dir.glob("*.orphan.json")):
            try:
                recovery = json.loads(marker.read_text(encoding="utf-8"))
                if not isinstance(recovery, dict) or set(recovery) != {
                    "version",
                    "kind",
                    "artifact_id",
                    "canonical",
                    "original",
                }:
                    raise ValueError
                artifact_id = recovery["artifact_id"]
                canonical_name = recovery["canonical"]
                original_name = recovery["original"]
                if (
                    recovery["version"] != _ORPHAN_VERSION
                    or recovery["kind"] != _ORPHAN_KIND
                    or not isinstance(artifact_id, str)
                    or _ARTIFACT_ID_PATTERN.fullmatch(artifact_id) is None
                    or marker.name != f"{artifact_id}.orphan.json"
                    or canonical_name != f"{artifact_id}.pending.xlsx"
                    or not isinstance(original_name, str)
                    or _CREATE_TEMP_PATTERN.fullmatch(original_name) is None
                ):
                    raise ValueError
                canonical = self._contained(
                    self.artifact_dir / canonical_name,
                    must_exist=False,
                )
                original = self._contained(
                    self.artifact_dir / original_name,
                    must_exist=False,
                )
                if canonical.exists():
                    if original.exists():
                        canonical.unlink()
                    else:
                        canonical.replace(original)
                marker.unlink()
            except (OSError, ValueError, KeyError, json.JSONDecodeError):
                raise ArtifactStorageError("artifact_unavailable") from None

    def _register_create_orphan(
        self,
        artifact_id: str,
        canonical_path: Path,
        original_path: Path,
    ) -> None:
        if (
            _ARTIFACT_ID_PATTERN.fullmatch(artifact_id) is None
            or canonical_path.name != f"{artifact_id}.pending.xlsx"
            or _CREATE_TEMP_PATTERN.fullmatch(original_path.name) is None
        ):
            raise ArtifactStorageError("artifact_unavailable")
        marker = self._contained(
            self.artifact_dir / f"{artifact_id}.orphan.json",
            must_exist=False,
        )
        try:
            marker.write_text(
                json.dumps(
                    {
                        "version": _ORPHAN_VERSION,
                        "kind": _ORPHAN_KIND,
                        "artifact_id": artifact_id,
                        "canonical": canonical_path.name,
                        "original": original_path.name,
                    },
                    ensure_ascii=True,
                    separators=(",", ":"),
                ),
                encoding="utf-8",
            )
        except OSError:
            raise ArtifactStorageError("artifact_unavailable") from None

    def create_pending(
        self,
        *,
        owner_user_id: str,
        run_id: str,
        report_type: str,
        display_name: str,
        period: ReportPeriod,
        source_hashes: tuple[str, ...],
        file_sha256: str,
        pending_path: Path,
    ) -> PendingReportArtifact:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        run_id = _required(run_id, "run_id")
        report_type = _required(report_type, "report_type")
        display_name = Path(_required(display_name, "display_name")).name
        if not isinstance(period, ReportPeriod):
            raise TypeError("period is required")
        if not source_hashes or any(not str(value).strip() for value in source_hashes):
            raise ValueError("source_hashes are required")
        file_sha256 = _required(file_sha256, "file_sha256")
        self._recover_create_orphans()
        if _CREATE_TEMP_PATTERN.fullmatch(Path(pending_path).name) is None:
            raise ArtifactStorageError("artifact_unavailable")
        path = self._contained(Path(pending_path))
        if _sha256(path) != file_sha256:
            raise ArtifactStorageError("artifact_hash_mismatch")
        artifact_id = uuid4().hex
        canonical_path = self._contained(
            self.artifact_dir / f"{artifact_id}.pending.xlsx",
            must_exist=False,
        )
        encoded_hashes = json.dumps(
            tuple(sorted(set(source_hashes))),
            ensure_ascii=True,
            separators=(",", ":"),
        )
        try:
            connection = self._connect()
        except (OSError, sqlite3.Error):
            raise ArtifactStorageError("artifact_unavailable") from None
        moved = False
        with closing(connection):
            try:
                connection.execute("BEGIN IMMEDIATE")
                path.replace(canonical_path)
                moved = True
                connection.execute(
                    """
                    INSERT INTO report_artifacts (
                        artifact_id, owner_user_id, run_id, reply_id, report_type,
                        display_name, period_start, period_end, source_hashes_json,
                        file_sha256, state, created_at, published_at
                    ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL)
                    """,
                    (
                        artifact_id,
                        owner_user_id,
                        run_id,
                        report_type,
                        display_name,
                        period.start_year,
                        period.end_year,
                        encoded_hashes,
                        file_sha256,
                        datetime.now(UTC).isoformat(),
                    ),
                )
                connection.commit()
            except Exception:
                connection.rollback()
                if moved:
                    try:
                        canonical_path.replace(path)
                    except OSError:
                        try:
                            canonical_path.unlink(missing_ok=True)
                        except OSError:
                            self._register_create_orphan(
                                artifact_id,
                                canonical_path,
                                path,
                            )
                raise ArtifactStorageError("artifact_unavailable") from None
        return PendingReportArtifact(
            artifact_id=artifact_id,
            owner_user_id=owner_user_id,
            run_id=run_id,
            report_type=report_type,
            period=period,
            source_sha256=_source_digest(tuple(json.loads(encoded_hashes))),
            file_sha256=file_sha256,
            display_name=display_name,
            file_path=canonical_path,
        )

    def _artifact_from_row(
        self, row: sqlite3.Row, final_path: Path
    ) -> PublishedReportArtifact:
        hashes = tuple(json.loads(row["source_hashes_json"]))
        generated_at = datetime.fromisoformat(row["created_at"])
        return PublishedReportArtifact(
            artifact_id=row["artifact_id"],
            owner_user_id=row["owner_user_id"],
            run_id=row["run_id"],
            reply_id=row["reply_id"],
            report_type=row["report_type"],
            period=ReportPeriod(row["period_start"], row["period_end"]),
            source_sha256=_source_digest(hashes),
            file_sha256=row["file_sha256"],
            display_name=row["display_name"],
            file_path=final_path,
            generated_at=generated_at,
        )

    def _published_from_row(self, row: sqlite3.Row) -> PublishedReportArtifact:
        final_path = self._contained(
            self.artifact_dir / f"{row['artifact_id']}.xlsx"
        )
        if _sha256(final_path) != row["file_sha256"]:
            raise ArtifactStorageError("artifact_hash_mismatch")
        return self._artifact_from_row(row, final_path)

    def _paths(self, artifact_id: str) -> tuple[Path, Path, Path]:
        return (
            self._contained(
                self.artifact_dir / f"{artifact_id}.pending.xlsx",
                must_exist=False,
            ),
            self._contained(
                self.artifact_dir / f"{artifact_id}.xlsx",
                must_exist=False,
            ),
            self._contained(
                self.artifact_dir / f"{artifact_id}.aborting.xlsx",
                must_exist=False,
            ),
        )

    def _reconcile_terminal_row(self, row: sqlite3.Row) -> None:
        pending, final, aborting = self._paths(row["artifact_id"])
        if row["state"] == "PUBLISHED":
            if not final.exists():
                recoverable = [path for path in (pending, aborting) if path.exists()]
                if len(recoverable) != 1:
                    raise ArtifactStorageError("artifact_unavailable")
                try:
                    recoverable[0].replace(final)
                except OSError:
                    raise ArtifactStorageError("artifact_unavailable") from None
            for stale in (pending, aborting):
                try:
                    stale.unlink(missing_ok=True)
                except OSError:
                    raise ArtifactStorageError("artifact_unavailable") from None
        elif row["state"] == "ABORTED":
            for stale in (pending, final, aborting):
                try:
                    stale.unlink(missing_ok=True)
                except OSError:
                    raise ArtifactStorageError("artifact_unavailable") from None

    def _pending_source(self, row: sqlite3.Row) -> Path:
        pending, final, aborting = self._paths(row["artifact_id"])
        existing = [path for path in (pending, final, aborting) if path.exists()]
        if len(existing) != 1:
            raise ArtifactStorageError("artifact_unavailable")
        return existing[0]

    def publish_run(
        self, owner_user_id: str, run_id: str, reply_id: str
    ) -> tuple[PublishedReportArtifact, ...]:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        run_id = _required(run_id, "run_id")
        reply_id = _required(reply_id, "reply_id")
        moved: list[tuple[Path, Path]] = []
        with closing(self._connect()) as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                run_rows = connection.execute(
                    """
                    SELECT * FROM report_artifacts
                    WHERE owner_user_id = ? AND run_id = ?
                    ORDER BY artifact_id
                    """,
                    (owner_user_id, run_id),
                ).fetchall()
                for row in run_rows:
                    self._reconcile_terminal_row(row)
                existing = connection.execute(
                    """
                    SELECT * FROM report_artifacts
                    WHERE owner_user_id = ? AND run_id = ? AND reply_id = ?
                      AND state = 'PUBLISHED'
                    ORDER BY artifact_id
                    """,
                    (owner_user_id, run_id, reply_id),
                ).fetchall()
                if existing:
                    published = tuple(
                        self._published_from_row(row) for row in existing
                    )
                    connection.commit()
                    return published
                pending = [row for row in run_rows if row["state"] == "PENDING"]
                for row in pending:
                    source = self._pending_source(row)
                    _pending_path, destination, _aborting_path = self._paths(
                        row["artifact_id"]
                    )
                    if source != destination:
                        source.replace(destination)
                        moved.append((source, destination))
                    if _sha256(destination) != row["file_sha256"]:
                        raise ArtifactStorageError("artifact_hash_mismatch")
                    connection.execute(
                        """
                        UPDATE report_artifacts
                        SET reply_id = ?, state = 'PUBLISHED', published_at = ?
                        WHERE artifact_id = ? AND state = 'PENDING'
                        """,
                        (reply_id, datetime.now(UTC).isoformat(), row["artifact_id"]),
                    )
                rows = connection.execute(
                    """
                    SELECT * FROM report_artifacts
                    WHERE owner_user_id = ? AND run_id = ? AND reply_id = ?
                      AND state = 'PUBLISHED'
                    ORDER BY artifact_id
                    """,
                    (owner_user_id, run_id, reply_id),
                ).fetchall()
                published = tuple(self._published_from_row(row) for row in rows)
                connection.commit()
            except Exception as error:
                connection.rollback()
                compensation_failed = False
                for source, destination in reversed(moved):
                    try:
                        destination.replace(source)
                    except OSError:
                        compensation_failed = True
                if isinstance(error, sqlite3.IntegrityError) and not compensation_failed:
                    raise
                raise ArtifactStorageError("artifact_unavailable") from None
        return published

    def get_published(
        self, artifact_id: str, owner_user_id: str
    ) -> PublishedReportArtifact:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT * FROM report_artifacts
                WHERE artifact_id = ? AND owner_user_id = ? AND state = 'PUBLISHED'
                """,
                (artifact_id, owner_user_id),
            ).fetchone()
        if row is None:
            raise ArtifactNotFound
        return self._published_from_row(row)

    def read_verified_published(
        self, artifact_id: str, owner_user_id: str
    ) -> tuple[PublishedReportArtifact, bytes]:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT * FROM report_artifacts
                WHERE artifact_id = ? AND owner_user_id = ? AND state = 'PUBLISHED'
                """,
                (artifact_id, owner_user_id),
            ).fetchone()
        if row is None:
            raise ArtifactNotFound
        final_path = self._contained(
            self.artifact_dir / f"{row['artifact_id']}.xlsx"
        )
        try:
            content = final_path.read_bytes()
        except OSError:
            raise ArtifactStorageError("artifact_unavailable") from None
        if hashlib.sha256(content).hexdigest() != row["file_sha256"]:
            raise ArtifactStorageError("artifact_hash_mismatch")
        return self._artifact_from_row(row, final_path), content

    def abort_run(self, owner_user_id: str, run_id: str) -> None:
        owner_user_id = _required(owner_user_id, "owner_user_id")
        run_id = _required(run_id, "run_id")
        staged: list[tuple[Path, Path]] = []
        cleanup: list[Path] = []
        with closing(self._connect()) as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                rows = connection.execute(
                    """
                    SELECT * FROM report_artifacts
                    WHERE owner_user_id = ? AND run_id = ?
                    ORDER BY artifact_id
                    """,
                    (owner_user_id, run_id),
                ).fetchall()
                for row in rows:
                    self._reconcile_terminal_row(row)
                for row in rows:
                    if row["state"] != "PENDING":
                        continue
                    source = self._pending_source(row)
                    _pending_path, _final_path, aborting = self._paths(
                        row["artifact_id"]
                    )
                    if source != aborting:
                        source.replace(aborting)
                        staged.append((source, aborting))
                    cleanup.append(aborting)
                connection.execute(
                    """
                    UPDATE report_artifacts SET state = 'ABORTED'
                    WHERE owner_user_id = ? AND run_id = ? AND state = 'PENDING'
                    """,
                    (owner_user_id, run_id),
                )
                connection.commit()
            except Exception:
                connection.rollback()
                for source, aborting in reversed(staged):
                    try:
                        aborting.replace(source)
                    except OSError:
                        pass
                raise ArtifactStorageError("artifact_unavailable") from None
        for aborting in cleanup:
            try:
                aborting.unlink(missing_ok=True)
            except OSError:
                raise ArtifactStorageError("artifact_unavailable") from None

    def get_state(self, artifact_id: str) -> str:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT state FROM report_artifacts WHERE artifact_id = ?",
                (artifact_id,),
            ).fetchone()
        if row is None:
            raise ArtifactNotFound
        return str(row["state"])

    def is_publishable_pending_run(
        self, *, artifact_id: str, owner_user_id: str, run_id: str,
        report_type: str, period: ReportPeriod,
    ) -> bool:
        """Verify the run has exactly one intact, identity-matching PENDING file."""
        try:
            with closing(self._connect()) as connection:
                rows = connection.execute(
                    "SELECT * FROM report_artifacts "
                    "WHERE owner_user_id = ? AND run_id = ? ORDER BY artifact_id",
                    (owner_user_id, run_id),
                ).fetchall()
            if len(rows) != 1:
                return False
            row = rows[0]
            pending_path = self._paths(str(row["artifact_id"]))[0]
            return (
                row["artifact_id"] == artifact_id
                and row["state"] == "PENDING"
                and row["report_type"] == report_type
                and row["period_start"] == period.start_year
                and row["period_end"] == period.end_year
                and pending_path.is_file()
                and _sha256(pending_path) == row["file_sha256"]
            )
        except (OSError, sqlite3.Error, ArtifactStorageError):
            return False


def get_published_artifact(
    artifact_id: str,
    owner_user_id: str,
    db_path: Path | None = None,
) -> PublishedReportArtifact:
    try:
        path = Path(DEFAULT_DB_PATH if db_path is None else db_path)
        artifact_dir = (
            DEFAULT_ARTIFACT_DIR
            if path.resolve() == DEFAULT_DB_PATH.resolve()
            else path.parent / "report_artifacts"
        )
        return ArtifactStorage(artifact_dir=artifact_dir, db_path=path).get_published(
            artifact_id, owner_user_id
        )
    except ArtifactNotFound:
        raise
    except (OSError, sqlite3.Error, ArtifactStorageError):
        raise ArtifactStorageError("artifact_unavailable") from None


def read_verified_published_artifact(
    artifact_id: str,
    owner_user_id: str,
    db_path: Path | None = None,
) -> tuple[PublishedReportArtifact, bytes]:
    try:
        path = Path(DEFAULT_DB_PATH if db_path is None else db_path)
        artifact_dir = (
            DEFAULT_ARTIFACT_DIR
            if path.resolve() == DEFAULT_DB_PATH.resolve()
            else path.parent / "report_artifacts"
        )
        return ArtifactStorage(
            artifact_dir=artifact_dir,
            db_path=path,
        ).read_verified_published(artifact_id, owner_user_id)
    except ArtifactNotFound:
        raise
    except (OSError, sqlite3.Error, ArtifactStorageError):
        raise ArtifactStorageError("artifact_unavailable") from None
