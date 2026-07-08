"""court 端点 smoke:动作 dispatch 通、C2 边界、司列表/档案。复用 conftest 已认证 user。"""
import importlib

from fastapi.testclient import TestClient

app = importlib.import_module("web.main").app
client = TestClient(app)


def _as_role(role):
    """临时把当前用户角色改成 role(测 C2 把关人路径)。"""
    deps = importlib.import_module("web.deps")
    auth = importlib.import_module("web.schemas.auth")
    app.dependency_overrides[deps.get_current_user] = lambda: auth.CurrentUser(
        user_id=1, username="u", role=role, tenant_slug="default")


def test_action_reversible_ok():
    doc = {"actions": ["apply_fixes"], "workflow": {"state": "待审"}}
    r = client.post("/api/court/action", json={"doc": doc, "action": "apply_fixes"})
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["status"] == "ok" and body["data"]["new_state"] == "待审"


def test_action_release_blocked_for_non_gatekeeper():
    # 默认 conftest 角色 admin,不是把关人 → release 被 C2 拒
    doc = {"actions": ["release"], "workflow": {"state": "待审"}}
    r = client.post("/api/court/action", json={"doc": doc, "action": "release", "confirm": True})
    body = r.json()
    assert body["success"] is False and body["data"]["code"] == "forbidden_gatekeeper"


def test_action_release_allowed_for_yushi():
    try:
        _as_role("yushi")
        doc = {"actions": ["release"], "workflow": {"state": "待审"}}
        r = client.post("/api/court/action", json={"doc": doc, "action": "release", "confirm": True})
        assert r.json()["data"]["new_state"] == "已准奏"
    finally:
        deps = importlib.import_module("web.deps")
        app.dependency_overrides.pop(deps.get_current_user, None)


def test_action_irreversible_needs_confirm():
    doc = {"actions": ["archive_amulet"], "workflow": {"state": "待审"}}
    r = client.post("/api/court/action", json={"doc": doc, "action": "archive_amulet"})
    assert r.json()["data"]["status"] == "needs_confirm"


def test_si_list_and_profile():
    r = client.get("/api/court/si/hubu")
    assert r.status_code == 200
    assert any(s["code"] == "accounting" for s in r.json()["data"]["si"])
    p = client.get("/api/court/si/hubu/accounting")
    assert p.json()["data"]["identity"]["name"] == "会计司"
    # 未接归档 → 能力诚实空
    assert p.json()["data"]["capability"]["scored"] is False


def test_si_unknown_returns_error():
    r = client.get("/api/court/si/hubu/not_a_si")
    assert r.json()["success"] is False
