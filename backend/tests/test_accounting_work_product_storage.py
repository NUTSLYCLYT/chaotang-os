from __future__ import annotations

import hashlib
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import (
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
)
from app.work_products import (
    ArtifactGateReceipt,
    ArtifactManifestItem,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
)


def _storage(tmp_path: Path) -> ArtifactStorage:
    return ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )


def _published_artifact(storage: ArtifactStorage, *, owner: str = "owner-a") -> str:
    content = b"synthetic workbook"
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    pending = storage.create_pending(
        owner_user_id=owner,
        run_id="artifact-run",
        report_type="management",
        display_name="management.xlsx",
        period=ReportPeriod(2024, 2024),
        source_hashes=("a" * 64,),
        file_sha256=hashlib.sha256(content).hexdigest(),
        pending_path=incoming,
    )
    storage.publish_run(owner, "artifact-run", "reply-a")
    return pending.artifact_id


def _ready_envelope(
    *,
    owner: str = "owner-a",
    work_product_id: str = "work-product-a",
    version: int = 1,
    work_status: WorkProductStatus = WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
) -> WorkProductEnvelope:
    return WorkProductEnvelope(
        work_product_id=work_product_id,
        version=version,
        owner_user_id=owner,
        run_id="work-run-a",
        reply_id="reply-a",
        capability_id="accounting-report",
        work_status=work_status,
        confirmation_status=ConfirmationStatus.PENDING,
        artifact_state="PUBLISHED",
        decision="Review the management report.",
        facts=({"fact_id": "fact-a", "amount": "10.00"},),
        assumptions=("The ledger is complete.",),
        recommendations=("Confirm the reconciled workbook.",),
        evidence_used=("source-a",),
        missing_evidence=(),
        conflicts=(),
        risk_register=("Human confirmation remains pending.",),
        artifact_manifest=(
            ArtifactManifestItem(
                kind="management_report_xlsx",
                ref="reports/management.xlsx",
                content_digest="a" * 64,
                traceable=True,
            ),
        ),
        artifact_gate=ArtifactGateReceipt(
            status="PASSED",
            reason_codes=(),
            missing_kinds=(),
            unexpected_kinds=(),
        ),
        content_digest="b" * 64,
        created_at=datetime(2026, 8, 5, tzinfo=UTC),
    )


def _seeded_work_product(
    tmp_path: Path,
) -> tuple[ArtifactStorage, str, WorkProductEnvelope]:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a", artifact_id, _ready_envelope()
    )
    return storage, artifact_id, payload


def test_mingshuo_pending_artifact_and_work_product_replay_are_exact_and_unpublished(
    tmp_path: Path,
) -> None:
    storage = _storage(tmp_path)
    content = b"synthetic mingshuo workbook"
    digest = hashlib.sha256(content).hexdigest()
    artifact_id = "a" * 32

    def incoming() -> Path:
        path = storage.artifact_dir / f".{uuid4().hex}.xlsx"
        path.write_bytes(content)
        return path

    arguments = {
        "artifact_id": artifact_id,
        "owner_user_id": "owner-a",
        "run_id": "b" * 32,
        "report_type": "MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1",
        "display_name": "mingshuo-solution-quotation-draft.xlsx",
        "period": ReportPeriod(2026, 2026),
        "source_hashes": ("c" * 64,),
        "file_sha256": digest,
    }
    created, created_now = storage.create_or_verify_pending(
        **arguments, pending_path=incoming()
    )
    replayed, replayed_now = storage.create_or_verify_pending(
        **arguments, pending_path=incoming()
    )
    assert created.artifact_id == replayed.artifact_id == artifact_id
    assert (created_now, replayed_now) == (True, False)

    envelope = _ready_envelope(
        work_product_id="d" * 32,
    ).model_copy(
        update={
            "run_id": "b" * 32,
            "reply_id": None,
            "capability_id": "mingshuo.first-delivery.work-product.v1",
            "artifact_state": "PENDING",
        }
    )
    first_product, first_created = storage.create_or_verify_work_product(
        "owner-a", artifact_id, envelope
    )
    second_product, second_created = storage.create_or_verify_work_product(
        "owner-a", artifact_id, envelope
    )
    assert first_product == second_product == envelope
    assert (first_created, second_created) == (True, False)

    with pytest.raises(ArtifactStorageError, match="artifact_unavailable"):
        storage.publish_run("owner-a", "b" * 32, "reply-a")
    assert created.file_path.is_file()
    assert storage.get_work_product_for_artifact("owner-a", artifact_id).artifact_state.value == (
        "PENDING"
    )


