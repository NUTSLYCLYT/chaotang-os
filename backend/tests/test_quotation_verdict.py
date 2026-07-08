"""tests/test_quotation_verdict.py — 报价红线复核最小可行片,镜像 test_tianjian_verdict.py。"""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from src.quotation_verdict import build_quotation_verdict, quotation_qa_to_items

app = importlib.import_module("web.main").app
client = TestClient(app)

_SAMPLE_TASK = "某储能集成商需要100MWh冷库储能系统方案,预算800万,请出报价单"

_QA_ALL_PASS = {
    "qa_result": "pass",
    "hard_checks": {
        "C1数字勾稽": "PASS",
        "C6报价明细加总与总报价一致性": "PASS",
        "C7实际毛利率≥目标毛利率": "PASS",
        "C8付款节点加总等于合同总额": "PASS",
        "C9质保期与成本预留年限一致": "PASS",
        "C10BOM单价×数量=小计可复算": "PASS",
    },
    "hard_check_notes": "全部通过",
}

_QA_MARGIN_FAIL = {
    "qa_result": "fail",
    "hard_checks": {
        "C1数字勾稽": "PASS",
        "C6报价明细加总与总报价一致性": "PASS",
        "C7实际毛利率≥目标毛利率": "FAIL",
        "C8付款节点加总等于合同总额": "PASS",
        "C9质保期与成本预留年限一致": "PASS",
        "C10BOM单价×数量=小计可复算": "PASS",
    },
    "hard_check_notes": "实际毛利率8% < 目标15%,毛利率击穿",
}


def test_quotation_qa_to_items_all_pass_is_green():
    items = quotation_qa_to_items(_QA_ALL_PASS, run_id="r1")
    assert len(items) == 6
    assert all(it["level"] == "green" for it in items)
    margin_item = next(it for it in items if "毛利率红线" in it["title"])
    assert "LLM自评" in margin_item["fix"]


def test_quotation_qa_to_items_margin_fail_is_red():
    items = quotation_qa_to_items(_QA_MARGIN_FAIL, run_id="r1")
    margin_item = next(it for it in items if "毛利率红线" in it["title"])
    assert margin_item["level"] == "red"
    assert margin_item["fix"] is None  # 不挂fix,防止compute_light把真红灯软成yellow
    assert "毛利率" in margin_item["title"]


def test_quotation_qa_to_items_missing_data_stays_unverified():
    items = quotation_qa_to_items(None)
    assert items[0]["level"] == "yellow"
    assert "QA硬核查数据缺失" in items[0]["title"]


def test_build_quotation_verdict_blocks_on_margin_fail():
    doc = build_quotation_verdict(
        _QA_MARGIN_FAIL, run_id="r1", question=_SAMPLE_TASK, archive=False
    )
    assert doc["dept"] == "hubu"
    assert doc["light"] in ("red", "black")
    assert "暂缓发出" in doc["headline"]


def test_build_quotation_verdict_passes_when_all_green():
    doc = build_quotation_verdict(
        _QA_ALL_PASS, run_id="r1", question=_SAMPLE_TASK, archive=False
    )
    assert doc["light"] == "green"
    assert "可发" in doc["headline"]


def test_verdict_endpoint_end_to_end(monkeypatch):
    """端点走真实链路,但用假 FlowEngine 顶替真 LLM 调用(不烧真 token)。"""

    class _FakeRunLog:
        run_id = "fake-run-1"
        final_output = {}
        qa_result = _QA_ALL_PASS

    class _FakeFlowEngine:
        def __init__(self, config_path):
            self.config_path = config_path

        def run(self, task_input):
            return _FakeRunLog()

    monkeypatch.setattr("src.flow_engine.FlowEngine", _FakeFlowEngine)

    r = client.post("/api/quotation/verdict", json={"task_input": _SAMPLE_TASK})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["dept"] == "hubu"
    assert body["data"]["light"] == "green"


def test_verdict_endpoint_rejects_empty_task_input():
    r = client.post("/api/quotation/verdict", json={})
    body = r.json()
    assert body["success"] is False
    assert "task_input" in body["error"]
