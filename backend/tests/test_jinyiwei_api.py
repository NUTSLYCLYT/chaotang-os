from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import jinyiwei as api_module
from app.auth import configure_auth_db, create_session, create_user
from app.jinyiwei import storage
from app.jinyiwei.models import EvidencePackStatus
from app.jinyiwei.read_models import InvestigationDetail, InvestigationPage, InvestigationSummary
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _authenticate_client(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("jinyiwei-user", "jinyiwei@example.com", "six-or-more")
    client.headers["Authorization"] = f"Bearer {create_session(user.id)}"
    yield user
    client.headers.pop("Authorization", None)
    configure_auth_db(None)


def _detail_with_public_source_metadata() -> InvestigationDetail:
    return InvestigationDetail.model_validate(
        {
            "pack_id": "pack-1",
            "investigation_id": "inv-1",
            "status": "PARTIAL",
            "request": {
                "requesting_agent": "bureau:hubu",
                "question": "What is the latest BYD price?",
                "required_facts": [
                    {
                        "key": "quote",
                        "description": "Latest trade price",
                        "category": "MARKET_QUOTE",
                        "data_scope": "EXTERNAL_PUBLIC",
                        "subject": "BYD",
                        "jurisdiction": "CN",
                        "expected_unit": "CNY",
                        "expected_shape": "number",
                        "market_metric": "LAST_PRICE",
                    }
                ],
                "decision_context": "Prepare bureau opinion",
                "freshness": {"max_age_seconds": 300, "not_before": None},
                "existing_evidence_ids": [],
                "request_id": "req-1",
                "timeout_seconds": 30,
                "source_scope": ["PUBLIC_API"],
            },
            "investigation_plan": {"fact_keys": ["quote"], "source_scope": ["PUBLIC_API"]},
            "evidence_by_fact": {
                "quote": [
                    {
                        "evidence_id": "evidence-1",
                        "fact_key": "quote",
                        "value": 100,
                        "unit": "CNY",
                        "as_of": "2026-07-22T10:00:00+00:00",
                        "published_at": "2026-07-22T10:00:00+00:00",
                        "retrieved_at": "2026-07-22T10:01:00+00:00",
                        "source_url": "https://example.test/quote",
                        "publisher": "Example Exchange",
                        "source_type": "PUBLIC_API",
                        "coverage": ["CN"],
                        "license_note": "Free public quotation feed.",
                        "quality": "AUTHORITATIVE",
                        "stance": "SUPPORTS",
                        "excerpt": "BYD last trade was 100 CNY.",
                        "content_hash": "a" * 64,
                        "confidence": 0.9,
                    }
                ]
            },
            "historical_evidence_by_fact": {"quote": []},
            "resolved_facts": ["quote"],
            "unresolved_facts": [],
            "conflicts": [],
            "source_attempts": [
                {
                    "source_type": "PUBLIC_API",
                    "source_name": "Example Exchange",
                    "status": "SUCCEEDED",
                    "started_at": "2026-07-22T10:00:00+00:00",
                    "completed_at": "2026-07-22T10:01:00+00:00",
                    "error": None,
                    "facts_attempted": ["quote"],
                }
            ],
            "investigation_started_at": "2026-07-22T10:00:00+00:00",
            "investigation_completed_at": "2026-07-22T10:01:00+00:00",
            "cache": {"hit": False, "cache_key": None, "cached_at": None, "expires_at": None},
            "do_not_infer": ["fact_stale:quote"],
            "adoptions": [],
        }
    )


def test_investigation_detail_exposes_categorized_facts_and_public_source_limits(
    monkeypatch, _authenticate_client,
) -> None:
    seen = {}
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_detail",
        lambda investigation_id, **kwargs: (
            seen.update(investigation_id=investigation_id, **kwargs)
            or _detail_with_public_source_metadata()
        ),
    )
    body = client.get("/api/v1/jinyiwei/investigations/inv-1").json()
    assert body["request"]["required_facts"][0]["category"] == "MARKET_QUOTE"
    assert body["request"]["required_facts"][0]["subject"] == "BYD"
    assert body["request"]["required_facts"][0]["jurisdiction"] == "CN"
    evidence = body["evidence_by_fact"]["quote"][0]
    assert evidence["published_at"] == "2026-07-22T10:00:00+00:00"
    assert evidence["retrieved_at"] == "2026-07-22T10:01:00+00:00"
    assert evidence["coverage"] == ["CN"]
    assert evidence["license_note"] == "Free public quotation feed."
    assert body["do_not_infer"] == ["fact_stale:quote"]
    assert "metadata" not in evidence
    assert seen == {
        "investigation_id": "inv-1",
        "owner_user_id": _authenticate_client.id,
    }


