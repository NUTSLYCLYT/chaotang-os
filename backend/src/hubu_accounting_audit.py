"""户部会计司 + 审计司最小确定性岗位。

目标是先替代“会计/审计员”的基础判断:
- 会计司: 账是否平、关键报表字段是否可算。
- 审计司: 每个关键数字是否有 sourceLabel, 输出数字是否能回链到事实包。

本模块不调 LLM、不接外部服务、不写数据库。它只把已有 finance_validators
组合成可被后续 API/蜂群复用的 contract gate。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from src.finance_validators import (
    FinCheck,
    VERIFIED_SOURCE_LABELS,
    accounting_identity,
    ratios,
    sanity_guards,
    verify_numbers,
)


ACCOUNTING_REQUIRED_PATHS = [
    "balance_sheet.资产总计",
    "balance_sheet.负债合计",
    "balance_sheet.所有者权益",
    "income_statement.营业收入",
    "income_statement.营业成本",
    "income_statement.净利润",
]


@dataclass
class AccountingAuditGate:
    """户部会计/审计岗位门禁输出。"""

    status: str
    checks: list[FinCheck]
    ratios: dict[str, Decimal | None] = field(default_factory=dict)
    verified_facts: dict[str, Any] = field(default_factory=dict)
    required_action: str = ""


def _decimal(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).replace(",", "").replace("元", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


def _get_path(data: dict, dotted_path: str) -> Any:
    current: Any = data
    for part in dotted_path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _source_label(source: Any) -> str:
    if isinstance(source, dict):
        return str(source.get("sourceLabel", ""))
    if source is None:
        return ""
    return str(source)


def build_accounting_fact_pack(
    *,
    period: str,
    balance_sheet: dict,
    income_statement: dict,
    sources: dict,
    evidence: list[dict] | None = None,
    cash_flow_statement: dict | None = None,
) -> dict:
    """构建会计司/审计司共用事实包。

    sources 的 key 使用 dotted path, 例如:
    `balance_sheet.资产总计` -> {"sourceLabel": "internal_uploaded_file", "ref": "..."}。
    """
    return {
        "period": period,
        "balance_sheet": balance_sheet,
        "income_statement": income_statement,
        "cash_flow_statement": cash_flow_statement or {},
        "sources": sources,
        "evidence": evidence or [],
    }


def accounting_verified_facts(fact_pack: dict) -> dict:
    """把会计事实包展平成数字回链可用的 verified_facts。"""
    facts = {
        "period": fact_pack.get("period"),
        "balance_sheet": fact_pack.get("balance_sheet") or {},
        "income_statement": fact_pack.get("income_statement") or {},
        "cash_flow_statement": fact_pack.get("cash_flow_statement") or {},
    }
    computed_ratios = ratios(facts["income_statement"], facts["balance_sheet"])
    facts["ratios"] = {key: str(value) for key, value in computed_ratios.items() if value is not None}
    return facts


def audit_source_labels(fact_pack: dict, required_paths: list[str] | None = None) -> FinCheck:
    """审计司 sourceLabel 闸: 核心数字必须有已验证来源。"""
    required = required_paths or ACCOUNTING_REQUIRED_PATHS
    sources = fact_pack.get("sources") or {}
    gaps: list[str] = []

    for path in required:
        value = _get_path(fact_pack, path)
        if _decimal(value) is None:
            gaps.append(f"{path}:缺数字")
            continue
        label = _source_label(sources.get(path))
        if label not in VERIFIED_SOURCE_LABELS:
            gaps.append(f"{path}:sourceLabel={label or 'missing'}")

    return FinCheck(
        "会计审计sourceLabel闸",
        not gaps,
        "核心会计数字来源均已验证" if not gaps else f"待补证来源 {len(gaps)} 项",
        severity="warn",
        gaps=gaps,
    )


def accounting_office_gate(fact_pack: dict) -> AccountingAuditGate:
    """会计司 + 审计司组合门禁。

    status:
    - ready: 账平且核心来源可信;
    - needs_evidence: 账平但来源/字段缺证;
    - invalid: 会计恒等式或基础财务 sanity 失败。
    """
    balance_sheet = fact_pack.get("balance_sheet") or {}
    income_statement = fact_pack.get("income_statement") or {}

    source_check = audit_source_labels(fact_pack)
    identity_check = accounting_identity(
        balance_sheet.get("资产总计"),
        balance_sheet.get("负债合计"),
        balance_sheet.get("所有者权益"),
    )
    computed_ratios = ratios(income_statement, balance_sheet)
    sanity_checks = sanity_guards(computed_ratios)
    checks = [source_check, identity_check, *sanity_checks]

    has_invalid = any(not check.passed and check.severity == "hard_fail" for check in checks)
    if has_invalid:
        status = "invalid"
        action = "暂缓裁决: 账务地基不成立, 先由会计司修正报表/科目。"
    elif not source_check.passed:
        status = "needs_evidence"
        action = "退回补证: 账面可算, 但核心数字来源不足。"
    else:
        status = "ready"
        action = "可进入预算、出纳、投资或现金流后续判断。"

    return AccountingAuditGate(
        status=status,
        checks=checks,
        ratios=computed_ratios,
        verified_facts=accounting_verified_facts(fact_pack),
        required_action=action,
    )


def audit_report_numbers(report_text: str, fact_pack: dict) -> FinCheck:
    """审计司数字回链: 财务报告里的数字必须来自会计事实包。"""
    return verify_numbers(report_text, accounting_verified_facts(fact_pack))
