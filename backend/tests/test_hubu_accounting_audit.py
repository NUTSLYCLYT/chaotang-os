from __future__ import annotations

from src.hubu_accounting_audit import (
    accounting_office_gate,
    audit_report_numbers,
    audit_source_labels,
    build_accounting_fact_pack,
)


def _verified_sources() -> dict:
    return {
        "balance_sheet.资产总计": {"sourceLabel": "internal_uploaded_file", "ref": "balance_sheet.xlsx"},
        "balance_sheet.负债合计": {"sourceLabel": "internal_uploaded_file", "ref": "balance_sheet.xlsx"},
        "balance_sheet.所有者权益": {"sourceLabel": "internal_uploaded_file", "ref": "balance_sheet.xlsx"},
        "income_statement.营业收入": {"sourceLabel": "internal_uploaded_file", "ref": "income_statement.xlsx"},
        "income_statement.营业成本": {"sourceLabel": "internal_uploaded_file", "ref": "income_statement.xlsx"},
        "income_statement.净利润": {"sourceLabel": "manual_confirmed", "ref": "accountant_review_20260621"},
    }


def _balanced_pack(**overrides):
    data = {
        "period": "2026-06",
        "balance_sheet": {
            "资产总计": 1000000,
            "负债合计": 400000,
            "所有者权益": 600000,
        },
        "income_statement": {
            "营业收入": 800000,
            "营业成本": 520000,
            "净利润": 120000,
        },
        "sources": _verified_sources(),
        "evidence": [{"path": "finance/monthly-close-2026-06.xlsx"}],
    }
    data.update(overrides)
    return build_accounting_fact_pack(**data)


def test_accounting_office_gate_ready_for_balanced_verified_pack():
    gate = accounting_office_gate(_balanced_pack())

    assert gate.status == "ready"
    assert gate.ratios["毛利率%"] == 35
    assert gate.ratios["净利率%"] == 15
    assert all(check.passed for check in gate.checks)
    assert "可进入预算" in gate.required_action


def test_accounting_office_gate_invalid_when_balance_sheet_does_not_tie():
    pack = _balanced_pack(
        balance_sheet={
            "资产总计": 1000000,
            "负债合计": 400000,
            "所有者权益": 500000,
        }
    )

    gate = accounting_office_gate(pack)

    assert gate.status == "invalid"
    assert any(not check.passed and check.name == "会计恒等式" for check in gate.checks)


def test_accounting_office_gate_requires_verified_source_labels():
    sources = _verified_sources()
    sources["income_statement.净利润"] = {"sourceLabel": "internal_user_input"}
    pack = _balanced_pack(sources=sources)

    source_check = audit_source_labels(pack)
    gate = accounting_office_gate(pack)

    assert not source_check.passed
    assert gate.status == "needs_evidence"
    assert any("internal_user_input" in gap for gap in source_check.gaps)


def test_accounting_office_gate_invalid_when_profit_ratio_is_impossible():
    pack = _balanced_pack(
        income_statement={
            "营业收入": 800000,
            "营业成本": 720000,
            "净利润": 160000,
        }
    )

    gate = accounting_office_gate(pack)

    assert gate.status == "invalid"
    assert any("净利率" in gap for check in gate.checks for gap in check.gaps)


def test_audit_report_numbers_accepts_report_backed_by_fact_pack():
    pack = _balanced_pack()
    report = "2026年营业收入80万元,营业成本52万元,净利润12万元,毛利率35.0%。"

    check = audit_report_numbers(report, pack)

    assert check.passed


def test_audit_report_numbers_rejects_hallucinated_finance_number():
    pack = _balanced_pack()
    report = "2026年营业收入80万元,但新增利润999万元。"

    check = audit_report_numbers(report, pack)

    assert not check.passed
    assert any("999" in gap for gap in check.gaps)

