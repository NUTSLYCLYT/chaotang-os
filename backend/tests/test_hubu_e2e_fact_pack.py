from __future__ import annotations

import json
from pathlib import Path

from src.hubu_accounting_audit import accounting_office_gate, build_accounting_fact_pack
from src.hubu_budget import budget_gate, build_budget_fact_pack
from src.hubu_memorial import build_hubu_memorial
from src.hubu_treasury import build_treasury_fact_pack, payment_gate


FIXTURE = Path(__file__).parent / "fixtures" / "hubu_payment_fact_pack.json"


def _load_case(overrides=None) -> dict:
    case = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if overrides:
        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(case.get(key), dict):
                case[key].update(value)
            else:
                case[key] = value
    return case


def _run_case(case: dict):
    accounting_pack = build_accounting_fact_pack(**case["accounting"])
    treasury_pack = build_treasury_fact_pack(**case["treasury"])
    budget_pack = build_budget_fact_pack(**case["budget"])

    payment_request = case["paymentRequest"]
    gates = {
        "accounting": accounting_office_gate(accounting_pack),
        "treasury": payment_gate(treasury_pack, payment_request),
        "budget": budget_gate(budget_pack, {"amount": payment_request["amount"], **payment_request}),
    }
    return build_hubu_memorial(
        memorial_id=case["caseId"],
        title=case["title"],
        decision_type=case["decisionType"],
        gates=gates,
        known_facts=case["knownFacts"],
        source_label_summary={
            "accounting": "internal_uploaded_file/manual_confirmed",
            "treasury": "internal_uploaded_file/manual_confirmed",
            "budget": "internal_uploaded_file"
        },
    )


def test_hubu_payment_fact_pack_runs_full_decision_chain():
    memorial = _run_case(_load_case())
    plain = memorial.plain()

    assert memorial.recommendation == "approve"
    assert memorial.risk_level == "low"
    assert memorial.missing_evidence == []
    assert memorial.risk_gates == []
    assert plain["metrics"]["treasury.available_cash"] == "520000"
    assert plain["metrics"]["budget.remaining_after_request"] == "90000"
    assert [item["office"] for item in plain["audit_trail"]] == ["accounting", "treasury", "budget"]
    assert plain["next_actions"] == ["可进入老板批准。"]


def test_hubu_payment_fact_pack_blocks_when_bank_cash_is_insufficient():
    case = _load_case({"treasury": {"bank_balance": 10000}})

    memorial = _run_case(case)

    assert memorial.recommendation == "blocked"
    assert memorial.risk_level == "blocked"
    assert any("资金缺口" in gap for gap in memorial.missing_evidence)


def test_hubu_payment_fact_pack_needs_evidence_without_invoice():
    case = _load_case()
    case["paymentRequest"]["evidence"].pop("invoice")

    memorial = _run_case(case)

    assert memorial.recommendation == "needs_evidence"
    assert memorial.risk_level == "medium"
    assert any("invoice" in gap for gap in memorial.missing_evidence)

