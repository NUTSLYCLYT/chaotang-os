from __future__ import annotations

from decimal import Decimal

from src.hubu_budget import (
    budget_gate,
    budget_source_gate,
    budget_usage,
    build_budget_fact_pack,
)


def _budget_pack(**overrides):
    data = {
        "budget_id": "budget-equipment-2026",
        "period": "2026",
        "department": "工厂",
        "project": "自动化设备",
        "budget_amount": 500000,
        "actual_used": 260000,
        "committed_amount": 60000,
        "sources": {
            "budget_amount": {"sourceLabel": "internal_uploaded_file", "ref": "budget-2026.xlsx"},
        },
        "evidence": [{"path": "budget-2026.xlsx"}],
    }
    data.update(overrides)
    return build_budget_fact_pack(**data)


def _request(**overrides):
    data = {
        "amount": 80000,
        "purpose": "设备尾款",
        "evidence": {
            "budget": "budget-line-equipment-2026",
            "approval": "purchase-approval-001",
        },
    }
    data.update(overrides)
    return data


def test_budget_usage_calculates_remaining_before_and_after_request():
    usage = budget_usage(_budget_pack(), 80000)

    assert usage["remaining_before_request"] == Decimal("180000")
    assert usage["remaining_after_request"] == Decimal("100000")
    assert usage["usage_after_request_ratio"] == Decimal("0.8000")


def test_budget_gate_within_budget_when_clean_and_not_near_limit():
    gate = budget_gate(_budget_pack(), _request())

    assert gate.status == "within_budget"
    assert gate.remaining_after_request == Decimal("100000")
    assert not gate.risk_gates
    assert "出纳司" in gate.required_action


def test_budget_gate_near_limit_when_request_uses_most_budget():
    gate = budget_gate(_budget_pack(), _request(amount=140000))

    assert gate.status == "near_limit"
    assert "near_budget_limit" in gate.risk_gates
    assert gate.usage_after_request_ratio == Decimal("0.9200")


def test_budget_gate_over_budget_requires_owner_confirmation():
    gate = budget_gate(_budget_pack(), _request(amount=220000))

    assert gate.status == "over_budget"
    assert "over_budget" in gate.risk_gates
    assert "二次确认" in gate.required_action


def test_budget_gate_needs_evidence_when_budget_source_is_user_input():
    pack = _budget_pack(sources={"budget_amount": {"sourceLabel": "internal_user_input"}})

    source_check = budget_source_gate(pack)
    gate = budget_gate(pack, _request())

    assert not source_check.passed
    assert gate.status == "needs_evidence"
    assert any("internal_user_input" in gap for gap in source_check.gaps)


def test_budget_gate_needs_evidence_when_request_lacks_budget_approval():
    gate = budget_gate(_budget_pack(), _request(evidence={"budget": "budget-line-equipment-2026"}))

    assert gate.status == "needs_evidence"
    assert any("approval" in gap for check in gate.checks for gap in check.gaps)


def test_budget_gate_blocks_invalid_request_amount():
    gate = budget_gate(_budget_pack(), _request(amount=0))

    assert gate.status == "blocked"
    assert "非法" in gate.required_action

