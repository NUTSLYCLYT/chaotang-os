"""tests/test_archive_chronicle.py — POST /api/chaotang/archive/chronicle。

真实归档数据聚合(memorials/reviews/retrospectives) + LLM 摘要,LLM 不可用时诚实
兜底(不冒充生成成功,不落库)。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _memorial(
    run_id: str, title: str, created_at: str, status: str = "approved"
) -> dict:
    return {"id": run_id, "title": title, "status": status, "createdAt": created_at}


def test_chronicle_empty_window_is_honest_not_fabricated(client, monkeypatch):
    import web.routers.throne as throne_mod
    import src.chaotang_store as cs

    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [])
    monkeypatch.setattr(cs, "list_reviews", lambda **_: [])

    r = client.post("/api/chaotang/archive/chronicle", json={"type": "日史"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["events"] == []
    assert data["decisions"] == []
    assert data["knowledge"] == []
    assert "不编造" in data["summary"]
    assert data["llmDegraded"] is False


def test_chronicle_aggregates_real_events_decisions_knowledge(
    client, monkeypatch, tmp_path
):
    import web.routers.throne as throne_mod
    import src.chaotang_store as cs

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    today = __import__("datetime").date.today().isoformat()
    mem = _memorial("task_c1", "储能项目复盘", f"{today}T09:00:00")
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [mem])
    monkeypatch.setattr(
        cs,
        "list_reviews",
        lambda **_: [
            {
                "memorialId": "task_c1",
                "action": "approve",
                "createdAt": f"{today}T10:00:00",
            }
        ],
    )
    cs.save_retrospective("task_c1", {"score": 4, "lessons": ["下次先核成本"]})

    # LLM 不可用(无 key)→ 走诚实兜底分支,不应报错
    r = client.post("/api/chaotang/archive/chronicle", json={"type": "日史"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["events"] == ["储能项目复盘"]
    assert data["decisions"] == [{"title": "储能项目复盘", "status": "已完成"}]
    assert data["knowledge"] == ["下次先核成本"]
    assert data["llmDegraded"] is True
    assert "LLM 摘要暂不可用" in data["summary"]
    assert "1 件事项" in data["summary"] and "1 项决策" in data["summary"]


def test_chronicle_respects_days_window(client, monkeypatch):
    import web.routers.throne as throne_mod
    import src.chaotang_store as cs

    old_mem = _memorial("task_old", "很久以前的奏折", "2020-01-01T00:00:00")
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [old_mem])
    monkeypatch.setattr(cs, "list_reviews", lambda **_: [])

    r = client.post("/api/chaotang/archive/chronicle", json={"type": "月史"})
    assert r.json()["data"]["events"] == []  # 2020 年的奏折不在 30 天窗口内


def test_chronicle_uses_llm_summary_when_available(client, monkeypatch):
    import web.routers.throne as throne_mod
    import src.chaotang_store as cs
    import web.routers.chaotang as chaotang_mod

    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [])
    monkeypatch.setattr(cs, "list_reviews", lambda **_: [])
    monkeypatch.setattr(
        chaotang_mod,
        "_chronicle_summary",
        lambda events, decisions: ("真 LLM 写的摘要", False),
    )

    r = client.post("/api/chaotang/archive/chronicle", json={"type": "日史"})
    data = r.json()["data"]
    assert data["summary"] == "真 LLM 写的摘要"
    assert data["llmDegraded"] is False
