"""审查簇五件套直接单测(2026-07-14 拆分时补:此前只有 run_swarm_execution_loop 的传递覆盖)。

钉死:证据审计缺证判定、御史升级高风险、冲突可见、合成简报的下一步动作分支、
质量门 source_label 诚实标铁律(DEMO 禁入/FALLBACK 不许终局确定性)。
"""

from src import swarm_review as sr


def _out(**kw):
    base = {
        "swarm_id": "hubu_finance_swarm",
        "swarm_role": "户部财务蜂群",
        "summary": "测试结论",
        "position": "准奏",
        "evidence_used": ["合同扫描件"],
        "missing_evidence": [],
        "risks": [],
    }
    base.update(kw)
    return base


def test_evidence_audit_flags_unsupported_and_missing():
    outputs = [
        _out(evidence_used=[], missing_evidence=[]),  # 无证据也无缺口 → 无依据断言
        _out(missing_evidence=["BOM 清单", "BOM 清单"]),  # 缺口去重
    ]
    audit = sr.evidence_audit(outputs, "LIVE")
    assert audit["unsupported_claims"] == ["测试结论"]
    assert audit["missing_evidence"] == ["BOM 清单"]
    assert audit["evidence_confidence"] == "低"


def test_critic_escalates_high_risk_and_asks_emperor():
    risk = {"risk": "股权对赌", "severity": "高", "requires_human_confirmation": True}
    outputs = [_out(risks=[risk])]
    audit = sr.evidence_audit(outputs, "LIVE")
    critique = sr.critic_report(outputs, audit, "LIVE")
    assert critique["risk_escalations"] == [risk]
    assert critique["emperor_questions"]


def test_detect_conflicts_between_approval_and_blocker():
    outputs = [
        _out(),
        _out(
            swarm_id="xingbu_legal_risk_swarm",
            swarm_role="刑部法务风险蜂群",
            position="复核",
            summary="合同条款存疑",
        ),
    ]
    res = sr.detect_conflicts(outputs, "LIVE")
    assert len(res["conflicts"]) == 1
    assert res["conflicts"][0]["severity"] == "高"


def test_synthesize_brief_action_priority():
    """动作优先级:高风险人工确认 > 补证 > 合奏/直呈。"""
    risk = {"risk": "付款承诺", "severity": "高", "requires_human_confirmation": True}
    outputs = [_out(risks=[risk], missing_evidence=["交付周期"])]
    audit = sr.evidence_audit(outputs, "LIVE")
    critique = sr.critic_report(outputs, audit, "LIVE")
    conflicts = sr.detect_conflicts(outputs, "LIVE")
    brief = sr.synthesize_brief(outputs, audit, critique, conflicts, "LIVE")
    assert "人工确认" in brief["recommended_next_action"]

    clean = [_out()]
    audit2 = sr.evidence_audit(clean, "LIVE")
    critique2 = sr.critic_report(clean, audit2, "LIVE")
    brief2 = sr.synthesize_brief(
        clean, audit2, critique2, sr.detect_conflicts(clean, "LIVE"), "LIVE", council=False
    )
    assert "上书房" in brief2["recommended_next_action"]


def test_quality_gate_source_label_iron_rules():
    ok = sr.quality_gate(
        {
            "source_label": "LIVE",
            "evidence_chain": ["x"],
            "missing_evidence": [],
            "risk_register": [],
            "conflict_summary": [],
            "recommended_next_action": "推进",
        }
    )
    assert ok["passed"]

    demo = sr.quality_gate({"source_label": "DEMO", "recommended_next_action": "推进"})
    assert not demo["passed"]
    assert "demo_cannot_enter_real_decision" in demo["blocking_reasons"]

    fb = sr.quality_gate(
        {
            "source_label": "FALLBACK",
            "evidence_chain": ["x"],
            "missing_evidence": [],
            "recommended_next_action": "推进",
        }
    )
    assert "no_fallback_final_certainty" in fb["blocking_reasons"]


def test_reexports_stay_importable_from_execution_loop():
    """外部调用方与 mock patch target 钉在 swarm_execution_loop 路径上,shim 不许断。"""
    from src import swarm_execution_loop as sel

    for name in (
        "evidence_audit",
        "critic_report",
        "detect_conflicts",
        "synthesize_brief",
        "quality_gate",
        "SOURCE_LABELS",
    ):
        assert getattr(sel, name) is getattr(sr, name)
