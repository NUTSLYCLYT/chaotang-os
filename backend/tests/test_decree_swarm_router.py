"""密旨意图路由验证 — 锁住"储能密旨不再盲投 ai_ops"这条核心修复。

回归就绪度审计的根因:chaotang.py 盲默认 ai_ops 让储能密旨答非所问、quality 2.5 分。
"""

from __future__ import annotations

from src.decree_swarm_router import (
    DEFAULT_SWARM,
    is_light_health_check,
    select_entry_swarm,
)

# 模拟编排器注册的可用蜂群(对齐 config/swarm_orchestrator.yaml)。
AVAILABLE = {
    "haolong",
    "opc",
    "product",
    "quotation",
    "ai_ops",
    "sdlc",
    "ima",
    "pack_rd",
    "finance",
    "legal",
    "xiaohongshu",
    "jinyiwei",
    "tianjian",
    "libu_personnel",
    "lipu",
}


def test_eight_bu_natural_language_routing():
    """上书房说人话能路由到新补的四部(钦天监A2收官)。"""
    cases = {
        "帮我做竞品情报,盯一下欣旺达动态": "jinyiwei",
        "预测下半年储能价格走势": "tianjian",
        "招聘一个PACK工艺工程师,设计面试题": "libu_personnel",
        "把这份素材撰稿成公众号推文": "lipu",
    }
    for cmd, expected in cases.items():
        r = select_entry_swarm(cmd, AVAILABLE)
        assert r["swarm"] == expected, f"{cmd} → {r['swarm']} (期望 {expected})"


def test_storage_decree_routes_to_opc_not_ai_ops():
    """核心回归:储能项目决策密旨 → opc,绝不再进 ai_ops。"""
    r = select_entry_swarm("判断 100MWh 冷库储能项目是否推进", AVAILABLE)
    assert r["swarm"] == "opc", r
    assert r["matched"] is True
    assert r["swarm"] != "ai_ops"


def test_ai_ops_only_when_truly_ops_intent():
    """ai_ops 只在密旨真关于运维/蜂群健康时才被选。"""
    r = select_entry_swarm("巡检一下蜂群质量和系统健康,排查异常", AVAILABLE)
    assert r["swarm"] == "ai_ops", r
    assert r["matched"] is True


def test_intent_mappings():
    cases = {
        "帮我生成这单的报价单": "quotation",
        "做个获客线索跟进计划": "haolong",
        "财务现金流和毛利分析": "finance",
        "这个合同条款有没有合规风险": "legal",
        "产品路线图功能优先级排序": "product",
    }
    for cmd, expect in cases.items():
        r = select_entry_swarm(cmd, AVAILABLE)
        assert r["swarm"] == expect, (cmd, r)


def test_internal_connectivity_trace_routes_to_ai_ops_before_business_default():
    r = select_entry_swarm(
        "TRACE-abc 请后端蜂群做一次低风险联通自检，只返回链路健康、会话ID，不触碰真实产线资产",
        AVAILABLE,
    )
    assert r["swarm"] == "ai_ops", r
    assert r["matched"] is True


def test_light_health_check_is_only_for_connectivity_smoke():
    assert is_light_health_check(
        "TRACE-abc 请后端蜂群做一次低风险联通自检，只返回链路健康、会话ID，不触碰真实产线资产"
    )
    assert not is_light_health_check("巡检一下蜂群质量和系统健康,排查异常")
    assert not is_light_health_check("客户线索：华东客户咨询 5MWh 电池储能项目")


def test_high_specific_business_buckets_outrank_opc_battery_terms():
    cases = {
        "客户线索：华东客户咨询 5MWh 电池储能项目": "haolong",
        "给这个 100MWh 电池储能项目出正式报价单": "quotation",
        "审一下储能电池采购合同和违约条款": "legal",
        "PACK 电池包 BMS 模组结构研发设计复盘": "pack_rd",
    }
    for cmd, expect in cases.items():
        r = select_entry_swarm(cmd, AVAILABLE)
        assert r["swarm"] == expect, (cmd, r)
        assert r["matched"] is True


