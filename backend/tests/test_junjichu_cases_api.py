"""Read-only HTTP contract for owner-scoped Grand Council cases."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.decrees as decrees_module
from app.agents.chancellor.graph import ChancellorGraphInvocationError
from app.agents.chancellor_draft.authority import ConsumedDraftAuthority
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.api.auth import CurrentUser
from app.auth import configure_auth_db, create_session, create_user
from app.junjichu_cases import storage
from app.junjichu_cases.models import JunjichuCaseOpenInput
from app.main import app
from app.shiguan.archive_decree import ArchiveDecreeResult

client = TestClient(app)
execution_app = FastAPI()
decrees_module.register_chancellor_exception_handlers(execution_app)


@execution_app.post(
    "/api/v1/decrees/chancellor",
    response_model=decrees_module.ChancellorDecreeResponse,
)
def _execute_decree_for_case_tests(
    payload: decrees_module.ChancellorDecreeRequest,
    current_user: CurrentUser,
):
    return decrees_module.execute_decree_now(payload, current_user)


execution_client = TestClient(execution_app)
CASES_URL = "/api/v1/junjichu/cases"


@pytest.fixture(autouse=True)
def _authenticated_case_api(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "_DEFAULT_DB_PATH", tmp_path / "junjichu_cases.sqlite3")
    configure_auth_db(tmp_path / "auth.sqlite3")
    owner = create_user("case-owner", "case-owner@example.com", "six-or-more")
    authorization = f"Bearer {create_session(owner.id)}"
    client.headers["Authorization"] = authorization
    execution_client.headers["Authorization"] = authorization
    yield owner
    client.headers.pop("Authorization", None)
    execution_client.headers.pop("Authorization", None)
    configure_auth_db(None)


def _open_case(owner_id: str, **overrides):
    payload = {
        "decree_text": "请议边防与军饷",
        "route_type": "multi",
        "departments": ["兵部", "户部"],
        "processing_path": ["丞相分流", "军机处会审"],
    }
    payload.update(overrides)
    return storage.open_case(JunjichuCaseOpenInput.model_validate(payload), owner_user_id=owner_id)


def test_list_returns_only_current_owner_safe_case_fields(_authenticated_case_api):
    owned = _open_case(_authenticated_case_api.id)
    other = create_user("case-other", "case-other@example.com", "six-or-more")
    _open_case(other.id, decree_text="他人的军饷案")

    response = client.get(CASES_URL)

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": owned.id,
            "decree_text": "请议边防与军饷",
            "departments": ["兵部", "户部"],
            "status": "MINISTRY_REVIEWING",
            "processing_path": ["丞相分流", "军机处会审"],
            "completed_ministry_opinions": [],
            "council_verdict": None,
            "reply_id": None,
            "failure_reason": None,
            "created_at": owned.created_at,
            "updated_at": owned.updated_at,
        }
    ]


def test_list_applies_allowed_filters_after_owner_isolation(_authenticated_case_api):
    owned = _open_case(_authenticated_case_api.id)
    storage.record_checkpoint(
        owned.id,
        owner_user_id=_authenticated_case_api.id,
        status="COUNCIL_REVIEWING",
    )
    _open_case(_authenticated_case_api.id, decree_text="礼制案", departments=["礼部", "户部"])
    other = create_user("filter-other", "filter-other@example.com", "six-or-more")
    _open_case(other.id, decree_text="他人的边防案")

    response = client.get(
        CASES_URL,
        params={"status": "COUNCIL_REVIEWING", "department": "兵部", "keyword": "边防"},
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [owned.id]


def test_list_rejects_unknown_query_without_disclosing_case_data(_authenticated_case_api):
    _open_case(_authenticated_case_api.id)

    response = client.get(CASES_URL, params={"owner_user_id": _authenticated_case_api.id})

    assert response.status_code == 400
    assert response.json() == {"status": "error", "reason": "validation"}


def test_list_rejects_invalid_status_with_a_sanitized_response(_authenticated_case_api):
    _open_case(_authenticated_case_api.id)

    response = client.get(CASES_URL, params={"status": "QUEUE_RUNNING"})

    assert response.status_code == 400
    assert response.json() == {"status": "error", "reason": "validation"}


def test_list_rejects_malicious_nested_ministry_fields_without_leaking_them(
    _authenticated_case_api,
):
    case = _open_case(_authenticated_case_api.id)
    storage.record_checkpoint(
        case.id,
        owner_user_id=_authenticated_case_api.id,
        status="MINISTRY_REVIEWING",
        completed_ministry_opinions=[
            {
                "department": "兵部",
                "bureau_opinions": [
                    {"bureau": "武库司", "opinion": "核验军械", "evidence": "secret"}
                ],
                "opinion": "兵部意见",
                "owner_user_id": "other-owner",
            }
        ],
    )

    response = client.get(CASES_URL)

    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": "case_unavailable"}
    assert "secret" not in response.text


def test_detail_returns_404_for_missing_or_other_owner_case(_authenticated_case_api):
    other = create_user("detail-other", "detail-other@example.com", "six-or-more")
    other_case = _open_case(other.id)

    response = client.get(f"{CASES_URL}/{other_case.id}")

    assert response.status_code == 404
    assert response.json() == {"status": "error", "reason": "case_not_found"}


def test_cases_require_an_authenticated_session():
    client.headers.pop("Authorization", None)

    response = client.get(CASES_URL)

    assert response.status_code == 401
    assert response.json() == {"message": "invalid credentials"}


def test_decree_to_case_ledger_is_private_and_records_only_real_terminal_outcomes(
    _authenticated_case_api, monkeypatch
):
    """Exercise two sessions through the decree API with no live model or database."""

    second_user = create_user("case-second", "case-second@example.com", "six-or-more")
    observed_processing_cases: list[dict[str, object]] = []
    observed_owner_ids: list[str] = []
    archive_reply_ids = iter(("reply-owner-a", "reply-owner-b", "reply-single"))
    outcomes = iter(("success", "success", "failure", "single"))

    def result_for(route_type: str) -> dict[str, object]:
        departments = ["兵部", "户部"] if route_type == "multi" else ["户部"]
        ministry_opinions = [
            {
                "department": department,
                "bureau_opinions": [
                    {
                        "bureau": "报价司" if department == "兵部" else "预算司",
                        "opinion": "已核验",
                    }
                ],
                "opinion": "部议已成",
            }
            for department in departments
        ]
        return {
            "chancellor_rationale": "离线测试分流",
            "route_type": route_type,
            "processing_path": ["上书房", "丞相", "军机处（会审）", "丞相（最终汇总）"],
            "departments": departments,
            "ministry_opinions": ministry_opinions,
            "council_verdict": "会审结论" if route_type == "multi" else None,
            "final_verdict": "丞相最终汇总",
            "recommendations": ["建议一", "建议二", "建议三"],
        }

    def fake_builder(*, lifecycle_observer, report_session, owner_user_id):
        assert owner_user_id == report_session.owner_user_id
        observed_owner_ids.append(owner_user_id)
        outcome = next(outcomes)

        class _FakeGraph:
            def invoke(self, state):
                if outcome == "single":
                    return result_for("single")
                lifecycle_observer.open_case(
                    decree_text=state["decree_text"],
                    departments=["兵部", "户部"],
                    processing_path=["上书房", "丞相（首次分流）"],
                )
                if outcome == "failure":
                    raise ChancellorGraphInvocationError("provider_token=must-not-leak")
                processing = client.get(CASES_URL)
                assert processing.status_code == 200
                observed_processing_cases.extend(processing.json())
                lifecycle_observer.record_ministry_opinion(
                    {
                        "department": "兵部",
                        "bureau_opinions": [{"bureau": "报价司", "opinion": "已核验"}],
                        "opinion": "部议已成",
                    }
                )
                lifecycle_observer.record_checkpoint(
                    status="COUNCIL_REVIEWING",
                    processing_path=["上书房", "丞相", "军机处（会审）"],
                    council_verdict="会审结论",
                )
                lifecycle_observer.record_checkpoint(
                    status="CHANCELLOR_FINALIZING",
                    processing_path=["上书房", "丞相", "军机处（会审）"],
                )
                return result_for("multi")

        return _FakeGraph()

    def fake_archive(*_args, **_kwargs):
        return ArchiveDecreeResult(archived=True, reply_id=next(archive_reply_ids))

    monkeypatch.setattr(decrees_module, "build_chancellor_graph", fake_builder)
    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", fake_archive)
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume_with_context",
        lambda **kwargs: ConsumedDraftAuthority(
            route_snapshot=ApprovedRouteSnapshot(
                departments=(
                    (
                        ApprovedDepartmentRoute(
                            department="户部", required_bureaus=("预算司",)
                        ),
                    )
                    if "单部" in kwargs["decree_text"]
                    else (
                        ApprovedDepartmentRoute(
                            department="兵部", required_bureaus=("报价司",)
                        ),
                        ApprovedDepartmentRoute(
                            department="户部", required_bureaus=("预算司",)
                        ),
                    )
                )
            ),
            accounting_context=None,
        ),
    )

    first = execution_client.post(
        "/api/v1/decrees/chancellor", json={"decree_text": "甲的跨部旨意"}
    )
    assert first.status_code == 200
    assert observed_processing_cases[0]["status"] == "MINISTRY_REVIEWING"
    assert observed_processing_cases[0]["reply_id"] is None

    client.headers["Authorization"] = f"Bearer {create_session(second_user.id)}"
    execution_client.headers["Authorization"] = client.headers["Authorization"]
    second = execution_client.post(
        "/api/v1/decrees/chancellor", json={"decree_text": "乙的跨部旨意"}
    )
    assert second.status_code == 200
    assert observed_owner_ids == [_authenticated_case_api.id, second_user.id]
    second_owner_cases = client.get(CASES_URL).json()
    second_owner_summary = [
        (item["decree_text"], item["status"], item["reply_id"])
        for item in second_owner_cases
    ]
    assert second_owner_summary == [
        ("乙的跨部旨意", "ARCHIVED", "reply-owner-b")
    ]

    client.headers["Authorization"] = f"Bearer {create_session(_authenticated_case_api.id)}"
    execution_client.headers["Authorization"] = client.headers["Authorization"]
    failure = execution_client.post(
        "/api/v1/decrees/chancellor", json={"decree_text": "甲的失败旨意"}
    )
    assert failure.status_code == 502
    assert "provider_token" not in failure.text
    single = execution_client.post(
        "/api/v1/decrees/chancellor", json={"decree_text": "甲的单部旨意"}
    )
    assert single.status_code == 200

    owner_cases = client.get(CASES_URL).json()
    assert len(owner_cases) == 2
    assert {item["status"] for item in owner_cases} == {"ARCHIVED", "FAILED"}
    archived = next(item for item in owner_cases if item["status"] == "ARCHIVED")
    failed = next(item for item in owner_cases if item["status"] == "FAILED")
    assert archived["reply_id"] == "reply-owner-a"
    assert failed["reply_id"] is None
    assert failed["failure_reason"] == "processing_failed"
    assert "failure_stage" not in failed
    assert "failure_code" not in failed
    assert archived["reply_id"] != second_owner_cases[0]["reply_id"]
