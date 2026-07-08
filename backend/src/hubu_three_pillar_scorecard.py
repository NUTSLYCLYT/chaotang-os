"""户部供应链、财务、投资三板块 100 分就绪度总闸。

本模块只做确定性评分和裁决前风险归集:
- 不连接外部服务
- 不生成交易/付款/采购指令
- 不写数据库
- 不替代人工复核
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


SUPPLY_WEIGHT = Decimal("0.30")
FINANCE_WEIGHT = Decimal("0.40")
INVESTMENT_WEIGHT = Decimal("0.30")

REQUIRED_SUPPLY_FORBIDDEN_ACTIONS = {
    "no_auto_payment",
    "no_auto_purchase_order",
    "no_vendor_commitment",
}
REQUIRED_INVESTMENT_FORBIDDEN_ACTIONS = {
    "no_auto_trade",
    "no_buy_sell_recommendation",
}


def build_hubu_three_pillar_scorecard(
    *,
    supply_chain: dict[str, Any] | None = None,
    finance: dict[str, Any] | None = None,
    investment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a boss-facing readiness scorecard for Hubu's three key pillars."""

    supply_score = _score_supply_chain(supply_chain)
    finance_score = _score_finance(finance)
    investment_score = _score_investment(investment)
    pillars = {
        "supplyChain": supply_score,
        "finance": finance_score,
        "investment": investment_score,
    }
    overall_score = _weighted_score(supply_score["score"], finance_score["score"], investment_score["score"])
    blockers = _merge_items(pillar["blockers"] for pillar in pillars.values())
    improvements = _merge_items(pillar["improvements"] for pillar in pillars.values())
    status = _overall_status(overall_score, blockers, pillars)

    missing_for_100 = blockers + improvements
    boss_brief = _boss_brief(overall_score, status, blockers, improvements)
    return {
        "department": "户部",
        "reportType": "three_pillar_readiness_scorecard",
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "overallScore": overall_score,
        "grade": _grade(overall_score),
        "status": status,
        "bossBrief": boss_brief,
        "pillars": pillars,
        "p0Blockers": blockers,
        "p1Improvements": improvements,
        "missingFor100": missing_for_100,
        "hundredPointCriteria": [
            "供应链、财务、投资三板块均达到 95 分以上",
            "不存在 P0 阻塞项",
            "所有关键数字具备可信 sourceLabel/evidence",
            "付款、采购、交易、贷款申报均为预览/草稿，不自动执行",
            "高风险事项进入老板裁决或人工复核",
        ],
        "decisionOptions": [
            {"action": "archive_preview", "label": "存入史馆草稿", "allowed": status == "ready"},
            {"action": "return_for_evidence", "label": "退回补证", "allowed": bool(blockers)},
            {"action": "manual_review", "label": "交人工复核", "allowed": status != "ready"},
            {"action": "boss_decision", "label": "提交老板裁决", "allowed": status in {"ready", "needs_review"}},
        ],
        "forbiddenActions": sorted(
            {
                "no_auto_payment",
                "no_auto_purchase_order",
                "no_vendor_commitment",
                "no_auto_trade",
                "no_buy_sell_recommendation",
                "no_bank_submission",
                "no_tax_filing",
                "no_external_commitment",
            }
        ),
    }


def _score_supply_chain(memorial: dict[str, Any] | None) -> dict[str, Any]:
    if not memorial:
        return _pillar_result(
            "supply_chain",
            0,
            [_item("supply_chain", "critical", "缺少供应链报告", "请先生成供应链奏折。")],
            [],
        )

    score = 100
    blockers: list[dict[str, str]] = []
    improvements: list[dict[str, str]] = []
    status = str(memorial.get("status") or "unknown")
    if status == "needs_evidence":
        score -= 40
        blockers.append(_item("supply_chain", "critical", "供应链证据不足", "补齐供应商、采购、库存、应付数据来源。"))
    elif status == "needs_boss_decision":
        score -= 8
        improvements.append(_item("supply_chain", "medium", "供应链需要老板裁决", "优先处理到期应付、库存异常或供应商风险。"))
    elif status != "ready":
        score -= 20
        improvements.append(_item("supply_chain", "medium", f"供应链状态未收口: {status}", "确认供应链奏折状态。"))

    score -= _deduct_issues(
        memorial.get("riskIssues") or [],
        blockers,
        improvements,
        source="supply_chain",
        title_prefix="供应链风险",
    )
    if memorial.get("errors"):
        score -= 10 * len(memorial["errors"])
        blockers.append(_item("supply_chain", "high", "供应链导入存在错误", "修正 CSV/证据包后重跑供应链报告。"))
    missing = REQUIRED_SUPPLY_FORBIDDEN_ACTIONS - set(memorial.get("forbiddenActions") or [])
    if missing:
        score -= 30
        blockers.append(_item("supply_chain", "critical", "供应链执行红线不完整", f"缺少红线: {', '.join(sorted(missing))}。"))

    return _pillar_result("supply_chain", score, blockers, improvements)


