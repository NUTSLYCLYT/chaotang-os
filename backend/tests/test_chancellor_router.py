"""丞相顶层选择器 · 回归门(2026-07-07 · 三层递归架构第2步·顶层)。

钉死:单域→direct、跨域→军机处选尚书子集、force_mode 覆盖、selected_ministries 带 allowed_swarms 契约、
证券红线不在 decide 里重跑(已在入口第0步b)。
"""

from src.chancellor_router import (
    JUNJICHU_MIN_MINISTRIES,
    decide,
    select_dept_swarm,
)

FULL_SET = {"finance", "quotation", "product", "legal", "opc", "tianjian", "sourcing"}


def test_single_domain_direct_action_goes_direct():
    """单域直办密旨(整理/摘要类轻量措辞)→ direct,选一个入口蜂群,1 个尚书。"""
    d = decide("帮我整理这批储能柜的报价摘要", FULL_SET)
    assert d["mode"] == "direct"
    assert d["direct_swarm"] is not None
    assert len(d["selected_ministries"]) == 1
    assert d["selected_ministries"][0]["code"] == "hubu"


def test_evidence_gap_wording_convenes_junjichu():
    """收敛后有意变更(2026-07-14,阶段1):"帮我算这批储能柜的报价"无直办动词且带证据缺口,
    loop 口径(黄金案例钦定)判 cluster → junjichu。旧 decide 判 direct 是弱关键词引擎的漏判。"""
    d = decide("帮我算这批储能柜的报价", FULL_SET)
    assert d["mode"] == "junjichu"
    assert any(m["code"] == "hubu" for m in d["selected_ministries"])


def test_cross_domain_convenes_junjichu():
    """跨域密旨(报价+合同违约+交付)→ 开军机处,≥2 尚书,含刑部+户部。"""
    d = decide("帮我算报价并核对合同违约风险再排个交付计划", FULL_SET)
    assert d["mode"] == "junjichu"
    codes = {m["code"] for m in d["selected_ministries"]}
    assert len(codes) >= JUNJICHU_MIN_MINISTRIES
    assert "xingbu" in codes and "hubu" in codes


def test_selected_ministries_carry_allowed_swarms():
    """每个选中尚书带 allowed_swarms(=该部 calls_swarms),是给中层尚书的有界集契约。"""
    d = decide("帮我算报价并核对合同违约风险再排个交付计划", FULL_SET)
    for m in d["selected_ministries"]:
        assert isinstance(m["allowed_swarms"], list)
        assert m["allowed_swarms"], f"{m['code']} 无 allowed_swarms,尚书无从选起"


def test_force_mode_direct_overrides():
    """force_mode='direct':即使跨域也不开军机处(人选优先)。"""
    d = decide("帮我算报价并核对合同违约风险再排交付", FULL_SET, force_mode="direct")
    assert d["mode"] == "direct"


def test_force_mode_junjichu_overrides():
    """force_mode='junjichu':即使单域也开军机处。"""
    d = decide("帮我算这批储能柜的报价", FULL_SET, force_mode="junjichu")
    assert d["mode"] == "junjichu"


def test_qintianjian_trigger_passed_through():
    """钦天监触发器透传(丞相调一次三层读的镜片信号)。"""
    d = decide("帮我算这批储能柜的报价", FULL_SET)
    assert "qintianjian_trigger" in d


def test_securities_not_rehandled_in_decide():
    """证券红线已在入口(第0步b)处理,decide 不再重跑红线——直接按域路由,不下放窄集(防旁路)。

    decide 收到证券密旨时,应像普通密旨一样按打分走(红线由 route_with_redline_precheck 在更上游拦)。
    这条钉住"红线只在入口一次、不经三层分解"的架构定律。
    """
    d = decide("用现金流加仓这只股票", FULL_SET)
    # decide 本身不含证券红线逻辑:不会返回 redline 字段,按普通密旨处理
    assert "redline" not in d
    assert d["mode"] in ("direct", "junjichu")


# ── 中层尚书 select_dept_swarm:递归选择器 + 弃权 + 窄集不跑红线 ──

HUBU = {
    "code": "hubu",
    "name": "户部",
    "allowed_swarms": ["finance", "quotation", "product"],
}


def test_dept_confident_hit_selects():
    """尚书在本部蜂群里自信命中 → 选中,不弃权。"""
    r = select_dept_swarm("帮我出一份报价单", HUBU)
    assert r["abstain"] is False
    assert r["swarm"] in HUBU["allowed_swarms"]


def test_dept_no_hit_abstains_not_forces():
    """本部无自信命中 → 弃权(abstain=True),不硬选字母序错兄弟蜂群(会审 HIGH)。"""
    r = select_dept_swarm("帮我写一首关于月亮的诗", HUBU)
    assert r["abstain"] is True
    assert r["swarm"] is None


def test_dept_narrowed_set_no_securities_bypass():
    """窄集不跑证券红线(第0步b 已在入口拦):证券密旨进到尚书层,绝不落业务蜂群挂红线徽章旁路。

    apply_securities_redline=False → 证券词在窄集不触发红线降级;要么普通命中要么弃权,
    绝不出现 select_entry_swarm 那种"落 ima 却谎称转合规"的旁路。
    """
    r = select_dept_swarm("用现金流加仓这只股票", HUBU)
    assert r.get("redline") != "securities_advice"  # 窄集没有红线旁路
    # 落业务蜂群或弃权都行,但绝不是"戴红线徽章的业务蜂群"
    assert not (r.get("swarm") in HUBU["allowed_swarms"] and r.get("redline"))


def test_dept_empty_swarms_abstains():
    """空 allowed_swarms → 弃权,不崩。"""
    r = select_dept_swarm(
        "任意任务", {"code": "x", "name": "某部", "allowed_swarms": []}
    )
    assert r["abstain"] is True and r["swarm"] is None


# ── 丞相天才下一步 genius_next_step:召回接地 or 诚实弃权 ──


def test_genius_next_step_abstains_when_no_recall(monkeypatch):
    """无召回(新租户/无历史)→ 弃权发 needs_evidence,不编造。"""

    class _EmptyRag:
        def search(self, *a, **k):
            return []

    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: _EmptyRag())
    from src.chancellor_router import genius_next_step

    steps = genius_next_step("帮我算个报价", [{"code": "hubu", "name": "户部"}])
    assert len(steps) == 1
    assert steps[0]["grounded"] is False
    assert steps[0]["confidence"] == "needs_evidence"
    assert steps[0]["citations"] == []


def test_genius_next_step_grounded_with_citation(monkeypatch):
    """有召回 → 带 source 引用 + grounded=True,天才建议接地可核。"""

    class _Rag:
        def search(self, *a, **k):
            return [{"source": "case_archive:储能报价_20260601.json", "content": "历史成交毛利18%"}]

    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: _Rag())
    from src.chancellor_router import genius_next_step

    steps = genius_next_step("帮我算个储能报价", [{"code": "hubu", "name": "户部"}])
    assert steps[0]["grounded"] is True
    assert steps[0]["citations"] == ["case_archive:储能报价_20260601.json"]
    assert "户部" in steps[0]["suggestion"]