def test_verify_pending_identity_is_read_only_and_binds_the_stored_file(
    tmp_path: Path,
) -> None:
    storage = _storage(tmp_path)
    content = b"synthetic immutable mingshuo workbook"
    digest = hashlib.sha256(content).hexdigest()
    artifact_id = "a" * 32
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    arguments = {
        "artifact_id": artifact_id,
        "owner_user_id": "owner-a",
        "run_id": "b" * 32,
        "report_type": "MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1",
        "display_name": "mingshuo-solution-quotation-draft.xlsx",
        "period": ReportPeriod(2026, 2026),
        "source_hashes": ("c" * 64,),
        "file_sha256": digest,
    }
    created, _ = storage.create_or_verify_pending(**arguments, pending_path=incoming)
    before = created.file_path.stat()

    verified = storage.verify_pending_identity(**arguments)

    after = created.file_path.stat()
    assert verified == created
    assert (after.st_size, after.st_mtime_ns) == (before.st_size, before.st_mtime_ns)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("owner_user_id", "owner-b"),
        ("run_id", "different-run"),
        ("report_type", "DIFFERENT_REPORT"),
        ("display_name", "different.xlsx"),
        ("period", ReportPeriod(2025, 2026)),
        ("source_hashes", ("d" * 64,)),
        ("file_sha256", "e" * 64),
    ],
)
def test_verify_pending_identity_fails_closed_on_identity_drift(
    tmp_path: Path, field: str, value: object
) -> None:
    storage = _storage(tmp_path)
    content = b"synthetic immutable mingshuo workbook"
    digest = hashlib.sha256(content).hexdigest()
    artifact_id = "a" * 32
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    arguments: dict[str, object] = {
        "artifact_id": artifact_id,
        "owner_user_id": "owner-a",
        "run_id": "b" * 32,
        "report_type": "MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1",
        "display_name": "mingshuo-solution-quotation-draft.xlsx",
        "period": ReportPeriod(2026, 2026),
        "source_hashes": ("c" * 64,),
        "file_sha256": digest,
    }
    storage.create_or_verify_pending(**arguments, pending_path=incoming)
    arguments[field] = value

    with pytest.raises(ArtifactStorageError, match="^artifact_unavailable$"):
        storage.verify_pending_identity(**arguments)


@pytest.mark.parametrize("tamper", ["database_sha", "file_bytes", "missing_file"])
def test_verify_pending_identity_fails_closed_on_durable_artifact_tampering(
    tmp_path: Path, tamper: str
) -> None:
    storage = _storage(tmp_path)
    content = b"synthetic immutable mingshuo workbook"
    digest = hashlib.sha256(content).hexdigest()
    artifact_id = "a" * 32
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    arguments = {
        "artifact_id": artifact_id,
        "owner_user_id": "owner-a",
        "run_id": "b" * 32,
        "report_type": "MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1",
        "display_name": "mingshuo-solution-quotation-draft.xlsx",
        "period": ReportPeriod(2026, 2026),
        "source_hashes": ("c" * 64,),
        "file_sha256": digest,
    }
    created, _ = storage.create_or_verify_pending(**arguments, pending_path=incoming)
    if tamper == "database_sha":
        with sqlite3.connect(storage.db_path) as connection:
            connection.execute(
                "UPDATE report_artifacts SET file_sha256=? WHERE artifact_id=?",
                ("e" * 64, artifact_id),
            )
    elif tamper == "file_bytes":
        created.file_path.write_bytes(b"tampered")
    else:
        created.file_path.unlink()

    with pytest.raises(ArtifactStorageError, match="^artifact_unavailable$"):
        storage.verify_pending_identity(**arguments)


