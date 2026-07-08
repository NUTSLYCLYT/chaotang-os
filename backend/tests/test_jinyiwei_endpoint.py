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
