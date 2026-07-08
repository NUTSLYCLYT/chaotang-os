"""Adapters that turn daily department outputs into the shared Chaotang payload."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEPARTMENT_ALIASES = {
    "丞相": "prime_minister",
    "钦天监": "qintianjian",
    "工部": "gongbu",
    "户部": "hubu",
    "吏部": "libu_personnel",
    "兵部": "bingbu",
    "锦衣卫": "jinyiwei",
    "御史": "yushi",
    "史馆": "shiguan",
    "礼部": "libu",
    "刑部": "xingbu",
    "astronomer": "qintianjian",
    "product": "gongbu",
    "finance": "hubu",
    "hr": "libu_personnel",
    "sales": "bingbu",
    "aftercare": "bingbu",
    "guard": "jinyiwei",
    "historian": "shiguan",
    "market": "libu",
    "legal": "xingbu",
}

DEFAULT_OUTPUT_TYPE = {
    "prime_minister": "next_step_orchestration",
    "qintianjian": "mainline_decision",
    "gongbu": "implementation",
    "hubu": "roi_analysis",
    "libu_personnel": "personnel_assignment",
    "bingbu": "sales_battlecard",
    "jinyiwei": "external_signal",
    "yushi": "global_gate",
    "shiguan": "archive",
    "libu": "customer_message",
    "xingbu": "policy_control",
}


@dataclass(frozen=True)
class DepartmentPayload:
    run_id: str
    department: str
    output_type: str
    summary: str
    evidence: list[dict[str, Any]]
    benefit_score: float
    automation_level_requested: str
    next_action: str
    prime_minister_next_step: dict[str, Any]
    qintianjian_trigger: dict[str, Any]
    owner: str | None = None
    confidence: float | None = None
    assumptions: list[str] = field(default_factory=list)
    changed_paths: list[str] = field(default_factory=list)
    security_status: str | None = None
    finding_summary: dict[str, Any] | None = None
    human_signoff: bool | None = None
    qintianjian_brief: bool | None = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return {key: value for key, value in data.items() if value is not None}


def utc_now_id(prefix: str = "dept") -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


def normalize_department(department: str) -> str:
    raw = department.strip()
    return DEPARTMENT_ALIASES.get(raw, raw)


def infer_output_type(department: str, summary: str) -> str:
    text = summary.lower()
    if "osv" in text or "依赖" in summary or "漏洞" in summary or "security_poc" in text:
        return "dependency_security"
    if "报价" in summary or "roi" in text or "预算" in summary:
        return "quotation" if "报价" in summary else "roi_analysis"
    if any(term in summary for term in ("销售", "线索", "售后", "客户战情", "跟进")):
        return "aftercare_case" if "售后" in summary else "sales_battlecard"
    if any(term in summary for term in ("人员", "权限", "任免", "绩效", "责任")):
        return "permission_review" if "权限" in summary else "personnel_assignment"
    if "客户" in summary or "对外" in summary or "发布" in summary:
        return "customer_message"
    if "开源" in summary or "github" in text or "scorecard" in text:
        return "open_source_signal"
    return DEFAULT_OUTPUT_TYPE.get(department, "general_output")


def infer_automation_level(summary: str) -> str:
    if any(term in summary for term in ("生产", "删除", "花钱", "合同", "客户承诺")):
        return "L5"
    if "自动执行" in summary:
        return "L4"
    if any(term in summary for term in ("工具", "脚本", "扫描", "POC", "poc")):
        return "L3"
    if any(term in summary for term in ("任务", "归档", "内部")):
        return "L2"
    return "L1"


def infer_benefit_score(summary: str, evidence: list[dict[str, Any]]) -> float:
    score = 2.5
    if evidence:
        score += 1.0
    if any(term in summary for term in ("安全", "漏洞", "收益", "客户", "主线", "自动化", "节省")):
        score += 0.8
    if any(term in summary for term in ("阻断", "失败", "缺", "风险")):
        score -= 0.4
    return round(max(0.0, min(5.0, score)), 2)


def parse_changed_paths(summary: str) -> list[str]:
    return re.findall(r"(?:[\w.-]+/)+[\w.-]+", summary)


def build_prime_minister_next_step(department: str, next_action: str) -> dict[str, Any]:
    return {
        "owner": department,
        "route": department if department != "yushi" else "shiguan",
        "due": "next_review_cycle",
        "blocker": f"未完成：{next_action}",
    }


def build_qintianjian_trigger(summary: str) -> dict[str, Any]:
    if any(term in summary for term in ("发布", "上线", "生产")):
        signal = "release_gate_light"
        threshold = "green"
        decision_change = "非 green 则退回御史整改"
    elif any(term in summary for term in ("报价", "客户", "合同", "交付")):
        signal = "customer_commitment_or_assumption_change"
        threshold = "any material change"
        decision_change = "重新计算风险、报价和签字"
    else:
        signal = "evidence_or_quality_change"
        threshold = "any failed gate"
        decision_change = "回到来源部门补证据"
    return {
        "signal": signal,
        "threshold": threshold,
        "watch_window": "next_review_cycle",
        "decision_change": decision_change,
    }


def build_text_payload(
    *,
    department: str,
    summary: str,
    run_id: str | None = None,
    output_type: str | None = None,
    evidence: list[dict[str, Any]] | None = None,
    next_action: str = "进入部门协同协议和御史总判。",
    automation_level_requested: str | None = None,
    human_signoff: bool | None = None,
    qintianjian_brief: bool | None = None,
) -> dict[str, Any]:
    normalized = normalize_department(department)
    evidence = evidence or []
    payload = DepartmentPayload(
        run_id=run_id or utc_now_id(normalized),
        department=normalized,
        output_type=output_type or infer_output_type(normalized, summary),
        summary=summary,
        evidence=evidence,
        benefit_score=infer_benefit_score(summary, evidence),
        automation_level_requested=automation_level_requested or infer_automation_level(summary),
        next_action=next_action,
        prime_minister_next_step=build_prime_minister_next_step(normalized, next_action),
        qintianjian_trigger=build_qintianjian_trigger(summary),
        changed_paths=parse_changed_paths(summary),
        human_signoff=human_signoff,
        qintianjian_brief=qintianjian_brief,
    )
    return payload.to_dict()


def build_security_poc_payload(report_path: Path, run_id: str | None = None) -> dict[str, Any]:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    osv = next((item for item in report.get("results", []) if item.get("name") == "osv-scanner"), {})
    finding_summary: dict[str, Any] = {}
    for evidence in osv.get("evidence", []):
        if evidence.get("phase") == "poc":
            finding_summary = evidence.get("finding_summary") or {}
    status = str(osv.get("status", "missing_tool"))
    return DepartmentPayload(
        run_id=run_id or str(report.get("generated_at", utc_now_id("security-poc"))),
        department="gongbu",
        output_type="dependency_security",
        summary="Open-source security POC result submitted by Gongbu.",
        evidence=[{"source": str(report_path), "status": status}],
        benefit_score=4.8 if status == "poc_passed" else 4.0,
        automation_level_requested="L2",
        next_action="进入御史总判；通过后归档史馆，失败则回工部修复。",
        prime_minister_next_step=build_prime_minister_next_step(
            "gongbu",
            "进入御史总判；通过后归档史馆，失败则回工部修复。",
        ),
        qintianjian_trigger={
            "signal": "security_poc_status",
            "threshold": "poc_passed",
            "watch_window": "before_release_gate",
            "decision_change": "未通过则回工部修复并由御史阻断发布",
        },
        security_status=status,
        finding_summary=finding_summary,
    ).to_dict()
