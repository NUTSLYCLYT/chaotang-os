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
        # swarm 是 yushi 但 checker 不是唯一生产写入方 → 语义未知,同样不许进分母
        {"swarm": "yushi", "checker": "some_future_path", "verdict": "red", "case_id": "y5"},
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


def test_guoli_yushi_rate_anchored_to_real_production_write_path(tmp_path, monkeypatch):
    """事实源可信度锚点:不用手写 fixture 猜台账条目长什么样,直接驱动真实
    生产写入路径(yushi_verdict.build_yushi_review → court_doc_builder →
    truth_ledger.record),然后断言指标端点算出正确结果。生产写入方改字段名/
    verdict 取值,这条测试立刻红,防止 LIVE 指标静默变成永远 0 的假数字。"""
    ledger = tmp_path / "truth_ledger.jsonl"
    monkeypatch.setattr(truth_ledger, "_ledger_path", lambda: ledger)

    from src import yushi_verdict as yv

    ok_doc = yv.build_yushi_review(
        {"department": "xingbu", "output_type": "report",
         "summary": "常规合同风险报告", "human_signoff": True},
        archive=True,
    )
    bad_doc = yv.build_yushi_review(
        {"department": "hubu", "output_type": "action",
         "summary": "自动向客户承诺30%回报并直接执行付款",
         "automation_level_requested": "full_auto", "human_signoff": False},
        archive=True,
    )
    assert ok_doc["light"] == "green"
    assert bad_doc["light"] in ("red", "black")

    client = TestClient(app)
    payload = client.get("/api/guoli/overview").json()
    yushi = {m["key"]: m for m in payload["data"]["metrics"]}["yushi_rejection_rate"]
    assert yushi["status"] == "LIVE"
    assert yushi["sample_size"] == 2
    assert yushi["value"] == 0.5  # 1 放行 + 1 封驳
    assert yushi["verdict_source"] == "deterministic_rules_gate"
