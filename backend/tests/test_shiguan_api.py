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

import pytest
from fastapi.testclient import TestClient

import app.api.shiguan as shiguan_api
from app.auth import configure_auth_db, create_session, create_user
from app.main import app
from app.shiguan.errors import ArchiveNotFoundError, ArchiveValidationError, ShiguanStorageError

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
    assert ShiguanStorageError in handlers
