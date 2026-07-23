"""HTTP-level tests for ``POST /api/v1/shiguan/recall`` (旧案召回).

``app.shiguan.recall`` has no dedicated unit-test file among this module's
allowed test paths (module 1 already owns ``test_shiguan_models.py`` /
``test_shiguan_storage.py`` / ``test_shiguan_validation.py``, and none of
them cover ``recall.py``), so this file exercises the full matching,
priority-ranking, deduplication and bounding behavior end-to-end through
the HTTP layer rather than duplicating anything already tested elsewhere.

Fully offline via ``conftest.py``'s autouse ``isolate_shiguan_default_db_path``
fixture (fresh ``tmp_path`` sqlite file per test).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import configure_auth_db, create_session, create_user
from app.main import app

client = TestClient(app)

ARCHIVES_URL = "/api/v1/shiguan/archives"
RECALL_URL = "/api/v1/shiguan/recall"


@pytest.fixture(autouse=True)
def _authenticate_client(isolate_shiguan_default_db_path, tmp_path):
    del isolate_shiguan_default_db_path
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("recall-user", "recall@example.com", "six-or-more")
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


def _decision_payload(**overrides) -> dict:
    payload = {
        "type": "DECISION",
        "title": "决策标题",
        "content": "决策内容",
        "matter_type": "赈灾",
        "department": "军机处",
        "participating_departments": ["吏部", "户部"],
        "decision_process": "军机处会审后丞相汇总",
        "decision_conclusion": "批准所奏",
        "decision_time": "2026-07-17T10:00:00+00:00",
        "responsible_owner": "丞相",
    }
    payload.update(overrides)
    return payload


def _create(payload: dict) -> dict:
    response = client.post(ARCHIVES_URL, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class TestRecallRequiresAtLeastOneDimension:
    def test_missing_both_dimensions_returns_422(self):
        response = client.post(RECALL_URL, json={})
        assert response.status_code == 422

    def test_blank_dimensions_returns_422(self):
        response = client.post(RECALL_URL, json={"matter_type": "   ", "department": ""})
        assert response.status_code == 422

    def test_matter_type_only_is_accepted(self):
        _create(_memorial_payload(matter_type="赈灾"))
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        assert response.status_code == 200

    def test_department_only_is_accepted(self):
        _create(_memorial_payload(department="户部"))
        response = client.post(RECALL_URL, json={"department": "户部"})
        assert response.status_code == 200


class TestRecallNoMatches:
    def test_no_matching_archives_returns_empty_list(self):
        _create(_memorial_payload(matter_type="赈灾", department="户部"))
        response = client.post(
            RECALL_URL, json={"matter_type": "不存在的事项", "department": "不存在的部门"}
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_empty_database_returns_empty_list(self):
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        assert response.status_code == 200
        assert response.json() == []


class TestRecallMatchPriorityAndDedup:
    def test_both_dimension_match_ranks_first_and_is_not_duplicated(self):
        both = _create(_memorial_payload(matter_type="赈灾", department="户部"))
        matter_only = _create(_memorial_payload(matter_type="赈灾", department="兵部"))
        department_only = _create(_memorial_payload(matter_type="边防", department="户部"))

        response = client.post(
            RECALL_URL, json={"matter_type": "赈灾", "department": "户部", "limit": 10}
        )
        assert response.status_code == 200
        matches = response.json()
        ids_in_order = [m["archive_id"] for m in matches]

        assert ids_in_order[0] == both["id"]
        assert matches[0]["match_reason"] == "事项类型+部门匹配"
        assert matter_only["id"] in ids_in_order
        assert department_only["id"] in ids_in_order
        # The higher-priority match must not reappear in a lower-priority group.
        assert ids_in_order.count(both["id"]) == 1
        assert len(ids_in_order) == len(set(ids_in_order))

    def test_matter_type_only_match_reason(self):
        created = _create(_memorial_payload(matter_type="赈灾", department="户部"))
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        match = next(m for m in response.json() if m["archive_id"] == created["id"])
        assert match["match_reason"] == "仅事项类型匹配"

    def test_department_only_match_reason(self):
        created = _create(_memorial_payload(matter_type="赈灾", department="户部"))
        response = client.post(RECALL_URL, json={"department": "户部"})
        match = next(m for m in response.json() if m["archive_id"] == created["id"])
        assert match["match_reason"] == "仅部门匹配"

    def test_matches_are_sorted_created_at_desc_within_a_priority_group(self):
        created = [
            _create(_memorial_payload(matter_type="赈灾", department="户部")) for _ in range(4)
        ]
        created_ids = {archive["id"] for archive in created}

        response = client.post(
            RECALL_URL, json={"matter_type": "赈灾", "department": "户部", "limit": 10}
        )
        matches = [m for m in response.json() if m["archive_id"] in created_ids]
        assert len(matches) == 4

        created_ats = [
            client.get(f"{ARCHIVES_URL}/{m['archive_id']}").json()["created_at"] for m in matches
        ]
        for earlier, later in zip(created_ats, created_ats[1:], strict=False):
            assert earlier >= later


class TestRecallBoundedResults:
    def test_limit_bounds_the_number_of_matches(self):
        for _ in range(5):
            _create(_memorial_payload(matter_type="赈灾", department="户部"))

        response = client.post(RECALL_URL, json={"matter_type": "赈灾", "limit": 2})
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_default_limit_is_ten_when_not_provided(self):
        for _ in range(12):
            _create(_memorial_payload(matter_type="赈灾"))

        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        assert response.status_code == 200
        assert len(response.json()) == 10


class TestRecallResultFields:
    def test_result_includes_reason_conclusion_review_status_and_lessons(self):
        created = _create(
            _memorial_payload(
                matter_type="赈灾",
                department="户部",
                evidence=[{"source": "实盘记录", "reality_label": "LIVE"}],
                lessons_learned="按流程复核证据来源",
                pitfalls="不要把宣传材料当作 LIVE 证据",
            )
        )
        client.patch(
            f"{ARCHIVES_URL}/{created['id']}/review",
            json={
                "status": "ACHIEVED",
                "reviewed_at": "2026-07-17T11:00:00+00:00",
                "note": "按期完成",
            },
        )

        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        match = response.json()[0]
        assert match["archive_id"] == created["id"]
        assert match["match_reason"] == "仅事项类型匹配"
        assert match["historical_conclusion"]
        assert match["evidence_labels"] == ["LIVE"]
        assert match["review_status"]["status"] == "ACHIEVED"
        assert match["lessons_learned"] == "按流程复核证据来源"
        assert match["pitfalls"] == "不要把宣传材料当作 LIVE 证据"

    def test_decision_archive_uses_decision_conclusion_as_historical_conclusion(self):
        decision = _create(_decision_payload(matter_type="赈灾", department="军机处"))

        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        match = next(m for m in response.json() if m["archive_id"] == decision["id"])
        assert match["historical_conclusion"] == "批准所奏"

    def test_archive_without_review_status_has_null_review_status(self):
        created = _create(_memorial_payload(matter_type="赈灾"))
        response = client.post(RECALL_URL, json={"matter_type": "赈灾"})
        match = next(m for m in response.json() if m["archive_id"] == created["id"])
        assert match["review_status"] is None
        assert match["lessons_learned"] is None
        assert match["pitfalls"] is None
