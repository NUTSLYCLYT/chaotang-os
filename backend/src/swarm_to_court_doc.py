"""src/swarm_to_court_doc.py — 蜂群输出 → court_doc 焊缝(方案A'数据桥)。

把蜂群成员的 SwarmOutputV1(swarm_id/summary/key_findings/risks/missing_evidence/confidence…)
转成全院 court_doc 的 items,再经 dept_doc 装配。这是"court_doc 接成蜂群装配末段"的**数据桥**(纯函数、可测)。

边界:本模块只做形状转换 + 装配,**不改 live 派单循环**(那步深焊要单独小心做)。
焊死护栏:装配走 dept_doc→court_doc_builder,自带 C2(assert_not_gating)+ 接地门;
risks/missing_evidence 缺证据 → 由上游传 rag_hit/deterministic_gated 决定是否降级(禁假 PASS)。
"""
from __future__ import annotations

from src import dept_doc

# 风险严重度词 → court_doc 灯
_RISK_LEVEL = {
    "critical": "red", "high": "red", "严重": "red", "高": "red",
    "medium": "yellow", "中": "yellow", "moderate": "yellow",
    "low": "green", "低": "green",
}


def _risk_to_item(r) -> dict:
    """SwarmOutputV1.risks 的一条 → court_doc item。兼容 str 或 dict。"""
    if isinstance(r, dict):
        sev = str(r.get("severity") or r.get("level") or "medium").lower()
        return {
            "level": _RISK_LEVEL.get(sev, "yellow"),
            "title": str(r.get("title") or r.get("risk") or r.get("desc") or r),
            "impact": r.get("impact"),
            "fix": r.get("mitigation") or r.get("fix"),
            "evidence_ref": r.get("evidence_ref"),
        }
    return {"level": "yellow", "title": str(r)}


def swarm_outputs_to_items(outputs: list[dict]) -> list[dict]:
    """多个 SwarmOutputV1 → court_doc items(风险按严重度,缺证据单列)。"""
    items: list[dict] = []
    for o in outputs or []:
        for r in (o.get("risks") or []):
            items.append(_risk_to_item(r))
        for miss in (o.get("missing_evidence") or []):
            items.append({"level": "yellow", "title": f"缺证据:{miss}",
                          "evidence_ref": o.get("swarm_id")})
    return items


def assemble_from_swarm(
    dept: str,
    outputs: list[dict],
    *,
    question: str = "",
    advisors: list[str] | None = None,
    rag_hit: bool = False,
    deterministic_gated: bool | None = None,
    archive: bool = True,
) -> dict:
    """蜂群输出 → 该部门 court_doc(经 dept_doc:口吻 + C2 + 接地门 + 存证)。

    source_label 取蜂群里最差的(有 FALLBACK 即 FALLBACK),不假装 LIVE。
    """
    labels = [str(o.get("source_label") or "FALLBACK") for o in (outputs or [])]
    worst = "FALLBACK" if (not labels or "FALLBACK" in labels) else (
        "MIXED" if "MIXED" in labels else labels[0])
    return dept_doc.build_dept_doc(
        dept,
        items=swarm_outputs_to_items(outputs),
        question=question,
        advisors=advisors,
        rag_hit=rag_hit,
        deterministic_gated=deterministic_gated,
        archive=archive,
        source_label=worst,
    )
