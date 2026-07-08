"""tests/test_live_swarm.py — 军机处通电(mock→真LLM多智能体,开关驱动+兜底)。"""
from __future__ import annotations

from src import swarm_execution_loop as sel

_EDICT = {"original_question": "这份储能合同能签吗", "refined_edict": "审合同风险",
          "known_facts": [], "unknown_gaps": []}


def test_default_is_deterministic_rule():
    # 默认(live 关)= 既有规则,行为不变
    r = sel.run_department_swarm("xingbu_legal_risk_swarm", _EDICT, "MIXED")
    assert r["swarm_id"] == "xingbu_legal_risk_swarm"
    assert r["source_label"] == "MIXED"          # 规则路径不升级来源
    assert "position" in r and "risks" in r


def test_live_uses_llm_position():
    mock = lambda s, u: '{"position":"复核","summary":"合同验收条款有风险","key_findings":["验收模糊"],"missing_evidence":["验收标准"],"risks":[{"risk":"尾款拖欠","severity":"高","reason":"验收无标准"}],"recommended_next_action":"补验收条款","confidence":"高"}'  # noqa: E731
    r = sel.run_department_swarm("xingbu_legal_risk_swarm", _EDICT, "MIXED", call_fn=mock)
    assert r["position"] == "复核" and r["confidence"] == "高"
    assert r["source_label"] == "LIVE_SWARM"     # 真 LLM 出的立场,来源升级
    assert r["risks"][0]["severity"] == "高"


def test_live_falls_back_to_rule_on_bad_llm():
    boom = lambda s, u: "不是JSON的废话"  # noqa: E731
    r = sel.run_department_swarm("hubu_finance_swarm", _EDICT, "MIXED", call_fn=boom)
    # LLM 解析失败 → 兜底规则(禁假 PASS,不崩)
    assert r["source_label"] == "MIXED" and "position" in r


def test_live_position_parses_fenced_json():
    mock = lambda s, u: '```json\n{"position":"补证","summary":"需补ROI","key_findings":[],"risks":[]}\n```'  # noqa: E731
    r = sel.run_department_swarm("hubu_finance_swarm", _EDICT, "MIXED", call_fn=mock)
    assert r["position"] == "补证" and r["source_label"] == "LIVE_SWARM"
