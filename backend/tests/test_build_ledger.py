"""build-ledger 回归门(2026-07-11 补齐)。

见 docs/frontend-backend-connectivity-gap-audit-2026-07-11.md:
/api/court/build-ledger 之前从未在后端实现过,前端 build-ledger.ts 一直
打到死链——运营闭环页面的构建台账功能实际上永远拿不到数据。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from web.main import app


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
