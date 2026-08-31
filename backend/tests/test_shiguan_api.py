"""Tests for the 史馆 (Shiguan) HTTP API: ``app/api/shiguan.py``.

Fully offline: every test relies on ``conftest.py``'s autouse
``isolate_shiguan_default_db_path`` fixture, which points
``app.shiguan.db._DEFAULT_DB_PATH`` at a fresh ``tmp_path`` file for every
test function, so nothing here ever touches the shared runtime database
file, the network, or a real model.

Covers all six endpoints' happy paths plus 404/422/503 error mapping,
``GET /archives`` filtering/deterministic-ordering, and ``GET /statistics``
returning ``null`` (not ``0``) when its denominator is zero. Old-case
recall's matching/ranking logic itself is covered end-to-end in
``test_shiguan_recall.py``.
"""

from __future__ import annotations

import hashlib
import sqlite3
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

import app.api.shiguan as shiguan_api
from app.auth import (
    configure_auth_db,
    create_session,
    create_user,
    get_session_user,
)
from app.main import app
from app.shiguan import db as shiguan_db
from app.shiguan import storage as shiguan_storage
from app.shiguan.errors import (
    ArchiveDecisionConflictError,
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanStorageError,
)
from app.shiguan.models import ArchiveEvidenceReferenceCreate

client = TestClient(app)

ARCHIVES_URL = "/api/v1/shiguan/archives"
STATISTICS_URL = "/api/v1/shiguan/statistics"
RECALL_URL = "/api/v1/shiguan/recall"


@pytest.fixture(autouse=True)
def _authenticate_client(isolate_shiguan_default_db_path, tmp_path):
    del isolate_shiguan_default_db_path
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("shiguan-user", "shiguan@example.com", "six-or-more")
    client.headers["Authorization"] = f"Bearer {create_session(user.id)}"
    yield
    client.headers.pop("Authorization", None)
    configure_auth_db(None)


@pytest.fixture
def outcome_client():
    """Use the production identity boundary: auth and Outcome share one DB."""

    configure_auth_db(shiguan_db._DEFAULT_DB_PATH)
    user = create_user(
        "shiguan-outcome-user", "shiguan-outcome@example.com", "six-or-more"
    )
    session_id = create_session(user.id)
    with TestClient(app) as isolated_client:
        isolated_client.headers["Authorization"] = f"Bearer {session_id}"
        yield isolated_client
    configure_auth_db(None)


def _memorial_payload(**overrides) -> dict:
    payload = {
        "type": "MEMORIAL",
        "title": "奏折标题",
        "content": "奏折正文",
        "matter_type": "赈灾",
        "department": "户部",
    }
    payload.update(overrides)
    return payload


def _reply_payload(**overrides) -> dict:
    payload = {
        "type": "REPLY",
        "title": "回奏标题",
        "content": "回奏内容",
        "matter_type": "赈灾",
        "department": "军机处",
        "source_kind": "DECREE",
        "source_text": "请赈济灾民",
        "participating_departments": ["吏部", "户部"],
        "reply_process": "军机处会审后丞相汇总",
        "reply_conclusion": "批准所奏",
        "reply_time": "2026-07-17T10:00:00+00:00",
        "respondent": "丞相",
    }
    payload.update(overrides)
    return payload


def _second_user_headers() -> dict[str, str]:
    user = create_user("shiguan-other", "shiguan-other@example.com", "six-or-more")
    return {"Authorization": f"Bearer {create_session(user.id)}"}


def _outcome_reference() -> ArchiveEvidenceReferenceCreate:
    return ArchiveEvidenceReferenceCreate.model_validate(
        {
            "pack_id": "pack-api-outcome",
            "investigation_id": "investigation-api-outcome",
            "snapshot": {
                "evidence_id": "evidence-api-outcome",
                "fact_key": "acceptance",
                "category": "ENTITY_REFERENCE",
                "data_scope": "INTERNAL_BUSINESS",
                "subject": "验收结果",
                "value": {"accepted": True},
                "as_of": "2026-08-31T08:00:00+00:00",
                "retrieved_at": "2026-08-31T08:00:00+00:00",
                "source_url": "https://example.test/private-outcome",
                "publisher": "朝堂 OS",
                "source_type": "SHIGUAN",
                "quality": "PRIMARY",
                "stance": "SUPPORTS",
                "excerpt": "敏感验收正文不得进入 Outcome 投影。",
                "content_hash": hashlib.sha256(b"api-outcome").hexdigest(),
                "confidence": 1.0,
            },
        }
    )