def test_summary_and_list_forward_validated_read_parameters(
    monkeypatch, _authenticate_client,
) -> None:
    summary_seen = {}
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_summary",
        lambda **kwargs: (
            summary_seen.update(kwargs)
            or InvestigationSummary(
            total_investigations=0,
            resolved_count=0,
            partial_count=0,
            blocked_count=0,
            unavailable_count=0,
            distinct_evidence_count=0,
            pending_adoption_count=0,
            confirmed_adoption_count=0,
            )
        ),
    )
    seen = {}
    monkeypatch.setattr(
        api_module.storage,
        "list_investigations",
        lambda **kwargs: (
            seen.update(kwargs)
            or InvestigationPage(items=(), total=0, limit=kwargs["limit"], offset=kwargs["offset"])
        ),
    )

    assert client.get("/api/v1/jinyiwei/summary").status_code == 200
    response = client.get("/api/v1/jinyiwei/investigations?status=PARTIAL&limit=10&offset=2")
    assert response.status_code == 200
    assert summary_seen == {"owner_user_id": _authenticate_client.id}
    assert seen == {
        "owner_user_id": _authenticate_client.id,
        "status": EvidencePackStatus.PARTIAL,
        "limit": 10,
        "offset": 2,
    }
    assert response.json() == {"items": [], "total": 0, "limit": 10, "offset": 2}


def test_query_and_id_validation_happen_before_storage(monkeypatch) -> None:
    called = []
    monkeypatch.setattr(
        api_module.storage, "list_investigations", lambda **_kwargs: called.append(1)
    )
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_detail",
        lambda _id, **_kwargs: called.append(1),
    )

    for url in (
        "/api/v1/jinyiwei/investigations?status=WRONG",
        "/api/v1/jinyiwei/investigations?limit=101",
        "/api/v1/jinyiwei/investigations?offset=-1",
        "/api/v1/jinyiwei/investigations/%20",
        f"/api/v1/jinyiwei/investigations/{'x' * 129}",
    ):
        assert client.get(url).status_code == 422
    assert called == []


def test_not_found_and_storage_failures_are_sanitized(monkeypatch) -> None:
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_detail",
        lambda _id, **_kwargs: (_ for _ in ()).throw(
            storage.InvestigationNotFoundError("secret path")
        ),
    )
    missing = client.get("/api/v1/jinyiwei/investigations/missing")
    assert missing.status_code == 404
    assert missing.json() == {
        "status": "error",
        "reason": "investigation_not_found",
        "message": "调查记录不存在",
    }

    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_summary",
        lambda **_kwargs: (_ for _ in ()).throw(
            storage.JinyiweiStorageError("SELECT secret FROM C:\\private")
        ),
    )
    failed = client.get("/api/v1/jinyiwei/summary")
    assert failed.status_code == 503
    assert failed.json() == {
        "status": "error",
        "reason": "storage_unavailable",
        "message": "锦衣卫档案暂时不可用",
    }
    assert "secret" not in failed.text and "SELECT" not in failed.text


def test_list_and_detail_relationship_corruption_use_fixed_503(monkeypatch) -> None:
    error = storage.JinyiweiStorageError("JOIN failed at C:\\private\\db.sqlite3")
    monkeypatch.setattr(
        api_module.storage,
        "list_investigations",
        lambda **_kwargs: (_ for _ in ()).throw(error),
    )
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_detail",
        lambda _id, **_kwargs: (_ for _ in ()).throw(error),
    )

    for url in (
        "/api/v1/jinyiwei/investigations",
        "/api/v1/jinyiwei/investigations/investigation-1",
    ):
        response = client.get(url)
        assert response.status_code == 503
        assert response.json() == {
            "status": "error",
            "reason": "storage_unavailable",
            "message": "锦衣卫档案暂时不可用",
        }
        assert "private" not in response.text and "JOIN" not in response.text


def test_only_get_methods_exist_and_health_is_unchanged() -> None:
    for url in (
        "/api/v1/jinyiwei/summary",
        "/api/v1/jinyiwei/investigations",
        "/api/v1/jinyiwei/investigations/id-1",
    ):
        assert client.post(url).status_code == 405
        assert client.patch(url).status_code == 405
        assert client.delete(url).status_code == 405
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"


def test_all_jinyiwei_reads_reject_anonymous_requests_before_storage(
    monkeypatch,
) -> None:
    called = []
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_summary",
        lambda **_kwargs: called.append("summary"),
    )
    monkeypatch.setattr(
        api_module.storage,
        "list_investigations",
        lambda **_kwargs: called.append("list"),
    )
    monkeypatch.setattr(
        api_module.storage,
        "get_investigation_detail",
        lambda _id, **_kwargs: called.append("detail"),
    )
    client.headers.pop("Authorization")

    for url in (
        "/api/v1/jinyiwei/summary",
        "/api/v1/jinyiwei/investigations",
        "/api/v1/jinyiwei/investigations/inv-other-owner",
    ):
        response = client.get(url)
        assert response.status_code == 401
        assert response.json() == {"message": "invalid credentials"}
    assert called == []
