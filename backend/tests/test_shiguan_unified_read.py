"""K5 史馆读链统一回归门:archive 页读 canonical ShiguanArchive 投影。

钉死:归档行出现在 /api/chaotang/archive 的 memorials/decisions 里,
表空时旧投影行为不变(不因 canonical 层缺数据而丢老档案)。
"""

from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _insert_archive(session_local, task_id: str = "task_k5"):
    import json

    from src.db.models import ShiguanArchive

    db = session_local()
    db.add(
        ShiguanArchive(
            id=f"archive_{task_id}",
            task_id=task_id,
            raw_question="低温电池投标合规问题",
            refined_edict="核查 GB 38031 认证要求",
            final_memorial_json=json.dumps(
                {"title": "低温电池合规回奏", "sourceDepartment": "刑部"}
            ),
            emperor_decision_json=json.dumps({"action": "approve", "reason": "证据齐"}),
            evidence_chain_json="[]",
            source_label="LIVE_SWARM",
            synthetic_flag=False,
            created_at="2026-07-14T20:00:00",
        )
    )
    db.commit()
    db.close()


def test_canonical_archive_row_appears_in_page_payload(
    monkeypatch, isolated_session_local
):
    _insert_archive(isolated_session_local)
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/archive")
    assert r.status_code == 200
    data = r.json()["data"]
    mem = {m["id"]: m for m in data["memorials"]}
    assert "task_k5" in mem, "canonical ShiguanArchive 行没进史馆读模型"
    assert mem["task_k5"]["title"] == "低温电池合规回奏"
    assert mem["task_k5"]["status"] == "archived"
    assert mem["task_k5"]["sourceLabel"] == "LIVE_SWARM"
    decisions = [d for d in data["decisions"] if d.get("memorialId") == "task_k5"]
    assert decisions and decisions[0]["action"] == "approve"


def test_non_default_tenant_does_not_read_canonical_layer(
    monkeypatch, isolated_session_local
):
    """shiguan_archives 无 tenant_id 列:非 default 租户不得读到 default 的归档。"""
    _insert_archive(isolated_session_local)
    from web.routers.chaotang import _shiguan_archive_projection

    import src.tenant as tenant_mod

    monkeypatch.setattr(tenant_mod, "get_current_tenant", lambda: "tenant_b")
    memorials, decisions = _shiguan_archive_projection()
    assert memorials == [] and decisions == []


def test_empty_canonical_table_keeps_legacy_projection(
    monkeypatch, isolated_session_local
):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/archive")
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data["memorials"], list)
    assert isinstance(data["decisions"], list)
