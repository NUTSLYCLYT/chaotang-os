"""户部付款裁决预览 contract。

本模块只做确定性预览: 会计/审计 -> 出纳 -> 预算 -> 户部奏折。
它不写数据库、不执行付款、不触发真实蜂群。
"""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from decimal import Decimal
from hashlib import sha1
from typing import Any

from src.hubu_accounting_audit import accounting_office_gate, build_accounting_fact_pack
from src.hubu_budget import budget_gate, build_budget_fact_pack
from src.hubu_memorial import build_hubu_memorial
from src.hubu_treasury import build_treasury_fact_pack, payment_gate


REQUIRED_TOP_LEVEL_KEYS = ("caseId", "title", "decisionType", "accounting", "treasury", "budget", "paymentRequest")

BUTTON_LABELS = {
    "approve": "批准",
    "archive_preview": "存入史馆草稿",
    "block": "阻断",
    "confirm_with_risk_gate": "确认风险后批准",
    "return_for_correction": "退回修正",
    "return_for_council_review": "交军机处再议",
    "return_for_evidence": "退回补证",
    "return_for_legal_review": "交刑部复核",
    "save_draft": "保存草稿",
}


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if is_dataclass(value):
        return _jsonable(asdict(value))
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _source_label_summary(section: dict) -> list[str]:
    labels: list[str] = []
    for source in (section.get("sources") or {}).values():
        if isinstance(source, dict):
            label = str(source.get("sourceLabel") or "").strip()
            if label:
                labels.append(label)
    return sorted(set(labels))


def _require_case_shape(case: dict) -> None:
    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in case]
    if missing:
        raise ValueError(f"付款预览事实包缺少字段: {', '.join(missing)}")
    for section in ("accounting", "treasury", "budget", "paymentRequest"):
        if not isinstance(case.get(section), dict):
            raise ValueError(f"付款预览事实包字段必须是 object: {section}")