def test_no_intent_match_uses_explicit_default_not_ai_ops():
    """无意图命中 → 显式默认(opc),绝不盲投 ai_ops,且 reason 可见。"""
    r = select_entry_swarm("今天天气怎么样随便聊聊", AVAILABLE)
    assert r["swarm"] == DEFAULT_SWARM == "opc", r
    assert r["matched"] is False
    assert "no_intent_match" in r["reason"]
    assert r["swarm"] != "ai_ops"


def test_default_unavailable_falls_back_without_silent_ai_ops():
    """默认蜂群不可用时,退化到其它可用蜂群并标注,不静默落 ai_ops。"""
    avail = {"ai_ops", "finance"}
    r = select_entry_swarm("随便一句没有意图的话", avail)
    assert r["swarm"] == "finance", r  # 排除 ai_ops 优先
    assert r["matched"] is False
    assert r["swarm"] != "ai_ops"


def test_empty_available_returns_empty_not_crash():
    r = select_entry_swarm("任意密旨", set())
    assert r["swarm"] == ""
    assert r["matched"] is False


# ── 证券投资/个股交易建议 = 合规红线（2026-06-21 路由治理）──
def test_securities_position_advice_not_opc_not_finance():
    cases = [
        "户部评估:三花智控当前仓位是否该减",
        "三花智控当前仓位是否该减",
        "这只股票能不能买",
        "帮我看下是否该减仓",
    ]
    for cmd in cases:
        r = select_entry_swarm(cmd, AVAILABLE)
        assert r["swarm"] not in ("opc", "finance"), (cmd, r)
        assert r["swarm"] == "legal", (cmd, r)
        assert r["matched"] is True, (cmd, r)
        assert ("securities" in r["reason"].lower()) or ("红线" in r["reason"]), (
            cmd,
            r,
        )


def test_securities_redline_falls_back_safer_not_opc_when_no_legal():
    r = select_entry_swarm("这只股票该不该减仓", {"opc", "ai_ops", "finance"})
    assert r["swarm"] not in ("opc", "ai_ops"), r
    assert ("securities" in r["reason"].lower()) or ("红线" in r["reason"]), r


def test_corporate_finance_not_misfired_as_securities():
    r = select_entry_swarm("财务现金流和毛利分析", AVAILABLE)
    assert r["swarm"] == "finance", r


def test_normal_opc_unaffected_by_securities_rule():
    r = select_entry_swarm("判断 100MWh 冷库储能项目是否推进", AVAILABLE)
    assert r["swarm"] == "opc", r


def test_securities_reframe_declines_advice_and_requires_signoff():
    """reframe:拒绝给买卖建议、要求人工裁决、留痕,且提供有价值的风险奏折框架。"""
    from src.decree_swarm_router import securities_redline_reframe

    r = securities_redline_reframe("户部评估:三花智控当前仓位是否该减")
    assert r["redline"] == "securities_advice"
    assert r["human_signoff_required"] is True
    assert r["archive_required"] is True
    # 拒绝给方向性交易建议(不得出现"建议减仓/建议买入"等)
    blob = str(r)
    for banned in (
        "建议减仓",
        "建议加仓",
        "建议买入",
        "建议卖出",
        "应该减仓",
        "可以买入",
    ):
        assert banned not in blob, banned
    # 有价值:奏折框架含公开指标+信息缺口+裁决路径
    frame = r["memorial_frame"]
    assert (
        frame["可整理(公开可验证)"] and frame["信息缺口(需你补)"] and frame["裁决路径"]
    )


def test_securities_reframe_end_to_end_from_router():
    """端到端:故障输入 → 路由判红线 → 出风险奏折,而非 opc 无效产出。"""
    from src.decree_swarm_router import securities_redline_reframe, select_entry_swarm

    cmd = "户部评估:三花智控当前仓位是否该减"
    route = select_entry_swarm(cmd, AVAILABLE)
    assert route.get("redline") == "securities_advice"
    assert route["swarm"] != "opc"
    reframe = securities_redline_reframe(cmd)
    assert reframe["human_signoff_required"] is True
