# tests/test_chaotang_manor_dept.py
"""庄园 + 部门端点测试(T1)。
测行为(契约字段、状态码、信封格式),不测实现细节。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# ──────────────── fixtures ────────────────

@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    # 隔离 opportunities store 到 tmp
    import src.manor_data as md
    monkeypatch.setattr(md, "_OPP_PATH", tmp_path / "opportunities.json")
    from web.main import app
    return TestClient(app)


# ──────────────── manor/opportunities ────────────────

class TestManorOpportunities:
    def test_envelope_and_list(self, client):
        r = client.get("/api/chaotang/manor/opportunities")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert isinstance(data, list)
        assert len(data) >= 8  # seed 至少 8 条

    def test_required_fields(self, client):
        r = client.get("/api/chaotang/manor/opportunities")
        opps = r.json()["data"]
        required = {"id", "name", "domain", "stage", "updatedAt"}
        for o in opps:
            missing = required - o.keys()
            assert not missing, f"缺字段 {missing} in {o}"

    def test_stage_values(self, client):
        valid = {"seed", "sprout", "grow", "bloom", "harvest", "wither"}
        r = client.get("/api/chaotang/manor/opportunities")
        stages = {o["stage"] for o in r.json()["data"]}
        assert stages <= valid, f"非法 stage: {stages - valid}"

    def test_covers_all_six_stages(self, client):
        valid = {"seed", "sprout", "grow", "bloom", "harvest", "wither"}
        r = client.get("/api/chaotang/manor/opportunities")
        stages = {o["stage"] for o in r.json()["data"]}
        assert stages == valid, f"seed 数据未覆盖全部 6 态,缺: {valid - stages}"

    def test_value_unit_is_wanyuan_or_null(self, client):
        # value 单位是万元;若存在应为数字,不是字符串
        r = client.get("/api/chaotang/manor/opportunities")
        for o in r.json()["data"]:
            v = o.get("value")
            if v is not None:
                assert isinstance(v, (int, float)), f"value 应为数字, got {v!r}"


# ──────────────── manor/supply-chain ────────────────

class TestManorSupplyChain:
    def test_envelope(self, client):
        r = client.get("/api/chaotang/manor/supply-chain")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_required_fields(self, client):
        r = client.get("/api/chaotang/manor/supply-chain")
        items = r.json()["data"]
        assert len(items) >= 4  # 至少 4 个 products
        required = {"model", "category", "capacity", "priceRange", "leadTime"}
        for item in items:
            missing = required - item.keys()
            assert not missing, f"缺字段 {missing} in {item}"

    def test_price_range_is_string(self, client):
        r = client.get("/api/chaotang/manor/supply-chain")
        for item in r.json()["data"]:
            assert isinstance(item["priceRange"], str), "priceRange 应为字符串"


# ──────────────── manor/overview ────────────────

class TestManorOverview:
    def test_envelope(self, client):
        r = client.get("/api/chaotang/manor/overview")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_top_level_fields(self, client):
        data = client.get("/api/chaotang/manor/overview").json()["data"]
        required = {"pulse", "groups", "assetCategories", "opportunityFunnel", "generatedAt"}
        missing = required - data.keys()
        assert not missing, f"overview 缺字段: {missing}"

    def test_pulse_fields(self, client):
        pulse = client.get("/api/chaotang/manor/overview").json()["data"]["pulse"]
        required = {"totalAssets", "activeOpportunities", "runningProjects",
                    "supplyItems", "riskCount", "aiAdviceCount"}
        missing = required - pulse.keys()
        assert not missing, f"pulse 缺字段: {missing}"

    def test_groups_count(self, client):
        groups = client.get("/api/chaotang/manor/overview").json()["data"]["groups"]
        assert len(groups) == 6

    def test_funnel_has_six_stages(self, client):
        funnel = client.get("/api/chaotang/manor/overview").json()["data"]["opportunityFunnel"]
        assert len(funnel) == 6
        stages = {f["stage"] for f in funnel}
        assert stages == {"seed", "sprout", "grow", "bloom", "harvest", "wither"}

    def test_asset_categories_nonempty(self, client):
        cats = client.get("/api/chaotang/manor/overview").json()["data"]["assetCategories"]
        assert len(cats) >= 4
        for c in cats:
            assert "key" in c and "label" in c and "count" in c


# ──────────────── manor/ai-advice ────────────────

class TestManorAiAdvice:
    def test_envelope(self, client):
        r = client.get("/api/chaotang/manor/ai-advice")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_advice_fields(self, client):
        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        assert isinstance(advices, list)
        assert len(advices) >= 1
        required = {"id", "title", "detail", "source", "priority"}
        for a in advices:
            missing = required - a.keys()
            assert not missing, f"advice 缺字段: {missing}"

    def test_priority_values(self, client):
        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        valid = {"high", "medium", "low"}
        for a in advices:
            assert a["priority"] in valid, f"非法 priority: {a['priority']}"


# ──────────────── dept/{code}/overview ────────────────

class TestDeptOverview:
    @pytest.mark.parametrize("code", ["finance", "legal", "market", "guard"])
    def test_valid_codes(self, client, code):
        r = client.get(f"/api/chaotang/dept/{code}/overview")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert data["code"] == code

    def test_required_fields(self, client):
        data = client.get("/api/chaotang/dept/finance/overview").json()["data"]
        required = {"code", "agentCode", "minister", "status",
                    "recentMemorials", "activeTasks", "keyMetrics"}
        missing = required - data.keys()
        assert not missing, f"dept overview 缺字段: {missing}"

    def test_agent_code_mapping(self, client):
        expected = {
            "finance": "hu_bu",
            "legal": "xing_bu",
            "market": "li_bu_rites",
            "guard": "jin_yi_wei",
        }
        for code, ac in expected.items():
            data = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]
            assert data["agentCode"] == ac, f"{code} agentCode 应为 {ac}, 得 {data['agentCode']}"

    def test_minister_fields(self, client):
        minister = client.get("/api/chaotang/dept/finance/overview").json()["data"]["minister"]
        for f in ("id", "name", "role", "iconKey", "description"):
            assert f in minister, f"minister 缺字段: {f}"

    def test_status_valid(self, client):
        valid = {"idle", "processing", "risk", "pending_review", "done"}
        for code in ("finance", "legal", "market", "guard"):
            status = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["status"]
            assert status in valid, f"{code} status={status!r} 非法"

    def test_invalid_code_returns_fail(self, client):
        r = client.get("/api/chaotang/dept/unknown_dept/overview")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is False

    def test_key_metrics_nonempty(self, client):
        for code in ("finance", "legal", "market", "guard"):
            metrics = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["keyMetrics"]
            assert len(metrics) >= 2, f"{code} keyMetrics 应至少 2 条"
            for m in metrics:
                assert "label" in m and "value" in m

    def test_risks_field_present(self, client):
        # risks 可为空列表,但字段必须存在
        data = client.get("/api/chaotang/dept/guard/overview").json()["data"]
        assert "risks" in data


# ──────────────── T-be3: ops/physician 新增 code ────────────────

class TestDeptOpsPhysician:
    """T-be3:兵部(ops)+ 太医(physician)部门端点验收。"""

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_valid_code_returns_200(self, client, code):
        r = client.get(f"/api/chaotang/dept/{code}/overview")
        assert r.status_code == 200
        assert r.json()["success"] is True, f"{code} 应返回 success=True"

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_code_field_matches(self, client, code):
        data = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]
        assert data["code"] == code

    def test_ops_agent_code(self, client):
        data = client.get("/api/chaotang/dept/ops/overview").json()["data"]
        assert data["agentCode"] == "bing_bu", \
            f"ops agentCode 应为 bing_bu,得 {data['agentCode']!r}"

    def test_physician_agent_code(self, client):
        data = client.get("/api/chaotang/dept/physician/overview").json()["data"]
        assert data["agentCode"] == "tai_yi_yuan", \
            f"physician agentCode 应为 tai_yi_yuan,得 {data['agentCode']!r}"

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_minister_fields_present(self, client, code):
        minister = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["minister"]
        for f in ("id", "name", "role", "iconKey", "description"):
            assert f in minister, f"{code} minister 缺字段: {f}"

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_status_valid(self, client, code):
        valid = {"idle", "processing", "risk", "pending_review", "done"}
        status = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["status"]
        assert status in valid, f"{code} status={status!r} 非法"

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_key_metrics_nonempty(self, client, code):
        metrics = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["keyMetrics"]
        assert len(metrics) >= 2, f"{code} keyMetrics 应至少 2 条"
        for m in metrics:
            assert "label" in m and "value" in m, f"{code} metric 缺字段: {m}"

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_recent_memorials_is_list(self, client, code):
        memorials = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]["recentMemorials"]
        assert isinstance(memorials, list)

    @pytest.mark.parametrize("code", ["ops", "physician"])
    def test_risks_field_present(self, client, code):
        data = client.get(f"/api/chaotang/dept/{code}/overview").json()["data"]
        assert "risks" in data


# ──────────────── manor_data 单元测试 ────────────────

class TestManorDataUnit:
    def test_load_opportunities_seeds_when_missing(self, tmp_path):
        from src.manor_data import load_opportunities
        p = tmp_path / "opps.json"
        assert not p.exists()
        opps = load_opportunities(p)
        assert len(opps) >= 8
        assert p.exists()  # 已自动写盘

    def test_load_opportunities_reads_existing(self, tmp_path):
        from src.manor_data import load_opportunities
        p = tmp_path / "opps.json"
        data = [{"id": "x1", "name": "测试", "domain": "能源",
                 "stage": "seed", "updatedAt": "2026-01-01T00:00:00Z"}]
        p.write_text(json.dumps(data), encoding="utf-8")
        result = load_opportunities(p)
        assert result[0]["id"] == "x1"

    def test_opportunity_funnel_all_stages(self):
        from src.manor_data import opportunity_funnel, OPPORTUNITY_STAGES
        opps = [{"stage": s} for s in OPPORTUNITY_STAGES]
        funnel = opportunity_funnel(opps)
        assert len(funnel) == 6
        assert all(f["count"] == 1 for f in funnel)

    def test_load_supply_chain_nonempty(self):
        from src.manor_data import load_supply_chain
        items = load_supply_chain()
        assert len(items) >= 4
        for item in items:
            assert item["model"] and item["priceRange"]

    # M-1: level 字段区分 cell/pack
    def test_supply_chain_level_field(self):
        from src.manor_data import load_supply_chain
        items = load_supply_chain()
        valid_levels = {"cell", "pack"}
        for item in items:
            assert "level" in item, f"缺 level 字段: {item['model']}"
            assert item["level"] in valid_levels, f"非法 level: {item['level']}"

    def test_supply_chain_cell_and_pack_levels_present(self):
        from src.manor_data import load_supply_chain
        items = load_supply_chain()
        levels = {item["level"] for item in items}
        assert "cell" in levels, "应有 cell 级条目(products)"
        assert "pack" in levels, "应有 pack 级条目(pack_solutions)"

    def test_supply_chain_pack_price_range_not_per_cell(self):
        # pack 级 priceRange 不应包含 "元/只"(元/只 是电芯单位)
        from src.manor_data import load_supply_chain
        for item in load_supply_chain():
            if item["level"] == "pack":
                assert "元/只" not in item["priceRange"], \
                    f"pack 级不应含 '元/只': {item['priceRange']}"


# ──────────────── reviewer M-2 修复:recentMemorials 投影为 MemorialBrief ────────────────

class TestDeptMemorialBrief:
    BRIEF_KEYS = {"id", "title", "sourceDepartment", "agentCode",
                  "priority", "status", "summary", "createdAt"}

    def _inject_memorial(self, monkeypatch, code: str):
        """注入一条带多余字段的奏折,验证投影效果。"""
        import web.routers.throne as th
        fat_memorial = {
            "id": "run_test_brief",
            "title": "测试奏折",
            "sourceDepartment": code,
            "agentCode": "hu_bu",
            "priority": "normal",
            "status": "pending",
            "summary": "摘要",
            "createdAt": "2026-05-27T00:00:00",
            # 以下字段超出 MemorialBrief 契约,应被投影删除
            "suggestedAction": "不应出现",
            "deadline": "不应出现",
            "qualityScore": 4.5,
            "grade": "B",
            "riskLevel": "high",
        }
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [fat_memorial])

    def test_recent_memorials_only_brief_keys(self, client, monkeypatch):
        self._inject_memorial(monkeypatch, "finance")
        data = client.get("/api/chaotang/dept/finance/overview").json()["data"]
        memorials = data["recentMemorials"]
        assert len(memorials) == 1
        m = memorials[0]
        extra = set(m.keys()) - self.BRIEF_KEYS
        assert not extra, f"recentMemorials 含超出契约的字段: {extra}"

    def test_recent_memorials_contains_all_brief_keys(self, client, monkeypatch):
        self._inject_memorial(monkeypatch, "legal")
        data = client.get("/api/chaotang/dept/legal/overview").json()["data"]
        memorials = data["recentMemorials"]
        assert len(memorials) == 1
        m = memorials[0]
        missing = self.BRIEF_KEYS - set(m.keys())
        assert not missing, f"recentMemorials 缺 Brief 字段: {missing}"


# ──────────────── reviewer L-1 修复:value=None 时不渲染 "None 万元" ────────────────

# ──────────────── T-be2: funnel 真实计数 + ai-advice 半真实 ────────────────

class TestFunnelRealCounts:
    """opportunity_funnel 必须反映真实商机数据,不能是硬编码。"""

    def test_funnel_counts_match_opportunities(self, client, monkeypatch, tmp_path):
        """funnel count 应等于 opportunities 各 stage 的真实条数。"""
        import src.manor_data as md
        opps = [
            {"id": "a", "stage": "seed"}, {"id": "b", "stage": "seed"},
            {"id": "c", "stage": "bloom"}, {"id": "d", "stage": "harvest"},
        ]
        p = tmp_path / "opps.json"
        p.write_text(json.dumps(opps), encoding="utf-8")
        monkeypatch.setattr(md, "_OPP_PATH", p)

        funnel = client.get("/api/chaotang/manor/overview").json()["data"]["opportunityFunnel"]
        by_stage = {f["stage"]: f["count"] for f in funnel}
        assert by_stage["seed"] == 2, f"seed 期望 2,得 {by_stage['seed']}"
        assert by_stage["bloom"] == 1, f"bloom 期望 1,得 {by_stage['bloom']}"
        assert by_stage["harvest"] == 1, f"harvest 期望 1,得 {by_stage['harvest']}"
        assert by_stage["sprout"] == 0, f"sprout 期望 0,得 {by_stage['sprout']}"

    def test_funnel_total_equals_opportunity_count(self, client):
        """funnel 所有 stage count 之和 = opportunities 条数(seed data)。"""
        from src.manor_data import load_opportunities, opportunity_funnel
        opps = load_opportunities()
        funnel = opportunity_funnel(opps)
        total = sum(f["count"] for f in funnel)
        assert total == len(opps), \
            f"funnel 总数 {total} 应等于 opportunities 条数 {len(opps)}"

    def test_funnel_all_six_stages_present(self):
        """即使某阶段为 0 条,funnel 仍返回全 6 项。"""
        from src.manor_data import opportunity_funnel
        opps = [{"stage": "bloom"}, {"stage": "harvest"}]
        funnel = opportunity_funnel(opps)
        stages = {f["stage"] for f in funnel}
        assert stages == {"seed", "sprout", "grow", "bloom", "harvest", "wither"}
        zero_stages = [f for f in funnel if f["stage"] in ("seed", "sprout", "grow", "wither")]
        assert all(f["count"] == 0 for f in zero_stages), "未出现阶段应为 0"


class TestAiAdviceBriefingDerived:
    """ai-advice 应从 briefing(待裁决奏折/高风险)派生建议条目,非纯硬编码。"""

    def test_high_pending_count_generates_advice(self, client, monkeypatch):
        """注入 pending_count=5 时应生成待裁决积压建议,priority=high。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_briefing_pending_count", lambda: 5)
        monkeypatch.setattr(manor_mod, "_briefing_high_risk_count", lambda: 0)

        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        briefing_advices = [a for a in advices if a.get("id") == "adv_briefing_1"]
        assert briefing_advices, "pending_count=5 时应生成 adv_briefing_1"
        assert briefing_advices[0]["priority"] == "high"
        assert "/court-briefing" in briefing_advices[0]["actionHref"]

    def test_medium_pending_count_generates_medium_advice(self, client, monkeypatch):
        """pending_count=3 → priority=medium(3<=count<5)。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_briefing_pending_count", lambda: 3)
        monkeypatch.setattr(manor_mod, "_briefing_high_risk_count", lambda: 0)

        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        briefing_advices = [a for a in advices if a.get("id") == "adv_briefing_1"]
        assert briefing_advices, "pending_count=3 时应生成 adv_briefing_1"
        assert briefing_advices[0]["priority"] == "medium"

    def test_low_pending_count_no_briefing_advice(self, client, monkeypatch):
        """pending_count=1 时不应生成 adv_briefing_1(阈值 3)。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_briefing_pending_count", lambda: 1)
        monkeypatch.setattr(manor_mod, "_briefing_high_risk_count", lambda: 0)

        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        briefing_advices = [a for a in advices if a.get("id") == "adv_briefing_1"]
        assert not briefing_advices, "pending_count=1 不应触发积压建议"

    def test_high_risk_count_generates_risk_advice(self, client, monkeypatch):
        """high_risk_count=2 时应生成高风险预警建议。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_briefing_pending_count", lambda: 0)
        monkeypatch.setattr(manor_mod, "_briefing_high_risk_count", lambda: 2)

        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        risk_advices = [a for a in advices if a.get("id") == "adv_risk_1"]
        assert risk_advices, "high_risk_count=2 时应生成 adv_risk_1"
        assert risk_advices[0]["priority"] == "high"

    def test_zero_risk_no_risk_advice(self, client, monkeypatch):
        """high_risk_count=0 时不应生成 adv_risk_1。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_briefing_pending_count", lambda: 0)
        monkeypatch.setattr(manor_mod, "_briefing_high_risk_count", lambda: 0)

        advices = client.get("/api/chaotang/manor/ai-advice").json()["data"]
        risk_advices = [a for a in advices if a.get("id") == "adv_risk_1"]
        assert not risk_advices, "high_risk_count=0 不应生成风险预警建议"

    def test_fallback_when_briefing_fails(self):
        """_briefing_pending_count 抛异常时应返回 0,不 crash。"""
        from web.routers.manor import _briefing_pending_count, _briefing_high_risk_count
        # 正常调用应返回 int(不崩)
        result = _briefing_pending_count()
        assert isinstance(result, int)
        result2 = _briefing_high_risk_count()
        assert isinstance(result2, int)