def _score_finance(preview: dict[str, Any] | None) -> dict[str, Any]:
    if not preview:
        return _pillar_result(
            "finance",
            0,
            [_item("finance", "critical", "缺少财务总览", "请先生成财务报表/审计/融资材料预览。")],
            [],
        )

    score = 100
    blockers: list[dict[str, str]] = []
    improvements: list[dict[str, str]] = []
    if preview.get("previewOnly") is not True or preview.get("sideEffects") != "none":
        score -= 40
        blockers.append(_item("finance", "critical", "财务模块必须保持预览无副作用", "禁止自动付款、自动申报或外部提交。"))
    if preview.get("executionAllowed") is not False:
        score = 0
        blockers.append(_item("finance", "critical", "财务模块出现自动执行权限", "关闭 executionAllowed，并改为老板确认/人工复核。"))

    risk_level = str(((preview.get("bossBrief") or {}).get("riskLevel") or "unknown")).lower()
    if risk_level == "blocked":
        score -= 50
        blockers.append(_item("finance", "critical", "财务报告被阻塞", "先解决资产负债不平、来源不足或付款异常。"))
    elif risk_level == "high":
        score -= 30
        blockers.append(_item("finance", "high", "财务高风险", "交审计复核并补齐关键证据。"))
    elif risk_level == "medium":
        score -= 12
        improvements.append(_item("finance", "medium", "财务中风险", "补充解释材料后再提交老板裁决。"))
    elif risk_level not in {"low", "healthy"}:
        score -= 8
        improvements.append(_item("finance", "low", "财务风险等级不明确", "统一 bossBrief.riskLevel。"))

    score -= _deduct_issues(
        preview.get("auditFindings") or [],
        blockers,
        improvements,
        source="finance",
        title_prefix="财务审计发现",
    )
    archive = preview.get("archiveDraft") or {}
    if archive.get("archiveEligible") is False:
        score -= 8
        improvements.append(_item("finance", "medium", "财务草稿暂不可归档", "完成审计补证后再入史馆。"))

    return _pillar_result("finance", score, blockers, improvements)


def _score_investment(memorial: dict[str, Any] | None) -> dict[str, Any]:
    if not memorial:
        return _pillar_result(
            "investment",
            0,
            [_item("investment", "critical", "缺少投资组合报告", "请先生成投资风险奏折。")],
            [],
        )

    score = 100
    blockers: list[dict[str, str]] = []
    improvements: list[dict[str, str]] = []
    status = str(memorial.get("status") or "unknown")
    if status == "needs_evidence":
        score -= 40
        blockers.append(_item("investment", "critical", "投资数据证据不足", "补齐账户、持仓、行情、估值来源。"))
    elif status == "needs_review":
        score -= 15
        improvements.append(_item("investment", "medium", "投资组合需要复核", "复核集中度、亏损、估值和风险披露。"))
    elif status != "ready":
        score -= 20
        improvements.append(_item("investment", "medium", f"投资状态未收口: {status}", "确认投资奏折状态。"))

    risk_issues = memorial.get("risk_issues") or memorial.get("riskIssues") or []
    score -= _deduct_issues(risk_issues, blockers, improvements, source="investment", title_prefix="投资风险")
    warnings = memorial.get("warnings") or []
    if warnings:
        score -= min(15, len(warnings) * 3)
        improvements.append(_item("investment", "low", "投资报告存在提示项", "逐项确认行情、估值或来源提示。"))

    concentration = _decimal((memorial.get("summary") or {}).get("top_concentration_percent"))
    if concentration is not None:
        if concentration > Decimal("50"):
            score -= 15
            blockers.append(_item("investment", "high", "投资集中度过高", f"第一大持仓占比 {concentration}%，需人工复核。"))
        elif concentration > Decimal("30"):
            score -= 8
            improvements.append(_item("investment", "medium", "投资集中度偏高", f"第一大持仓占比 {concentration}%，建议复核。"))

    missing = REQUIRED_INVESTMENT_FORBIDDEN_ACTIONS - set(memorial.get("forbidden_actions") or memorial.get("forbiddenActions") or [])
    if missing:
        score -= 35
        blockers.append(_item("investment", "critical", "投资交易红线不完整", f"缺少红线: {', '.join(sorted(missing))}。"))

    return _pillar_result("investment", score, blockers, improvements)