def _adopted_reply_for_current_session(outcome_client: TestClient) -> str:
    session_id = outcome_client.headers["Authorization"].removeprefix("Bearer ")
    principal = get_session_user(session_id)
    assert principal is not None
    reply_id = uuid.uuid4().hex
    shiguan_storage.create_reply_with_evidence(
        _reply_payload(),
        [_outcome_reference()],
        reply_id=reply_id,
        owner_user_id=principal.id,
    )
    shiguan_storage.set_archive_decision(
        reply_id, "ADOPTED", owner_user_id=principal.id
    )
    return reply_id


class TestCreateArchive:
    def test_create_returns_201_with_full_archive(self):
        response = client.post(ARCHIVES_URL, json=_memorial_payload())
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "MEMORIAL"
        assert body["title"] == "奏折标题"
        assert isinstance(body["id"], str) and body["id"]
        assert body["created_at"]
        assert body["review_status"] is None

    def test_create_reply_archive_returns_reply_fields(self):
        response = client.post(ARCHIVES_URL, json=_reply_payload())
        assert response.status_code == 201
        body = response.json()
        assert body["participating_departments"] == ["吏部", "户部"]
        assert body["reply_conclusion"] == "批准所奏"
        assert body["source_kind"] == "DECREE"

    def test_create_rejects_removed_archive_type(self):
        response = client.post(
            ARCHIVES_URL,
            json={**_memorial_payload(), "type": "DECISION"},
        )
        assert response.status_code == 422

    def test_create_rejects_empty_title_with_422(self):
        response = client.post(ARCHIVES_URL, json=_memorial_payload(title="   "))
        assert response.status_code == 422
        body = response.json()
        assert body["status"] == "error"
        assert body["reason"] == "validation_failed"
        assert body["message"]

    def test_create_rejects_client_supplied_id_with_422(self):
        payload = _memorial_payload()
        payload["id"] = "client-supplied-id"
        response = client.post(ARCHIVES_URL, json=payload)
        assert response.status_code == 422

    def test_create_rejects_unknown_related_archive_id_with_422(self):
        response = client.post(
            ARCHIVES_URL, json=_memorial_payload(related_archive_ids=["does-not-exist"])
        )
        assert response.status_code == 422

    def test_create_rejects_illegal_evidence_label_with_422(self):
        response = client.post(
            ARCHIVES_URL,
            json=_memorial_payload(
                evidence=[{"source": "some-source", "reality_label": "NOT_A_LABEL"}]
            ),
        )
        assert response.status_code == 422

    def test_create_returns_503_when_storage_unavailable(self, monkeypatch):
        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆写入失败，请稍后再试")

        monkeypatch.setattr(shiguan_api.storage, "create_archive", _boom)
        response = client.post(ARCHIVES_URL, json=_memorial_payload())
        assert response.status_code == 503
        body = response.json()
        assert body["status"] == "error"
        assert body["reason"] == "storage_unavailable"


