"""户部出纳司最小确定性岗位。

职责:
- 计算当前可用资金。
- 检查余额来源是否可信。
- 判断付款申请是否可放行、需补证、需老板二次确认或直接阻断。

本模块不接银行、不启动服务、不写数据库。真实银行/网银数据后续作为
treasury fact pack 输入。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from src.finance_validators import FinCheck, VERIFIED_SOURCE_LABELS


TREASURY_REQUIRED_BALANCE_PATHS = ["cash_balance", "bank_balance"]
PAYMENT_REQUIRED_FIELDS = ["payee", "amount", "purpose"]
PAYMENT_REQUIRED_EVIDENCE = ["contract", "invoice", "budget"]
DEFAULT_LARGE_PAYMENT_THRESHOLD = Decimal("100000")


@dataclass
class TreasuryGate:
    """出纳司付款门输出。"""

    status: str
    checks: list[FinCheck]
    available_cash: Decimal
    payment_amount: Decimal | None = None
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


def build_treasury_fact_pack(
    *,
    as_of: str,
    cash_balance,
    bank_balance,
    sources: dict,
    pending_receipts: list[dict] | None = None,
    pending_payments: list[dict] | None = None,
    evidence: list[dict] | None = None,
    reserved_cash=0,
) -> dict:
    """构建出纳司事实包。"""
    return {
        "as_of": as_of,
        "cash_balance": cash_balance,
        "bank_balance": bank_balance,
        "reserved_cash": reserved_cash,
        "pending_receipts": pending_receipts or [],
        "pending_payments": pending_payments or [],
        "sources": sources,
        "evidence": evidence or [],
    }


def available_cash(fact_pack: dict) -> Decimal:
    """可用资金 = 现金 + 银行余额 + 确认即将到账 - 保留资金 - 确认待付款。"""
    cash = _decimal(fact_pack.get("cash_balance")) or Decimal("0")
    bank = _decimal(fact_pack.get("bank_balance")) or Decimal("0")
    reserved = _decimal(fact_pack.get("reserved_cash")) or Decimal("0")
    receipts = sum(
        (_decimal(item.get("amount")) or Decimal("0"))
        for item in fact_pack.get("pending_receipts", [])
        if item.get("status") == "confirmed"
    )
    payments = sum(
        (_decimal(item.get("amount")) or Decimal("0"))
        for item in fact_pack.get("pending_payments", [])
        if item.get("status") == "approved"
    )
    return cash + bank + receipts - reserved - payments


def treasury_source_gate(fact_pack: dict) -> FinCheck:
    """余额来源闸: 现金/银行余额必须有可信 sourceLabel。"""
    sources = fact_pack.get("sources") or {}
    gaps: list[str] = []
    for path in TREASURY_REQUIRED_BALANCE_PATHS:
        if _decimal(fact_pack.get(path)) is None:
            gaps.append(f"{path}:缺数字")
            continue
        label = _source_label(sources.get(path))
        if label not in VERIFIED_SOURCE_LABELS:
            gaps.append(f"{path}:sourceLabel={label or 'missing'}")

    return FinCheck(
        "出纳余额sourceLabel闸",
        not gaps,
        "现金/银行余额来源已验证" if not gaps else f"待补证余额来源 {len(gaps)} 项",
        severity="warn",
        gaps=gaps,
    )


def payment_evidence_gate(payment_request: dict) -> FinCheck:
    """付款申请证据闸: 收款方、金额、用途、合同、发票、预算必须齐。"""
    gaps: list[str] = []
    for field_name in PAYMENT_REQUIRED_FIELDS:
        value = payment_request.get(field_name)
        if value in (None, ""):
            gaps.append(f"{field_name}:缺失")
    if _decimal(payment_request.get("amount")) is None:
        gaps.append("amount:非数字")

    evidence = payment_request.get("evidence") or {}
    for evidence_key in PAYMENT_REQUIRED_EVIDENCE:
        if not evidence.get(evidence_key):
            gaps.append(f"evidence.{evidence_key}:缺失")

    return FinCheck(
        "付款证据闸",
        not gaps,
        "付款对象、金额、用途和证据齐全" if not gaps else f"付款待补证 {len(gaps)} 项",
        gaps=gaps,
    )


def payment_gate(
    fact_pack: dict,
    payment_request: dict,
    *,
    large_payment_threshold=DEFAULT_LARGE_PAYMENT_THRESHOLD,
) -> TreasuryGate:
    """出纳付款门。

    status:
    - ready: 金额充足、来源可信、证据齐全、未触发大额二次确认。
    - needs_confirmation: 大额/关联方/对外承诺付款, 需老板二次确认。
    - needs_evidence: 余额或付款证据不足。
    - blocked: 钱不够或金额非法。
    """
    source_check = treasury_source_gate(fact_pack)
    evidence_check = payment_evidence_gate(payment_request)
    amount = _decimal(payment_request.get("amount"))
    cash_available = available_cash(fact_pack)
    checks = [source_check, evidence_check]

    risk_gates: list[str] = []
    threshold = _decimal(large_payment_threshold) or DEFAULT_LARGE_PAYMENT_THRESHOLD
    if amount is not None and amount >= threshold:
        risk_gates.append("large_payment")
    if payment_request.get("related_party"):
        risk_gates.append("related_party")
    if payment_request.get("external_commitment"):
        risk_gates.append("external_commitment")

    if amount is None or amount <= 0:
        status = "blocked"
        action = "阻断付款: 付款金额缺失或非法。"
    elif cash_available < amount:
        checks.append(
            FinCheck(
                "出纳可用资金闸",
                False,
                f"可用资金 {cash_available:,} < 付款金额 {amount:,}",
                gaps=[f"资金缺口 {amount - cash_available:,}"],
            )
        )
        status = "blocked"
        action = "阻断付款: 当前可用资金不足。"
    elif not source_check.passed or not evidence_check.passed:
        status = "needs_evidence"
        action = "退回补证: 余额来源或付款凭据不足。"
    elif risk_gates:
        status = "needs_confirmation"
        action = "需老板二次确认: 付款触发高风险确认门。"
    else:
        checks.append(FinCheck("出纳可用资金闸", True, f"可用资金 {cash_available:,} >= 付款金额 {amount:,}"))
        status = "ready"
        action = "可付款: 资金、来源和凭据均满足出纳门。"

    return TreasuryGate(
        status=status,
        checks=checks,
        available_cash=cash_available,
        payment_amount=amount,
        risk_gates=risk_gates,
        required_action=action,
    )