@pytest.mark.parametrize(
    ("assignment", "value"),
    [
        ("owner_user_id = ?", "attacker"),
        ("run_id = ?", "different-run"),
        ("capability_id = ?", "different-capability"),
        ("version = ?", 2),
        ("payload_json = ?", "{}"),
        ("created_at = ?", "2030-01-01T00:00:00+00:00"),
    ],
)
def test_database_rejects_direct_work_product_identity_and_payload_tampering(
    tmp_path: Path, assignment: str, value: object
) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                f"UPDATE work_products SET {assignment} WHERE work_product_id = ?",
                (value, payload.work_product_id),
            )


def test_database_rejects_state_change_without_matching_receipt_and_reversal(
    tmp_path: Path,
) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                UPDATE work_products SET confirmation_status = 'CONFIRMED'
                WHERE work_product_id = ?
                """,
                (payload.work_product_id,),
            )
    storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        "CONFIRMED",
        "user:owner-a",
        "Amounts, sources, and reconciliations were reviewed.",
    )
    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                UPDATE work_products SET confirmation_status = 'PENDING'
                WHERE work_product_id = ?
                """,
                (payload.work_product_id,),
            )


def test_database_rejects_work_product_and_artifact_binding_mutation(
    tmp_path: Path,
) -> None:
    storage, artifact_id, payload = _seeded_work_product(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "DELETE FROM work_products WHERE work_product_id = ?",
                (payload.work_product_id,),
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                UPDATE work_product_artifacts SET artifact_id = ?
                WHERE work_product_id = ?
                """,
                ("different-artifact", payload.work_product_id),
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "DELETE FROM work_product_artifacts WHERE work_product_id = ?",
                (payload.work_product_id,),
            )
    assert storage.get_state(artifact_id) == "PUBLISHED"


def test_database_binds_receipt_version_to_parent_work_product(tmp_path: Path) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)
    _storage(tmp_path)
    _storage(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO confirmation_receipts (
                    work_product_id, version, sequence, decision, actor_ref,
                    structured_reason, created_at
                ) VALUES (?, ?, 1, 'ESCALATED', 'user:owner-a', 'wrong version', ?)
                """,
                (
                    payload.work_product_id,
                    payload.version + 1,
                    "2026-08-05T00:00:00+00:00",
                ),
            )
        count = connection.execute(
            "SELECT COUNT(*) FROM confirmation_receipts"
        ).fetchone()[0]
    assert count == 0


@pytest.mark.parametrize(
    ("decision", "expected_work_status"),
    [
        ("CONFIRMED", WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION),
        ("ESCALATED", WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION),
        ("REVISION_REQUIRED", WorkProductStatus.REVISION_REQUIRED),
    ],
)
def test_standalone_receipt_insert_atomically_updates_parent_state(
    tmp_path: Path, decision: str, expected_work_status: WorkProductStatus
) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        connection.execute(
            """
            INSERT INTO confirmation_receipts (
                work_product_id, version, sequence, decision, actor_ref,
                structured_reason, created_at
            ) VALUES (?, ?, 1, ?, 'user:owner-a', 'direct SQL decision', ?)
            """,
            (
                payload.work_product_id,
                payload.version,
                decision,
                "2026-08-05T00:00:00+00:00",
            ),
        )

    stored = storage.get_work_product("owner-a", payload.work_product_id)
    assert stored.confirmation_status is ConfirmationStatus(decision)
    assert stored.work_status is expected_work_status
    assert len(
        storage.list_confirmation_receipts("owner-a", payload.work_product_id)
    ) == 1