class TestGetArchive:
    def test_other_user_cannot_get_or_review_an_archive(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        other_headers = _second_user_headers()

        get_response = client.get(f"{ARCHIVES_URL}/{created['id']}", headers=other_headers)
        review_response = client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={"status": "ACHIEVED", "reviewed_at": "2026-07-23T00:00:00+00:00"},
            headers=other_headers,
        )

        assert get_response.status_code == review_response.status_code == 404
        assert get_response.json()["reason"] == "archive_not_found"
        assert review_response.json()["reason"] == "archive_not_found"

    def test_get_returns_created_archive(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        response = client.get(f"{ARCHIVES_URL}/{created['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    def test_get_missing_archive_returns_404(self):
        response = client.get(f"{ARCHIVES_URL}/does-not-exist")
        assert response.status_code == 404
        body = response.json()
        assert body["status"] == "error"
        assert body["reason"] == "archive_not_found"

    def test_get_returns_503_when_storage_unavailable(self, monkeypatch):
        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆查询失败，请稍后再试")

        monkeypatch.setattr(shiguan_api.storage, "get_archive", _boom)
        response = client.get(f"{ARCHIVES_URL}/whatever-id")
        assert response.status_code == 503


class TestListArchives:
    def test_filters_by_type_matter_type_and_department(self):
        client.post(ARCHIVES_URL, json=_memorial_payload(matter_type="赈灾", department="户部"))
        client.post(ARCHIVES_URL, json=_memorial_payload(matter_type="边防", department="兵部"))
        client.post(
            ARCHIVES_URL,
            json=_reply_payload(
                matter_type="赈灾",
                department="军机处",
            ),
        )

        by_type = client.get(ARCHIVES_URL, params={"type": "REPLY"}).json()
        assert len(by_type) == 1
        assert by_type[0]["type"] == "REPLY"

        by_matter_type = client.get(ARCHIVES_URL, params={"matter_type": "赈灾"}).json()
        assert len(by_matter_type) == 2

        by_department = client.get(ARCHIVES_URL, params={"department": "兵部"}).json()
        assert len(by_department) == 1
        assert by_department[0]["department"] == "兵部"

    def test_ordering_is_deterministic_created_at_desc_id_asc(self):
        for _ in range(5):
            client.post(ARCHIVES_URL, json=_memorial_payload())

        archives = client.get(ARCHIVES_URL).json()
        assert len(archives) == 5
        for earlier, later in zip(archives, archives[1:], strict=False):
            if earlier["created_at"] == later["created_at"]:
                assert earlier["id"] <= later["id"]
            else:
                assert earlier["created_at"] >= later["created_at"]

    def test_limit_is_respected(self):
        for _ in range(3):
            client.post(ARCHIVES_URL, json=_memorial_payload())
        response = client.get(ARCHIVES_URL, params={"limit": 2})
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_empty_result_is_empty_list(self):
        response = client.get(ARCHIVES_URL, params={"matter_type": "不存在的事项"})
        assert response.status_code == 200
        assert response.json() == []

    def test_invalid_type_literal_returns_422(self):
        response = client.get(ARCHIVES_URL, params={"type": "NOT_A_TYPE"})
        assert response.status_code == 422

    def test_limit_above_bound_returns_422(self):
        response = client.get(ARCHIVES_URL, params={"limit": 100_000})
        assert response.status_code == 422

    def test_list_returns_503_when_storage_unavailable(self, monkeypatch):
        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆查询失败，请稍后再试")

        monkeypatch.setattr(shiguan_api.storage, "list_archives", _boom)
        response = client.get(ARCHIVES_URL)
        assert response.status_code == 503


class TestUpdateReviewStatus:
    def test_update_review_returns_200_with_status(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        response = client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={
                "status": "ACHIEVED",
                "reviewed_at": "2026-07-17T11:00:00+00:00",
                "note": "按期完成",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ACHIEVED"
        assert body["note"] == "按期完成"

        fetched = client.get(f"{ARCHIVES_URL}/{created['id']}").json()
        assert fetched["review_status"]["status"] == "ACHIEVED"

    def test_repeated_update_keeps_only_the_latest_status(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={"status": "OBSERVING", "reviewed_at": "2026-07-17T09:00:00+00:00"},
        )
        response = client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={"status": "PARTIAL", "reviewed_at": "2026-07-17T10:00:00+00:00"},
        )
        assert response.status_code == 200
        fetched = client.get(f"{ARCHIVES_URL}/{created['id']}").json()
        assert fetched["review_status"]["status"] == "PARTIAL"

    def test_update_missing_archive_returns_404(self):
        response = client.patch(
            f"{ARCHIVES_URL}/does-not-exist/review",
            json={"status": "ACHIEVED", "reviewed_at": "2026-07-17T11:00:00+00:00"},
        )
        assert response.status_code == 404

    def test_update_invalid_status_returns_422(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        response = client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={"status": "DONE", "reviewed_at": "2026-07-17T11:00:00+00:00"},
        )
        assert response.status_code == 422

    def test_update_missing_required_fields_returns_422(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        response = client.patch(f"{ARCHIVES_URL}/{created['id']}/review", json={})
        assert response.status_code == 422


class TestArchiveDecision:
    @pytest.mark.parametrize(
        ("payload_factory", "decision"),
        [
            (_memorial_payload, "APPROVED"),
            (_memorial_payload, "REJECTED"),
            (_reply_payload, "ADOPTED"),
            (_reply_payload, "RETURNED_FOR_RECONSIDERATION"),
        ],
    )
    def test_all_four_document_specific_decisions_return_200(
        self, payload_factory, decision
    ):
        created = client.post(ARCHIVES_URL, json=payload_factory()).json()
        response = client.put(
            f"{ARCHIVES_URL}/{created['id']}/decision", json={"decision": decision}
        )
        assert response.status_code == 200
        assert response.json()["decision"] == decision
        assert response.json()["decided_at"]

    @pytest.mark.parametrize(
        "body",
        [{}, {"decision": "PENDING"}, {"decision": "APPROVED", "owner_user_id": "attacker"}],
    )
    def test_decision_request_body_is_strict(self, body):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        response = client.put(f"{ARCHIVES_URL}/{created['id']}/decision", json=body)
        assert response.status_code == 422

    @pytest.mark.parametrize(
        ("payload_factory", "decision"),
        [
            (_memorial_payload, "ADOPTED"),
            (_memorial_payload, "RETURNED_FOR_RECONSIDERATION"),
            (_reply_payload, "APPROVED"),
            (_reply_payload, "REJECTED"),
        ],
    )
    def test_wrong_document_decision_returns_422(self, payload_factory, decision):
        created = client.post(ARCHIVES_URL, json=payload_factory()).json()
        response = client.put(
            f"{ARCHIVES_URL}/{created['id']}/decision", json={"decision": decision}
        )
        assert response.status_code == 422
        assert response.json()["reason"] == "validation_failed"

    def test_same_decision_is_idempotent_and_different_decision_conflicts(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        url = f"{ARCHIVES_URL}/{created['id']}/decision"
        first = client.put(url, json={"decision": "APPROVED"})
        retry = client.put(url, json={"decision": "APPROVED"})
        conflict = client.put(url, json={"decision": "REJECTED"})
        assert first.status_code == retry.status_code == 200
        assert retry.json() == first.json()
        assert conflict.status_code == 409
        assert conflict.json()["reason"] == "decision_conflict"
        assert client.get(f"{ARCHIVES_URL}/{created['id']}").json()[
            "decision_status"
        ] == first.json()

    def test_missing_and_cross_owner_are_both_404(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        other_headers = _second_user_headers()
        missing = client.put(
            f"{ARCHIVES_URL}/does-not-exist/decision", json={"decision": "APPROVED"}
        )
        cross_owner = client.put(
            f"{ARCHIVES_URL}/{created['id']}/decision",
            json={"decision": "APPROVED"},
            headers=other_headers,
        )
        assert missing.status_code == cross_owner.status_code == 404
        assert missing.json()["reason"] == cross_owner.json()["reason"] == "archive_not_found"

    def test_storage_failure_returns_sanitized_503(self, monkeypatch):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()

        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆决定写入失败，请稍后再试")

        monkeypatch.setattr(shiguan_api.storage, "set_archive_decision", _boom)
        response = client.put(
            f"{ARCHIVES_URL}/{created['id']}/decision", json={"decision": "APPROVED"}
        )
        assert response.status_code == 503
        assert response.json()["reason"] == "storage_unavailable"

    def test_list_and_get_include_decision_status(self):
        created = client.post(ARCHIVES_URL, json=_reply_payload()).json()
        undecided = client.get(f"{ARCHIVES_URL}/{created['id']}").json()
        assert undecided["decision_status"] is None
        decided = client.put(
            f"{ARCHIVES_URL}/{created['id']}/decision", json={"decision": "ADOPTED"}
        ).json()
        assert client.get(f"{ARCHIVES_URL}/{created['id']}").json()[
            "decision_status"
        ] == decided
        listed = {archive["id"]: archive for archive in client.get(ARCHIVES_URL).json()}
        assert listed[created["id"]]["decision_status"] == decided

    def test_malformed_v5_decision_schema_returns_sanitized_503_and_closes_connection(
        self, monkeypatch
    ):
        assert client.get(ARCHIVES_URL).status_code == 200
        path = shiguan_db._DEFAULT_DB_PATH
        connection = sqlite3.connect(path)
        try:
            connection.execute("DROP TABLE archive_decisions")
            connection.execute("CREATE TABLE archive_decisions (archive_id TEXT PRIMARY KEY)")
            connection.commit()
        finally:
            connection.close()

        opened_connections = []
        original_connect = sqlite3.connect

        class TrackingConnection(sqlite3.Connection):
            was_closed = False

            def close(self):
                self.was_closed = True
                return super().close()

        def tracking_connect(*args, **kwargs):
            kwargs["factory"] = TrackingConnection
            tracked = original_connect(*args, **kwargs)
            opened_connections.append(tracked)
            return tracked

        monkeypatch.setattr(shiguan_db.sqlite3, "connect", tracking_connect)
        response = client.get(ARCHIVES_URL)
        assert response.status_code == 503
        assert response.json() == {
            "status": "error",
            "reason": "storage_unavailable",
            "message": "史馆存储暂时不可用，请稍后再试",
        }
        assert opened_connections
        assert all(connection.was_closed for connection in opened_connections)
        lock_probe = original_connect(path, timeout=0)
        try:
            lock_probe.execute("BEGIN EXCLUSIVE")
            lock_probe.rollback()
        finally:
            lock_probe.close()


class TestAuthenticatedOutcomeApi:
    def test_outcome_api_derives_identity_and_rejects_client_authority_fields(
        self, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        url = f"{ARCHIVES_URL}/{archive_id}/outcomes"
        request = {
            "outcome": "ACHIEVED",
            "occurred_at": datetime.now(UTC).isoformat(),
            "idempotency_key": "api-outcome-key-001",
            "supersedes_event_id": None,
        }
        response = outcome_client.post(url, json=request)
        assert response.status_code == 201
        body = response.json()
        assert set(body) == {
            "event_id",
            "archive_id",
            "event_kind",
            "outcome",
            "source_type",
            "source_auth_level",
            "occurred_at",
            "recorded_at",
            "archive_digest",
            "decision_digest",
            "evidence_bundle_digest",
            "evidence_count",
            "supersedes_event_id",
            "event_digest",
        }
        assert body["source_type"] == "OWNER_ATTESTATION"
        assert body["source_auth_level"] == "AUTHENTICATED_OWNER_ASSERTION"
        assert "example.test" not in response.text
        assert "敏感验收" not in response.text

        rejected = outcome_client.post(
            url, json={**request, "tenant_id": "client-controlled"}
        )
        assert rejected.status_code == 422

    def test_outcome_api_missing_and_cross_scope_have_identical_404(
        self, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        other_headers = _second_user_headers()
        cross = outcome_client.get(
            f"{ARCHIVES_URL}/{archive_id}/outcomes", headers=other_headers
        )
        missing = outcome_client.get(
            f"{ARCHIVES_URL}/{uuid.uuid4().hex}/outcomes", headers=other_headers
        )
        assert cross.status_code == missing.status_code == 404
        assert cross.content == missing.content

    def test_outcome_api_cursor_limit_order_and_projection_whitelist(
        self, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        url = f"{ARCHIVES_URL}/{archive_id}/outcomes"
        for ordinal, outcome in enumerate(("OBSERVING", "PARTIAL"), start=1):
            response = outcome_client.post(
                url,
                json={
                    "outcome": outcome,
                    "occurred_at": datetime.now(UTC).isoformat(),
                    "idempotency_key": f"api-page-key-{ordinal:03d}",
                    "supersedes_event_id": None,
                },
            )
            assert response.status_code == 201
        first = outcome_client.get(url, params={"limit": 1})
        assert first.status_code == 200
        assert len(first.json()["items"]) == 1
        assert first.json()["next_cursor"]
        second = outcome_client.get(
            url,
            params={"limit": 1, "cursor": first.json()["next_cursor"]},
        )
        assert second.status_code == 200
        assert first.json()["items"][0]["event_id"] != second.json()["items"][0][
            "event_id"
        ]
        assert outcome_client.get(url, params={"limit": 101}).status_code == 422
        assert outcome_client.get(url, params={"cursor": "not+base64"}).status_code == 422

    def test_outcome_api_revoked_session_fails_before_storage(
        self, monkeypatch, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        session_id = outcome_client.headers["Authorization"].removeprefix("Bearer ")
        principal = get_session_user(session_id)
        assert principal is not None
        connection = shiguan_db.get_connection()
        try:
            connection.execute(
                "UPDATE tenant_memberships SET revoked_at=? WHERE id=?",
                (datetime.now(UTC).isoformat(), principal.membership_id),
            )
            connection.commit()
        finally:
            connection.close()
        called = False

        def _unexpected(*args, **kwargs):
            nonlocal called
            called = True
            raise AssertionError("storage must not be called")

        monkeypatch.setattr(shiguan_api.storage, "create_outcome", _unexpected)
        response = outcome_client.post(
            f"{ARCHIVES_URL}/{archive_id}/outcomes",
            json={
                "outcome": "ACHIEVED",
                "occurred_at": datetime.now(UTC).isoformat(),
                "idempotency_key": "api-revoked-key",
                "supersedes_event_id": None,
            },
        )
        assert response.status_code == 401
        assert called is False

    def test_outcome_api_session_revoked_after_dependency_fails_in_transaction(
        self, monkeypatch, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        session_id = outcome_client.headers["Authorization"].removeprefix("Bearer ")
        real_create_outcome = shiguan_api.storage.create_outcome

        def _revoke_after_dependency(*args, **kwargs):
            with sqlite3.connect(shiguan_db._DEFAULT_DB_PATH) as connection:
                connection.execute(
                    "UPDATE auth_sessions SET revoked_at=? WHERE id=?",
                    (datetime.now(UTC).isoformat(), session_id),
                )
            return real_create_outcome(*args, **kwargs)

        monkeypatch.setattr(
            shiguan_api.storage, "create_outcome", _revoke_after_dependency
        )
        response = outcome_client.post(
            f"{ARCHIVES_URL}/{archive_id}/outcomes",
            json={
                "outcome": "ACHIEVED",
                "occurred_at": datetime.now(UTC).isoformat(),
                "idempotency_key": "api-session-race-key",
                "supersedes_event_id": None,
            },
        )

        assert response.status_code == 404
        with sqlite3.connect(shiguan_db._DEFAULT_DB_PATH) as connection:
            assert connection.execute("SELECT COUNT(*) FROM outcome_events").fetchone() == (
                0,
            )

    def test_outcome_api_reads_recheck_session_in_transaction(
        self, monkeypatch, outcome_client
    ):
        archive_id = _adopted_reply_for_current_session(outcome_client)
        url = f"{ARCHIVES_URL}/{archive_id}/outcomes"
        created = outcome_client.post(
            url,
            json={
                "outcome": "ACHIEVED",
                "occurred_at": datetime.now(UTC).isoformat(),
                "idempotency_key": "api-session-reader-key",
                "supersedes_event_id": None,
            },
        )
        assert created.status_code == 201

        first_session_id = outcome_client.headers["Authorization"].removeprefix(
            "Bearer "
        )
        principal = get_session_user(first_session_id)
        assert principal is not None
        real_list_archive_outcomes = shiguan_api.storage.list_archive_outcomes

        def _revoke_archive_reader_after_dependency(*args, **kwargs):
            with sqlite3.connect(shiguan_db._DEFAULT_DB_PATH) as connection:
                connection.execute(
                    "UPDATE auth_sessions SET revoked_at=? WHERE id=?",
                    (datetime.now(UTC).isoformat(), first_session_id),
                )
            return real_list_archive_outcomes(*args, **kwargs)

        monkeypatch.setattr(
            shiguan_api.storage,
            "list_archive_outcomes",
            _revoke_archive_reader_after_dependency,
        )
        assert outcome_client.get(url).status_code == 404

        second_session_id = create_session(principal.id)
        outcome_client.headers["Authorization"] = f"Bearer {second_session_id}"
        real_list_outcomes = shiguan_api.storage.list_outcomes

        def _revoke_global_reader_after_dependency(*args, **kwargs):
            with sqlite3.connect(shiguan_db._DEFAULT_DB_PATH) as connection:
                connection.execute(
                    "UPDATE auth_sessions SET revoked_at=? WHERE id=?",
                    (datetime.now(UTC).isoformat(), second_session_id),
                )
            return real_list_outcomes(*args, **kwargs)

        monkeypatch.setattr(
            shiguan_api.storage, "list_outcomes", _revoke_global_reader_after_dependency
        )
        assert outcome_client.get("/api/v1/shiguan/outcomes").status_code == 404


class TestStatistics:
    def test_empty_database_returns_null_success_rate(self):
        response = client.get(STATISTICS_URL)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 0
        assert body["success_rate"] is None

    def test_only_observing_status_still_returns_null_success_rate(self):
        created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
        client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={"status": "OBSERVING", "reviewed_at": "2026-07-17T11:00:00+00:00"},
        )
        response = client.get(STATISTICS_URL)
        body = response.json()
        assert body["observing"] == 1
        assert body["success_rate"] is None

    def test_success_rate_reflects_reviewed_archives(self):
        for status in ["ACHIEVED", "NOT_ACHIEVED"]:
            created = client.post(ARCHIVES_URL, json=_memorial_payload()).json()
            client.patch(
                f"{ARCHIVES_URL}/{created['id']}/review",
                json={"status": status, "reviewed_at": "2026-07-17T11:00:00+00:00"},
            )
        response = client.get(STATISTICS_URL)
        body = response.json()
        assert body["success_rate"] == pytest.approx(0.5)

    def test_statistics_returns_503_when_storage_unavailable(self, monkeypatch):
        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆统计查询失败，请稍后再试")

        monkeypatch.setattr(shiguan_api.storage, "get_statistics", _boom)
        response = client.get(STATISTICS_URL)
        assert response.status_code == 503
        assert response.json()["reason"] == "storage_unavailable"


class TestRecallEndpointErrorMapping:
    """Recall's matching/ranking behavior itself lives in
    ``test_shiguan_recall.py``; this class only covers this endpoint's own
    status-code contract (200/422)."""

    def test_recall_by_matter_type_returns_200(self):
        client.post(ARCHIVES_URL, json=_memorial_payload(matter_type="赈灾"))
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_recall_requires_matter_type_or_department(self):
        response = client.post(RECALL_URL, json={})
        assert response.status_code == 422
        body = response.json()
        assert body["status"] == "error"
        assert body["reason"] == "validation_failed"

    def test_recall_returns_503_when_storage_unavailable(self, monkeypatch):
        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆查询失败，请稍后再试")

        monkeypatch.setattr(shiguan_api, "find_similar_archives", _boom)
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        assert response.status_code == 503


def test_exception_handlers_registered_for_every_shiguan_error_type():
    """Guard against a future refactor accidentally dropping one handler."""
    handlers = app.exception_handlers
    assert ArchiveNotFoundError in handlers
    assert ArchiveValidationError in handlers
    assert ArchiveDecisionConflictError in handlers
    assert ShiguanStorageError in handlers
