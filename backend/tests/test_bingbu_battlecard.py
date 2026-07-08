"""tests/test_bingbu_battlecard.py — 兵部战报最小可行片(六部能力评估挖出的洞)。

haolong/opc/quotation/voice_sales/storage_aftercare 都是真实、独立跑着的业务,但从没人让
它们产出 court_doc(dept="bingbu")。这里只接 flow_haolong 一条,证明链路通,不假装做完
docs/dept_design/bingbu.md 设计的完整 MVP(竞品攻防/报价回链/售后回填/大神会审门未做)。
"""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from src.bingbu_battlecard import build_bingbu_battlecard, haolong_output_to_items
from src.swarm_fallbacks import _build_haolong_final_output

app = importlib.import_module("web.main").app
client = TestClient(app)

_SAMPLE_LEAD = "内蒙古某牧场,冬天-40℃,需要100套户外电源,3周内交货,预算不超过2000元/套"


def test_haolong_output_to_items_covers_all_fields():
    final_output = _build_haolong_final_output(_SAMPLE_LEAD)
    items = haolong_output_to_items(final_output, run_id="r1")
    titles = [it["title"] for it in items]
    assert len(items) == 6  # 线索评分/客户档案/触达策略/沟通话术/营销内容/分发计划
    assert all(it["level"] == "yellow" for it in items)  # 未经复核,统一诚实标 yellow
    assert any("线索评分" in t for t in titles)
    assert all(it["evidence_ref"].startswith("truth://haolong/r1#") for it in items)


def test_haolong_output_to_items_skips_empty_fields():
    items = haolong_output_to_items({"线索评分": "", "客户档案": "有内容"})
    assert len(items) == 1
    assert "客户档案" in items[0]["title"]


def test_build_bingbu_battlecard_honestly_marks_unreviewed():
    """真实数据(哪怕来自确定性 fallback)也不能冒充"已经战情团审过"。"""
    final_output = _build_haolong_final_output(_SAMPLE_LEAD)
    doc = build_bingbu_battlecard(
        final_output, run_id="r1", question=_SAMPLE_LEAD, archive=False
    )
    assert doc["dept"] == "bingbu" and doc["doc_type"] == "brief"
    assert doc["provenance"]["gate"] == "pending"  # rag_hit=False,不冒充已审
    assert "未经战情复核" in doc["headline"]
    assert doc["provenance"]["rag_grounded"] is False


def test_bingbu_advisors_match_dept_design_doc():
    """docs/dept_design/bingbu.md §三:判官(neil-rackham/chris-voss)+
    顾问(aaron-ross/charity-majors)。这轮才补齐(此前只有 2 位判官,缺 2 位顾问)。
    """
    doc = build_bingbu_battlecard(
        _build_haolong_final_output(_SAMPLE_LEAD), archive=False
    )
    assert doc["provenance"]["advisors"] == [
        "neil-rackham",
        "chris-voss",
        "aaron-ross",
        "charity-majors",
    ]
    assert doc["seal"]["stamp"] == "令旗印"


def test_battlecard_endpoint_end_to_end(monkeypatch):
    """端点走真实链路,但用确定性 fallback 顶替真 LLM 调用(不烧真 token)。"""
    from src import bingbu_battlecard as bc

    class _FakeRunLog:
        run_id = "fake-run-1"
        final_output = _build_haolong_final_output(_SAMPLE_LEAD)

    class _FakeFlowEngine:
        def __init__(self, config_path):
            self.config_path = config_path

        def run(self, task_input):
            return _FakeRunLog()

    monkeypatch.setattr("src.flow_engine.FlowEngine", _FakeFlowEngine)

    r = client.post("/api/bingbu/battlecard", json={"task_input": _SAMPLE_LEAD})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    doc = body["data"]
    assert doc["dept"] == "bingbu"
    # 6 个 LLM 字段项仍在,确定性真值门(haolong_check)条目为增量,故 ≥6
    assert len(doc["items"]) >= 6


def test_determinism_gate_flags_arithmetic_mismatch():
    from src.bingbu_battlecard import _determinism_items

    # ΣN×M%=85 却报综合评分95 → C1 线索评分算术不自洽 → red(数字勾稽击穿)
    bad = {"线索评分": "加权:80×50% + 90×50%,综合评分:95分"}
    items = _determinism_items(bad)
    assert any(it["level"] == "red" and "C1" in it["title"] for it in items), items


def test_determinism_gate_passes_consistent_score():
    from src.bingbu_battlecard import _determinism_items

    good = {
        "线索评分": "加权:80×50% + 90×50%,综合评分:85分",
        "客户档案": "李四[✓确认]已成交",
    }
    items = _determinism_items(good)
    assert any(it["level"] == "green" and "C1" in it["title"] for it in items), items


def test_determinism_red_breaks_battlecard_light():
    doc = build_bingbu_battlecard(
        {"线索评分": "加权:80×50% + 90×50%,综合评分:95分"}, archive=False
    )
    assert doc["light"] == "red"  # 评分算错击穿,不再是诚实yellow


def test_battlecard_endpoint_rejects_empty_task_input():
    r = client.post("/api/bingbu/battlecard", json={})
    body = r.json()
    assert body["success"] is False
    assert "task_input" in body["error"]