@pytest.mark.parametrize(
    "work_status",
    [
        WorkProductStatus.NEEDS_DATA,
        WorkProductStatus.NEEDS_REVIEW,
        WorkProductStatus.BLOCKED,
        WorkProductStatus.REVISION_REQUIRED,
    ],
)
@pytest.mark.parametrize(
    "decision",
    ["CONFIRMED", "REVISION_REQUIRED", "ESCALATED"],
)
def test_database_rejects_confirmation_receipt_for_non_ready_parent(
    tmp_path: Path,
    work_status: WorkProductStatus,
    decision: str,
) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a",
        artifact_id,
        _ready_envelope(work_status=work_status),
    )

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO confirmation_receipts (
                    work_product_id, version, sequence, decision, actor_ref,
                    structured_reason, created_at
                ) VALUES (?, ?, 1, ?, 'user:owner-a', 'non-ready decision', ?)
                """,
                (
                    payload.work_product_id,
                    payload.version,
                    decision,
                    "2026-08-05T00:00:00+00:00",
                ),
            )

    stored = storage.get_work_product("owner-a", payload.work_product_id)
    assert stored.work_status is work_status
    assert stored.confirmation_status is ConfirmationStatus.PENDING
    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == ()


def test_database_rejects_second_receipt_after_standalone_insert(tmp_path: Path) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)
    with sqlite3.connect(storage.db_path) as connection:
        connection.execute(
            """
            INSERT INTO confirmation_receipts (
                work_product_id, version, sequence, decision, actor_ref,
                structured_reason, created_at
            ) VALUES (?, ?, 1, 'CONFIRMED', 'user:owner-a', 'direct confirm', ?)
            """,
            (payload.work_product_id, payload.version, "2026-08-05T00:00:00+00:00"),
        )
    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO confirmation_receipts (
                    work_product_id, version, sequence, decision, actor_ref,
                    structured_reason, created_at
                ) VALUES (?, ?, 2, 'ESCALATED', 'user:owner-a', 'second receipt', ?)
                """,
                (
                    payload.work_product_id,
                    payload.version,
                    "2026-08-05T00:01:00+00:00",
                ),
            )

    with pytest.raises(ArtifactStorageError, match="confirmation_transition_invalid"):
        storage.append_confirmation(
            "owner-a",
            payload.work_product_id,
            "ESCALATED",
            "user:owner-a",
            "A second terminal decision must be rejected.",
        )
    assert len(
        storage.list_confirmation_receipts("owner-a", payload.work_product_id)
    ) == 1


def test_database_rejects_forged_receipt_decision(tmp_path: Path) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO confirmation_receipts (
                    work_product_id, version, sequence, decision, actor_ref,
                    structured_reason, created_at
                ) VALUES (?, ?, 1, 'PENDING', 'user:owner-a', 'forged decision', ?)
                """,
                (payload.work_product_id, payload.version, "2026-08-05T00:00:00+00:00"),
            )

    assert storage.get_work_product(
        "owner-a", payload.work_product_id
    ).confirmation_status is ConfirmationStatus.PENDING
    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == ()


@pytest.mark.parametrize(
    ("decision", "expected_work_status"),
    [
        ("CONFIRMED", WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION),
        ("ESCALATED", WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION),
        ("REVISION_REQUIRED", WorkProductStatus.REVISION_REQUIRED),
    ],
)
def test_append_confirmation_maps_all_legal_decisions_atomically(
    tmp_path: Path, decision: str, expected_work_status: WorkProductStatus
) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    receipt = storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        decision,
        "user:owner-a",
        "Legal decision regression.",
    )

    stored = storage.get_work_product("owner-a", payload.work_product_id)
    assert stored.confirmation_status is ConfirmationStatus(decision)
    assert stored.work_status is expected_work_status
    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == (receipt,)


def test_database_rejects_receipt_delete_and_preserves_receipt(tmp_path: Path) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)
    receipt = storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        "ESCALATED",
        "user:owner-a",
        "Specialist review is required.",
    )

    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "DELETE FROM confirmation_receipts WHERE work_product_id = ?",
                (payload.work_product_id,),
            )

    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == (receipt,)


def test_append_confirmation_is_owner_scoped(tmp_path: Path) -> None:
    storage, _artifact_id, payload = _seeded_work_product(tmp_path)

    with pytest.raises(ArtifactNotFound):
        storage.append_confirmation(
            "owner-b",
            payload.work_product_id,
            "CONFIRMED",
            "user:owner-b",
            "Cross-owner confirmation attempt.",
        )

    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == ()


def test_database_enforces_work_product_business_uniqueness(tmp_path: Path) -> None:
    storage, artifact_id, _payload = _seeded_work_product(tmp_path)

    with pytest.raises(ArtifactStorageError, match="artifact_unavailable"):
        storage.create_work_product(
            "owner-a",
            artifact_id,
            _ready_envelope(work_product_id="different-work-product-id"),
        )


@pytest.mark.parametrize(
    ("work_product_id", "artifact_id"),
    [
        ("missing-work-product", "1" * 32),
        ("work-product-a", "2" * 32),
    ],
)
def test_database_enforces_artifact_binding_foreign_keys(
    tmp_path: Path, work_product_id: str, artifact_id: str
) -> None:
    storage, existing_artifact_id, payload = _seeded_work_product(tmp_path)
    if work_product_id == "missing-work-product":
        artifact_id = existing_artifact_id
    else:
        work_product_id = payload.work_product_id

    with sqlite3.connect(storage.db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO work_product_artifacts (work_product_id, artifact_id)
                VALUES (?, ?)
                """,
                (work_product_id, artifact_id),
            )


