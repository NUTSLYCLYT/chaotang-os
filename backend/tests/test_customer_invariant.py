"""customer_invariant 家族 · 高风险承诺护栏 — 回归尺子（确定性,不调 LLM）。

大神天才设计(2026-06-09)收敛的可复用内核第一个成员:把"客户能复述的成果"锁成确定性闸,
空对账源 fail-secure(Bezos失败路径③:空库默认放行=橡皮图章)。先在 storage 售后端到端跑通,
再一行 YAML 复制到 court/gongbu(Karpathy:跑通一个 baseline 再谈复用)。
"""

from __future__ import annotations

from src.step_assertions import _assert_high_stakes_claim_guarded as guard

CFG = {"authorizing_key": "warranty_facts", "signoff_marker": "需人工签字"}


def test_no_claim_passes():
    # 没做任何承诺 → 无需护栏
    out = "建议检查3号PACK单体压差,安排现场复测,记录温升曲线。"
    ok, _ = guard(out, CFG, {})
    assert ok


def test_payout_promise_without_source_or_signoff_fails():
    # 凭空向客户承诺赔付,无质保源、无签字门 → fail-secure 拦下(单向门)
    out = "经判断为产品缺陷,我方承担全部责任,免费更换整组PACK并全额赔付客户损失。"
    ok, msg = guard(out, CFG, {})
    assert not ok
    assert "fail-secure" in msg or "凭空" in msg


def test_payout_with_signoff_marker_passes():
    # 承诺但挂了人工签字门 → 放行(不可逆决策交人工)
    out = "是否赔付需核实质保条款后由售后负责人书面确认（需人工签字），现场先断电撤离。"
    ok, _ = guard(out, CFG, {})
    assert ok


def test_payout_with_warranty_authorization_passes():
    # 有质保授权源背书 → 承诺有据,放行
    out = "依据质保条款,本次单体故障在保,免费更换。"
    ok, _ = guard(out, CFG, {"warranty_facts": {"in_warranty": True, "term": "3年"}})
    assert ok


def test_empty_source_is_fail_secure_not_open():
    # 核心:空对账源时必须 fail(不是放行),否则退化成橡皮图章
    out = "包赔到底,你放心。"
    ok, _ = guard(out, CFG, {"warranty_facts": None})  # 显式空源
    assert not ok


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-q"]))
