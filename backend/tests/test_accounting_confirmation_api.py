from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import ArtifactStorage
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.main import app
from app.shiguan import db as shiguan_db
from app.work_products import (
    ArtifactGateReceipt,
    ArtifactManifestItem,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
)


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    configure_auth_db(tmp_path / "auth.sqlite3")
    configure_report_artifact_db(tmp_path / "report_artifacts.sqlite3")
    monkeypatch.setattr(shiguan_db, "_DEFAULT_DB_PATH", tmp_path / "shiguan.sqlite3")
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        configure_report_artifact_db(None)
        configure_auth_db(None)


def _register(client: TestClient, username: str) -> tuple[str, dict[str, str]]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.test",
            "password": "six-or-more",
        },
    )
    assert response.status_code == 201
    return response.json()["user"]["id"], {
        "Authorization": f"Bearer {response.json()['session_id']}"
    }


def _seed_ready_product(
    tmp_path: Path,
    owner_user_id: str,
    *,
    work_status: WorkProductStatus = WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
) -> tuple[str, str]:
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    content = b"synthetic workbook"
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    pending = storage.create_pending(
        owner_user_id=owner_user_id,
        run_id="artifact-run",
        report_type="management",
        display_name="management.xlsx",
        period=ReportPeriod(2024, 2024),
        source_hashes=("a" * 64,),
        file_sha256=hashlib.sha256(content).hexdigest(),
        pending_path=incoming,
    )
    storage.publish_run(owner_user_id, "artifact-run", "reply-a")
    envelope = WorkProductEnvelope(
        work_product_id="work-product-a",
        version=1,
        owner_user_id=owner_user_id,
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
    storage.create_work_product(owner_user_id, pending.artifact_id, envelope)
    return pending.artifact_id, envelope.work_product_id


def _review_row_count() -> int:
    with shiguan_db.get_connection() as connection:
        return int(
            connection.execute("SELECT COUNT(*) FROM archive_review_status").fetchone()[0]
        )


def test_owner_gets_public_work_product_snapshot(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_headers = _register(client, "owner")
    artifact_id, work_product_id = _seed_ready_product(tmp_path, owner_id)

    response = client.get(
        f"/api/v1/report-artifacts/{artifact_id}/work-product",
        headers=owner_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["artifact_id"] == artifact_id
    assert body["work_product_id"] == work_product_id
    assert body["work_status"] == "READY_FOR_HUMAN_CONFIRMATION"
    assert body["confirmation_status"] == "PENDING"
    assert body["artifact_state"] == "PUBLISHED"
    assert body["confirmation_receipts"] == []
    assert "owner_user_id" not in body
    assert "file_path" not in body
    assert "review_status" not in body


def test_confirmation_is_owner_scoped_append_only_and_does_not_touch_shiguan(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_headers = _register(client, "owner")
    _other_id, other_headers = _register(client, "other")
    artifact_id, _work_product_id = _seed_ready_product(tmp_path, owner_id)

    assert client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=other_headers,
        json={"decision": "CONFIRMED", "structured_reason": "Cross-owner attempt."},
    ).status_code == 404
    before_reviews = _review_row_count()

    response = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json={
            "decision": "CONFIRMED",
            "structured_reason": "Period, sources, amounts, and reconciliation checked.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["work_status"] == "READY_FOR_HUMAN_CONFIRMATION"
    assert body["confirmation_status"] == "CONFIRMED"
    assert body["artifact_state"] == "PUBLISHED"
    assert body["confirmation_receipts"][0]["decision"] == "CONFIRMED"
    assert body["confirmation_receipts"][0]["actor_ref"] == f"user:{owner_id}"
    assert _review_row_count() == before_reviews

    reversal = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json={
            "decision": "REVISION_REQUIRED",
            "structured_reason": "Attempt to reverse a confirmed decision.",
        },
    )
    assert reversal.status_code == 409
    assert reversal.json() == {"message": "confirmation transition invalid"}


@pytest.mark.parametrize(
    ("decision", "expected_work_status"),
    [
        (
            ConfirmationStatus.CONFIRMED,
            WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
        ),
        (
            ConfirmationStatus.ESCALATED,
            WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
        ),
        (
            ConfirmationStatus.REVISION_REQUIRED,
            WorkProductStatus.REVISION_REQUIRED,
        ),
    ],
)
def test_ready_work_product_accepts_each_terminal_decision(
    client: TestClient,
    tmp_path: Path,
    decision: ConfirmationStatus,
    expected_work_status: WorkProductStatus,
) -> None:
    owner_id, owner_headers = _register(client, "owner")
    artifact_id, _work_product_id = _seed_ready_product(tmp_path, owner_id)

    response = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json={
            "decision": decision.value,
            "structured_reason": "The ready product received a terminal decision.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["work_status"] == expected_work_status.value
    assert body["confirmation_status"] == decision.value
    assert body["confirmation_receipts"][0]["decision"] == decision.value


def test_e20_revision_preserves_evidence_manifest_and_semantic_digest(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_headers = _register(client, "owner-e20")
    artifact_id, work_product_id = _seed_ready_product(tmp_path, owner_id)
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    before = storage.get_work_product(owner_id, work_product_id)

    response = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json={
            "decision": "REVISION_REQUIRED",
            "structured_reason": "Please correct the report while preserving evidence.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    after = storage.get_work_product(owner_id, work_product_id)
    receipts = storage.list_confirmation_receipts(owner_id, work_product_id)
    assert body["work_status"] == "REVISION_REQUIRED"
    assert body["confirmation_status"] == "REVISION_REQUIRED"
    assert len(receipts) == 1
    assert receipts[0].sequence == 1
    assert after.facts == before.facts
    assert after.evidence_used == before.evidence_used
    assert after.artifact_manifest == before.artifact_manifest
    assert after.content_digest == before.content_digest


@pytest.mark.parametrize(
    "payload",
    [
        {"decision": "PENDING", "structured_reason": "Not a decision."},
        {"decision": "CONFIRMED", "structured_reason": "   "},
        {
            "decision": "CONFIRMED",
            "structured_reason": "Forged owner.",
            "owner_user_id": "attacker",
        },
        {
            "decision": "CONFIRMED",
            "structured_reason": "Forged review.",
            "review_status": "ACHIEVED",
        },
        {
            "decision": "CONFIRMED",
            "structured_reason": "Forged state.",
            "artifact_state": "ABORTED",
        },
        {
            "decision": "CONFIRMED",
            "structured_reason": "Forged path.",
            "file_path": "C:/secret/report.xlsx",
        },
    ],
)
def test_confirmation_request_is_strict(
    client: TestClient, tmp_path: Path, payload: dict[str, str]
) -> None:
    owner_id, owner_headers = _register(client, f"owner-{uuid4().hex[:8]}")
    artifact_id, _work_product_id = _seed_ready_product(tmp_path, owner_id)

    response = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json=payload,
    )

    assert response.status_code == 422


def test_work_product_routes_require_auth_and_hide_unknown(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_headers = _register(client, "owner")
    artifact_id, _work_product_id = _seed_ready_product(tmp_path, owner_id)

    assert client.get(
        f"/api/v1/report-artifacts/{artifact_id}/work-product"
    ).status_code == 401
    assert client.get(
        "/api/v1/report-artifacts/unknown/work-product", headers=owner_headers
    ).status_code == 404
    assert client.post(
        "/api/v1/report-artifacts/unknown/confirmation",
        headers=owner_headers,
        json={"decision": "ESCALATED", "structured_reason": "Needs escalation."},
    ).status_code == 404


def test_work_product_storage_failure_is_sanitized(
    client: TestClient, tmp_path: Path
) -> None:
    _owner_id, owner_headers = _register(client, "owner")
    (tmp_path / "report_artifacts.sqlite3").write_bytes(b"not a sqlite database")

    response = client.get(
        "/api/v1/report-artifacts/unknown/work-product", headers=owner_headers
    )

    assert response.status_code == 503
    assert response.json() == {"message": "artifact unavailable"}
    assert str(tmp_path) not in response.text
    assert "sqlite" not in response.text.lower()


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
    [
        ConfirmationStatus.CONFIRMED,
        ConfirmationStatus.REVISION_REQUIRED,
        ConfirmationStatus.ESCALATED,
    ],
)
def test_non_ready_work_product_cannot_be_confirmed(
    client: TestClient,
    tmp_path: Path,
    work_status: WorkProductStatus,
    decision: ConfirmationStatus,
) -> None:
    owner_id, owner_headers = _register(client, "owner")
    artifact_id, work_product_id = _seed_ready_product(
        tmp_path, owner_id, work_status=work_status
    )

    response = client.post(
        f"/api/v1/report-artifacts/{artifact_id}/confirmation",
        headers=owner_headers,
        json={
            "decision": decision.value,
            "structured_reason": "A non-ready product must remain unconfirmed.",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"message": "confirmation transition invalid"}
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    stored = storage.get_work_product(owner_id, work_product_id)
    assert stored.work_status is work_status
    assert stored.confirmation_status is ConfirmationStatus.PENDING
    assert storage.list_confirmation_receipts(owner_id, work_product_id) == ()