def _weighted_score(supply_score: int, finance_score: int, investment_score: int) -> int:
    score = (
        Decimal(supply_score) * SUPPLY_WEIGHT
        + Decimal(finance_score) * FINANCE_WEIGHT
        + Decimal(investment_score) * INVESTMENT_WEIGHT
    )
    return int(score.quantize(Decimal("1")))


def _overall_status(overall_score: int, blockers: list[dict[str, str]], pillars: dict[str, dict[str, Any]]) -> str:
    if any(item.get("severity") == "critical" for item in blockers):
        return "blocked"
    if blockers or overall_score < 90:
        return "needs_review"
    if any(pillar["score"] < 90 for pillar in pillars.values()):
        return "needs_review"
    return "ready"


def _boss_brief(
    overall_score: int,
    status: str,
    blockers: list[dict[str, str]],
    improvements: list[dict[str, str]],
) -> dict[str, Any]:
    if status == "ready":
        one_sentence = f"户部三板块就绪度 {overall_score} 分，可进入老板裁决或史馆草稿。"
    elif status == "blocked":
        one_sentence = f"户部三板块就绪度 {overall_score} 分，存在 P0 阻塞项，不能直接裁决。"
    else:
        one_sentence = f"户部三板块就绪度 {overall_score} 分，建议复核后再裁决。"
    return {
        "oneSentence": one_sentence,
        "topBlockers": blockers[:5],
        "topImprovements": improvements[:5],
        "nextAction": "boss_decision" if status == "ready" else "return_for_evidence_or_manual_review",
    }


def _deduct_issues(
    issues: list[dict[str, Any]],
    blockers: list[dict[str, str]],
    improvements: list[dict[str, str]],
    *,
    source: str,
    title_prefix: str,
) -> int:
    deduction = 0
    for issue in issues:
        severity = str(issue.get("severity") or "medium").lower()
        title = str(issue.get("title") or issue.get("type") or title_prefix)
        if severity == "critical":
            deduction += 30
            blockers.append(_item(source, "critical", title, "必须先处理该 P0 风险。"))
        elif severity == "high":
            deduction += 15
            blockers.append(_item(source, "high", title, "需人工复核后才能裁决。"))
        elif severity == "medium":
            deduction += 6
            improvements.append(_item(source, "medium", title, "建议补证或解释。"))
        else:
            deduction += 2
            improvements.append(_item(source, "low", title, "记录为后续优化项。"))
    return deduction


def _pillar_result(
    pillar: str,
    score: int,
    blockers: list[dict[str, str]],
    improvements: list[dict[str, str]],
) -> dict[str, Any]:
    clamped_score = _clamp(score)
    if any(item["severity"] == "critical" for item in blockers):
        status = "blocked"
    elif blockers or clamped_score < 90:
        status = "needs_review"
    else:
        status = "ready"
    return {
        "pillar": pillar,
        "score": clamped_score,
        "grade": _grade(clamped_score),
        "status": status,
        "blockers": blockers,
        "improvements": improvements,
    }


def _item(source: str, severity: str, title: str, action: str) -> dict[str, str]:
    return {
        "source": source,
        "severity": severity,
        "title": title,
        "action": action,
    }


def _merge_items(groups: Any) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    for group in groups:
        merged.extend(group)
    return merged


def _grade(score: int) -> str:
    if score >= 95:
        return "A+"
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _clamp(value: int) -> int:
    return max(0, min(100, int(value)))


def _decimal(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).replace("%", "").replace(",", "").strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None
