"""Authenticated Mingshuo project/fact-pack persistence contract tests."""

from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.api import mingshuo as mingshuo_api
from app.api.auth import register_auth_exception_handlers, require_current_user
from app.auth.models import AuthenticatedPrincipal
from app.mingshuo import service, storage


def _owner(*, user_id: str = "owner-a", tenant_id: str = "tenant-a") -> AuthenticatedPrincipal:
    return AuthenticatedPrincipal(
        id=user_id,
        username=user_id,
        email=f"{user_id}@example.test",
        tenant_id=tenant_id,
        membership_id=f"membership-{user_id}",
        tenant_role="OWNER",
    )


def _payload(*, key: str = "mingshuo-create-0001") -> dict[str, object]:
    evidence_digest = "sha256:" + hashlib.sha256(b"synthetic-evidence").hexdigest()
    return {
        "requestKey": key,
        "projectName": "Synthetic storage proposal",
        "requirementsText": "Create an evidence-bound non-production proposal draft.",
        "productLines": ["PACK_POWER"],
        "markets": ["DE"],
        "languages": ["en"],
        "skuCandidates": [
            {
                "id": "sku-a",
                "label": "Candidate A",
                "status": "EVIDENCE_BOUND",
                "parameterStatus": "EVIDENCE_BOUND",
            },
            {
                "id": "sku-b",
                "label": "Candidate B",
                "status": "RESERVED",
                "parameterStatus": "PARTIAL",
            },
            {
                "id": "sku-c",
                "label": "Candidate C",
                "status": "RESERVED",
                "parameterStatus": "PARTIAL",
            },
        ],
        "evidence": [
            {
                "id": "evidence-a",
                "sourceClass": "THIRD_PARTY_VERIFIED",
                "digest": evidence_digest,
                "validUntil": "2099-12-31",
                "adoptionStatus": "ADOPTED",
            }
        ],
        "facts": [
            {
                "id": "fact-a",
                "kind": "PARAMETER",
                "subject": "nominal voltage",
                "value": "51.2V synthetic",
                "evidenceRefs": ["evidence-a"],
            }
        ],
        "claims": [
            {
                "id": "claim-a",
                "text": "Synthetic claim for isolated acceptance only.",
                "evidenceRefs": ["evidence-a"],
            }
        ],
        "channels": [{"id": "WEBSITE"}],
    }


@pytest.fixture
def client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setattr(storage, "_DEFAULT_DB_PATH", tmp_path / "mingshuo.sqlite3")
    application = FastAPI()
    application.include_router(mingshuo_api.router)
    register_auth_exception_handlers(application)
    application.dependency_overrides[require_current_user] = _owner
    return TestClient(application)


def test_create_read_draft_and_exact_replay_are_owner_scoped(client: TestClient) -> None:
    created = client.post("/api/v1/mingshuo/projects", json=_payload())
    assert created.status_code == 201
    body = created.json()
    assert body["created"] is True
    project = body["project"]
    project_id = project["projectId"]
    assert len(project_id) == 32
    assert project["currentFactPack"]["decision"] == "PASS"
    assert project["currentFactPack"]["nonAuthorizing"] is True
    assert "tenant" not in json.dumps(body).lower()
    assert "owner" not in json.dumps(body).lower()

    replay = client.post("/api/v1/mingshuo/projects", json=_payload())
    assert replay.status_code == 200
    assert replay.json()["project"]["projectId"] == project_id

    read = client.get(f"/api/v1/mingshuo/projects/{project_id}")
    assert read.status_code == 200
    assert read.json()["project"] == project

    fact_pack = project["currentFactPack"]
    draft_payload = {
        "requestKey": "mingshuo-draft-0001",
        "factPackVersion": fact_pack["version"],
        "factPackDigest": fact_pack["factPackDigest"],
    }
    drafted = client.post(
        f"/api/v1/mingshuo/projects/{project_id}/draft-requests", json=draft_payload
    )
    assert drafted.status_code == 201
    assert drafted.json()["draftRequest"]["status"] == "NON_AUTHORIZING"
    assert "price" not in json.dumps(drafted.json()).lower()
    assert (
        client.post(
            f"/api/v1/mingshuo/projects/{project_id}/draft-requests", json=draft_payload
        ).status_code
        == 200
    )


