"""户部预算司最小确定性岗位。

职责:
- 判断付款/投资是否有预算。
- 计算已用、已承诺、剩余额度和本次申请后的预算状态。
- 对近额度、超预算和缺证预算触发门禁。

预算司只回答“计划内不内”。它不替代出纳司的现金判断。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from src.finance_validators import FinCheck, VERIFIED_SOURCE_LABELS


DEFAULT_NEAR_LIMIT_RATIO = Decimal("0.90")
DEFAULT_CONFIRMATION_RATIO = Decimal("1.00")


@dataclass
class BudgetGate:
    """预算司门禁输出。"""

    status: str
    checks: list[FinCheck]
    budget_amount: Decimal | None
    actual_used: Decimal
    committed_amount: Decimal
    request_amount: Decimal | None
    remaining_before_request: Decimal | None
    remaining_after_request: Decimal | None
    usage_after_request_ratio: Decimal | None = None
    risk_gates: list[str] = field(default_factory=list)
    required_action: str = ""


def _decimal(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


def _source_label(source: Any) -> str:
    if isinstance(source, dict):
        return str(source.get("sourceLabel", ""))
    if source is None:
        return ""
    return str(source)


def build_budget_fact_pack(
    *,
    budget_id: str,
    budget_amount,
    actual_used=0,
    committed_amount=0,
    sources: dict,
    period: str | None = None,
    department: str | None = None,
    project: str | None = None,
    evidence: list[dict] | None = None,
) -> dict:
    """构建预算司事实包。"""
    return {
        "budget_id": budget_id,
        "period": period,
        "department": department,
        "project": project,
        "budget_amount": budget_amount,
        "actual_used": actual_used,
        "committed_amount": committed_amount,
        "sources": sources,
        "evidence": evidence or [],
    }


def budget_source_gate(fact_pack: dict) -> FinCheck:
    """预算基准来源闸: 预算总额必须有可信来源。"""
    budget_amount = _decimal(fact_pack.get("budget_amount"))
    label = _source_label((fact_pack.get("sources") or {}).get("budget_amount"))
    gaps: list[str] = []

    if budget_amount is None or budget_amount <= 0:
        gaps.append("budget_amount:缺失或<=0")
    if label not in VERIFIED_SOURCE_LABELS:
        gaps.append(f"budget_amount:sourceLabel={label or 'missing'}")

    return FinCheck(
        "预算sourceLabel闸",
        not gaps,
        "预算基准来源已验证" if not gaps else f"预算待补证 {len(gaps)} 项",
        severity="warn",
        gaps=gaps,
    )


def budget_usage(fact_pack: dict, request_amount=0) -> dict[str, Decimal | None]:
    """计算预算占用情况。"""
    budget_amount = _decimal(fact_pack.get("budget_amount"))
    actual_used = _decimal(fact_pack.get("actual_used")) or Decimal("0")
    committed_amount = _decimal(fact_pack.get("committed_amount")) or Decimal("0")
    request = _decimal(request_amount)

    remaining_before = None
    remaining_after = None
    usage_ratio = None
    if budget_amount is not None:
        remaining_before = budget_amount - actual_used - committed_amount
        if request is not None:
            remaining_after = remaining_before - request
            if budget_amount > 0:
                usage_ratio = ((actual_used + committed_amount + request) / budget_amount).quantize(Decimal("0.0001"))

    return {
        "budget_amount": budget_amount,
        "actual_used": actual_used,
        "committed_amount": committed_amount,
        "request_amount": request,
        "remaining_before_request": remaining_before,
        "remaining_after_request": remaining_after,
        "usage_after_request_ratio": usage_ratio,
    }


def budget_gate(
    fact_pack: dict,
    request: dict,
    *,
    near_limit_ratio=DEFAULT_NEAR_LIMIT_RATIO,
    confirmation_ratio=DEFAULT_CONFIRMATION_RATIO,
) -> BudgetGate:
    """预算门。

    status:
    - within_budget: 预算充足且未接近阈值。
    - near_limit: 预算未超, 但本次后接近额度, 建议老板知情。
    - over_budget: 本次后超预算, 必须二次确认或退回。
    - needs_evidence: 预算来源或申请依据不足。
    - blocked: 金额非法或缺预算。
    """
    source_check = budget_source_gate(fact_pack)
    request_amount = _decimal(request.get("amount"))
    usage = budget_usage(fact_pack, request_amount)
    checks = [source_check]
    risk_gates: list[str] = []

    evidence = request.get("evidence") or {}
    evidence_gaps: list[str] = []
    if not evidence.get("budget"):
        evidence_gaps.append("evidence.budget:缺失")
    if not evidence.get("approval"):
        evidence_gaps.append("evidence.approval:缺失")
    evidence_check = FinCheck(
        "预算申请证据闸",
        not evidence_gaps,
        "预算申请依据齐全" if not evidence_gaps else f"预算申请待补证 {len(evidence_gaps)} 项",
        gaps=evidence_gaps,
    )
    checks.append(evidence_check)

    if request_amount is None or request_amount <= 0:
        status = "blocked"
        action = "阻断预算占用: 申请金额缺失或非法。"
    elif usage["budget_amount"] is None or usage["budget_amount"] <= 0:
        status = "blocked"
        action = "阻断预算占用: 缺少有效预算额度。"
    elif not source_check.passed or not evidence_check.passed:
        status = "needs_evidence"
        action = "退回补证: 预算来源或申请依据不足。"
    elif usage["remaining_after_request"] is not None and usage["remaining_after_request"] < 0:
        risk_gates.append("over_budget")
        status = "over_budget"
        action = "需老板二次确认: 本次申请后超预算。"
    elif (
        usage["usage_after_request_ratio"] is not None
        and usage["usage_after_request_ratio"] >= _decimal(confirmation_ratio)
    ):
        risk_gates.append("budget_limit")
        status = "over_budget"
        action = "需老板二次确认: 本次申请达到或超过预算总额。"
    elif usage["usage_after_request_ratio"] is not None and usage["usage_after_request_ratio"] >= _decimal(near_limit_ratio):
        risk_gates.append("near_budget_limit")
        status = "near_limit"
        action = "预算接近上限: 可继续流转, 但建议老板知情。"
    else:
        status = "within_budget"
        action = "预算内: 可继续交出纳司判断现金与付款门。"

    return BudgetGate(
        status=status,
        checks=checks,
        budget_amount=usage["budget_amount"],
        actual_used=usage["actual_used"],
        committed_amount=usage["committed_amount"],
        request_amount=usage["request_amount"],
        remaining_before_request=usage["remaining_before_request"],
        remaining_after_request=usage["remaining_after_request"],
        usage_after_request_ratio=usage["usage_after_request_ratio"],
        risk_gates=risk_gates,
        required_action=action,
    )

