"""户部奏折最小 contract。

把会计/审计、预算、出纳、投资等岗位 gate 汇总成老板可读裁决。
本模块不调 LLM、不写库、不改 flow。它只做确定性汇总。
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from decimal import Decimal
from typing import Any


RECOMMENDATION_PRIORITY = {
    "blocked": 50,
    "legal_review": 45,
    "needs_evidence": 40,
    "needs_confirmation": 35,
    "council_review": 30,
    "pause": 20,
    "approve": 10,
}


@dataclass
class HubuMemorial:
    """老板可读的户部奏折。"""

    memorial_id: str
    title: str
    decision_type: str
    recommendation: str
    risk_level: str
    summary: str
    known_facts: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    missing_evidence: list[str] = field(default_factory=list)
    risk_gates: list[str] = field(default_factory=list)
    source_label_summary: dict[str, Any] = field(default_factory=dict)
    audit_trail: list[dict[str, Any]] = field(default_factory=list)
    next_actions: list[str] = field(default_factory=list)

    def plain(self) -> dict:
        """返回可 JSON 化 dict。"""
        return _jsonable(asdict(self))


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _gate_to_dict(gate: Any) -> dict:
    if gate is None:
        return {}
    if isinstance(gate, dict):
        return gate
    if is_dataclass(gate):
        return asdict(gate)
    return {"status": getattr(gate, "status", None), "required_action": getattr(gate, "required_action", "")}


def _checks_from_gate(gate: Any) -> list[dict]:
    gate_dict = _gate_to_dict(gate)
    checks = gate_dict.get("checks") or []
    out: list[dict] = []
    for check in checks:
        item = asdict(check) if is_dataclass(check) else check
        if isinstance(item, dict):
            out.append(item)
    return out


def _recommendation_for_status(status: str) -> str:
    return {
        "ready": "approve",
        "within_budget": "approve",
        "near_limit": "needs_confirmation",
        "needs_confirmation": "needs_confirmation",
        "needs_evidence": "needs_evidence",
        "invalid": "blocked",
        "blocked": "blocked",
        "over_budget": "needs_confirmation",
    }.get(status, "pause")


def _risk_level(recommendation: str, risk_gates: list[str]) -> str:
    if recommendation == "blocked":
        return "blocked"
    if any(gate in risk_gates for gate in ("over_budget", "large_payment", "related_party", "external_commitment")):
        return "high"
    if recommendation in {"needs_evidence", "needs_confirmation", "council_review"}:
        return "medium"
    return "low"


def _choose_recommendation(gates: dict[str, Any], extra_risk_gates: list[str]) -> str:
    recommendations = [_recommendation_for_status(_gate_to_dict(gate).get("status", "")) for gate in gates.values() if gate]
    if not recommendations:
        return "needs_evidence"
    if "legal_redline" in extra_risk_gates:
        recommendations.append("legal_review")
    return max(recommendations, key=lambda item: RECOMMENDATION_PRIORITY[item])


def _collect_missing_evidence(gates: dict[str, Any]) -> list[str]:
    gaps: list[str] = []
    for name, gate in gates.items():
        for check in _checks_from_gate(gate):
            if check.get("passed") is False:
                for gap in check.get("gaps") or []:
                    gaps.append(f"{name}:{gap}")
    return gaps


def _collect_risk_gates(gates: dict[str, Any], extra: list[str] | None = None) -> list[str]:
    out: list[str] = []
    for gate in gates.values():
        gate_dict = _gate_to_dict(gate)
        out.extend(gate_dict.get("risk_gates") or [])
    out.extend(extra or [])
    return list(dict.fromkeys(out))


def _collect_metrics(gates: dict[str, Any]) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    for name, gate in gates.items():
        gate_dict = _gate_to_dict(gate)
        for key in (
            "ratios",
            "available_cash",
            "payment_amount",
            "budget_amount",
            "actual_used",
            "committed_amount",
            "request_amount",
            "remaining_before_request",
            "remaining_after_request",
            "usage_after_request_ratio",
        ):
            if key in gate_dict:
                metrics[f"{name}.{key}"] = gate_dict[key]
    return metrics


def _next_actions(recommendation: str, risk_gates: list[str], missing_evidence: list[str]) -> list[str]:
    if recommendation == "blocked":
        return ["暂缓裁决, 先修复阻断项。", *[f"补齐/修正: {gap}" for gap in missing_evidence[:5]]]
    if recommendation == "needs_evidence":
        return ["退回补证。", *[f"补证: {gap}" for gap in missing_evidence[:5]]]
    if recommendation == "needs_confirmation":
        return ["提交老板二次确认。", *[f"确认风险门: {gate}" for gate in risk_gates]]
    if recommendation == "legal_review":
        return ["交刑部/法务复核后再裁决。"]
    if recommendation == "council_review":
        return ["交军机处会审后再裁决。"]
    return ["可进入老板批准。"]


def build_hubu_memorial(
    *,
    memorial_id: str,
    title: str,
    decision_type: str,
    gates: dict[str, Any],
    known_facts: list[str] | None = None,
    extra_risk_gates: list[str] | None = None,
    source_label_summary: dict[str, Any] | None = None,
) -> HubuMemorial:
    """汇总户部岗位 gate 为老板奏折。"""
    risk_gates = _collect_risk_gates(gates, extra_risk_gates)
    missing_evidence = _collect_missing_evidence(gates)
    recommendation = _choose_recommendation(gates, risk_gates)
    risk_level = _risk_level(recommendation, risk_gates)
    metrics = _collect_metrics(gates)
    audit_trail = [
        {
            "office": office,
            "status": _gate_to_dict(gate).get("status"),
            "required_action": _gate_to_dict(gate).get("required_action", ""),
        }
        for office, gate in gates.items()
        if gate is not None
    ]

    summary = {
        "approve": "户部各门通过, 可进入老板批准。",
        "needs_confirmation": "户部发现高风险或接近上限事项, 需老板二次确认。",
        "needs_evidence": "户部发现证据缺口, 需退回补证。",
        "blocked": "户部发现阻断项, 暂缓裁决。",
        "legal_review": "户部发现合规/法务红线, 需交刑部复核。",
        "council_review": "户部判断事项重大或跨部门影响大, 需交军机处会审。",
        "pause": "户部建议暂缓推进。",
    }[recommendation]

    return HubuMemorial(
        memorial_id=memorial_id,
        title=title,
        decision_type=decision_type,
        recommendation=recommendation,
        risk_level=risk_level,
        summary=summary,
        known_facts=known_facts or [],
        metrics=metrics,
        missing_evidence=missing_evidence,
        risk_gates=risk_gates,
        source_label_summary=source_label_summary or {},
        audit_trail=audit_trail,
        next_actions=_next_actions(recommendation, risk_gates, missing_evidence),
    )

