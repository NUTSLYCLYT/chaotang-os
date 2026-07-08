"""§8 四档编排器路由验收：把"是否值得多 agent + 用哪档"变成确定性可观测决策。

对应 docs/chaotang_backend_grand_strategy_2026-06-10.md §8。
第一性原理：N 个 agent 只有 4 个理由能回本（多样性/对抗验证/分解/涌现），
否则退回 T-Solo（单 agent，省钱）。本测试锁住每档的触发条件 + 默认 T-Solo + reason 可观测。
"""

from __future__ import annotations

import pytest

from src.decree_swarm_router import TIERS, select_orchestration_tier


def _tier(cmd: str, **kw) -> str:
    return select_orchestration_tier(cmd, **kw)["tier"]


def test_tiers_enum_complete():
    assert TIERS == {"T-Solo", "T-Diverge", "T-Verify", "T-Decompose", "T-Reflect"}


def test_default_is_solo_not_all():
    """默认 T-Solo：可逆+单部门，编排无价值→不编排（Addy：别为编排而编排）。"""
    r = select_orchestration_tier("查一下这个客户的联系方式", decision_class="reversible")
    assert r["tier"] == "T-Solo"
    assert "reason" in r and r["reason"]
    assert r["value_thesis"] == "none"  # 没有能回本的理由


def test_irreversible_goes_verify():
    """不可逆/高 stakes → T-Verify（对抗验证三票）。"""
    assert _tier("和客户签这份合同对外发布", decision_class="irreversible") == "T-Verify"
    # 关键词也能独立触发（即使没传 decision_class）
    assert _tier("这个项目要不要直接上线发布") == "T-Verify"


def test_multidept_reversible_goes_diverge():
    """可逆但多部门有取舍 → T-Diverge（分歧涌现，不平均）。"""
    assert _tier("这个储能项目利润和增长怎么取舍", decision_class="reversible") == "T-Diverge"
    # 通过 involved_depts 计数触发
    assert _tier("评估这个方案", decision_class="reversible", involved_depts=["hu_bu", "bing_bu"]) == "T-Diverge"


def test_largescope_goes_decompose():
    """大范围扫描/审计/调研 → T-Decompose（分解并行覆盖）。"""
    assert _tier("全面审计一下所有蜂群的质量") == "T-Decompose"
    assert _tier("把这批客户逐一盘点梳理清单") == "T-Decompose"


def test_quality_sensitive_goes_reflect():
    """质量敏感产出（研发/复杂方案蜂群）→ T-Reflect（critic→修订环）。"""
    assert _tier("做这个 pack 的研发技术方案", entry_swarm="pack_rd") == "T-Reflect"
    assert _tier("生成这个功能的代码", entry_swarm="sdlc") == "T-Reflect"


def test_irreversible_beats_multidept():
    """优先级：不可逆 > 多部门——不可逆走 Verify，但 reason 标注叠加 Diverge。"""
    r = select_orchestration_tier(
        "签这个大额采购合同，涉及利润和增长取舍",
        decision_class="irreversible",
        involved_depts=["hu_bu", "bing_bu"],
    )
    assert r["tier"] == "T-Verify"
    assert "diverge" in r["reason"].lower()  # 叠加分歧档


def test_reason_and_value_thesis_observable():
    """每个决策必须带 reason + value_thesis（可观测，绝不静默——铁律2）。"""
    for cmd, kw in [
        ("查联系方式", {"decision_class": "reversible"}),
        ("签合同", {"decision_class": "irreversible"}),
        ("全面审计所有蜂群", {}),
    ]:
        r = select_orchestration_tier(cmd, **kw)
        assert r["tier"] in TIERS
        assert r["reason"]
        assert r["value_thesis"] in {"none", "diversity", "adversarial", "decomposition", "reflection"}
