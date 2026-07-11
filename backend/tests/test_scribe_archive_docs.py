"""tests/test_scribe_archive_docs.py — GET /api/scribe/archive-docs 真实 CourtDoc 卷宗。

替换 frontend court-doc.ts 的 MOCK_COURT_DOCS：诚实映射真实复盘为 CourtDoc 契约，
不编造 evidenceRef/grounding。见 web/routers/scribe.py 的 scribe_archive_docs。
"""

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


def test_archive_docs_maps_approved_to_green_passed_and_signed(client, monkeypatch, tmp_path):
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod, "_build_memorial_list", lambda: [_memorial("task_a", status="approved", title="奏折A")]
    )
    cs.save_retrospective(
        "task_a",
        {"score": 4, "successes": ["跑通"], "failures": [], "lessons": ["下次先测超时"], "playbook": "先测 SSE"},
    )

    r = client.get("/api/scribe/archive-docs")
    assert r.status_code == 200
    docs = r.json()["data"]["docs"]
    assert len(docs) == 1
    doc = docs[0]
    assert doc["caseId"] == "task_a"
    assert doc["headline"] == "奏折A"
    assert doc["light"] == "green"
    assert doc["provenance"]["gate"] == "passed"
    assert doc["provenance"]["grounding"] == "none"
    assert doc["provenance"]["advisors"] == []
    assert doc["sourceLabel"] == "LIVE"
    assert doc["signed"] is True
    assert doc["sealedArchive"] is None
    assert doc["items"] == [
        {"level": "yellow", "title": "下次先测超时", "odds": None, "impact": None, "fix": None, "evidenceRef": None}
    ]


def test_archive_docs_maps_archived_to_sealed_and_rejected_to_red_blocked(client, monkeypatch, tmp_path):
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            _memorial("task_archived", status="archived", title="已封存案"),
            _memorial("task_rejected", status="rejected", title="被驳回案"),
        ],
    )
    cs.save_retrospective("task_archived", {"score": 5, "lessons": ["经验一"]})
    cs.save_retrospective("task_rejected", {"score": 1, "lessons": ["教训一"]})

    r = client.get("/api/scribe/archive-docs")
    docs = {d["caseId"]: d for d in r.json()["data"]["docs"]}

    assert docs["task_archived"]["light"] == "green"
    assert docs["task_archived"]["sealedArchive"] == "task_archived"
    assert docs["task_archived"]["signed"] is True

    assert docs["task_rejected"]["light"] == "red"
    assert docs["task_rejected"]["provenance"]["gate"] == "blocked"
    assert docs["task_rejected"]["signed"] is False
    assert docs["task_rejected"]["sealedArchive"] is None


def test_archive_docs_skips_synthetic_empty_and_in_flight(client, monkeypatch, tmp_path):
    """没有真实复盘、复盘为空、或任务还在跑(running/pending)的,不进列表——
    与 scribe_lessons() 同一套"诚实不编造"边界。"""
    import src.chaotang_store as cs
    import web.routers.throne as throne_mod

    monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            _memorial("task_no_retro"),
            _memorial("task_empty_lessons"),
            _memorial("task_running", status="running"),
        ],
    )
    cs.save_retrospective("task_empty_lessons", {"score": 3, "lessons": []})
    cs.save_retrospective("task_running", {"score": 4, "lessons": ["提前写的"]})

    r = client.get("/api/scribe/archive-docs")
    assert r.json()["data"]["docs"] == []
