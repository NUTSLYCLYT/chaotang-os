"""T1 验收：六部 council 人格补全 + 4 结构化分歧对（让"户部vs兵部分歧"有真实人格根）。

对应方略 docs/chaotang_backend_grand_strategy_2026-06-10.md §2、§6 T1。
铁律：分歧建在沙子上时 conflicts 字段会沦为模板话术（Deming theater）。
本测试锁住：① 核心六部 + 三辅有专属人格（非回退通用） ② 每部人格带本域铁律关键词
③ 4 分歧对结构正确且可无序匹配 ④ 对立两部的立场倾向真的相反（户部认现金红线、兵部认增长）。
"""

from __future__ import annotations

import pytest

from src.minister_personas import (
    CONFLICT_AXES,
    DEPARTMENT_ANTI_HALLUCINATION_CLAUSE,
    MINISTER_PERSONAS,
    conflict_axis_of,
    council_prompt,
)


def test_six_ministries_share_the_same_anti_hallucination_clause():
    six = ["hu_bu", "li_bu", "li_bu_rites", "bing_bu", "xing_bu", "gong_bu"]
    for code in six:
        persona = MINISTER_PERSONAS[code]
        assert DEPARTMENT_ANTI_HALLUCINATION_CLAUSE in persona
        assert "超出本部门职责范围" in persona
        assert "[missing]" in persona

# 方略确立的 canonical council 人格集（六部 6 + 三辅 3 + 太医 1）
CANONICAL_MINISTERS = {
    "hu_bu",
    "gong_bu",
    "bing_bu",
    "xing_bu",
    "li_bu_rites",
    "li_bu",  # 六部
    "jin_yi_wei",
    "qin_tian_jian",
    "scribe",  # 三辅
    "tai_yi_yuan",  # 太医（独立）
}

# 每部人格必须出现的"本域铁律关键词"——证明人格有根、不是通用模板
DOMAIN_KEYWORDS = {
    "hu_bu": ["现金", "毛利"],  # 户部只认现金/毛利红线
    "bing_bu": ["增长", "竞品"],  # 兵部只认增长/竞品身位
    "gong_bu": ["交付", "冲突"],  # 工部只认可交付性/接口冲突
    "xing_bu": ["可签", "合规"],  # 刑部只认可签/合规红线
    "li_bu_rites": ["对外", "证据"],  # 礼部只认对外表达且须证据支撑
    "tai_yi_yuan": ["健康", "就医"],  # 太医只给非诊断提示、涉诊断必建议就医
}


def test_canonical_ministers_all_have_dedicated_persona():
    """核心六部 + 三辅 + 太医 都必须有专属人格（不回退通用）。"""
    missing = CANONICAL_MINISTERS - set(MINISTER_PERSONAS)
    assert not missing, f"缺专属 council 人格（会回退通用模板，分歧无根）：{missing}"


@pytest.mark.parametrize("code,keywords", DOMAIN_KEYWORDS.items())
def test_persona_carries_domain_iron_law(code: str, keywords: list[str]):
    """每部人格必须带本域铁律关键词——让该部立场有根，分歧才真。"""
    persona = MINISTER_PERSONAS[code]
    for kw in keywords:
        assert kw in persona, f"{code} 人格缺本域铁律关键词『{kw}』，分歧会沦为模板话术"


def test_council_prompt_returns_specialized_not_generic():
    """council_prompt 对六部 code 必须返回专属人格，不是传入的通用 default。"""
    generic = "GENERIC_FALLBACK_TEMPLATE"
    for code in ["hu_bu", "bing_bu", "gong_bu", "xing_bu", "li_bu_rites"]:
        assert council_prompt(code, generic) != generic, f"{code} 仍回退通用模板"
    # 未登记的 code 仍应回退（保持现有行为不变）
    assert council_prompt("unknown_dept", generic) == generic


def test_conflict_axes_structure():
    """4 个结构化分歧对：字段齐全 + minister code 合法。"""
    assert len(CONFLICT_AXES) == 4, "方略确立 4 个分歧对（户兵/工户/刑礼/卫监）"
    for ax in CONFLICT_AXES:
        assert {"axis", "a", "b", "tension"} <= set(ax), f"分歧对字段不全：{ax}"
        # 分歧对两端必须是有专属人格的部门（否则分歧无根）
        assert ax["a"] in MINISTER_PERSONAS, f"分歧对 a 端 {ax['a']} 无人格"
        assert ax["b"] in MINISTER_PERSONAS, f"分歧对 b 端 {ax['b']} 无人格"


def test_conflict_axis_of_unordered_match():
    """conflict_axis_of 无序匹配；非对立对返回 None。"""
    ax = conflict_axis_of("hu_bu", "bing_bu")
    assert ax is not None and ax["tension"] == "利润 vs 增长"
    # 反序也命中
    assert conflict_axis_of("bing_bu", "hu_bu") == ax
    # 非结构化对立对
    assert conflict_axis_of("hu_bu", "scribe") is None


def test_the_four_canonical_axes_present():
    """锁死 4 对 canonical 分歧对（接 edict.v2.conflicts[].axis 合法取值）。"""
    pairs = {frozenset((ax["a"], ax["b"])) for ax in CONFLICT_AXES}
    expected = {
        frozenset(("hu_bu", "bing_bu")),  # 利润 vs 增长
        frozenset(("gong_bu", "hu_bu")),  # 可交付性 vs 预算
        frozenset(("xing_bu", "li_bu_rites")),  # 合规边界 vs 对外表达
        frozenset(("jin_yi_wei", "qin_tian_jian")),  # 既成事实 vs 趋势推演
    }
    assert pairs == expected
