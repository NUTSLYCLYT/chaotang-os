from __future__ import annotations

import hashlib
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.api.report_artifacts as report_artifacts_api
from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import ArtifactStorage
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.main import app


@pytest.fixture
def client(tmp_path: Path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    configure_report_artifact_db(tmp_path / "report_artifacts.sqlite3")
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        configure_report_artifact_db(None)
        configure_auth_db(None)


def _register(client: TestClient, username: str) -> tuple[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.test",
            "password": "six-or-more",
        },
    )
    assert response.status_code == 201
    return (
        response.json()["user"]["id"],
        response.json()["session_id"],
    )


def _published(tmp_path: Path, owner_user_id: str):
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    pending_path = tmp_path / "report_artifacts" / f".{uuid4().hex}.xlsx"
    payload = b"synthetic xlsx bytes"
    pending_path.write_bytes(payload)
    storage.create_pending(
        owner_user_id=owner_user_id,
        run_id="run-a",
        report_type="management",
        display_name="2024年度会计管理报告.xlsx",
        period=ReportPeriod(2024, 2024),
        source_hashes=("a" * 64,),
        file_sha256=hashlib.sha256(payload).hexdigest(),
        pending_path=pending_path,
    )
    return storage.publish_run(owner_user_id, "run-a", "reply-a")[0]


def test_download_requires_authentication_and_hides_unknown_or_cross_owner(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_session = _register(client, "owner")
    _other_id, other_session = _register(client, "other")
    artifact = _published(tmp_path, owner_id)

    assert (
        client.get(f"/api/v1/report-artifacts/{artifact.artifact_id}/download").status_code
        == 401
    )
    owner_headers = {"Authorization": f"Bearer {owner_session}"}
    assert (
        client.get(
            "/api/v1/report-artifacts/unknown/download", headers=owner_headers
        ).status_code
        == 404
    )
    cross_response = client.get(
        f"/api/v1/report-artifacts/{artifact.artifact_id}/download",
        headers={"Authorization": f"Bearer {other_session}"},
    )
    assert cross_response.status_code == 404
    assert "owner" not in cross_response.text.lower()
    assert str(tmp_path) not in cross_response.text


def test_owner_download_has_fixed_safe_headers(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_session = _register(client, "owner")
    artifact = _published(tmp_path, owner_id)

    response = client.get(
        f"/api/v1/report-artifacts/{artifact.artifact_id}/download",
        headers={"Authorization": f"Bearer {owner_session}"},
    )

    assert response.status_code == 200
    assert response.content == b"synthetic xlsx bytes"
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["content-disposition"].startswith(
        "attachment; filename*=UTF-8''"
    )
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "private, no-store"


def test_hash_failure_is_stable_sanitized_503(
    client: TestClient, tmp_path: Path
) -> None:
    owner_id, owner_session = _register(client, "owner")
    artifact = _published(tmp_path, owner_id)
    artifact.file_path.write_bytes(b"tampered")

    response = client.get(
        f"/api/v1/report-artifacts/{artifact.artifact_id}/download",
        headers={"Authorization": f"Bearer {owner_session}"},
    )

    assert response.status_code == 503
    assert response.json() == {"message": "artifact unavailable"}
    assert str(tmp_path) not in response.text
    assert "synthetic" not in response.text


def test_storage_database_failure_is_stable_sanitized_503(
    client: TestClient, tmp_path: Path
) -> None:
    _owner_id, owner_session = _register(client, "owner")
    (tmp_path / "report_artifacts.sqlite3").write_bytes(b"not a sqlite database")

    response = client.get(
        "/api/v1/report-artifacts/unknown/download",
        headers={"Authorization": f"Bearer {owner_session}"},
    )

    assert response.status_code == 503
    assert response.json() == {"message": "artifact unavailable"}
    assert str(tmp_path) not in response.text
    assert "sqlite" not in response.text.lower()


def test_download_streams_verified_bytes_even_if_path_is_replaced_after_read(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    owner_id, owner_session = _register(client, "owner")
    artifact = _published(tmp_path, owner_id)
    from app.accounting_reports.storage import read_verified_published_artifact

    def replace_after_verified_read(artifact_id, current_owner_id, db_path):
        metadata, content = read_verified_published_artifact(
            artifact_id, current_owner_id, db_path
        )
        replacement = artifact.file_path.with_suffix(".replacement")
        replacement.write_bytes(b"replacement bytes")
        replacement.replace(artifact.file_path)
        return metadata, content

    monkeypatch.setattr(
        report_artifacts_api,
        "read_verified_published_artifact",
        replace_after_verified_read,
    )

    response = client.get(
        f"/api/v1/report-artifacts/{artifact.artifact_id}/download",
        headers={"Authorization": f"Bearer {owner_session}"},
    )

    assert response.status_code == 200
    assert response.content == b"synthetic xlsx bytes"
