"""运行对比端点 —

  GET /api/compare              — 双 run diff（按 step_index 对齐）
  GET /api/compare/quality      — QA 维度分对比
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.compare import compare_quality
from src.step_log import load_run

from web.deps import get_current_user
from web.run_utils import FIELD_THRESHOLDS, step_cmp_data
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/compare", tags=["compare"])


def _load_pair(left_id: str, right_id: str):
    if not left_id or not right_id:
        raise HTTPException(status_code=400, detail="需要 left 和 right 参数")
    try:
        left = load_run(left_id)
        right = load_run(right_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if left is None:
        raise HTTPException(status_code=404, detail=f"Run {left_id} 不存在")
    if right is None:
        raise HTTPException(status_code=404, detail=f"Run {right_id} 不存在")
    return left, right


def build_compare_payload(left_id: str, right_id: str) -> dict[str, Any]:
    """对外可复用 — exports.py 也调用。"""
    left, right = _load_pair(left_id, right_id)
    max_steps = max(len(left.steps), len(right.steps))
    step_diff = []
    for i in range(max_steps):
        ls = left.steps[i] if i < len(left.steps) else None
        rs = right.steps[i] if i < len(right.steps) else None
        step_diff.append({
            "step_index": i,
            "left": step_cmp_data(ls) if ls else None,
            "right": step_cmp_data(rs) if rs else None,
        })

    return {
        "left": {
            "run_id": left_id,
            "final_output": left.final_output,
            "qa_result": left.qa_result or {},
        },
        "right": {
            "run_id": right_id,
            "final_output": right.final_output,
            "qa_result": right.qa_result or {},
        },
        "step_diff": step_diff,
        "field_thresholds": FIELD_THRESHOLDS,
    }


@router.get("")
def api_compare(
    left: str = Query(..., alias="left"),
    right: str = Query(..., alias="right"),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return build_compare_payload(left, right)


@router.get("/quality")
def api_compare_quality(
    left: str = Query(...),
    right: str = Query(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    left_log, right_log = _load_pair(left, right)
    diff = compare_quality(left_log, right_log)
    return diff.to_dict()
