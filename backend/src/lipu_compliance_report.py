"""src/lipu_compliance_report.py — 礼部合规审核司三源聚合(2026-07-06 新增,
2026-07-07 补第三源)。

背景:今天设计礼部"司"体系时发现合规审核职能散落三处——lipu_vet(确定性反幻觉
硬闸)、flow_lipu.lipu_review(LLM 软意见)、flow_xiaohongshu.xhs_monitor(舆情软
意见),各自独立、没有聚合。这跟工部"质量司四闸合一"是同一个模式(见
src/project_quality_report.py)。

**硬闸+lipu_review(二源)不需要 project_id**:这两者同属一次 flow_lipu 执行
(本函数自包含调用,内部自己跑一遍 flow_lipu)。**xhs_monitor(舆情,第三源)
是另一个独立蜂群(flow_xiaohongshu)的产出**,只有调用方额外传入 project_id、
且那次 flow_xiaohongshu 是通过 SwarmOrchestrator(带同一 project_id)触发的,
才能被这里查到——本函数本身不通过 SwarmOrchestrator 跑,所以"这次 lipu 执行"
不会被记进 project_id 下,project_id 只用来*读*外部已存在的 xiaohongshu session。

**刻意的设计边界(禁止违反,跟工部四闸合一同一条铁律)**:硬灯(light)只由
lipu_vet 的确定性素材回链判定决定,lipu_review 和 xhs_monitor 都是 LLM 生成的
专业意见,再详实也不是机器可验证判定,不得参与红绿灯判定,只标 LLM_ONLY /
ENGINE_BACKED 附加展示。
"""

from __future__ import annotations

from typing import Any


def _find_latest_completed_run_id(sessions: list[dict], swarm_id: str) -> str | None:
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


def build_lipu_compliance_report(
    task_input: str, *, archive: bool = False, project_id: str | None = None
) -> dict[str, Any]:
    """跑一次 flow_lipu,聚合 lipu_vet(硬闸)+ lipu_review(软意见)+ 可选
    xhs_monitor(舆情第三源,需 project_id 且对应 xiaohongshu 蜂群已完成)。

    真实 LLM 调用,非确定性;lipu_vet 那道硬闸本身是确定性素材回链匹配。
    """
    from pathlib import Path

    from src.flow_engine import FlowEngine
    from src.lipu_vet import build_lipu_verdict

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / "flow_lipu.yaml"
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)

    draft = run_log.final_output
    if isinstance(
        draft, dict
    ):  # QA 输出的 final_output 字段可能是分段 dict,同 lipu_vet._run_flow_and_vet
        draft = "\n".join(str(v) for v in draft.values())
    doc = build_lipu_verdict(
        str(draft or ""), task_input, question=task_input, archive=archive
    )

    review_text = None
    for s in getattr(run_log, "steps", None) or []:
        if getattr(s, "step_id", "") == "lipu_review" and getattr(s, "output", ""):
            review_text = s.output
            break

    xhs_text = None
    xhs_run_id = None
    if project_id:
        from src.swarm_orchestrator import list_sessions_by_project

        sessions = list_sessions_by_project(project_id)
        xhs_run_id = _find_latest_completed_run_id(sessions, "xiaohongshu")
        if xhs_run_id:
            xhs_text = _extract_step_output(xhs_run_id, "xhs_monitor")

    missing_coverage = []
    if not review_text:
        missing_coverage.append("lipu_review(合规软意见)未产出")
    if not xhs_text:
        if not project_id:
            missing_coverage.append(
                "xhs_monitor(舆情软意见)——未传 project_id,未尝试关联"
            )
        else:
            missing_coverage.append(
                "xhs_monitor(舆情软意见)——已传 project_id 但未找到已完成的 xiaohongshu 会话"
            )

    return {
        "light": doc.get("light"),
        "headline": doc.get("headline"),
        "items": doc.get("items"),
        "source_label": "DETERMINISTIC_GATE",
        "deterministic_gated": True,
        "review_opinion": (
            {"text": review_text, "source_label": "LLM_ONLY"} if review_text else None
        ),
        "xhs_monitor_opinion": (
            {"text": xhs_text, "source_label": "ENGINE_BACKED", "run_id": xhs_run_id}
            if xhs_text
            else None
        ),
        "missing_coverage": missing_coverage,
    }