def test_schema_v1_forward_migration_preserves_existing_fact_pack_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "mingshuo.sqlite3"
    monkeypatch.setattr(storage, "_DEFAULT_DB_PATH", database)
    application = FastAPI()
    application.include_router(mingshuo_api.router)
    register_auth_exception_handlers(application)
    application.dependency_overrides[require_current_user] = _owner
    client = TestClient(application)
    created = client.post("/api/v1/mingshuo/projects", json=_payload()).json()["project"]
    with sqlite3.connect(database) as connection:
        connection.execute("DROP TRIGGER mingshuo_delivery_intents_guard_update")
        connection.execute("DROP TRIGGER mingshuo_delivery_intents_no_delete")
        connection.execute("DROP TABLE mingshuo_delivery_intents")
        connection.execute("PRAGMA user_version = 1")
    storage.initialize_database()
    with sqlite3.connect(database) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM mingshuo_projects").fetchone()[0] == 1
        assert connection.execute(
            "SELECT COUNT(*) FROM mingshuo_fact_pack_revisions"
        ).fetchone()[0] == 1
    assert client.get(f"/api/v1/mingshuo/projects/{created['projectId']}").status_code == 200


def test_unauthenticated_access_is_generic_401() -> None:
    application = FastAPI()
    application.include_router(mingshuo_api.router)
    register_auth_exception_handlers(application)
    response = TestClient(application).post("/api/v1/mingshuo/projects", json=_payload())
    assert response.status_code == 401
    assert response.json() == {"message": "invalid credentials"}


def test_append_revision_is_immutable_and_old_version_cannot_draft(client: TestClient) -> None:
    first = client.post("/api/v1/mingshuo/projects", json=_payload()).json()["project"]
    project_id = first["projectId"]
    revision = _payload(key="mingshuo-revise-0001")
    revision.pop("projectName")
    revision["requirementsText"] = "Revised evidence-bound synthetic requirement."
    updated_response = client.post(
        f"/api/v1/mingshuo/projects/{project_id}/revisions", json=revision
    )
    assert updated_response.status_code == 201
    updated = updated_response.json()["project"]
    assert updated["currentRevision"] == 2
    assert len(updated["revisions"]) == 2
    assert updated["revisions"][0]["requirementsText"] == first["revisions"][0]["requirementsText"]

    old_pack = first["currentFactPack"]
    rejected = client.post(
        f"/api/v1/mingshuo/projects/{project_id}/draft-requests",
        json={
            "requestKey": "mingshuo-draft-old-0001",
            "factPackVersion": old_pack["version"],
            "factPackDigest": old_pack["factPackDigest"],
        },
    )
    assert rejected.status_code == 409


def test_cross_tenant_and_unknown_project_are_the_same_generic_404(
    client: TestClient,
) -> None:
    project_id = client.post("/api/v1/mingshuo/projects", json=_payload()).json()["project"][
        "projectId"
    ]
    app = client.app
    app.dependency_overrides[require_current_user] = lambda: _owner(
        user_id="owner-b", tenant_id="tenant-b"
    )
    cross = client.get(f"/api/v1/mingshuo/projects/{project_id}")
    unknown = client.get("/api/v1/mingshuo/projects/" + "f" * 32)
    malformed = client.get("/api/v1/mingshuo/projects/not-an-id")
    assert cross.status_code == unknown.status_code == malformed.status_code == 404
    assert cross.json() == unknown.json() == malformed.json()


