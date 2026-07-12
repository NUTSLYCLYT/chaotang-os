"""tests/test_build_ledger_tenant_isolation.py — P0-A：build-ledger 租户/用户隔离。

2026-07-12 独立只读审查(code-reviewer agent)发现:BuildLedgerEntry/
BuildLedgerAuditEvent 完全没有租户/用户归属列，`/api/court/build-ledger` 的
GET(不带 taskId)会把最近 50 条记录**跨所有用户/租户**返回给任意已登录调用方，
transition/persist/prune 也都不按归属校验，属于 IDOR/broken access control。

这里先写会针对当前(未修复)实现失败的测试，再改实现让它们通过——按 CLAUDE.md
TDD 纪律，测试先行。
"""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from web.schemas.auth import CurrentUser

app = importlib.import_module("web.main").app
deps = importlib.import_module("web.deps")
client = TestClient(app)


def _as_user(user_id: int, username: str, role: str = "user", tenant_slug: str = "default"):
    def _override() -> CurrentUser:
        return CurrentUser(user_id=user_id, username=username, role=role, tenant_slug=tenant_slug)

    return _override


def _with_identity(override):
    """临时把 get_current_user 换成指定身份，用完恢复原值——跟仓库里其余
    tenant/user 隔离测试(test_jinyiwei_endpoint.py)同样的手法。"""
    original = app.dependency_overrides.get(deps.get_current_user)
    app.dependency_overrides[deps.get_current_user] = override
    return original


def _restore_identity(original):
    if original is None:
        app.dependency_overrides.pop(deps.get_current_user, None)
    else:
        app.dependency_overrides[deps.get_current_user] = original


def _entry(entry_id: str, task_id: str, title: str) -> dict:
    return {
        "id": entry_id,
        "taskId": task_id,
        "title": title,
        "command": "测试命令",
        "evidence": [],
        "ministers": [],
        "createdAt": "2026-07-12T00:00:00Z",
        "status": "dispatched",
    }


def test_list_excludes_other_users_entries(isolated_session_local):
    original = _with_identity(_as_user(101, "user-a"))
    try:
        r = client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-a1", "task-a1", "用户A的台账")},
        )
        assert r.json()["success"] is True
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        listed = client.get("/api/court/build-ledger").json()
        assert listed["success"] is True
        assert listed["data"] == [], "用户B不应该看到用户A的台账条目"
    finally:
        _restore_identity(original)


def test_get_by_task_id_hides_other_users_entry(isolated_session_local):
    original = _with_identity(_as_user(101, "user-a"))
    try:
        client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-a2", "task-a2", "用户A的台账2")},
        )
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        filtered = client.get("/api/court/build-ledger?taskId=task-a2").json()
        assert filtered["data"] == [], "按 taskId 查询别人的条目应该表现得像不存在"
    finally:
        _restore_identity(original)


def test_export_excludes_other_users_entries(isolated_session_local):
    original = _with_identity(_as_user(101, "user-a"))
    try:
        client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-a3", "task-a3", "用户A的台账3")},
        )
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        exported = client.get("/api/court/build-ledger?format=export").json()
        assert exported["data"]["count"] == 0
        assert exported["data"]["entries"] == []
    finally:
        _restore_identity(original)


def test_audit_excludes_other_users_events(isolated_session_local):
    original = _with_identity(_as_user(101, "user-a"))
    try:
        client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-a4", "task-a4", "用户A的台账4")},
        )
        transitioned = client.post(
            "/api/court/build-ledger",
            json={"action": "transition", "taskId": "task-a4", "toStatus": "reviewing", "note": "复核"},
        ).json()
        assert transitioned["success"] is True
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        audit = client.get("/api/court/build-ledger?audit=1&taskId=task-a4").json()
        assert audit["data"] == [], "用户B不应该看到用户A触发的审计事件"
    finally:
        _restore_identity(original)


