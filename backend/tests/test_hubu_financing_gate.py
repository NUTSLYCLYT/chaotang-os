from __future__ import annotations

from decimal import Decimal

from src.hubu_financing_gate import (
    build_financing_fact_pack,
    financing_capacity_gate,
    financing_decision_preview,
    financing_evidence_gate,
    financing_gate,
    financing_source_gate,
)


def _sources() -> dict:
    return {
        "requested_amount": {"sourceLabel": "manual_confirmed", "ref": "boss_financing_request"},
        "term_months": {"sourceLabel": "manual_confirmed", "ref": "bank_term_sheet_draft"},
        "annual_interest_rate": {"sourceLabel": "web_research", "ref": "market_rate_reference"},
        "annual_operating_cash_flow": {"sourceLabel": "internal_uploaded_file", "ref": "cashflow_2026.xlsx"},
    }


def _evidence() -> dict:
    return {
        "financial_statements": "reports/2026-06-statements.pdf",
        "audit_report": "reports/2026-06-audit.pdf",
        "bank_statement": "bank/2026-06.pdf",
        "tax_record": "tax/2026-q2.pdf",
        "use_of_funds": "docs/use-of-funds.md",
        "repayment_plan": "docs/repayment-plan.md",
    }


def _pack(**overrides) -> dict:
    data = {
        "case_id": "finance-001",
        "title": "制造企业流动资金贷款草稿",
        "purpose": "working_capital",
        "requested_amount": 600000,
        "term_months": 36,
        "annual_interest_rate": "0.05",
        "annual_operating_cash_flow": 420000,
        "existing_annual_debt_service": 60000,
        "sources": _sources(),
        "evidence": _evidence(),
        "collateral": {},
    }
    data.update(overrides)
    return build_financing_fact_pack(**data)


def test_financing_gate_ready_for_complete_materials_and_healthy_cash_flow():
    gate = financing_gate(_pack())

    assert gate.status == "ready"
    assert gate.requested_amount == Decimal("600000")
    assert gate.estimated_annual_debt_service == Decimal("230000.00")
    assert gate.debt_service_coverage_ratio == Decimal("1.4483")
    assert gate.preview["previewOnly"] is True
    assert gate.preview["executionAllowed"] is False
    assert gate.preview["submissionAllowed"] is False
    assert gate.preview["manualReviewRequired"] is True
    assert gate.preview["loanApplicationDraft"]["requestedAmount"] == "600000.00"


def test_financing_gate_requires_verified_source_labels():
    sources = _sources()
    sources["annual_operating_cash_flow"] = {"sourceLabel": "unknown"}
    pack = _pack(sources=sources)

    check = financing_source_gate(pack)
    gate = financing_gate(pack)

    assert not check.passed
    assert gate.status == "needs_evidence"
    assert any("sourceLabel=unknown" in gap for gap in check.gaps)


def test_financing_gate_requires_core_application_materials():
    evidence = _evidence()
    del evidence["audit_report"]
    del evidence["repayment_plan"]

    check = financing_evidence_gate(_pack(evidence=evidence))
    gate = financing_gate(_pack(evidence=evidence))

    assert not check.passed
    assert gate.status == "needs_evidence"
    assert any("audit_report" in gap for gap in check.gaps)
    assert any("repayment_plan" in gap for gap in check.gaps)


def test_financing_gate_blocks_when_cash_flow_cannot_cover_debt_service():
    check, annual_service, dscr = financing_capacity_gate(_pack(annual_operating_cash_flow=180000))
    gate = financing_gate(_pack(annual_operating_cash_flow=180000))

    assert not check.passed
    assert annual_service == Decimal("230000.00")
    assert dscr == Decimal("0.6207")
    assert gate.status == "blocked"
    assert "偿债覆盖不足" in gate.required_action


def test_financing_gate_requires_confirmation_for_large_or_pledged_financing():
    gate = financing_gate(
        _pack(
            requested_amount=1200000,
            annual_operating_cash_flow=900000,
            collateral={"asset": "factory_building", "estimatedValue": 3000000},
        )
    )

    assert gate.status == "needs_confirmation"
    assert "large_financing" in gate.risk_gates
    assert "asset_pledge" in gate.risk_gates
    assert "二次确认" in gate.required_action


def test_financing_decision_preview_never_executes_external_submission():
    decision = financing_decision_preview(_pack(), {"action": "prepare_loan_draft"})

    assert decision["allowed"] is True
    assert decision["status"] == "accepted_preview"
    assert decision["executionAllowed"] is False
    assert decision["sideEffects"] == "none"


def test_financing_decision_preview_rejects_loan_draft_when_gate_is_blocked():
    decision = financing_decision_preview(_pack(annual_operating_cash_flow=180000), {"action": "prepare_loan_draft"})

    assert decision["allowed"] is False
    assert decision["status"] == "blocked_preview"
    assert decision["gateStatus"] == "blocked"