@pytest.mark.parametrize(
    "raw",
    [
        b'{"requestKey":"mingshuo-create-0001","requestKey":"evil"}',
        b'{"requestKey":',
        b"\xff",
        (b"[" * 66) + b"0" + (b"]" * 66),
    ],
)
def test_invalid_json_duplicate_keys_utf8_and_depth_are_422(client: TestClient, raw: bytes) -> None:
    response = client.post(
        "/api/v1/mingshuo/projects",
        content=raw,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json() == {"status": "error", "reason": "validation"}


def test_complete_request_with_duplicate_nested_key_is_422(client: TestClient) -> None:
    raw = json.dumps(_payload(), separators=(",", ":")).replace(
        '"projectName":', '"projectName":"evil","projectName":', 1
    )
    response = client.post(
        "/api/v1/mingshuo/projects",
        content=raw,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422


def test_chunked_oversize_body_stops_before_buffering_the_remainder() -> None:
    first = b"x" * (service.fact_pack.MAX_INPUT_BYTES // 2)
    second = b"x" * (service.fact_pack.MAX_INPUT_BYTES - len(first) + 1)
    messages = [
        {"type": "http.request", "body": first, "more_body": True},
        {"type": "http.request", "body": second, "more_body": True},
        {"type": "http.request", "body": b"unread-tail", "more_body": False},
    ]
    receive_calls = 0

    async def receive() -> dict[str, object]:
        nonlocal receive_calls
        message = messages[receive_calls]
        receive_calls += 1
        return message

    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/mingshuo/projects",
            "raw_path": b"/api/v1/mingshuo/projects",
            "query_string": b"",
            "headers": [(b"content-type", b"application/json")],
            "client": ("127.0.0.1", 1),
            "server": ("testserver", 80),
        },
        receive,
    )

    with pytest.raises(ValueError, match="INPUT_BYTES_LIMIT"):
        asyncio.run(mingshuo_api._parse(request, mingshuo_api.CreateProjectRequest))

    assert receive_calls == 2
    assert "_body" not in request.__dict__


@pytest.mark.parametrize(
    "field,value",
    [
        ("tenantId", "attacker"),
        ("ownerUserId", "attacker"),
        ("projectId", "0" * 32),
        ("decision", "PASS"),
        ("approvalStatus", "APPROVED"),
        ("factPackDigest", "sha256:" + "0" * 64),
        ("productionPromotionAuthorized", True),
        ("commercial", {"priceAuthority": {"status": "APPROVED"}}),
    ],
)
def test_client_cannot_submit_authoritative_fields(
    client: TestClient, field: str, value: object
) -> None:
    payload = _payload()
    payload[field] = value
    assert client.post("/api/v1/mingshuo/projects", json=payload).status_code == 422


def test_price_or_quote_request_blocks_draft_without_external_side_effect(
    client: TestClient,
) -> None:
    payload = _payload()
    payload["facts"][0]["kind"] = "PRICE"  # type: ignore[index]
    created = client.post("/api/v1/mingshuo/projects", json=payload)
    assert created.status_code == 201
    project = created.json()["project"]
    assert project["currentFactPack"]["decision"] == "BLOCK"
    rejected = client.post(
        f"/api/v1/mingshuo/projects/{project['projectId']}/draft-requests",
        json={
            "requestKey": "mingshuo-draft-price-01",
            "factPackVersion": 1,
            "factPackDigest": project["currentFactPack"]["factPackDigest"],
        },
    )
    assert rejected.status_code == 409
    assert storage.count_rows("mingshuo_draft_requests") == 0

    quote = _payload(key="mingshuo-create-quote1")
    quote["quoteRequested"] = True
    quoted = client.post("/api/v1/mingshuo/projects", json=quote)
    assert quoted.status_code == 201
    assert quoted.json()["project"]["currentFactPack"]["decision"] == "BLOCK"


def test_key_conflict_is_stable_and_concurrent_create_has_one_identity(
    client: TestClient,
) -> None:
    assert client.post("/api/v1/mingshuo/projects", json=_payload()).status_code == 201
    conflict_payload = _payload()
    conflict_payload["requirementsText"] = "Different request content."
    assert client.post("/api/v1/mingshuo/projects", json=conflict_payload).status_code == 409

    concurrent_payload = _payload(key="mingshuo-create-race1")
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda _: client.post("/api/v1/mingshuo/projects", json=concurrent_payload),
                range(2),
            )
        )
    assert sorted(item.status_code for item in responses) == [200, 201]
    assert len({item.json()["project"]["projectId"] for item in responses}) == 1


