from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

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
        artifact_dir: Path = DEFAULT_ARTIFACT_DIR,
        db_path: Path = DEFAULT_DB_PATH,
    ) -> None:
        self.artifact_dir = Path(artifact_dir).resolve()
        self.db_path = Path(db_path)
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
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
                """
            )
            connection.commit()

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
                    connection.commit()
                    return tuple(self._published_from_row(row) for row in existing)
                pending = [row for row in run_rows if row["state"] == "PENDING"]
                for row in pending:
                    source = self._pending_source(row)
                    _pending_path, destination, _aborting_path = self._paths(
                        row["artifact_id"]
                    )
                    if source != destination:
                        source.replace(destination)
                        moved.append((source, destination))
                    connection.execute(
                        """
                        UPDATE report_artifacts
                        SET reply_id = ?, state = 'PUBLISHED', published_at = ?
                        WHERE artifact_id = ? AND state = 'PENDING'
                        """,
                        (reply_id, datetime.now(UTC).isoformat(), row["artifact_id"]),
                    )
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
            rows = connection.execute(
                """
                SELECT * FROM report_artifacts
                WHERE owner_user_id = ? AND run_id = ? AND reply_id = ?
                  AND state = 'PUBLISHED'
                ORDER BY artifact_id
                """,
                (owner_user_id, run_id, reply_id),
            ).fetchall()
        return tuple(self._published_from_row(row) for row in rows)

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


def get_published_artifact(
    artifact_id: str,
    owner_user_id: str,
    db_path: Path = DEFAULT_DB_PATH,
) -> PublishedReportArtifact:
    try:
        path = Path(db_path)
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
    db_path: Path = DEFAULT_DB_PATH,
) -> tuple[PublishedReportArtifact, bytes]:
    try:
        path = Path(db_path)
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
