from __future__ import annotations

from decimal import Decimal

from src.hubu_treasury import (
    available_cash,
    build_treasury_fact_pack,
    payment_evidence_gate,
    payment_gate,
    treasury_source_gate,
)


def _treasury_pack(**overrides):
    data = {
        "as_of": "2026-06-21T20:00:00+08:00",
        "cash_balance": 20000,
        "bank_balance": 500000,
        "reserved_cash": 50000,
        "pending_receipts": [{"amount": 80000, "status": "confirmed"}],
        "pending_payments": [{"amount": 30000, "status": "approved"}],
        "sources": {
            "cash_balance": {"sourceLabel": "manual_confirmed", "ref": "cashier_count_20260621"},
            "bank_balance": {"sourceLabel": "internal_uploaded_file", "ref": "bank_export_20260621.xlsx"},
        },
        "evidence": [{"path": "bank_export_20260621.xlsx"}],
    }
    data.update(overrides)
    return build_treasury_fact_pack(**data)


def _payment(**overrides):
    data = {
        "payee": "深圳设备供应商A",
        "amount": 90000,
        "purpose": "设备尾款",
        "evidence": {
            "contract": "contract-001.pdf",
            "invoice": "invoice-001.pdf",
            "budget": "budget-line-equipment-2026",
        },
    }
    data.update(overrides)
    return data


def test_available_cash_subtracts_reserved_and_approved_pending_payments():
    assert available_cash(_treasury_pack()) == Decimal("520000")


def test_treasury_source_gate_requires_verified_balance_sources():
    pack = _treasury_pack(sources={"cash_balance": {"sourceLabel": "internal_user_input"}})

    check = treasury_source_gate(pack)

    assert not check.passed
    assert any("bank_balance" in gap for gap in check.gaps)
    assert any("internal_user_input" in gap for gap in check.gaps)


def test_payment_gate_ready_when_balance_and_evidence_are_clean():
    gate = payment_gate(_treasury_pack(), _payment())

    assert gate.status == "ready"
    assert gate.available_cash == Decimal("520000")
    assert not gate.risk_gates
    assert "可付款" in gate.required_action


def test_payment_gate_needs_confirmation_for_large_payment():
    gate = payment_gate(_treasury_pack(), _payment(amount=120000))

    assert gate.status == "needs_confirmation"
    assert "large_payment" in gate.risk_gates
    assert "二次确认" in gate.required_action


def test_payment_gate_blocks_when_cash_is_insufficient():
    gate = payment_gate(_treasury_pack(), _payment(amount=900000))

    assert gate.status == "blocked"
    assert any("资金缺口" in gap for check in gate.checks for gap in check.gaps)


def test_payment_gate_requires_contract_invoice_and_budget():
    payment = _payment(evidence={"contract": "contract-001.pdf"})

    evidence_check = payment_evidence_gate(payment)
    gate = payment_gate(_treasury_pack(), payment)

    assert not evidence_check.passed
    assert gate.status == "needs_evidence"
    assert any("invoice" in gap for gap in evidence_check.gaps)
    assert any("budget" in gap for gap in evidence_check.gaps)


def test_payment_gate_needs_confirmation_for_related_party():
    gate = payment_gate(_treasury_pack(), _payment(related_party=True))

    assert gate.status == "needs_confirmation"
    assert "related_party" in gate.risk_gates

