"""庄园·蜂群聚集地 roster 端点测试(B1)。"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


def test_roster_lists_all_registered_swarms(client):
    r = client.get("/api/swarm/roster")
    assert r.status_code == 200
    roster = r.json()
    # 与 /config 注册蜂群数一致(聚集地必须"一屏全在")
    cfg = client.get("/api/swarm/config").json()
    assert len(roster) == len(cfg["swarms"]) >= 18, (len(roster), len(cfg["swarms"]))


def test_roster_item_shape(client):
    roster = client.get("/api/swarm/roster").json()
    for it in roster:
        assert it["id"] and it["name"]
        assert it["status"]  # 至少 idle
        assert "group" in it and "last_run_id" in it


def test_roster_join_reflects_runs(client):
    """跑过 run 的蜂群应带最近 run(非全 idle)——若库里有 session。"""
    roster = client.get("/api/swarm/roster").json()
    sessions = client.get("/api/swarm/sessions").json()
    if sessions:  # 有历史 session 才断言 join 生效
        assert any(it["last_run_id"] for it in roster), "有 session 但 roster 全无 last_run,join 失败"


if __name__ == "__main__":
    import subprocess, sys
    sys.exit(subprocess.call([sys.executable, "-m", "pytest", __file__, "-q"]))
