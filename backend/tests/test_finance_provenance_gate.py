"""finance number_provenance 闸 — 回归尺子（确定性,不调 LLM）。

蜂群满意度审计(2026-06-09)核实:finance 的"每个数字必须回链 verified_facts 否则 hard_fail"
招牌闸已挂进 4 个 step,但 build_verified_facts 零调用 → ctx.verified_facts 永远空 →
口述编的数字全部 PASS(绿灯造假)。本测试给这把从没被测过的闸上尺子:证明喂了 facts 就能
抓编数,并锁死 require_facts 两种模式,为"通电"提供可回归的地基。
"""

from __future__ import annotations

from src.step_assertions import _assert_disclaimer_when_unverified, _assert_number_provenance

# 已验证事实:某公司 2023 营收 1.2 亿(120000000),毛利率 18%。
# _allowed_values 会按 万/亿 缩放,故 "1.2亿" / "12000万" / "120000000" 都算可溯源。
FACTS = {"periods": {"2023": {"营收": 120000000, "毛利率": 18}}}


def test_sourced_number_passes():
    out = "2023 年营收 1.2 亿元,毛利率 18%,经营稳健。"
    ok, msg = _assert_number_provenance(out, {"facts_key": "verified_facts"}, {"verified_facts": FACTS})
    assert ok, msg


def test_fabricated_number_hard_fails():
    # 1.5亿 不在 facts → 应判幻觉、整段作废
    out = "2023 年营收 1.5 亿元(实为编造),利润率高达 35%。"
    ok, msg = _assert_number_provenance(out, {"facts_key": "verified_facts"}, {"verified_facts": FACTS})
    assert not ok
    assert "无来源" in msg or "幻觉" in msg


def test_no_facts_passthrough_is_current_gap():
    # 当前默认:无 facts → 放行。这正是"绿灯造假"的根源,本测试锁住它好让"通电"有 before/after。
    out = "营收 9.9 亿元,净利 5 亿元。"  # 全编,但无 facts 时仍放行
    ok, _ = _assert_number_provenance(out, {"facts_key": "verified_facts"}, {})
    assert ok, "记录现状:无 facts 默认放行(非 fail-secure)"


def test_require_facts_makes_it_fail_secure():
    # 产品决策为 fail-secure 时:无 facts → 拒绝出数(GIGO)。证明该模式已可用,翻 require_facts 即生效。
    out = "营收 9.9 亿元,净利 5 亿元。"
    ok, msg = _assert_number_provenance(out, {"facts_key": "verified_facts", "require_facts": True}, {})
    assert not ok
    assert "拒绝出数" in msg or "GIGO" in msg


# ── disclaimer_when_unverified 闸(产品决策=标注未核实): number_provenance 的互补闸 ──
def test_disclaimer_required_when_no_facts():
    # 无审计源 + 无免责标注 → 绿灯造假,必须 hard_fail
    out = "营收 9.9 亿元,净利 5 亿元,建议立即扩产。"
    ok, msg = _assert_disclaimer_when_unverified(out, {"facts_key": "verified_facts"}, {})
    assert not ok
    assert "绿灯造假" in msg or "未标注" in msg


def test_disclaimer_present_passes():
    # 无审计源但诚实标注 → 放行
    out = "营收 9.9 亿元(用户口述,未经审计验证),关键决策前请提供审计源核实。"
    ok, _ = _assert_disclaimer_when_unverified(out, {"facts_key": "verified_facts"}, {})
    assert ok


def test_disclaimer_skipped_when_facts_present():
    # 有 facts → 由 number_provenance 抓编数,本闸放行,不强制免责
    out = "2023 年营收 1.2 亿元。"
    ok, _ = _assert_disclaimer_when_unverified(out, {"facts_key": "verified_facts"}, {"verified_facts": FACTS})
    assert ok


# ── disclaimer 闸旁路回归(2026-06-09 安全审查发现:中文数字/成语/英文金额绕过) ──
import pytest  # noqa: E402


@pytest.mark.parametrize(
    "out",
    [
        "营收一点五亿，净利三千万，建议立即扩产。",  # 中文数字
        "竞品月销十万件，搜索量暴涨三倍。",  # 中文数字 + 倍
        "营收破百亿，市场规模过亿，毛利三成。",  # 量级成语 + 成
        "FY24 revenue grew to 1.5B this year.",  # 英文金额
    ],
)
def test_disclaimer_blocks_non_ascii_quant_claims(out):
    # 无审计源 + 无免责标注,且为实质数字断言(非阿拉伯数字形式)→ 必须 hard_fail,不得绕过
    ok, msg = _assert_disclaimer_when_unverified(out, {"facts_key": "verified_facts"}, {})
    assert not ok, f"旁路未拦: {out} → {msg}"


@pytest.mark.parametrize(
    "out",
    [
        "本议案需进一步核实数据后再议。",  # 纯流程,无实质断言
        "请汇报三件事，分三步推进，三天内复测并归档。",  # 含中文数字但属流程
        "千万别漏检，万一压差异常需立即断电。",  # "千万/万一"成语,非量级断言
    ],
)
def test_disclaimer_does_not_misfire_on_process_text(out):
    # 诚实的纯流程文本不得被错拦(误伤会逼用户绕过闸 → 闸形同虚设)
    ok, msg = _assert_disclaimer_when_unverified(out, {"facts_key": "verified_facts"}, {})
    assert ok, f"误伤诚实流程文本: {out} → {msg}"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