def test_transition_rejects_other_users_entry(isolated_session_local):
    original = _with_identity(_as_user(101, "user-a"))
    try:
        client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-a5", "task-a5", "用户A的台账5")},
        )
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        r = client.post(
            "/api/court/build-ledger",
            json={"action": "transition", "taskId": "task-a5", "toStatus": "reviewing", "note": "抢占"},
        )
        body = r.json()
        assert body["success"] is False, "用户B不应该能推进用户A的台账条目状态"
    finally:
        _restore_identity(original)

    # 用户A自己看，状态应该还是原样，没被用户B的越权请求改掉
    original = _with_identity(_as_user(101, "user-a"))
    try:
        mine = client.get("/api/court/build-ledger?taskId=task-a5").json()
        assert mine["data"][0]["status"] == "dispatched"
    finally:
        _restore_identity(original)


def test_persist_cannot_overwrite_another_users_entry_with_same_id(isolated_session_local):
    """同一个 entry id 被两个不同用户提交:第二个用户不能静默接管/覆盖第一个
    用户的行,也不应该 500——服务端应该安全拒绝而不是让所有权失控。"""
    original = _with_identity(_as_user(101, "user-a"))
    try:
        r1 = client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-shared-id", "task-a6", "用户A的台账6")},
        )
        assert r1.json()["success"] is True
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(202, "user-b"))
    try:
        r2 = client.post(
            "/api/court/build-ledger",
            json={"entry": _entry("ledger-shared-id", "task-b6", "用户B想接管这个id")},
        )
        assert r2.status_code == 200, "id 冲突应该被安全处理,不该是未捕获异常导致的 500"
        assert r2.json()["success"] is False
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(101, "user-a"))
    try:
        mine = client.get("/api/court/build-ledger?taskId=task-a6").json()
        assert len(mine["data"]) == 1, "用户A的原始条目不应该被用户B的提交顶掉"
        assert mine["data"][0]["title"] == "用户A的台账6"
    finally:
        _restore_identity(original)


def test_prune_only_affects_current_tenant(isolated_session_local, monkeypatch):
    """管理员清理台账时,不能顺带清掉别的租户的数据——本项目目前没有独立的
    "super-admin 跨租户"角色模型,role 只有 admin/user 一种区分,admin 权限
    始终局限在其 JWT 自带的那个 tenant_slug 内,所以 prune 按 tenant_id 收口
    (而不是全局)。同租户内允许 admin 清理其他用户的过期条目——那是"管理
    本租户的台账"这个动作本身的合理范围,不属于跨租户泄漏。"""
    import sqlite3
    from datetime import datetime, timedelta, timezone

    import src.tenant as tenant_module
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)"
    )
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('默认租户', 'default')")
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('租户甲', 'tenant-a')")
    conn.commit()
    monkeypatch.setattr(tenant_module, "get_db", lambda: conn)

    old_iso = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat(timespec="seconds")
    db = SessionLocal()
    try:
        db.add(BuildLedgerEntry(
            id="stale-default", task_id="task-stale-default", status="archived",
            entry_json="{}", created_at=old_iso, updated_at=old_iso,
            tenant_id=1, user_id="admin-default",
        ))
        db.add(BuildLedgerEntry(
            id="stale-tenant-a", task_id="task-stale-a", status="archived",
            entry_json="{}", created_at=old_iso, updated_at=old_iso,
            tenant_id=2, user_id="admin-a",
        ))
        db.commit()
    finally:
        db.close()

    def _as_tenant_admin(slug: str):
        def _override() -> CurrentUser:
            tenant_module.set_current_tenant(slug)
            return CurrentUser(user_id=1, username="ops", role="admin", tenant_slug=slug)

        return _override

    original = _with_identity(_as_tenant_admin("default"))
    try:
        pruned = client.post(
            "/api/court/build-ledger", json={"action": "prune", "retentionDays": 90}
        ).json()
        assert pruned["success"] is True
        assert pruned["data"]["removed"] == 1, "只应该删掉默认租户自己的过期条目"
    finally:
        _restore_identity(original)

    db = SessionLocal()
    try:
        survivor = db.query(BuildLedgerEntry).filter_by(id="stale-tenant-a").first()
        assert survivor is not None, "租户甲的过期条目不应该被默认租户的 admin 清理动作删掉"
    finally:
        db.close()
        conn.close()
