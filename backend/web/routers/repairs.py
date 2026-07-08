"""自动修复端点 —

  POST /api/runs/{run_id}/repair      — 同步修复循环
  GET  /api/repairs                   — 列出修复会话
  GET  /api/repairs/{session_id}      — 修复会话详情
  GET  /api/repair-insights           — 修复历史洞察

⚠️ /api/runs/{id}/repair/async 留给阶段 5（与 SSE streaming 一起重构）。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.flow_engine import FlowEngine
from src.repair import (
    RepairConfig,
    list_repair_sessions,
    load_repair_history,
    needs_repair,
    repair_cycle,
)
from src.step_log import load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import flow_semaphore, resolve_config_path
from web.schemas.auth import CurrentUser
from web.schemas.repairs import RepairRequest

router = APIRouter(prefix="/api", tags=["repairs"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@router.post("/runs/{run_id}/repair")
def api_repair(
    body: RepairRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    run_log = load_run(run_id)
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    config = RepairConfig(
        enabled=True,
        max_retries=body.max_retries,
        min_score=body.min_score,
        min_delta=body.min_delta,
        min_dimension_score=body.min_dimension_score,
    )

    if not needs_repair(run_log, config):
        return {
            "status": "no_repair_needed",
            "run_id": run_id,
            "message": "质量评分已达标，无需修复",
        }

    config_path = body.config or resolve_config_path(run_id)
    if not Path(config_path).is_absolute():
        config_path = str(_PROJECT_ROOT / config_path)

    if not flow_semaphore.acquire(timeout=10):
        raise HTTPException(
            status_code=429,
            detail="系统繁忙，请稍后重试（并发数已满）",
        )

    try:
        engine = FlowEngine(config_path)
        history = repair_cycle(engine, run_log, config)
    finally:
        flow_semaphore.release()

    return history.to_dict()


@router.get("/repairs")
def api_list_repairs(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_repair_sessions()


@router.get("/repairs/{session_id}")
def api_get_repair(
    session_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    history = load_repair_history(session_id)
    if history is None:
        raise HTTPException(
            status_code=404,
            detail=f"Repair session '{session_id}' not found",
        )
    return history.to_dict()


@router.get("/repair-insights")
def api_repair_insights(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    sessions = list_repair_sessions()
    if not sessions:
        return {
            "insights": [],
            "dimension_stats": {},
            "step_stats": {},
            "cases": [],
        }

    dim_fail_count: dict[str, int] = {}
    step_fail_count: dict[str, int] = {}
    success_cases: list[dict[str, Any]] = []
    total_rounds = 0
    total_sessions = len(sessions)
    improved_sessions = 0

    for s in sessions:
        history = load_repair_history(s["session_id"])
        if not history:
            continue

        session_improved = False
        for rnd in history.rounds:
            total_rounds += 1
            rnd_data = rnd if isinstance(rnd, dict) else {}
            for inst in rnd_data.get("instructions", []):
                for dim in inst.get("failure_dimensions", []) or []:
                    dim_fail_count[dim] = dim_fail_count.get(dim, 0) + 1
                step = inst.get("target_step", "")
                if step:
                    step_fail_count[step] = step_fail_count.get(step, 0) + 1
            if rnd_data.get("outcome") == "improved":
                session_improved = True

        if session_improved:
            improved_sessions += 1

        if history.stop_reason == "threshold_met" and history.rounds:
            fr = history.rounds[0] if isinstance(history.rounds[0], dict) else {}
            lr = history.rounds[-1] if isinstance(history.rounds[-1], dict) else {}
            success_cases.append({
                "session_id": history.session_id,
                "task_preview": history.task_input[:80] if history.task_input else "",
                "original_run_id": history.original_run_id,
                "final_run_id": history.final_run_id,
                "score_before": fr.get("total_before", 0),
                "score_after": lr.get("total_after", 0),
                "rounds_needed": len(history.rounds),
                "dimensions_fixed": list({
                    dim
                    for rnd in history.rounds
                    for inst in (
                        rnd.get("instructions", []) if isinstance(rnd, dict) else []
                    )
                    for dim in (inst.get("failure_dimensions", []) or [])
                }),
            })

    sorted_dims = sorted(dim_fail_count.items(), key=lambda x: -x[1])
    sorted_steps = sorted(step_fail_count.items(), key=lambda x: -x[1])

    insights: list[dict[str, Any]] = []
    for dim, count in sorted_dims[:3]:
        insights.append({
            "type": "dimension",
            "target": dim,
            "frequency": count,
            "suggestion": f"维度「{dim}」被修复 {count} 次，建议在相关 Agent 的 prompt 中增加针对性铁律约束",
        })
    for step, count in sorted_steps[:3]:
        insights.append({
            "type": "step",
            "target": step,
            "frequency": count,
            "suggestion": f"步骤「{step}」被修复 {count} 次，建议审查该 Agent 的 prompt 质量",
        })

    return {
        "total_sessions": total_sessions,
        "improved_sessions": improved_sessions,
        "total_rounds": total_rounds,
        "success_rate": round(improved_sessions / total_sessions * 100, 1) if total_sessions else 0,
        "dimension_stats": dict(sorted_dims),
        "step_stats": dict(sorted_steps),
        "insights": insights,
        "cases": success_cases[:20],
    }
