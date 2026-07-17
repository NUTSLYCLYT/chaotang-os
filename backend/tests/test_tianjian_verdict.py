"""tests/test_tianjian_verdict.py — 钦天监天象策最小可行片,镜像 test_bingbu_battlecard.py。"""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from src.tianjian_verdict import (
    build_tianjian_forecast,
    forecast_output_to_items,
    polymarket_items,
)

app = importlib.import_module("web.main").app
client = TestClient(app)

_SAMPLE_TASK = "预测一下下个季度储能电池的市场走势和价格趋势"
_SAMPLE_OUTPUT = {
    "态势与驱动因素(含依据)": "碳酸锂价格Q3预计8-10万元/吨(依据:SMM数据)",
    "多情景预测(乐观/基准/悲观+概率区间)": "基准情景(60%):均价0.25-0.29元/Wh",
    "影响传导路径与时间维度": "近(7月):价格震荡下行",
    "主要不确定因素与下行风险": "碳酸锂跌破8万元/吨",
    "可选行动与推荐顺序": "首选双线并进",
    "不可逆动作的人类签字点": "主动下调报价需高管签字",
}


def test_forecast_output_to_items_covers_all_fields():
    items = forecast_output_to_items(_SAMPLE_OUTPUT, run_id="r1")
    assert len(items) == 6
    assert all(it["evidence_ref"].startswith("truth://tianjian/r1#") for it in items)


def test_forecast_output_to_items_vets_hard_claim_without_primary_source():
    # "SMM"不在jinyiwei_vet的PRIMARY_KW(官网/公告/年报…)里,含硬声明(万元)→ 待核=yellow
    items = forecast_output_to_items(
        {"态势与驱动因素(含依据)": "碳酸锂价格Q3预计8-10万元/吨(依据:SMM数据)"}
    )
    assert items[0]["level"] == "yellow"
    assert "SMM" in items[0]["fix"]


def test_forecast_output_to_items_upgrades_primary_source_to_green():
    items = forecast_output_to_items(
        {"态势与驱动因素(含依据)": "碳酸锂价格Q3预计8万元/吨(依据:国家统计局公告)"}
    )
    assert items[0]["level"] == "green"


def test_forecast_output_to_items_no_citation_stays_unverified():
    items = forecast_output_to_items({"可选行动与推荐顺序": "首选双线并进策略"})
    assert items[0]["level"] in ("yellow", "red")
    assert "未标注具体来源" in items[0]["fix"]


def test_forecast_output_to_items_skips_empty_fields():
    items = forecast_output_to_items(
        {"态势与驱动因素(含依据)": "", "可选行动与推荐顺序": "有内容"}
    )
    assert len(items) == 1


def test_build_tianjian_forecast_honestly_marks_unverified():
    doc = build_tianjian_forecast(
        _SAMPLE_OUTPUT, run_id="r1", question=_SAMPLE_TASK, archive=False
    )
    assert doc["dept"] == "qintianjian" and doc["doc_type"] == "forecast"
    assert doc["provenance"]["gate"] == "pending"  # rag_hit=False,不冒充已核实
    assert "依据未经核实" in doc["headline"]
    assert doc["seal"]["stamp"] == "星盘印"


def test_polymarket_items_marks_real_markets_green():
    markets = [
        {
            "question": "Will lithium drop below 80k CNY/ton by Q3?",
            "outcomes": ["Yes", "No"],
            "outcome_prices": ["0.42", "0.58"],
            "closed": False,
            "url": "https://polymarket.com/event/x",
        }
    ]
    items = polymarket_items(markets)
    assert items[0]["level"] == "green"
    assert "Polymarket真实市场" in items[0]["title"]


def test_build_tianjian_forecast_merges_extra_items():
    doc = build_tianjian_forecast(
        _SAMPLE_OUTPUT,
        question=_SAMPLE_TASK,
        archive=False,
        extra_items=[
            {
                "level": "green",
                "title": "Polymarket真实市场:x",
                "fix": None,
                "evidence_ref": "u",
            }
        ],
    )
    assert len(doc["items"]) == 7


def test_forecast_endpoint_end_to_end(monkeypatch):
    """端点走真实链路,但用假 FlowEngine 顶替真 LLM 调用、假 search_markets 顶替真网络请求。"""

    class _FakeRunLog:
        run_id = "fake-run-1"
        final_output = _SAMPLE_OUTPUT

    class _FakeFlowEngine:
        def __init__(self, config_path):
            self.config_path = config_path

        def run(self, task_input):
            return _FakeRunLog()

    monkeypatch.setattr("src.flow_engine.FlowEngine", _FakeFlowEngine)
    monkeypatch.setattr("src.polymarket_lookup.search_markets", lambda *a, **kw: [])
    # This endpoint test proves the forecast transport/assembly path, not the
    # contents of the shared on-disk knowledge store.  Use an empty isolated
    # RAG so prior tests cannot add unrelated grounding items and change the
    # expected six forecast fields.
    class _EmptyRag:
        def search(self, *args, **kwargs):
            return []

    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: _EmptyRag())

    r = client.post("/api/qintianjian/forecast", json={"task_input": _SAMPLE_TASK})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["dept"] == "qintianjian"
    assert len(body["data"]["items"]) == 6


def test_forecast_endpoint_rejects_empty_task_input():
    r = client.post("/api/qintianjian/forecast", json={})
    body = r.json()
    assert body["success"] is False
    assert "task_input" in body["error"]
