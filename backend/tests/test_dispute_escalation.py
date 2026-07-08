"""tests/test_dispute_escalation.py — 异议上诉阶梯(御史→丞相→皇帝,钦天监参谋)。"""
from src import dispute_escalation as de


def test_no_dispute_ends_at_yushi():
    r = de.escalation_step("green", "green")
    assert r["rung"] == "御史定灯" and r["decider"] == "rules" and r["needs_signoff"] is False


def test_dispute_goes_to_chancellor_first():
    # 部门想 green,御史 red → 异议 → 先丞相
    r = de.escalation_step("green", "red")
    assert r["rung"] == "丞相调解" and r["decider"] == "chancellor"


def test_hard_veto_skips_chancellor_to_emperor():
    r = de.escalation_step("green", "black", hard_veto=True)
    assert r["rung"] == "皇帝终审" and r["decider"] == "emperor" and r["needs_signoff"] is True


def test_chancellor_resolved_closes():
    r = de.escalation_step("green", "yellow", chancellor_resolved=True)
    assert r["rung"] == "已解·丞相" and r["needs_signoff"] is False


def test_chancellor_fails_to_emperor():
    r = de.escalation_step("green", "red", chancellor_resolved=False)
    assert r["rung"] == "皇帝终审" and r["needs_signoff"] is True


def test_irreversible_forces_signoff_and_qintianjian():
    r = de.escalation_step("green", "green", irreversible=True)
    assert r["needs_signoff"] is True and r["qintianjian_engaged"] is True


def test_qintianjian_can_engage_anytime():
    r = de.escalation_step("green", "red", qintianjian=True)
    assert r["qintianjian_engaged"] is True
