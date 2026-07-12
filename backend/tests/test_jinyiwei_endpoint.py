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


def test_brief_endpoint_evidence_is_isolated_per_tenant(isolated_session_local, monkeypatch):
    """2026-07-12 Codex 停止前审查纠正:"tenant-scoped evidence uses the default
    tenant"——之前 intel_brief/intel_evidence 一律走
    chaotang_store._get_default_tenant_id()，硬查 slug='default'，完全不看
    当前请求实际是哪个租户在调用，等同于假装系统单租户。

    这里用一张假的内存 tenants 表(不碰真实 data/fengqun.db)模拟两个真实
    租户，通过 dependency_overrides 让 get_current_user 依赖像生产环境
    真实实现那样在依赖解析阶段调用 set_current_tenant()——不能直接在测试
    自己的线程里用 tenant_context() 设线程本地变量，因为 Starlette 对同步
    endpoint 走 run_in_threadpool，endpoint 函数体本身运行在独立的工作线程
    里；只有让"设置租户"和"读取租户"发生在同一次请求分派出的同一个工作
    线程内(即通过依赖注入，而不是测试外部代码)，这条断言才真实覆盖生产
    路径。验证在租户甲身份下写入的情报，切换到默认租户身份查询时看不到——
    如果又退化回硬编码默认租户，这条测试会因为"默认租户也能看到租户甲的
    情报"而失败。"""
    import sqlite3

    import src.tenant as tenant_module
    from web.schemas.auth import CurrentUser

    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)"
    )
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('默认租户', 'default')")
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('租户甲', 'tenant-a')")
    conn.commit()
    monkeypatch.setattr(tenant_module, "get_db", lambda: conn)

    def _as_tenant(slug: str):
        def _override() -> CurrentUser:
            tenant_module.set_current_tenant(slug)
            return CurrentUser(user_id=1, username="ops", role="admin", tenant_slug=slug)

        return _override

    deps = importlib.import_module("web.deps")
    original_override = app.dependency_overrides.get(deps.get_current_user)
    try:
        app.dependency_overrides[deps.get_current_user] = _as_tenant("tenant-a")
        r = client.post("/api/intel/brief", json={
            "query": "租户甲专属尽调",
            "findings": [{"claim": "租户甲的机密情报", "sources": [{"tier": "一手"}]}],
        })
        assert r.status_code == 200
        # 租户甲自己能查到自己写的情报
        own = client.get("/api/intel/evidence", params={"query": "租户甲专属尽调"})
        assert len(own.json()["data"]["items"]) == 1

        app.dependency_overrides[deps.get_current_user] = _as_tenant("default")
        # 默认租户查不到租户甲的情报——不能因为两次调用都没显式传 tenant_id
        # 就落进同一个桶。
        leaked = client.get("/api/intel/evidence", params={"query": "租户甲专属尽调"})
        assert leaked.json()["data"]["items"] == []
    finally:
        if original_override is None:
            app.dependency_overrides.pop(deps.get_current_user, None)
        else:
            app.dependency_overrides[deps.get_current_user] = original_override
        conn.close()


def _seed_awaiting_evidence_task(db, task_id: str) -> None:
    from src.db.models import DecisionTask

    db.add(
        DecisionTask(
            id=task_id,
            user_id="tester",
            raw_question="是否应该追加两百万投资？",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.commit()


def test_fill_gap_rejects_unknown_task_id():
    r = client.post("/api/intel/evidence/fill-gap", json={
        "task_id": "task_no_such_id",
        "gap": "客户资质是否齐全",
    })
    assert r.json()["success"] is False


def test_fill_gap_rejects_task_not_awaiting_evidence(isolated_session_local):
    from src.db.models import DecisionTask

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="task_reviewing_1",
            user_id="tester",
            raw_question="测试问题",
            status="reviewing",
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()

    r = client.post("/api/intel/evidence/fill-gap", json={
        "task_id": "task_reviewing_1",
        "gap": "任意缺口",
    })
    body = r.json()
    assert body["success"] is False
    assert "awaiting_evidence" in body["error"]


def test_fill_gap_rejects_empty_task_id_or_gap():
    r1 = client.post("/api/intel/evidence/fill-gap", json={"task_id": "", "gap": "x"})
    assert r1.json()["success"] is False
    r2 = client.post("/api/intel/evidence/fill-gap", json={"task_id": "task_x", "gap": ""})
    assert r2.json()["success"] is False


def test_fill_gap_success_persists_to_shared_pool(isolated_session_local, monkeypatch):
    db = isolated_session_local()
    _seed_awaiting_evidence_task(db, "task_evidence_gap_1")
    db.close()

    monkeypatch.setattr(
        jinyiwei_router, "tavily_search",
        lambda q, **kw: [{"claim": "该客户资质已通过核验", "sources": [{"tier": "一手"}]}],
    )
    r = client.post("/api/intel/evidence/fill-gap", json={
        "task_id": "task_evidence_gap_1",
        "gap": "客户资质是否齐全",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["sourceLabel"] == "LIVE_SEARCH"
    assert len(body["data"]["items"]) == 1

    r2 = client.get("/api/intel/evidence", params={"query": "客户资质是否齐全"})
    items = r2.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["originTaskId"] == "task_evidence_gap_1"
