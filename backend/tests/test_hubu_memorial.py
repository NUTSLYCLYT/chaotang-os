from __future__ import annotations

from src.hubu_accounting_audit import accounting_office_gate, build_accounting_fact_pack
from src.hubu_budget import budget_gate, build_budget_fact_pack
from src.hubu_memorial import build_hubu_memorial
from src.hubu_treasury import build_treasury_fact_pack, payment_gate


def _accounting_gate(**overrides):
    pack = build_accounting_fact_pack(
        period="2026-06",
        balance_sheet={"资产总计": 1000000, "负债合计": 400000, "所有者权益": 600000},
        income_statement={"营业收入": 800000, "营业成本": 520000, "净利润": 120000},
        sources={
            "balance_sheet.资产总计": {"sourceLabel": "internal_uploaded_file"},
            "balance_sheet.负债合计": {"sourceLabel": "internal_uploaded_file"},
            "balance_sheet.所有者权益": {"sourceLabel": "internal_uploaded_file"},
            "income_statement.营业收入": {"sourceLabel": "internal_uploaded_file"},
            "income_statement.营业成本": {"sourceLabel": "internal_uploaded_file"},
            "income_statement.净利润": {"sourceLabel": "manual_confirmed"},
        },
    )
    if overrides:
        pack.update(overrides)
    return accounting_office_gate(pack)


def _treasury_gate(amount=90000, **payment_overrides):
    pack = build_treasury_fact_pack(
        as_of="2026-06-21T20:00:00+08:00",
        cash_balance=20000,
        bank_balance=500000,
        reserved_cash=50000,
        pending_receipts=[{"amount": 80000, "status": "confirmed"}],
        pending_payments=[{"amount": 30000, "status": "approved"}],
        sources={
            "cash_balance": {"sourceLabel": "manual_confirmed"},
            "bank_balance": {"sourceLabel": "internal_uploaded_file"},
        },
    )
    payment = {
        "payee": "深圳设备供应商A",
        "amount": amount,
        "purpose": "设备尾款",
        "evidence": {"contract": "c.pdf", "invoice": "i.pdf", "budget": "b-001"},
    }
    payment.update(payment_overrides)
    return payment_gate(pack, payment)


def _budget_gate(amount=90000, request_overrides=None):
    pack = build_budget_fact_pack(
        budget_id="budget-equipment-2026",
        budget_amount=500000,
        actual_used=260000,
        committed_amount=60000,
        sources={"budget_amount": {"sourceLabel": "internal_uploaded_file"}},
    )
    request = {
        "amount": amount,
        "purpose": "设备尾款",
        "evidence": {"budget": "b-001", "approval": "a-001"},
    }
    request.update(request_overrides or {})
    return budget_gate(pack, request)


def test_hubu_memorial_approves_when_all_gates_are_clean():
    memorial = build_hubu_memorial(
        memorial_id="hubu-pay-001",
        title="设备尾款付款奏折",
        decision_type="payment",
        gates={
            "accounting": _accounting_gate(),
            "treasury": _treasury_gate(),
            "budget": _budget_gate(),
        },
        known_facts=["账务已平", "可用资金充足", "预算内"],
    )

    assert memorial.recommendation == "approve"
    assert memorial.risk_level == "low"
    assert memorial.missing_evidence == []
    assert memorial.next_actions == ["可进入老板批准。"]
    assert memorial.plain()["metrics"]["treasury.available_cash"] == "520000"


def test_hubu_memorial_requires_evidence_when_budget_application_lacks_approval():
    memorial = build_hubu_memorial(
        memorial_id="hubu-pay-002",
        title="缺审批付款奏折",
        decision_type="payment",
        gates={
            "accounting": _accounting_gate(),
            "treasury": _treasury_gate(),
            "budget": _budget_gate(request_overrides={"evidence": {"budget": "b-001"}}),
        },
    )

    assert memorial.recommendation == "needs_evidence"
    assert memorial.risk_level == "medium"
    assert any("approval" in gap for gap in memorial.missing_evidence)
    assert memorial.next_actions[0] == "退回补证。"


def test_hubu_memorial_blocks_when_treasury_has_insufficient_cash():
    memorial = build_hubu_memorial(
        memorial_id="hubu-pay-003",
        title="资金不足付款奏折",
        decision_type="payment",
        gates={
            "accounting": _accounting_gate(),
            "treasury": _treasury_gate(amount=900000),
            "budget": _budget_gate(amount=90000),
        },
    )

    assert memorial.recommendation == "blocked"
    assert memorial.risk_level == "blocked"
    assert any("资金缺口" in gap for gap in memorial.missing_evidence)


def test_hubu_memorial_requires_confirmation_for_large_payment_or_over_budget():
    memorial = build_hubu_memorial(
        memorial_id="hubu-pay-004",
        title="大额付款奏折",
        decision_type="payment",
        gates={
            "accounting": _accounting_gate(),
            "treasury": _treasury_gate(amount=120000),
            "budget": _budget_gate(amount=140000),
        },
    )

    assert memorial.recommendation == "needs_confirmation"
    assert memorial.risk_level == "high"
    assert "large_payment" in memorial.risk_gates
    assert "near_budget_limit" in memorial.risk_gates


def test_hubu_memorial_routes_legal_redline_to_legal_review():
    memorial = build_hubu_memorial(
        memorial_id="hubu-pay-005",
        title="合规红线付款奏折",
        decision_type="payment",
        gates={
            "accounting": _accounting_gate(),
            "treasury": _treasury_gate(),
            "budget": _budget_gate(),
        },
        extra_risk_gates=["legal_redline"],
    )

    assert memorial.recommendation == "legal_review"
    assert "刑部" in memorial.next_actions[0]
