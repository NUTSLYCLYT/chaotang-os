"""tests/test_jinyiwei_endpoint.py — 锦衣卫谍报端点。

POST /api/intel/brief 两种采证模式:调用方自带 findings，或 Tavily 真实联网检索
(TAVILY_API_KEY 缺失时诚实空态,不编造)。可信度分级永远走确定性 vet 门。
"""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

jinyiwei_router = importlib.import_module("web.routers.jinyiwei")
app = importlib.import_module("web.main").app
client = TestClient(app)


def test_brief_endpoint_grades_findings():
    r = client.post("/api/intel/brief", json={
        "query": "竞品储能动态",
        "findings": [
            {"claim": "竞品A中标某储能电站", "sources": [{"tier": "一手"}]},
            {"claim": "未证实小道消息", "sources": []},
        ],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    doc = body["data"]
    assert doc["dept"] == "jinyiwei" and doc["doc_type"] == "brief"
    lights = [it["level"] for it in doc["items"]]
    assert lights == ["green", "red"]
    assert doc["seal"]["stamp"] == "绣春刀印"
    assert doc["sourceLabel"] == "CALLER_FINDINGS"
    assert doc["items"][0]["primary_source"] is True
    assert doc["items"][0]["distinct_sources"] == 0
    assert doc["items"][1]["hard_claim"] is False
    assert doc["items"][0]["sources"][0]["tier"] == "一手"


def test_brief_endpoint_uses_tavily_when_no_findings(monkeypatch):
    monkeypatch.setattr(
        jinyiwei_router, "tavily_search",
        lambda q, **kw: [{"claim": q, "sources": [{"name": "https://a.com"}, {"name": "https://b.com"}]}],
    )
    r = client.post("/api/intel/brief", json={"query": "某客户背景"})
    assert r.status_code == 200
    doc = r.json()["data"]
    assert doc["sourceLabel"] == "LIVE_SEARCH"
    assert len(doc["items"]) == 1  # 真检索结果进了确定性 vet 门


def test_brief_endpoint_no_key_no_findings_is_honest_fallback(monkeypatch):
    monkeypatch.setattr(jinyiwei_router, "tavily_search", lambda q, **kw: [])
    r = client.post("/api/intel/brief", json={"query": "无结果查询"})
    doc = r.json()["data"]
    assert doc["items"] == []
    assert doc["sourceLabel"] == "FALLBACK"


def test_brief_endpoint_rejects_empty_query():
    r = client.post("/api/intel/brief", json={"query": "  "})
    assert r.json()["success"] is False


def test_brief_endpoint_advisors_match_dept_design_doc():
    r = client.post("/api/intel/brief", json={"query": "x", "findings": []})
    doc = r.json()["data"]
    assert doc["provenance"]["advisors"] == [
        "bruce-schneier", "deming", "soros-perspective", "charity-majors", "taleb-perspective",
    ]


def test_brief_endpoint_empty_findings_is_honest_not_fabricated(monkeypatch):
    monkeypatch.setattr(jinyiwei_router, "tavily_search", lambda q, **kw: [])  # 不触真实网络
    r = client.post("/api/intel/brief", json={"query": "无结果查询", "findings": []})
    doc = r.json()["data"]
    assert doc["items"] == []
    assert "不编造" in doc["shielded"]


def test_brief_endpoint_rejects_non_list_findings():
    r = client.post("/api/intel/brief", json={"query": "x", "findings": "不是数组"})
    body = r.json()
    assert body["success"] is False
    assert "findings" in body["error"]


def test_brief_endpoint_persists_items_to_shared_evidence_pool(isolated_session_local):
    """见 valiant-crunching-candy.md「锦衣卫作为跨阶段共享证据服务」阶段1验收:
    真实调一次 /api/intel/brief，确认落进 jinyiwei_evidence 表，
    再调 GET /api/intel/evidence 能查到，不是只存在于 court_doc 响应里。"""
    r = client.post("/api/intel/brief", json={
        "query": "厦门合作方尽调",
        "findings": [
            {"claim": "该合作方资质齐全", "sources": [{"tier": "一手"}]},
        ],
    })
    assert r.status_code == 200
    assert r.json()["data"]["sourceLabel"] == "CALLER_FINDINGS"

    r2 = client.get("/api/intel/evidence", params={"query": "厦门"})
    assert r2.status_code == 200
    items = r2.json()["data"]["items"]
    assert len(items) == 1
    assert "该合作方资质齐全" in items[0]["insight"]
    assert items[0]["trust"] == "jinyiwei_verified"


def test_brief_endpoint_live_search_findings_have_untruncated_claim_persisted(
    isolated_session_local, monkeypatch
):
    """Tavily 真检索路径下，路由层不能只拿到 gather_intel 已截断的 title——
    必须自己留一份原始 claim 才能正确落库。用一条超过 60 字的 claim 验证
    共享池里存的是完整文本，不是 _finding_to_item 截断后的 60 字标题。"""
    long_claim = "该客户在过去十二个月内多次公开表达对本轮融资方案的强烈保留意见并要求补充尽调" * 2
    assert len(long_claim) > 60
    monkeypatch.setattr(
        jinyiwei_router, "tavily_search",
        # tier="二手" 让 vet_intel 判成"二手(单源)/待核"，而不是默认无 tier 时
        # 判成"未证实/拒"——这里要验证的是"待核也能正确落库、claim 未被截断"，
        # 不是脏情报拦截门本身(那条已经在 evidence_store 的测试里覆盖过)。
        lambda q, **kw: [{"claim": long_claim, "sources": [{"name": "https://a.com", "tier": "二手"}]}],
    )
    r = client.post("/api/intel/brief", json={"query": "某客户态度核实"})
    assert r.status_code == 200
    assert r.json()["data"]["sourceLabel"] == "LIVE_SEARCH"

    r2 = client.get("/api/intel/evidence", params={"query": "某客户态度核实", "include_pending": True})
    items = r2.json()["data"]["items"]
    assert len(items) == 1
    assert long_claim in items[0]["insight"]
