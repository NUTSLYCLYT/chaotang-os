from fastapi.testclient import TestClient

from app.api.auth import require_current_user
from app.auth.models import AuthenticatedPrincipal
from app.bingbu.service import get_bingbu_service
from app.main import app


def test_bingbu_routes_use_authenticated_owner_and_import_preview():
    principal = AuthenticatedPrincipal(
        id="owner-a",
        username="owner",
        email="owner@example.com",
        tenant_id="tenant-a",
        membership_id="membership-a",
        tenant_role="OWNER",
    )
    app.dependency_overrides[require_current_user] = lambda: principal
    service = get_bingbu_service()
    service.store._opportunities.clear()
    service.store._import_fingerprints.clear()
    try:
        with TestClient(app) as client:
            preview = client.post(
                "/api/v1/bingbu/imports/preview",
                json={
                    "filename": "sales.csv",
                    "source_type": "csv",
                    "content": (
                        "id,account_name,stage,amount,next_action,next_action_owner,"
                        "next_action_due_at,source_ref\n"
                        "opp-1,北辰科技,discovery,100,确认决策人,owner,"
                        "2030-01-01T00:00:00Z,fixture:1\n"
                    ),
                },
            )
            assert preview.status_code == 200
            assert preview.json()["accepted_count"] == 1
            commit = client.post(
                "/api/v1/bingbu/imports/commit",
                json={
                    "filename": "sales.csv",
                    "source_type": "csv",
                    "content": (
                        "id,account_name,stage,amount,next_action,next_action_owner,"
                        "next_action_due_at,source_ref\n"
                        "opp-1,北辰科技,discovery,100,确认决策人,owner,"
                        "2030-01-01T00:00:00Z,fixture:1\n"
                    ),
                },
            )
            assert commit.status_code == 200
            overview = client.get("/api/v1/bingbu/overview")
            assert overview.status_code == 200
            assert overview.json()["ok"] is True
            filtered = client.get("/api/v1/bingbu/opportunities", params={"stage": "discovery"})
            assert filtered.status_code == 200
            assert filtered.json()["items"][0]["stage"] == "discovery"
    finally:
        app.dependency_overrides.clear()


def test_crm_sync_is_protected_and_disabled_by_default():
    principal = AuthenticatedPrincipal(
        id="owner-crm",
        username="crm-owner",
        email="crm-owner@example.com",
        tenant_id="tenant-crm",
        membership_id="membership-crm",
        tenant_role="OWNER",
    )
    app.dependency_overrides[require_current_user] = lambda: principal
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/bingbu/crm/sync/preview",
                json={"provider": "twenty", "page_size": 10},
            )
        assert response.status_code == 503
        assert response.json() == {
            "code": "BINGBU_CRM_UNAVAILABLE",
            "message": "CRM 事实源不可用",
        }
    finally:
        app.dependency_overrides.clear()
