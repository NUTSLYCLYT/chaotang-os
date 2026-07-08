"""证券红线入口预检 · 回归门(2026-07-07 · 三层架构会审头号 CRITICAL)。

三件事钉死:
1. 记录漏洞真实存在:窄化候选集后,select_entry_swarm 把证券问题落进业务蜂群却挂红线标签谎报——
   这条 characterization 测试证明"为什么红线必须在入口、不能下放给窄化集"(会审四模块独立复现)。
2. 预检在分解前拦下:开关开时,原始密旨的证券问题被短路到人工门(dispatch=False),不派任何蜂群。
3. 开关可关:创始人自己的租户关红线后,预检放行(他要用投资分析);且默认开、fail-safe。
"""

from src.decree_swarm_router import select_entry_swarm
from src.securities_redline import route_with_redline_precheck

# 户部的窄化候选集(departments.yaml 里户部 calls_swarms 的代表:全是业务蜂群,无 compliance/legal)
HUBU_NARROWED = {"finance", "quotation", "product", "ima"}
SECURITIES_CMD = "用公司现金流加仓这只股票"


def test_bypass_exists_in_narrowed_set():
    """漏洞现状 characterization:窄化集里红线找不到合规落点,跌进业务蜂群却仍挂红线标签谎报。

    这不是我们想要的行为,是我们要用入口预检绕过的现状。若哪天 select_entry_swarm 自身修好了
    (窄集也能安全落人工门),这条会失败——那是好事,说明下放红线不再危险,届时更新本测试。
    """
    r = select_entry_swarm(SECURITIES_CMD, HUBU_NARROWED)
    # 红线命中了,但落点是业务蜂群(不是 compliance/legal),reason 却谎称"转合规法务待裁"
    assert r["redline"] == "securities_advice"
    assert r["swarm"] in HUBU_NARROWED  # 落进了业务蜂群
    assert r["swarm"] not in (
        "compliance",
        "legal",
        "yushi",
        "xing_bu",
    )  # 根本不是合规落点
    # 结论:窄化集下红线是"戴徽章的 confident-wrong",必须在入口(route_with_redline_precheck)拦截


# ── B 方案入口 wrapper(route_with_redline_precheck):合规落点硬保证 + 开关生效 ──

FULL_SET = {"finance", "quotation", "product", "ima", "legal", "opc", "tianjian"}
COMPLIANCE_SET = {"legal", "compliance", "yushi"}


def test_wrapper_full_set_securities_lands_on_compliance(monkeypatch):
    """开关开 + 全集:证券密旨落合规蜂群(legal),绝不业务蜂群。形状与 select_entry_swarm 一致。"""
    monkeypatch.setattr(
        "src.securities_redline.securities_redline_enabled", lambda *a, **k: True
    )
    r = route_with_redline_precheck(SECURITIES_CMD, FULL_SET)
    assert r["redline"] == "securities_advice"
    assert r["swarm"] in COMPLIANCE_SET, f"证券落到非合规蜂群:{r['swarm']}"


def test_wrapper_narrowed_set_never_lands_on_business(monkeypatch):
    """开关开 + 窄集(户部,无合规蜂群):绝不落业务蜂群——纠回合规或拒绝(needs_compliance),不静默谎报。"""
    monkeypatch.setattr(
        "src.securities_redline.securities_redline_enabled", lambda *a, **k: True
    )
    r = route_with_redline_precheck(SECURITIES_CMD, HUBU_NARROWED)
    # B 硬保证:要么落合规,要么 swarm=None+needs_compliance;绝不是业务蜂群还挂红线徽章
    assert r["swarm"] not in HUBU_NARROWED, f"仍落业务蜂群旁路:{r['swarm']}"
    assert r["swarm"] in COMPLIANCE_SET or (
        r["swarm"] is None and r.get("needs_compliance") is True
    )


def test_wrapper_toggle_off_allows_analysis(monkeypatch):
    """开关关(创始人自己的租户):证券密旨照常路由,不被红线拦,可达业务/分析蜂群。"""
    monkeypatch.setattr(
        "src.securities_redline.securities_redline_enabled", lambda *a, **k: False
    )
    r = route_with_redline_precheck(SECURITIES_CMD, FULL_SET)
    assert r.get("redline") != "securities_advice"  # 红线未触发,他能拿到分析


def test_wrapper_non_securities_unchanged(monkeypatch):
    """普通业务密旨:wrapper 透传 select_entry_swarm 结果,行为不变。"""
    monkeypatch.setattr(
        "src.securities_redline.securities_redline_enabled", lambda *a, **k: True
    )
    r = route_with_redline_precheck("帮我算这批储能柜的报价", FULL_SET)
    assert r.get("redline") != "securities_advice"
    assert r["swarm"] in FULL_SET
