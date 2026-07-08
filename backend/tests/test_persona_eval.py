"""tests/test_persona_eval.py — RAG 强制门 + 大神升席棘轮(B 的离线可验证内核)。"""
from __future__ import annotations

from src import persona_eval as pe
from src import persona_registry as pr


# ── RAG 接地强制门 ───────────────────────────────────────────────────────────

def test_judge_persona_always_concludes():
    g = pr.gate_conclusion("taleb-perspective", rag_hit=False)
    assert g["can_conclude"] is True and g["mode"] == "judge"


def test_advisor_blocked_without_rag_hit():
    # deming 是观点席(rag_required);没命中 RAG → 不准下结论
    g = pr.gate_conclusion("deming", rag_hit=False)
    assert g["can_conclude"] is False and g["mode"] == "advisor_view_only"
    assert "不可下结论" in g["reason"]


def test_advisor_allowed_when_rag_hits():
    g = pr.gate_conclusion("deming", rag_hit=True)
    assert g["can_conclude"] is True and g["mode"] == "advisor_grounded"


def test_advisor_promoted_by_eval_can_conclude():
    g = pr.gate_conclusion("deming", rag_hit=False, eval_passed=True)
    assert g["can_conclude"] is True and g["mode"] == "judge"


def test_unknown_persona_cannot_conclude():
    g = pr.gate_conclusion("no-such-god", rag_hit=True)
    assert g["can_conclude"] is False and g["mode"] == "unknown"


# ── 升席棘轮(纯函数)─────────────────────────────────────────────────────────

def test_promotion_requires_cases():
    assert pr_promote(None, 0)["promote"] is False           # 无判例
    assert pr_promote(9.0, 0)["promote"] is False            # 有分但无判例
    assert pr_promote(9.0, 2)["promote"] is False            # 判例不足 3


def test_promotion_requires_passing_score():
    assert pe.promotion_gate("x", 7.0, 5)["promote"] is False  # 分不够
    assert pe.promotion_gate("x", 7.5, 5)["promote"] is True   # 达标
    assert pe.promotion_gate("x", 9.0, 3)["promote"] is True


def test_promotion_reject_carries_reason():
    g = pe.promotion_gate("x", 6.0, 5)
    assert g["promote"] is False and "未过判例" in g["reason"]


def pr_promote(score, n):
    return pe.promotion_gate("x", score, n)


# ── 判例加载 + 评分就绪诊断 ──────────────────────────────────────────────────

def test_load_seed_cases():
    cases = pe.load_cases("deming")
    assert len(cases) >= 3
    assert all("prompt" in c and "reference" in c and "must_not" in c for c in cases)


def test_score_persona_offline_needs_gateway():
    r = pe.score_persona("deming")
    assert r["scored"] is False and "needs_gateway" in r["reason"]
    assert pe.score_persona("no-cases-persona")["scored"] is False


def test_eval_readiness_surfaces_personas_without_cases():
    rd = pe.eval_readiness()
    # deming/charity-majors 有种子判例
    assert "deming" in rd["with_cases"]
    assert "charity-majors" in rd["with_cases"]
    # 绝大多数大神还没判例 → 升判官席前的第一道坎被照出来
    assert len(rd["without_cases"]) > 0
    assert 0.0 <= rd["coverage"] <= 1.0
