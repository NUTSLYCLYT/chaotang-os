"""tests/test_scribe_lessons.py — GET /api/scribe/lessons 聚合真实复盘。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _memorial(run_id: str, status: str = "approved", title: str = "示例奏折") -> dict:
    return {"id": run_id, "title": title, "status": status}


def test_lessons_aggregates_real_retrospectives(client, monkeypatch, tmp_path):
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod, "_build_memorial_list", lambda: [_memorial("task_a", title="奏折A")]
    )
    cs.save_retrospective(
        "task_a",
        {
            "score": 4,
            "successes": ["跑通"],
            "failures": [],
            "lessons": ["下次先测超时"],
            "playbook": "先测 SSE",
        },
    )

    r = client.get("/api/scribe/lessons")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    lessons = body["data"]["lessons"]
    assert len(lessons) == 1
    assert lessons[0]["billId"] == "task_a"
    assert lessons[0]["billTitle"] == "奏折A"
    assert lessons[0]["lessons"] == [
        {"id": "task_a-0", "text": "下次先测超时", "severity": "note"}
    ]
    assert lessons[0]["summary"] == "先测 SSE"
    # patterns/tags 后端没有数据源,诚实留空,不编造
    assert lessons[0]["patterns"] == []
    assert lessons[0]["tags"] == []


def test_lessons_skips_synthetic_and_empty(client, monkeypatch, tmp_path):
    """没有真实复盘(只有 GET 时自动合成的占位)或 lessons 为空的奏折,不进列表。"""
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [_memorial("task_no_retro"), _memorial("task_empty_lessons")],
    )
    # task_no_retro: 从未保存过复盘 → get_retrospective 返回 None
    cs.save_retrospective("task_empty_lessons", {"score": 3, "lessons": []})

    r = client.get("/api/scribe/lessons")
    assert r.json()["data"]["lessons"] == []


def test_lessons_only_includes_approved_archived_done(client, monkeypatch, tmp_path):
    """running/pending 奏折的复盘(哪怕真实存在)不算"已归档旧案",不进列表。"""
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [_memorial("task_running", status="running")],
    )
    cs.save_retrospective("task_running", {"score": 4, "lessons": ["提前写的"]})

    r = client.get("/api/scribe/lessons")
    assert r.json()["data"]["lessons"] == []
