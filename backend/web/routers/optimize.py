"""Prompt 优化闭环 — /api/runs/{run_id}/optimize/apply

行为复杂度：分析→选建议→更新 prompt（创建新版本）→ rerun → 返回 comparison_url。
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.compare import analyze_optimization_opportunity
from src.flow_engine import FlowEngine
from src.prompts_versioned import get_prompt, update_prompt
from src.step_log import load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import resolve_config_path
from web.schemas.auth import CurrentUser
from web.schemas.optimize import OptimizeApplyRequest

router = APIRouter(prefix="/api", tags=["optimize"])


@router.post("/runs/{run_id}/optimize/apply")
def api_optimize_apply(
    body: OptimizeApplyRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    analysis = analyze_optimization_opportunity(run_log)
    if not analysis.get("has_data"):
        raise HTTPException(status_code=400, detail="无优化建议数据")
    if not analysis.get("needs_optimization"):
        return {
            "error": "未达到优化触发阈值",
            "message": analysis.get("trigger_reason", "质量良好"),
            "analysis": analysis,
        }

    suggestions: list[dict[str, Any]] = []
    for step_sugs in (analysis.get("suggestions_by_step") or {}).values():
        suggestions.extend(step_sugs)
    if not suggestions:
        raise HTTPException(status_code=400, detail="无可用优化建议")

    if body.suggestion_indices:
        selected = [
            suggestions[i]
            for i in body.suggestion_indices
            if 0 <= i < len(suggestions)
        ]
    else:
        selected = suggestions
    if not selected:
        raise HTTPException(status_code=400, detail="未选择有效的建议")

    step_changes: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sug in selected:
        step_changes[sug.get("target_step", "unknown")].append(sug)

    updated_prompts: list[dict[str, Any]] = []
    for step_id, changes in step_changes.items():
        try:
            reasons = [c.get("issue", "") for c in changes]
            change_reason = f"优化闭环: {', '.join(reasons[:2])}"
            if len(reasons) > 2:
                change_reason += f" 等{len(reasons)}项改进"

            current_prompt = get_prompt(step_id)
            new_prompt = current_prompt + f"\n\n# 优化改进 ({change_reason})\n"
            new_version = update_prompt(step_id, new_prompt, change_reason, body.author)

            old_version = None
            if new_version != "v1":
                try:
                    old_version = get_prompt(
                        step_id,
                        version="v" + str(int(new_version[1:]) - 1),
                    )
                except Exception:
                    old_version = None

            updated_prompts.append({
                "step_id": step_id,
                "old_version": old_version,
                "new_version": new_version,
                "changes": len(changes),
            })
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"更新prompt失败 ({step_id}): {e!s}",
            ) from e

    config_path = resolve_config_path(run_id)
    try:
        engine = FlowEngine(config_path)
        new_run_log = engine.rerun_from(
            run_id=run_id,
            from_step=body.from_step,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重跑失败: {e!s}") from e

    return {
        "success": True,
        "original_run_id": run_id,
        "new_run_id": new_run_log.run_id,
        "updated_prompts": updated_prompts,
        "from_step": body.from_step,
        "trigger_analysis": {
            "needs_optimization": analysis["needs_optimization"],
            "trigger_reason": analysis["trigger_reason"],
            "old_grade": analysis["grade"],
            "old_total_score": analysis["total_score"],
        },
        "new_qa_result": (
            new_run_log.qa_result.get("qa_result")
            if new_run_log.qa_result
            else None
        ),
        "new_quality_score": new_run_log.quality_score,
        "comparison_url": f"/api/compare?left={run_id}&right={new_run_log.run_id}",
    }
