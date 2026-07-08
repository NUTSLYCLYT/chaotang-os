"""tests/test_admin_depts.py — admin 可编辑部门子系统（store + 9 端点）。

对齐前端 chaotang-web-lyt 的 admin/jiqun-depts 契约：
  GET/POST  /api/admin/depts
  PUT/DELETE /api/admin/depts/{id}
  GET/PUT   /api/admin/depts/{id}/flows
  GET       /api/admin/flows
  GET/PUT   /api/admin/users/{id}/depts
"""
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def store(isolated_session_local, monkeypatch):
    """部门 store，绑定内存 DB，租户固定为 1（避免依赖真实 tenants 库）。"""
    mod = importlib.import_module("src.dept_admin_store")
    monkeypatch.setattr(mod, "_current_tenant_id", lambda: 1)
    return mod


@pytest.fixture()
def client(store):
    app = importlib.import_module("web.main").app
    return TestClient(app)


# ── store 单元测试 ───────────────────────────────────────────────────────────

def test_create_list_rename_delete(store):
    d = store.create_department("户部")
    assert d["id"] > 0 and d["name"] == "户部" and d["created_at"]

    assert [x["name"] for x in store.list_departments()] == ["户部"]

    renamed = store.rename_department(d["id"], "户部·财政")
    assert renamed["name"] == "户部·财政"

    assert store.delete_department(d["id"]) is True
    assert store.list_departments() == []


def test_create_rejects_blank_and_duplicate(store):
    store.create_department("兵部")
    with pytest.raises(ValueError):
        store.create_department("兵部")  # 重名
    with pytest.raises(ValueError):
        store.create_department("   ")  # 空名


def test_rename_missing_returns_none(store):
    assert store.rename_department(999, "无") is None


def test_delete_missing_returns_false(store):
    assert store.delete_department(999) is False


def test_department_flows_set_get_and_dedup(store):
    d = store.create_department("工部")
    out = store.set_department_flows(d["id"], ["flow_sourcing", "flow_pack_rd", "flow_sourcing", " "])
    assert out == ["flow_pack_rd", "flow_sourcing"]  # 去重 + 去空 + 排序
    assert store.get_department_flows(d["id"]) == ["flow_pack_rd", "flow_sourcing"]
    # 覆盖式重设
    assert store.set_department_flows(d["id"], ["flow_legal"]) == ["flow_legal"]


def test_set_flows_unknown_dept_raises(store):
    with pytest.raises(LookupError):
        store.set_department_flows(999, ["flow_x"])


def test_delete_dept_cascades_flows(store):
    d = store.create_department("刑部")
    store.set_department_flows(d["id"], ["flow_legal"])
    store.delete_department(d["id"])
    assert store.get_department_flows(d["id"]) == []


def test_user_departments_set_get_filters_foreign_ids(store):
    a = store.create_department("礼部")
    b = store.create_department("吏部")
    # 1001 不存在 → 被过滤；只保留真实部门
    out = store.set_user_departments(7, [a["id"], b["id"], 1001])
    assert sorted(x["id"] for x in out) == sorted([a["id"], b["id"]])
    assert sorted(x["id"] for x in store.get_user_departments(7)) == sorted([a["id"], b["id"]])
    # 覆盖式重设为单个
    out2 = store.set_user_departments(7, [a["id"]])
    assert [x["id"] for x in out2] == [a["id"]]


def test_list_available_flows_nonempty_and_stems(store):
    flows = store.list_available_flows()
    assert flows == sorted(flows)
    assert all(f.startswith("flow_") and "." not in f for f in flows)
    assert "flow_finance" in flows


# ── API 端点契约测试 ─────────────────────────────────────────────────────────

def test_api_full_dept_lifecycle(client):
    # 建
    r = client.post("/api/admin/depts", json={"name": "户部"})
    assert r.status_code == 201, r.text
    dept = r.json()
    assert dept["name"] == "户部"
    did = dept["id"]

    # 列
    r = client.get("/api/admin/depts")
    assert r.status_code == 200 and [d["name"] for d in r.json()] == ["户部"]

    # 改名
    r = client.put(f"/api/admin/depts/{did}", json={"name": "户部·财政"})
    assert r.status_code == 200 and r.json()["name"] == "户部·财政"

    # 删
    r = client.delete(f"/api/admin/depts/{did}")
    assert r.status_code == 204
    assert client.get("/api/admin/depts").json() == []


def test_api_create_duplicate_400(client):
    client.post("/api/admin/depts", json={"name": "兵部"})
    r = client.post("/api/admin/depts", json={"name": "兵部"})
    assert r.status_code == 400


def test_api_rename_missing_404(client):
    r = client.put("/api/admin/depts/999", json={"name": "无"})
    assert r.status_code == 404


def test_api_delete_missing_404(client):
    assert client.delete("/api/admin/depts/999").status_code == 404


def test_api_dept_flows_roundtrip(client):
    did = client.post("/api/admin/depts", json={"name": "工部"}).json()["id"]
    r = client.put(f"/api/admin/depts/{did}/flows", json={"flow_ids": ["flow_sourcing", "flow_pack_rd"]})
    assert r.status_code == 200 and r.json() == ["flow_pack_rd", "flow_sourcing"]
    assert client.get(f"/api/admin/depts/{did}/flows").json() == ["flow_pack_rd", "flow_sourcing"]


def test_api_set_flows_unknown_dept_404(client):
    r = client.put("/api/admin/depts/999/flows", json={"flow_ids": ["flow_x"]})
    assert r.status_code == 404


def test_api_list_flows(client):
    r = client.get("/api/admin/flows")
    assert r.status_code == 200 and "flow_finance" in r.json()


def test_api_user_depts_roundtrip(client):
    a = client.post("/api/admin/depts", json={"name": "礼部"}).json()["id"]
    b = client.post("/api/admin/depts", json={"name": "吏部"}).json()["id"]
    r = client.put("/api/admin/users/7/depts", json={"dept_ids": [a, b]})
    assert r.status_code == 200
    assert sorted(d["id"] for d in r.json()) == sorted([a, b])
    assert sorted(d["id"] for d in client.get("/api/admin/users/7/depts").json()) == sorted([a, b])