def test_response_projection_failure_rolls_back_without_leaking_details(
    client: TestClient, monkeypatch
) -> None:
    def fail(_value: object) -> dict[str, object]:
        raise ValueError("secret sqlite path")

    monkeypatch.setattr(mingshuo_api, "_serialize_payload", fail)
    response = client.post("/api/v1/mingshuo/projects", json=_payload())
    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "unavailable"}
    assert storage.count_rows("mingshuo_projects") == 0


def test_tampered_canonical_pack_fails_closed_on_read(client: TestClient) -> None:
    project_id = client.post("/api/v1/mingshuo/projects", json=_payload()).json()["project"][
        "projectId"
    ]
    with sqlite3.connect(storage._DEFAULT_DB_PATH) as connection:
        connection.execute("DROP TRIGGER mingshuo_fact_pack_revisions_no_update")
        connection.execute(
            "UPDATE mingshuo_fact_pack_revisions SET canonical_bytes=? WHERE project_id=?",
            (b"{}", project_id),
        )
    response = client.get(f"/api/v1/mingshuo/projects/{project_id}")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "unavailable"}


def test_tampered_requirement_digest_fails_closed_on_read(client: TestClient) -> None:
    project_id = client.post("/api/v1/mingshuo/projects", json=_payload()).json()["project"][
        "projectId"
    ]
    with sqlite3.connect(storage._DEFAULT_DB_PATH) as connection:
        connection.execute("DROP TRIGGER mingshuo_requirement_revisions_no_update")
        connection.execute(
            "UPDATE mingshuo_requirement_revisions SET requirements_text=? WHERE project_id=?",
            ("tampered", project_id),
        )
    assert client.get(f"/api/v1/mingshuo/projects/{project_id}").status_code == 503


def test_current_clock_expiry_and_rollback_reject_draft_without_mutation(
    client: TestClient, monkeypatch
) -> None:
    payload = _payload()
    payload["evidence"][0]["validUntil"] = "2026-09-13"  # type: ignore[index]
    monkeypatch.setattr(service, "_utc_day", lambda: date(2026, 9, 13))
    project = client.post("/api/v1/mingshuo/projects", json=payload).json()["project"]
    pack = project["currentFactPack"]

    monkeypatch.setattr(service, "_utc_day", lambda: date(2026, 9, 14))
    expired = client.post(
        f"/api/v1/mingshuo/projects/{project['projectId']}/draft-requests",
        json={
            "requestKey": "mingshuo-draft-expired",
            "factPackVersion": pack["version"],
            "factPackDigest": pack["factPackDigest"],
        },
    )
    assert expired.status_code == 409
    assert storage.count_rows("mingshuo_draft_requests") == 0

    monkeypatch.setattr(service, "_utc_day", lambda: date(2026, 9, 12))
    rollback = client.post(
        f"/api/v1/mingshuo/projects/{project['projectId']}/draft-requests",
        json={
            "requestKey": "mingshuo-draft-rollback",
            "factPackVersion": pack["version"],
            "factPackDigest": pack["factPackDigest"],
        },
    )
    assert rollback.status_code == 409
    assert storage.count_rows("mingshuo_draft_requests") == 0


def test_schema_has_append_only_guards_and_exact_user_version(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage, "_DEFAULT_DB_PATH", tmp_path / "schema.sqlite3")
    storage.initialize_database()
    with sqlite3.connect(storage._DEFAULT_DB_PATH) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        names = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        }
    assert {
        "mingshuo_projects_no_delete",
        "mingshuo_project_identity_guard_update",
        "mingshuo_requirement_revisions_no_update",
        "mingshuo_requirement_revisions_no_delete",
        "mingshuo_fact_pack_revisions_no_update",
        "mingshuo_fact_pack_revisions_no_delete",
        "mingshuo_draft_requests_no_update",
        "mingshuo_draft_requests_no_delete",
        "mingshuo_idempotency_keys_no_update",
        "mingshuo_idempotency_keys_no_delete",
    } <= names
