"""Hubu financing and loan preparation gate contracts.

This module only evaluates whether financing or loan materials are ready for
manual review. It does not submit applications, contact banks, pledge assets,
write databases, or make external commitments.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from src.finance_validators import FinCheck

VERIFIED_SOURCE_LABELS = {"internal_uploaded_file", "manual_confirmed", "historical_archive", "web_research"}

REQUIRED_FINANCING_EVIDENCE = [
    "financial_statements",
    "audit_report",
    "bank_statement",
    "tax_record",
    "use_of_funds",
    "repayment_plan",
]

FINANCING_BUTTON_LABELS = {
    "prepare_loan_draft": "生成贷款申报草稿",
    "return_for_evidence": "退回补证",
    "return_for_audit_review": "退回审计复核",
    "boss_confirm_financing": "老板二次确认",
    "save_draft": "仅保存草稿",
}

DEFAULT_MIN_DSCR = Decimal("1.20")
DEFAULT_LARGE_FINANCING_AMOUNT = Decimal("1000000")


@dataclass
class FinancingGate:
    """Financing gate result for boss-reviewable funding workflows."""

    status: str
    checks: list[FinCheck]
    requested_amount: Decimal | None
    estimated_annual_debt_service: Decimal | None
    debt_service_coverage_ratio: Decimal | None
    risk_gates: list[str] = field(default_factory=list)
    required_action: str = ""
    preview: dict[str, Any] = field(default_factory=dict)


def _decimal(value: Any) -> Decimal | None:
    try:
        if value is None or value == "":
            return None
        return Decimal(str(value).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


def _money(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return f"{value.quantize(Decimal('0.01'))}"


def _source_label(source: Any) -> str:
    if isinstance(source, dict):
        return str(source.get("sourceLabel", ""))
    if source is None:
        return ""
    return str(source)


def _ratio(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if numerator is None or denominator in (None, Decimal("0")):
        return None
    return (numerator / denominator).quantize(Decimal("0.0001"))


def build_financing_fact_pack(
    *,
    case_id: str,
    title: str,
    requested_amount,
    term_months,
    annual_interest_rate,
    annual_operating_cash_flow,
    existing_annual_debt_service=0,
    sources: dict,
    evidence: dict | None = None,
    purpose: str | None = None,
    collateral: dict | None = None,
) -> dict:
    """Build a financing fact pack with explicit evidence and source labels."""
    return {
        "case_id": case_id,
        "title": title,
        "purpose": purpose,
        "requested_amount": requested_amount,
        "term_months": term_months,
        "annual_interest_rate": annual_interest_rate,
        "annual_operating_cash_flow": annual_operating_cash_flow,
        "existing_annual_debt_service": existing_annual_debt_service,
        "collateral": collateral or {},
        "sources": sources,
        "evidence": evidence or {},
    }


def financing_source_gate(fact_pack: dict) -> FinCheck:
    """Require verified source labels for amount, rate, term, and cash flow."""
    sources = fact_pack.get("sources") or {}
    required_paths = ["requested_amount", "term_months", "annual_interest_rate", "annual_operating_cash_flow"]
    gaps: list[str] = []
    for path in required_paths:
        if _decimal(fact_pack.get(path)) is None:
            gaps.append(f"{path}:缺数字")
            continue
        label = _source_label(sources.get(path))
        if label not in VERIFIED_SOURCE_LABELS:
            gaps.append(f"{path}:sourceLabel={label or 'missing'}")

    return FinCheck(
        "融资sourceLabel闸",
        not gaps,
        "融资关键数字来源已验证" if not gaps else f"融资关键数字待补证 {len(gaps)} 项",
        severity="warn",
        gaps=gaps,
    )


def financing_evidence_gate(fact_pack: dict) -> FinCheck:
    """Require financing materials before a loan draft can move forward."""
    evidence = fact_pack.get("evidence") or {}
    gaps = [f"evidence.{key}:缺失" for key in REQUIRED_FINANCING_EVIDENCE if not evidence.get(key)]
    return FinCheck(
        "融资材料闸",
        not gaps,
        "融资/贷款申报材料齐全" if not gaps else f"融资材料待补证 {len(gaps)} 项",
        gaps=gaps,
    )


def _estimated_annual_debt_service(fact_pack: dict) -> Decimal | None:
    amount = _decimal(fact_pack.get("requested_amount"))
    months = _decimal(fact_pack.get("term_months"))
    rate = _decimal(fact_pack.get("annual_interest_rate"))
    if amount is None or months is None or months <= 0 or rate is None:
        return None
    years = months / Decimal("12")
    principal_per_year = amount / years
    annual_interest = amount * rate
    return principal_per_year + annual_interest


def financing_capacity_gate(fact_pack: dict, *, min_dscr=DEFAULT_MIN_DSCR) -> tuple[FinCheck, Decimal | None, Decimal | None]:
    """Check whether operating cash flow can cover new and existing debt service."""
    annual_cash_flow = _decimal(fact_pack.get("annual_operating_cash_flow"))
    existing_service = _decimal(fact_pack.get("existing_annual_debt_service")) or Decimal("0")
    new_service = _estimated_annual_debt_service(fact_pack)
    min_ratio = _decimal(min_dscr) or DEFAULT_MIN_DSCR
    total_service = None if new_service is None else existing_service + new_service
    dscr = _ratio(annual_cash_flow, total_service)

    gaps: list[str] = []
    if annual_cash_flow is None:
        gaps.append("annual_operating_cash_flow:缺失")
    if new_service is None:
        gaps.append("estimated_annual_debt_service:无法计算")
    if dscr is not None and dscr < min_ratio:
        gaps.append(f"debt_service_coverage_ratio:{dscr}<最低{min_ratio}")

    return (
        FinCheck(
            "融资偿债能力闸",
            not gaps,
            "经营现金流覆盖融资偿债压力" if not gaps else f"偿债能力待复核 {len(gaps)} 项",
            gaps=gaps,
        ),
        new_service,
        dscr,
    )


def financing_gate(
    fact_pack: dict,
    *,
    min_dscr=DEFAULT_MIN_DSCR,
    large_amount_threshold=DEFAULT_LARGE_FINANCING_AMOUNT,
) -> FinancingGate:
    """Evaluate financing readiness without submitting or committing anything."""
    source_check = financing_source_gate(fact_pack)
    evidence_check = financing_evidence_gate(fact_pack)
    capacity_check, annual_service, dscr = financing_capacity_gate(fact_pack, min_dscr=min_dscr)
    checks = [source_check, evidence_check, capacity_check]

    requested_amount = _decimal(fact_pack.get("requested_amount"))
    risk_gates: list[str] = []
    threshold = _decimal(large_amount_threshold) or DEFAULT_LARGE_FINANCING_AMOUNT
    if requested_amount is not None and requested_amount >= threshold:
        risk_gates.append("large_financing")
    if fact_pack.get("collateral"):
        risk_gates.append("asset_pledge")
    if fact_pack.get("purpose") in {"external_commitment", "supplier_guarantee"}:
        risk_gates.append("external_commitment")

    if requested_amount is None or requested_amount <= 0:
        status = "blocked"
        action = "阻断融资: 申请金额缺失或非法。"
    elif not source_check.passed or not evidence_check.passed:
        status = "needs_evidence"
        action = "退回补证: 融资关键数字来源或申报材料不足。"
    elif not capacity_check.passed:
        status = "blocked"
        action = "阻断融资: 偿债覆盖不足或无法计算。"
    elif risk_gates:
        status = "needs_confirmation"
        action = "需老板二次确认: 融资触发高风险确认门。"
    else:
        status = "ready"
        action = "可生成贷款/融资申报草稿, 但仍需人工复核后对外提交。"

    return FinancingGate(
        status=status,
        checks=checks,
        requested_amount=requested_amount,
        estimated_annual_debt_service=annual_service,
        debt_service_coverage_ratio=dscr,
        risk_gates=risk_gates,
        required_action=action,
        preview={
            "previewOnly": True,
            "executionAllowed": False,
            "sideEffects": "none",
            "manualReviewRequired": True,
            "submissionAllowed": False,
            "buttonLabels": FINANCING_BUTTON_LABELS,
            "loanApplicationDraft": {
                "caseId": fact_pack.get("case_id"),
                "title": fact_pack.get("title"),
                "requestedAmount": _money(requested_amount),
                "estimatedAnnualDebtService": _money(annual_service),
                "debtServiceCoverageRatio": str(dscr) if dscr is not None else None,
                "requiredEvidence": REQUIRED_FINANCING_EVIDENCE,
            },
        },
    )


def financing_decision_preview(fact_pack: dict, decision_input: dict) -> dict:
    """Preview whether a financing action is allowed; never executes it."""
    gate = financing_gate(fact_pack)
    action = str(decision_input.get("action") or "")
    if gate.status == "ready":
        allowed_actions = ["prepare_loan_draft", "save_draft"]
    elif gate.status == "needs_confirmation":
        allowed_actions = ["boss_confirm_financing", "save_draft"]
    elif gate.status == "needs_evidence":
        allowed_actions = ["return_for_evidence", "save_draft"]
    else:
        allowed_actions = ["return_for_audit_review", "return_for_evidence", "save_draft"]

    allowed = action in allowed_actions
    return {
        "caseId": fact_pack.get("case_id"),
        "requestedAction": action,
        "allowed": allowed,
        "status": "accepted_preview" if allowed else "blocked_preview",
        "executionAllowed": False,
        "sideEffects": "none",
        "gateStatus": gate.status,
        "allowedActions": allowed_actions,
        "riskGates": gate.risk_gates,
        "requiredAction": gate.required_action,
    }
