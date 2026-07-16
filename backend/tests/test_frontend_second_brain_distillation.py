"""P4c: preserve safety invariants before retiring the frontend decision engines."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema

from src import swarm_review


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang_department_protocol"
SCHEMA = HARNESS / "contracts" / "frontend_second_brain_distillation.schema.json"
CASES = HARNESS / "golden_cases" / "frontend_second_brain_distillation.json"


def load_cases() -> list[dict]:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(cases, schema)
    return cases


def test_distilled_cases_are_complete_unique_and_traceable():
    cases = load_cases()
    assert len(cases) >= 8
    assert len({case["case_id"] for case in cases}) == len(cases)
    assert all(case["legacy_origins"] for case in cases)
    assert all(
        any(
            engine in origin
            for engine in (
                "ministry-review-loop.ts",
                "yushitai-auditor.ts",
                "imperial-report-synthesizer.ts",
                "unified-decision-loop.ts",
            )
            for origin in case["legacy_origins"]
        )
        for case in cases
    )


def test_distillation_covers_each_safety_invariant():
    cases = load_cases()
    expected = [case["expected"] for case in cases]
    assert any(item["required_missing_evidence_any"] for item in expected)
    assert any(item["required_risk_tokens_any"] for item in expected)
    assert any(item["needs_human_confirmation"] for item in expected)
    assert any(item["conflict_visible"] for item in expected)
    assert any(not item["decision_eligible"] for item in expected)
    assert {"LIVE", "FALLBACK", "DEMO"}.issubset(
        {case["input"]["source_label"] for case in cases}
    )


def test_backend_quality_gate_enforces_distilled_provenance_cases():
    for case in load_cases():
        source = case["input"]["source_label"]
        if source not in {"FALLBACK", "DEMO"}:
            continue
        brief = {
            "source_label": source,
            "evidence_chain": case["input"]["known_facts"],
            "missing_evidence": case["input"]["unknown_gaps"],
            "risk_register": [],
            "conflict_summary": [],
            "recommended_next_action": "等待后端证据与人工裁决",
        }
        gate = swarm_review.quality_gate(brief)
        assert gate["passed"] is False, case["case_id"]


def test_backend_review_primitives_preserve_missing_risk_and_conflict_visibility():
    missing_output = {
        "swarm_id": "gongbu_delivery_swarm",
        "swarm_role": "工部交付蜂群",
        "summary": "交付边界待证",
        "position": "补证",
        "evidence_used": [],
        "missing_evidence": ["BOM", "验收口径"],
        "risks": [],
    }
    approval_output = {
        **missing_output,
        "swarm_id": "hubu_finance_swarm",
        "swarm_role": "户部财务蜂群",
        "summary": "预算可推进",
        "position": "准奏",
        "evidence_used": ["预算表"],
        "missing_evidence": [],
    }
    audit = swarm_review.evidence_audit([missing_output], "LIVE")
    assert audit["missing_evidence"] == ["BOM", "验收口径"]
    missing_brief = swarm_review.synthesize_brief(
        [missing_output],
        audit,
        swarm_review.critic_report([missing_output], audit, "LIVE"),
        swarm_review.detect_conflicts([missing_output], "LIVE"),
        "LIVE",
    )
    assert swarm_review.quality_gate(missing_brief)["passed"] is False
    conflicts = swarm_review.detect_conflicts([approval_output, missing_output], "LIVE")
    assert conflicts["conflicts"]

    risky = {
        **missing_output,
        "risks": [{"risk": "对外承诺", "severity": "高", "requires_human_confirmation": True}],
    }
    risky_audit = swarm_review.evidence_audit([risky], "LIVE")
    critique = swarm_review.critic_report([risky], risky_audit, "LIVE")
    assert critique["risk_escalations"]
    assert critique["emperor_questions"]
