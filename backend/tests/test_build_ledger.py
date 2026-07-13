"""build-ledger 回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md:
/api/court/build-ledger 之前从未在后端实现过,前端 build-ledger.ts 一直
打到死链——运营闭环页面的构建台账功能实际上永远拿不到数据。
"""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

import src.tenant as tenant_module
from web.main import app


@pytest.fixture(autouse=True)
def _isolated_tenant_db(monkeypatch):
    """2026-07-12 独立验证阶段发现:`resolve_current_tenant_id()`
    (build_ledger.py 的 P0-A 改动首次让这个路由用上它) 走
    `src.tenant.get_db()`——一个完全独立于 `isolated_session_local` 的机制,
    直接用裸 sqlite3 连接真实的 `data/fengqun.db` 磁盘文件(`DB_PATH` 是
    模块级硬编码常量,没有环境变量或 fixture 能重定向它),不受任何测试隔离
    保护。P0-A 之前 build_ledger.py 从没调过这个函数，这是这份测试文件第一次
    真正触达那条路径。跟 jinyiwei 那边已有的先例
    (`test_jinyiwei_endpoint.py::test_brief_endpoint_evidence_is_isolated_per_tenant`)
    同款手法:换成内存 sqlite，测试不再依赖、不再写入真实共享文件。"""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)"
    )
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('默认租户', 'default')")
    conn.commit()
    monkeypatch.setattr(tenant_module, "get_db", lambda: conn)
    yield
    conn.close()


def test_build_ledger_persist_list_and_export(isolated_session_local):
    client = TestClient(app)
    entry = {
        "id": "ledger-e1",
        "taskId": "task-e1",
        "title": "测试台账",
        "command": "测试命令",
        "evidence": ["证据A"],
        "ministers": ["刑部"],
        "createdAt": "2026-07-11T00:00:00Z",
        "status": "dispatched",
    }
    persisted = client.post("/api/court/build-ledger", json={"entry": entry}).json()
    assert persisted["success"] is True
    assert persisted["data"]["entry"]["status"] == "dispatched"

    listed = client.get("/api/court/build-ledger").json()
    assert listed["success"] is True
    assert len(listed["data"]) == 1
    assert listed["data"][0]["taskId"] == "task-e1"

    filtered = client.get("/api/court/build-ledger?taskId=task-e1").json()
    assert len(filtered["data"]) == 1

    exported = client.get("/api/court/build-ledger?format=export").json()
    assert exported["data"]["schema"] == "chaotang.build-ledger.v1"
    assert exported["data"]["count"] == 1


def test_build_ledger_canonical_path_is_dual_mounted(isolated_session_local):
    """2026-07-14: /api/court/build-ledger 在 3050->8081 的 Next 代理链路上被
    某种未定位的中间层拦截(见 review-handoff.md)，POST 鉴权失败、GET 静默
    返回空数据。前端已经跳过代理直接走 /api/build-ledger 这个规范路径(跟
    /api/legal/overview 等既有先例同款手法)——后端必须同时挂载新路径，且
    行为跟旧路径完全一致，旧路径不下线(e2e/回归测试仍打旧路径)。"""
    client = TestClient(app)
    entry = {
        "id": "ledger-e2",
        "taskId": "task-e2",
        "title": "规范路径测试台账",
        "command": "测试命令",
        "evidence": ["证据B"],
        "ministers": ["刑部"],
        "createdAt": "2026-07-14T00:00:00Z",
        "status": "dispatched",
    }
    persisted = client.post("/api/build-ledger", json={"entry": entry}).json()
    assert persisted["success"] is True
    assert persisted["data"]["entry"]["status"] == "dispatched"

    listed = client.get("/api/build-ledger?taskId=task-e2").json()
    assert listed["success"] is True
    assert len(listed["data"]) == 1
    assert listed["data"][0]["taskId"] == "task-e2"


def test_build_ledger_transition_enforces_allowed_states_and_writes_audit(
    isolated_session_local,
):
    client = TestClient(app)
    entry = {
        "id": "ledger-e2",
        "taskId": "task-e2",
        "title": "测试台账2",
        "command": "测试命令2",
        "evidence": [],
        "ministers": [],
        "createdAt": "2026-07-11T00:00:00Z",
        "status": "dispatched",
    }
    client.post("/api/court/build-ledger", json={"entry": entry})

    transitioned = client.post(
        "/api/court/build-ledger",
        json={"action": "transition", "taskId": "task-e2", "toStatus": "reviewing", "note": "复核中"},
    ).json()
    assert transitioned["success"] is True
    assert transitioned["data"]["entry"]["status"] == "reviewing"

    invalid = client.post(
        "/api/court/build-ledger",
        json={"action": "transition", "taskId": "task-e2", "toStatus": "dispatched", "note": "回退"},
    ).json()
    assert invalid["success"] is False

    audit = client.get("/api/court/build-ledger?audit=1&taskId=task-e2").json()
    assert len(audit["data"]) == 1
    assert audit["data"][0]["fromStatus"] == "dispatched"
    assert audit["data"][0]["toStatus"] == "reviewing"


def test_build_ledger_prune_removes_stale_entries(isolated_session_local):
    from datetime import datetime, timedelta, timezone

    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    old_iso = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat(timespec="seconds")
    db = SessionLocal()
    try:
        db.add(
            BuildLedgerEntry(
                id="stale-1",
                task_id="task-stale",
                status="archived",
                entry_json="{}",
                created_at=old_iso,
                updated_at=old_iso,
            )
        )
        db.commit()
    finally:
        db.close()

    client = TestClient(app)
    pruned = client.post(
        "/api/court/build-ledger", json={"action": "prune", "retentionDays": 90}
    ).json()
    assert pruned["success"] is True
    assert pruned["data"]["removed"] == 1
    assert pruned["data"]["after"] == 0


def test_build_ledger_prune_requires_admin_role(isolated_session_local):
    """独立安全审查(2026-07-11)发现: 批量硬删除最初对任何登录用户开放,
    这里验证非 admin 角色被拒绝(403),而不是能清空别人的台账。"""
    import importlib

    from web.schemas.auth import CurrentUser

    app_mod = importlib.import_module("web.main")
    deps = importlib.import_module("web.deps")
    original = app_mod.app.dependency_overrides.get(deps.get_current_user)
    app_mod.app.dependency_overrides[deps.get_current_user] = lambda: CurrentUser(
        user_id=99, username="normal_user", role="user", tenant_slug="default"
    )
    try:
        client = TestClient(app)
        response = client.post(
            "/api/court/build-ledger", json={"action": "prune", "retentionDays": 90}
        )
        assert response.status_code == 403
    finally:
        if original is None:
            app_mod.app.dependency_overrides.pop(deps.get_current_user, None)
        else:
            app_mod.app.dependency_overrides[deps.get_current_user] = original
