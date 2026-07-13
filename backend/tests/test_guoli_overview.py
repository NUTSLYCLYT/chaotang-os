"""国力仪表盘回归门(2026-07-14 新建)。

四个数字一页:丞相押注胜率、钦天监命中率、御史封驳率、各部告病率。
设计铁律(大神会审定):
- 有真实数据的指标标 LIVE 并给出计算口径;
- 没有数据源的指标显式 NO_DATA + 原因 + 预计接入阶段,绝不编数字——
  这是本仓 sourceLabel 纪律(诚实标)在指标页的延伸。
御史封驳率是 v1 唯一可 LIVE 的指标:truth_ledger 里 swarm=="yushi" 的
确定性判决,red/black 记封驳,green/yellow 记放行。
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

import src.truth_ledger as truth_ledger
from web.main import app


def _write_ledger(path, entries):
    path.write_text(
        "\n".join(json.dumps(e, ensure_ascii=False) for e in entries) + "\n",
        encoding="utf-8",
    )


def test_guoli_overview_shape_and_honest_no_data(tmp_path, monkeypatch):
    """四个指标全部在场;无数据的三项必须是 NO_DATA 且带 reason,不许有数值。"""
    ledger = tmp_path / "truth_ledger.jsonl"
    _write_ledger(ledger, [])
    monkeypatch.setattr(truth_ledger, "_ledger_path", lambda: ledger)

    client = TestClient(app)
    payload = client.get("/api/guoli/overview").json()
    assert payload["success"] is True
    metrics = {m["key"]: m for m in payload["data"]["metrics"]}
    assert set(metrics) == {
        "chancellor_bet_win_rate",
        "qintian_hit_rate",
        "yushi_rejection_rate",
        "dept_sick_leave_rate",
    }
    for key in ("chancellor_bet_win_rate", "qintian_hit_rate", "dept_sick_leave_rate"):
        assert metrics[key]["status"] == "NO_DATA"
        assert metrics[key]["value"] is None
        assert metrics[key]["reason"]
    # 台账为空时御史也必须诚实 NO_DATA,不许显示 0% 假装"零封驳"
    assert metrics["yushi_rejection_rate"]["status"] == "NO_DATA"
    assert metrics["yushi_rejection_rate"]["value"] is None


def test_guoli_yushi_rejection_rate_live_from_truth_ledger(tmp_path, monkeypatch):
    """有真实御史判决时,封驳率 = red/black 判决数 / 御史判决总数,标 LIVE。"""
    ledger = tmp_path / "truth_ledger.jsonl"
    entries = [
        {"swarm": "yushi", "checker": "court_doc_builder", "verdict": "green", "case_id": "y1"},
        {"swarm": "yushi", "checker": "court_doc_builder", "verdict": "red", "case_id": "y2"},
        {"swarm": "yushi", "checker": "court_doc_builder", "verdict": "black", "case_id": "y3"},
        {"swarm": "yushi", "checker": "court_doc_builder", "verdict": "yellow", "case_id": "y4"},
        # 非御史判决必须被过滤,不许混进分母
        {"swarm": "pack_rd", "checker": "pack_rd_check", "verdict": "red", "case_id": "p1"},
    ]
    _write_ledger(ledger, entries)
    monkeypatch.setattr(truth_ledger, "_ledger_path", lambda: ledger)

    client = TestClient(app)
    payload = client.get("/api/guoli/overview").json()
    assert payload["success"] is True
    yushi = {m["key"]: m for m in payload["data"]["metrics"]}["yushi_rejection_rate"]
    assert yushi["status"] == "LIVE"
    assert yushi["value"] == 0.5  # 2 封驳(red+black) / 4 御史判决
    assert yushi["sample_size"] == 4