def decision_actions_for(recommendation: str) -> dict:
    """把户部建议转换成前端老板按钮契约。

    这里只生成允许展示的动作, 不执行付款、不归档、不写库。
    """
    contract = {
        "approve": {
            "primaryAction": "approve",
            "allowedActions": ["approve", "archive_preview", "save_draft"],
            "blockedActions": [],
            "requiresSecondConfirmation": False,
            "archiveEligible": True,
            "ownerHint": "boss",
        },
        "needs_confirmation": {
            "primaryAction": "confirm_with_risk_gate",
            "allowedActions": ["confirm_with_risk_gate", "return_for_council_review", "save_draft"],
            "blockedActions": ["approve"],
            "requiresSecondConfirmation": True,
            "archiveEligible": True,
            "ownerHint": "boss",
        },
        "needs_evidence": {
            "primaryAction": "return_for_evidence",
            "allowedActions": ["return_for_evidence", "save_draft"],
            "blockedActions": ["approve", "confirm_with_risk_gate"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "accounting_or_treasury",
        },
        "blocked": {
            "primaryAction": "block",
            "allowedActions": ["return_for_correction", "save_draft"],
            "blockedActions": ["approve", "confirm_with_risk_gate"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "hubu",
        },
        "legal_review": {
            "primaryAction": "return_for_legal_review",
            "allowedActions": ["return_for_legal_review", "save_draft"],
            "blockedActions": ["approve", "confirm_with_risk_gate"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "xingbu",
        },
        "council_review": {
            "primaryAction": "return_for_council_review",
            "allowedActions": ["return_for_council_review", "save_draft"],
            "blockedActions": ["approve"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "junjichu",
        },
        "pause": {
            "primaryAction": "save_draft",
            "allowedActions": ["save_draft"],
            "blockedActions": ["approve", "confirm_with_risk_gate"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "hubu",
        },
    }.get(
        recommendation,
        {
            "primaryAction": "save_draft",
            "allowedActions": ["save_draft"],
            "blockedActions": ["approve", "confirm_with_risk_gate"],
            "requiresSecondConfirmation": False,
            "archiveEligible": False,
            "ownerHint": "hubu",
        },
    )
    allowed = contract["allowedActions"]
    return {
        **contract,
        "buttonLabels": {action: BUTTON_LABELS[action] for action in allowed if action in BUTTON_LABELS},
    }


def _evidence_chain(case: dict) -> list[dict]:
    chain: list[dict] = []
    for section_name in ("accounting", "treasury", "budget"):
        section = case.get(section_name) or {}
        for source_path, source in (section.get("sources") or {}).items():
            if not isinstance(source, dict):
                continue
            chain.append(
                {
                    "section": section_name,
                    "path": source_path,
                    "sourceLabel": source.get("sourceLabel") or "unknown",
                    "ref": source.get("ref"),
                }
            )
    for key, ref in ((case.get("paymentRequest") or {}).get("evidence") or {}).items():
        if ref:
            chain.append(
                {
                    "section": "paymentRequest",
                    "path": f"evidence.{key}",
                    "sourceLabel": "internal_uploaded_file",
                    "ref": ref,
                }
            )
    return chain


def _archive_id(case_id: str, recommendation: str) -> str:
    digest = sha1(f"hubu:{case_id}:{recommendation}".encode("utf-8")).hexdigest()[:12]
    return f"hubu_archive_draft_{digest}"


def build_archive_draft(case: dict, memorial: Any, decision_actions: dict) -> dict:
    """生成史馆草稿 contract。

    这里只生成可归档 payload, 不写入史馆、不生成正式 archive record。
    """
    plain = memorial.plain()
    archive_eligible = bool(decision_actions.get("archiveEligible"))
    recommendation = str(plain.get("recommendation") or "")
    return {
        "archiveMode": "draft_only",
        "archiveId": _archive_id(str(case["caseId"]), recommendation),
        "archiveEligible": archive_eligible,
        "archiveBlockedReasons": [] if archive_eligible else plain.get("missing_evidence", []),
        "sourceDepartment": "hubu",
        "agentCode": "hu_bu",
        "caseId": str(case["caseId"]),
        "memorialId": plain.get("memorial_id"),
        "title": plain.get("title"),
        "decisionType": plain.get("decision_type"),
        "decisionStatus": "pending_boss_decision",
        "decisionResult": recommendation,
        "decisionReason": plain.get("summary"),
        "riskLevel": plain.get("risk_level"),
        "riskGates": plain.get("risk_gates", []),
        "sourceLabelSummary": plain.get("source_label_summary", {}),
        "evidenceChain": _evidence_chain(case),
        "auditTrail": plain.get("audit_trail", []),
        "relatedPastCases": case.get("relatedPastCases") or [],
        "nextActions": plain.get("next_actions", []),
    }


def _decision_receipt_id(case_id: str, action: str) -> str:
    digest = sha1(f"hubu-decision:{case_id}:{action}".encode("utf-8")).hexdigest()[:12]
    return f"hubu_decision_preview_{digest}"


def build_boss_decision_preview(case: dict, decision_input: dict) -> dict:
    """校验老板裁决输入并生成裁决收据草稿。

    这里只校验动作和确认字段, 不执行付款、不写史馆、不更新数据库。
    """
    if not isinstance(decision_input, dict):
        raise ValueError("decisionInput 必须是 object")
    action = str(decision_input.get("action") or "").strip()
    if not action:
        raise ValueError("decisionInput.action 不能为空")
    decided_by = str(decision_input.get("decidedBy") or "").strip()
    if not decided_by:
        raise ValueError("decisionInput.decidedBy 不能为空")

    preview = build_hubu_payment_preview(case)
    actions = preview["decisionActions"]
    allowed = actions.get("allowedActions") or []
    if action not in allowed:
        raise ValueError(f"当前户部结论不允许执行动作: {action}")

    confirmed_risk_gates = decision_input.get("confirmedRiskGates") or []
    if actions.get("requiresSecondConfirmation"):
        risk_gates = preview["decision"].get("riskGates") or []
        missing_confirmations = [gate for gate in risk_gates if gate not in confirmed_risk_gates]
        if missing_confirmations:
            raise ValueError(f"高风险确认门未确认: {', '.join(missing_confirmations)}")

    reason = str(decision_input.get("reason") or "").strip()
    return {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "caseId": preview["caseId"],
        "decisionReceipt": {
            "receiptId": _decision_receipt_id(preview["caseId"], action),
            "action": action,
            "actionLabel": BUTTON_LABELS.get(action, action),
            "accepted": True,
            "decidedBy": decided_by,
            "reason": reason,
            "requiresSecondConfirmation": bool(actions.get("requiresSecondConfirmation")),
            "confirmedRiskGates": confirmed_risk_gates,
            "nextState": _next_state_for_action(action),
        },
        "decision": preview["decision"],
        "archiveDraft": preview["archiveDraft"],
    }


def _next_state_for_action(action: str) -> str:
    return {
        "approve": "approved_pending_archive",
        "archive_preview": "archive_draft_ready",
        "confirm_with_risk_gate": "approved_with_risk_confirmation",
        "return_for_correction": "returned_for_correction",
        "return_for_council_review": "returned_for_council_review",
        "return_for_evidence": "returned_for_evidence",
        "return_for_legal_review": "returned_for_legal_review",
        "save_draft": "saved_as_draft",
    }.get(action, "pending")


def build_hubu_payment_preview(case: dict) -> dict:
    """把付款事实包转换为前端可直接展示的户部裁决预览。

    返回值显式声明 previewOnly/executionAllowed/sideEffects, 防止被误解为真实付款执行。
    """
    _require_case_shape(case)

    accounting_pack = build_accounting_fact_pack(**case["accounting"])
    treasury_pack = build_treasury_fact_pack(**case["treasury"])
    budget_pack = build_budget_fact_pack(**case["budget"])
    payment_request = case["paymentRequest"]

    gates = {
        "accounting": accounting_office_gate(accounting_pack),
        "treasury": payment_gate(treasury_pack, payment_request),
        "budget": budget_gate(budget_pack, {"amount": payment_request.get("amount"), **payment_request}),
    }
    source_label_summary = {
        "accounting": _source_label_summary(accounting_pack),
        "treasury": _source_label_summary(treasury_pack),
        "budget": _source_label_summary(budget_pack),
    }
    memorial = build_hubu_memorial(
        memorial_id=str(case["caseId"]),
        title=str(case["title"]),
        decision_type=str(case["decisionType"]),
        gates=gates,
        known_facts=case.get("knownFacts") or [],
        source_label_summary=source_label_summary,
    )

    decision_actions = decision_actions_for(memorial.recommendation)
    return {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "officeChain": ["accounting", "treasury", "budget", "memorial"],
        "caseId": str(case["caseId"]),
        "decision": {
            "recommendation": memorial.recommendation,
            "riskLevel": memorial.risk_level,
            "missingEvidence": memorial.missing_evidence,
            "riskGates": memorial.risk_gates,
            "nextActions": memorial.next_actions,
        },
        "decisionActions": decision_actions,
        "archiveDraft": build_archive_draft(case, memorial, decision_actions),
        "gates": _jsonable(gates),
        "memorial": memorial.plain(),
    }
