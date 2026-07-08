"""src/project_quality_report.py — 工部质量司四闸聚合(2026-07-06 新增)。

背景:今天摸清工部 8 司现状时发现,质量司现有的 sizing/cost 两道确定性闸
(pack_rd_report.py)之外,新增的 hardware_design(DFM 评审)、
process_manufacturing(工艺FMEA)理论上也该喂给质量司,但三个蜂群各自独立
触发、互不关联——没有字段能把"这次 hardware_design 的 DFM 结论"和
"这次 pack_rd 的 sizing 结果"识别成同一个客户项目。

project_id(见 swarm_orchestrator.py OrchestratorSession/SwarmRunRequest)
补上这个关联键。本模块按 project_id 查出三个蜂群各自的 session,聚合成
一份质量视图。

**刻意的设计边界(禁止违反)**:红绿灯(light/deterministic_gated)只由
sizing/cost 两道真正 no-LLM 的确定性闸决定 —— DFM 评审和工艺 FMEA 是
LLM 生成的专业文本,再详实也不是机器可验证的确定性判定,不得参与红绿灯
判定,只能作为 ENGINE_BACKED(专业蜂群产出,强于纯 LLM 会审,但非确定性)
的附加信息展示。混淆"设计意见"和"确定性验收"就是这次要避免的"洞2"。
"""

from __future__ import annotations

from typing import Any

from src.pack_rd_report import _overall_light

_SWARM_STEP_MAP = {
    "hardware_design": "hardware_dfm_reviewer",
    "process_manufacturing": "process_fmea_analyst",
}


def _find_completed_run_id(sessions: list[dict], swarm_id: str) -> str | None:
    """在该项目全部 session 里找 swarm_id 对应、状态 completed 的最新 run_id。
    同一项目可能重跑多次(比如设计改了重新做 DFM),取最新一次。
    """
    candidates = []
    for s in sessions:
        for run in s.get("swarm_runs") or []:
            if run.get("swarm_id") == swarm_id and run.get("status") == "completed":
                candidates.append((run.get("run_id"), run.get("end_time") or ""))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[1])
    return candidates[-1][0]


def _extract_step_output(run_id: str, step_id: str) -> str | None:
    from src.step_log import load_run

    run_log = load_run(run_id)
    if run_log is None:
        return None
    for s in getattr(run_log, "steps", None) or []:
        if getattr(s, "step_id", "") == step_id and getattr(s, "output", ""):
            return s.output
    return None


def build_project_quality_report(project_id: str) -> dict[str, Any]:
    """聚合一个客户项目下 pack_rd(sizing/cost)+ hardware_design(DFM)+
    process_manufacturing(FMEA)的质量视图。找不到任何 session 时诚实返回。
    """
    from src.swarm_orchestrator import list_sessions_by_project

    sessions = list_sessions_by_project(project_id)
    if not sessions:
        return {
            "found": False,
            "project_id": project_id,
            "headline": "该项目下未找到任何蜂群 session",
            "source_label": "NOT_FOUND",
        }

    pack_rd_run_id = _find_completed_run_id(sessions, "pack_rd")
    sizing: dict | None = None
    cost: dict | None = None
    if pack_rd_run_id:
        from src.pack_rd_report import build_pack_report

        pr = build_pack_report(pack_rd_run_id)
        sizing = pr.get("sizing_gate_verdict")
        cost = pr.get("cost_gate_verdict")

    light, gated = _overall_light(sizing, cost)

    dfm_run_id = _find_completed_run_id(sessions, "hardware_design")
    dfm_text = (
        _extract_step_output(dfm_run_id, _SWARM_STEP_MAP["hardware_design"])
        if dfm_run_id
        else None
    )

    fmea_run_id = _find_completed_run_id(sessions, "process_manufacturing")
    fmea_text = (
        _extract_step_output(fmea_run_id, _SWARM_STEP_MAP["process_manufacturing"])
        if fmea_run_id
        else None
    )

    missing_coverage = []
    if pack_rd_run_id is None:
        missing_coverage.append("pack_rd(sizing/cost 确定性闸未覆盖)")
    if dfm_run_id is None:
        missing_coverage.append("hardware_design(DFM 评审未覆盖)")
    if fmea_run_id is None:
        missing_coverage.append("process_manufacturing(工艺FMEA未覆盖)")

    return {
        "found": True,
        "project_id": project_id,
        "light": light,
        "deterministic_gated": gated,
        "source_label": "DETERMINISTIC_GATE" if gated else "PARTIAL_OR_UNVERIFIED",
        "sizing_gate_verdict": sizing,
        "cost_gate_verdict": cost,
        "dfm_review": (
            {"text": dfm_text, "source_label": "ENGINE_BACKED", "run_id": dfm_run_id}
            if dfm_text
            else None
        ),
        "process_fmea": (
            {"text": fmea_text, "source_label": "ENGINE_BACKED", "run_id": fmea_run_id}
            if fmea_text
            else None
        ),
        "missing_coverage": missing_coverage,
        "session_count": len(sessions),
    }