def test_schema_migration_is_idempotent_and_legacy_artifact_stays_readable(
    tmp_path: Path,
) -> None:
    artifact_dir = tmp_path / "report_artifacts"
    artifact_dir.mkdir()
    db_path = tmp_path / "report_artifacts.sqlite3"
    artifact_id = "1" * 32
    content = b"legacy published workbook"
    (artifact_dir / f"{artifact_id}.xlsx").write_bytes(content)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE report_artifacts (
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
                state TEXT NOT NULL CHECK (
                    state IN ('PENDING', 'PUBLISHED', 'ABORTED')
                ),
                created_at TEXT NOT NULL,
                published_at TEXT
            );
            """
        )
        connection.execute(
            """
            INSERT INTO report_artifacts (
                artifact_id, owner_user_id, run_id, reply_id, report_type,
                display_name, period_start, period_end, source_hashes_json,
                file_sha256, state, created_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)
            """,
            (
                artifact_id,
                "owner-a",
                "legacy-run",
                "legacy-reply",
                "management",
                "legacy.xlsx",
                2024,
                2024,
                '["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]',
                hashlib.sha256(content).hexdigest(),
                "2026-08-01T00:00:00+00:00",
                "2026-08-01T00:01:00+00:00",
            ),
        )

    storage = ArtifactStorage(artifact_dir=artifact_dir, db_path=db_path)
    reopened = ArtifactStorage(artifact_dir=artifact_dir, db_path=db_path)

    assert storage.get_published(artifact_id, "owner-a").artifact_id == artifact_id
    assert reopened.read_verified_published(artifact_id, "owner-a")[1] == content
    with sqlite3.connect(db_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        counts = {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in (
                "work_products",
                "work_product_artifacts",
                "confirmation_receipts",
            )
        }
    assert {"work_products", "work_product_artifacts", "confirmation_receipts"} <= tables
    assert counts == {
        "work_products": 0,
        "work_product_artifacts": 0,
        "confirmation_receipts": 0,
    }


def test_create_and_get_work_product_are_owner_scoped(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = _ready_envelope()

    created = storage.create_work_product("owner-a", artifact_id, payload)

    assert created == payload
    assert storage.get_work_product("owner-a", payload.work_product_id) == payload
    with pytest.raises(ArtifactNotFound):
        storage.get_work_product("owner-b", payload.work_product_id)
    with pytest.raises(ArtifactNotFound):
        storage.create_work_product("owner-b", artifact_id, _ready_envelope(owner="owner-b"))


def test_confirmation_receipts_are_owner_scoped_append_only_and_sequenced(
    tmp_path: Path,
) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a", artifact_id, _ready_envelope()
    )

    receipt = storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        "ESCALATED",
        "user:owner-a",
        "A specialist must review the source classification.",
    )

    assert receipt.sequence == 1
    assert receipt.version == payload.version
    assert receipt.decision is ConfirmationStatus.ESCALATED
    assert storage.list_confirmation_receipts(
        "owner-a", payload.work_product_id
    ) == (receipt,)
    with pytest.raises(ArtifactNotFound):
        storage.list_confirmation_receipts("owner-b", payload.work_product_id)
    with sqlite3.connect(storage.db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE confirmation_receipts SET structured_reason = 'changed'"
            )


def test_confirmed_version_is_irreversible_and_artifact_state_is_unchanged(
    tmp_path: Path,
) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a", artifact_id, _ready_envelope()
    )

    storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        "CONFIRMED",
        "user:owner-a",
        "Amounts, sources, and reconciliations were reviewed.",
    )
    confirmed = storage.get_work_product("owner-a", payload.work_product_id)

    assert confirmed.confirmation_status is ConfirmationStatus.CONFIRMED
    assert confirmed.work_status is payload.work_status
    assert confirmed.artifact_state is payload.artifact_state
    assert storage.get_state(artifact_id) == "PUBLISHED"
    with pytest.raises(ArtifactStorageError, match="confirmation_transition_invalid"):
        storage.append_confirmation(
            "owner-a",
            payload.work_product_id,
            "REVISION_REQUIRED",
            "user:owner-a",
            "Attempt to reverse confirmation.",
        )


def test_revision_only_changes_work_and_confirmation_status(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a", artifact_id, _ready_envelope()
    )
    immutable_before = payload.model_dump(mode="json")

    storage.append_confirmation(
        "owner-a",
        payload.work_product_id,
        "REVISION_REQUIRED",
        "user:owner-a",
        "The source mapping needs correction.",
    )
    revised = storage.get_work_product("owner-a", payload.work_product_id)

    assert revised.work_status is WorkProductStatus.REVISION_REQUIRED
    assert revised.confirmation_status is ConfirmationStatus.REVISION_REQUIRED
    assert revised.artifact_state is payload.artifact_state
    assert revised.content_digest == payload.content_digest
    assert revised.artifact_manifest == payload.artifact_manifest
    assert revised.facts == payload.facts
    immutable_after = revised.model_dump(mode="json")
    for field in (
        "decision",
        "facts",
        "assumptions",
        "recommendations",
        "evidence_used",
        "missing_evidence",
        "conflicts",
        "risk_register",
        "artifact_manifest",
        "artifact_gate",
        "content_digest",
        "artifact_state",
    ):
        assert immutable_after[field] == immutable_before[field]


class _FailingReceiptConnection:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection
        self.closed = False

    def execute(self, sql: str, parameters=()):
        if "INSERT INTO confirmation_receipts" in " ".join(sql.split()):
            raise sqlite3.OperationalError("synthetic receipt failure")
        return self.connection.execute(sql, parameters)

    def commit(self) -> None:
        self.connection.commit()

    def rollback(self) -> None:
        self.connection.rollback()

    def close(self) -> None:
        self.closed = True
        self.connection.close()


def test_confirmation_transaction_failure_rolls_back_and_closes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = _storage(tmp_path)
    artifact_id = _published_artifact(storage)
    payload = storage.create_work_product(
        "owner-a", artifact_id, _ready_envelope()
    )
    real_connect = storage._connect
    failing = _FailingReceiptConnection(real_connect())
    monkeypatch.setattr(storage, "_connect", lambda: failing)

    with pytest.raises(ArtifactStorageError, match="artifact_unavailable"):
        storage.append_confirmation(
            "owner-a",
            payload.work_product_id,
            "CONFIRMED",
            "user:owner-a",
            "This write will fail.",
        )

    assert failing.closed
    monkeypatch.setattr(storage, "_connect", real_connect)
    assert storage.get_work_product("owner-a", payload.work_product_id) == payload
    assert storage.list_confirmation_receipts("owner-a", payload.work_product_id) == ()