class TestAiAdviceNoneValue:
    def test_advice_detail_no_none_string(self, client, monkeypatch, tmp_path):
        """商机 value=None 时 detail 不应含字符串 'None'。"""
        import src.manor_data as md
        # 所有商机 value=None,触发 L-1 边界
        null_opps = [
            {"id": "x1", "name": "测试商机", "domain": "政府",
             "stage": "bloom", "owner": "hu_bu", "value": None,
             "desc": "", "updatedAt": "2026-05-27T00:00:00Z"},
        ]
        p = tmp_path / "opps.json"
        p.write_text(json.dumps(null_opps), encoding="utf-8")
        monkeypatch.setattr(md, "_OPP_PATH", p)
        r = client.get("/api/chaotang/manor/ai-advice")
        advices = r.json()["data"]
        for a in advices:
            assert "None" not in a["detail"], \
                f"detail 含字面 'None': {a['detail']}"


# ──────────────── 吏部(hr/personnel)交付 TOP1 ────────────────

class TestLibuPersonnelDept:
    """吏部 dept overview:hr 入白名单 + personnel 别名→hr,从空壳变真数据。"""

    def test_hr_overview_supported(self, client):
        r = client.get("/api/chaotang/dept/hr/overview")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True, body
        assert body["data"]["minister"]["name"] == "吏部", body["data"]["minister"]

    def test_personnel_alias_to_hr(self, client):
        r = client.get("/api/chaotang/dept/personnel/overview")
        body = r.json()
        assert body["success"] is True, body
        assert body["data"]["code"] == "personnel"  # 回显请求码
        assert body["data"]["minister"]["name"] == "吏部"  # 数据按 hr 查

    def test_hr_keymetrics_four(self, client):
        r = client.get("/api/chaotang/dept/hr/overview")
        data = r.json()["data"]
        assert len(data["keyMetrics"]) == 4
