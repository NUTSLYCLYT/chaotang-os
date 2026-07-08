"""src/pack_rd_report.py — 把 flow_pack_rd 蜂群的完整产出聚合成前端能用的报告。

现状(2026-07-06 查明):flow_pack_rd.yaml 是一条已跑通、持续迭代(6月中~7月初多次
真实运行修 bug)的成熟蜂群——11 个专业角色 + 197 芯真值库 + 双确定性闸
(sizing_validation/cost_validation,no-LLM)+ 五维度评审门(强制引用机器 verdict,
禁 LLM 自评)。但产出被前端完全丢弃:reverify 只回读 session_id/status/
source_label,11 个 output_fields(需求规格/成本/供应链/BMS/结构热/工艺/测试/
评审/BOM/风险)一个字段都没有回传。本模块补上"聚合→诚实标源→交前端"这一环,
不重新发明确定性门(那两道闸已经够硬),只做取数 + 标源 + 缺失容错。
"""

from __future__ import annotations

from typing import Any

# step agent_name → 报告里的语义段落 key(仅收录 11 个 output_fields 直接对应的关键步骤;
# 其余专业角色的 output 作为 sections 全量透出,不遗漏)。
_GATE_STEPS = {
    "sizing_validation": "sizing_gate_verdict",
    "cost_validation": "cost_gate_verdict",
}
_NARRATIVE_STEPS = ("expert_review_gate", "pack_summary_expert", "executive_summary")


def _overall_light(sizing: dict | None, cost: dict | None) -> tuple[str, bool]:
    """综合两道确定性闸算总灯色。任一 FAIL → red;任一 UNKNOWN/缺失 → yellow;
    都 PASS/green → green。返回 (light, deterministic_gated)。
    """
    if sizing is None and cost is None:
        return "yellow", False
    sizing_fail = sizing is not None and (
        sizing.get("seriesTruth") == "FAIL" or sizing.get("parallelTruth") == "FAIL"
    )
    cost_fail = (
        cost is not None
        and cost.get("green") is False
        and cost.get("extracted") is True
    )
    if sizing_fail or cost_fail:
        return "red", True
    sizing_unknown = sizing is None or not sizing.get("extracted", True)
    cost_unknown = cost is None or not cost.get("extracted", True)
    if sizing_unknown or cost_unknown:
        return "yellow", False
    return "green", True


def build_pack_report(run_id: str) -> dict[str, Any]:
    """聚合一次 pack_rd run 的完整产出(HTTP 路由用)。找不到 run 时诚实返回,不抛异常。"""
    from src.step_log import load_run

    run_log = load_run(run_id)
    if run_log is None:
        return {
            "found": False,
            "run_id": run_id,
            "headline": "未找到该 run(可能尚未跑完或 run_id 有误)",
            "source_label": "NOT_FOUND",
        }
    return _aggregate_pack_report(run_log, run_id)


def _aggregate_pack_report(run_log: Any, run_id: str) -> dict[str, Any]:
    """核心聚合逻辑,接受已加载的 run_log 对象,便于单测注入 mock,不依赖文件系统。"""
    steps = getattr(run_log, "steps", None) or []
    # 按 step_id(yaml 里的 id,稳定)匹配,不用 agent_name(渲染后的中文角色名,
    # 会随 prompt 措辞变化,不可靠)。
    by_name = {getattr(s, "step_id", ""): s for s in steps}

    sizing = None
    cost = None
    for step_name, verdict_key in _GATE_STEPS.items():
        s = by_name.get(step_name)
        if s is None:
            continue
        raw = getattr(s, "raw_response", None)
        if isinstance(raw, dict) and verdict_key in raw:
            if step_name == "sizing_validation":
                sizing = raw[verdict_key]
            else:
                cost = raw[verdict_key]

    light, gated = _overall_light(sizing, cost)

    narrative: dict[str, str] = {}
    for step_name in _NARRATIVE_STEPS:
        s = by_name.get(step_name)
        if s is not None and getattr(s, "output", ""):
            narrative[step_name] = s.output

    sections: dict[str, str] = {}
    for name, s in by_name.items():
        if name in _GATE_STEPS or name in _NARRATIVE_STEPS:
            continue
        out = getattr(s, "output", "")
        if out:
            sections[name] = out

    missing_gates = [step_name for step_name in _GATE_STEPS if step_name not in by_name]
    missing_narrative = [
        step_name for step_name in _NARRATIVE_STEPS if step_name not in by_name
    ]

    return {
        "found": True,
        "run_id": run_id,
        "light": light,
        "deterministic_gated": gated,
        "source_label": "DETERMINISTIC_GATE" if gated else "PARTIAL_OR_UNVERIFIED",
        "sizing_gate_verdict": sizing,
        "cost_gate_verdict": cost,
        "narrative": narrative,
        "sections": sections,
        "missing_steps": {"gates": missing_gates, "narrative": missing_narrative},
        "step_count": len(steps),
    }
