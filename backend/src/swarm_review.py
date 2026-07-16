"""蜂群回奏审查簇(2026-07-14 从 swarm_execution_loop 拆出,行为零变更)。

近纯函数五件套:证据审计 → 御史批评 → 冲突检测 → 合成简报 → 质量门。
只依赖部门 outputs 的 dict 形状与 SOURCE_LABELS 诚实标契约,不碰执行/路由/LLM。
swarm_execution_loop 保留同名 re-export(外部调用方与 mock patch target 不动)。
"""

from __future__ import annotations

from typing import Any

SOURCE_LABELS = {"LIVE", "LIVE_SWARM", "LIVE_ENGINE", "MIXED", "FALLBACK", "DEMO"}
# LIVE_ENGINE:真实部门专用引擎产出(确定性重算/真实flow,非通用LLM角色扮演),
# 比 LIVE_SWARM(_live_department_position 的通用角色扮演)更可信,见 src/real_department_engines.py。


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        value = item.strip()
        if value and value not in seen:
            seen.add(value)
            out.append(value)
    return out


def evidence_audit(outputs: list[dict[str, Any]], source_label: str) -> dict[str, Any]:
    unsupported = [
        o["summary"]
        for o in outputs
        if not o.get("evidence_used") and not o.get("missing_evidence")
    ]
    missing = _dedupe([m for o in outputs for m in (o.get("missing_evidence") or [])])
    return {
        "evidence_chain": [e for o in outputs for e in (o.get("evidence_used") or [])],
        "unsupported_claims": unsupported,
        "missing_evidence": missing,
        "evidence_confidence": "低" if missing else "中",
        "source_label": source_label,
    }


def critic_report(
    outputs: list[dict[str, Any]], audit: dict[str, Any], source_label: str
) -> dict[str, Any]:
    risks = [r for o in outputs for r in (o.get("risks") or [])]
    high = [
        r
        for r in risks
        if r.get("severity") == "高" or r.get("requires_human_confirmation")
    ]
    return {
        "hidden_assumptions": (
            ["关键结论依赖未补齐证据"] if audit["missing_evidence"] else []
        ),
        "overconfident_claims": audit["unsupported_claims"],
        "risk_escalations": high,
        "emperor_questions": (
            [
                "是否允许只进入初步方案阶段？",
                "是否禁止当前阶段对外正式承诺？",
            ]
            if high or audit["missing_evidence"]
            else []
        ),
        "source_label": source_label,
    }


def detect_conflicts(
    outputs: list[dict[str, Any]], source_label: str
) -> dict[str, Any]:
    approvals = [o for o in outputs if o.get("position") == "准奏"]
    blockers = [o for o in outputs if o.get("position") in {"补证", "复核", "驳回"}]
    conflicts = []
    for blocker in blockers[:4]:
        if approvals:
            conflicts.append(
                {
                    "summary": f"{approvals[0]['swarm_role']}倾向推进，但{blocker['swarm_role']}要求{blocker['position']}：{blocker['summary']}",
                    "swarms": [approvals[0]["swarm_id"], blocker["swarm_id"]],
                    "severity": "高" if blocker.get("position") == "复核" else "中",
                }
            )
    return {"conflicts": conflicts, "source_label": source_label}


def synthesize_brief(
    outputs: list[dict[str, Any]],
    audit: dict[str, Any],
    critique: dict[str, Any],
    conflicts: dict[str, Any],
    source_label: str,
    council: bool = True,
) -> dict[str, Any]:
    """council=True:军机处合奏口吻。council=False:非军机处串行闭环,丞相回奏直呈上书房。"""
    missing = audit["missing_evidence"]
    high_risk = any(
        r.get("requires_human_confirmation") for r in critique["risk_escalations"]
    )
    if high_risk:
        action = "先人工确认高风险红线，再决定是否复核。"
    elif missing:
        action = f"先补齐关键证据：{'、'.join(missing[:4])}"
    elif council:
        action = "可进入军机处合奏并呈报皇上。"
    else:
        action = "证据与核算齐备，丞相回奏呈上书房，请皇上裁决。"
    summary = (
        "蜂群已完成后台专业产线审查，结果供军机处合奏使用。"
        if council
        else "锦衣卫采证、户部核算已串行完成，丞相回奏直呈上书房裁决。"
    )
    return {
        "executive_summary": summary,
        "department_sections": outputs,
        "evidence_chain": audit["evidence_chain"],
        "risk_register": [r for o in outputs for r in (o.get("risks") or [])],
        "missing_evidence": missing,
        "conflict_summary": conflicts["conflicts"],
        "recommended_next_action": action,
        "questions_for_emperor": critique["emperor_questions"],
        "source_label": source_label,
    }


def quality_gate(brief: dict[str, Any]) -> dict[str, Any]:
    blocking: list[str] = []
    warnings: list[str] = []
    label = brief.get("source_label")
    if label not in SOURCE_LABELS:
        blocking.append("source_label_required")
    if label == "DEMO":
        blocking.append("demo_cannot_enter_real_decision")
    if label == "FALLBACK":
        blocking.append(
            "fallback_cannot_enter_real_decision"
            if brief.get("missing_evidence")
            else "no_fallback_final_certainty"
        )
    if brief.get("missing_evidence"):
        blocking.append("missing_evidence_requires_resolution")
    if not brief.get("evidence_chain") and not brief.get("missing_evidence"):
        blocking.append("evidence_or_gap_required")
    if any(
        r.get("requires_human_confirmation") for r in brief.get("risk_register", [])
    ):
        warnings.append("high_risk_requires_human_confirmation")
    if brief.get("conflict_summary"):
        warnings.append("conflict_visible")
    if not brief.get("recommended_next_action"):
        blocking.append("one_primary_action_required")
    return {
        "passed": not blocking,
        "blocking_reasons": blocking,
        "warnings": warnings,
        "revised_output": brief,
    }
