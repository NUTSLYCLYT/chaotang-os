"""翰林院回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md: 前端
features/hanlin/* 整套 hooks 一直打 404,因为后端从未实现过 /api/hanlin/*。
翰林院页面当前没有任何真实路由渲染(孤立组件),所以这里只需要结构正确、
诚实标注为空的响应,不需要为一个没有产品需求的功能编造数据。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app
from web.deps import get_current_user
from web.schemas.auth import CurrentUser


def test_hanlin_overview_and_summary_return_zeroed_honest_shape():
    client = TestClient(app)
    overview = client.get("/api/hanlin/overview").json()
    assert overview["overview"]["summary"]["submittedContributions"] == 0
    assert overview["overview"]["topContribution"] is None

    summary = client.get("/api/hanlin/summary").json()
    assert summary["summary"]["queuedAwards"] == 0


def test_hanlin_list_endpoints_return_empty_arrays_not_404():
    client = TestClient(app)
    for path, key in [
        ("/api/hanlin/contributions", "contributions"),
        ("/api/hanlin/reviews", "reviews"),
        ("/api/hanlin/recommendations", "recommendations"),
        # experiments 已接 truth_ledger 真源(P9),见 test_hanlin_truth_source.py
        ("/api/hanlin/incubation", "modules"),
        ("/api/hanlin/export-offerings", "offerings"),
    ]:
        response = client.get(path)
        assert response.status_code == 200, path
        assert response.json()[key] == []


def test_hanlin_awards_and_scouting_return_expected_envelope():
    client = TestClient(app)
    awards = client.get("/api/hanlin/awards").json()
    assert awards["awards"] == []
    assert awards["currentRewardPeriod"] is None

    scouting = client.get("/api/hanlin/scouting").json()
    assert scouting["projects"] == []
    assert scouting["candidates"] == []


def test_hanlin_scouting_detail_404s_for_unknown_candidate():
    client = TestClient(app)
    response = client.get("/api/hanlin/scouting/does-not-exist")
    assert response.status_code == 404


def test_hanlin_reset_demo_is_honest_noop():
    client = TestClient(app)
    response = client.get("/api/hanlin/reset-demo").json()
    assert response["sourceLabel"] == "FALLBACK"


def test_hanlin_api_rejects_authenticated_non_admin():
    original = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=2,
        username="ordinary-user",
        role="user",
        tenant_slug="default",
        tenant_id=1,
    )
    try:
        client = TestClient(app)
        assert client.get("/api/hanlin/overview").status_code == 403
        assert client.post("/api/hanlin/reset-demo").status_code == 403
    finally:
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original


def test_hanlin_api_rejects_anonymous_request():
    original = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = TestClient(app)
        assert client.get("/api/hanlin/overview").status_code == 401
        assert client.post("/api/hanlin/reset-demo").status_code == 401
    finally:
        if original is not None:
            app.dependency_overrides[get_current_user] = original
