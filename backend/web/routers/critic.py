"""Critic 质疑检查端点 — 红蓝对抗。

  GET  /api/critic/run/{run_id}  — 读已有 critic_result
  POST /api/critic/analyze       — 构建 prompt（不实际调用 LLM）
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.step_log import load_run

from web.deps import get_current_user, validate_run_id
from web.schemas.auth import CurrentUser
from web.schemas.critic import (
    CriticAnalyzeRequest,
    CriticAnalyzeResponse,
)

router = APIRouter(prefix="/api/critic", tags=["critic"])


@router.get("/run/{run_id}")
def get_critic_result(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not run_log:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "run_id": run_id,
        "critic_result": getattr(run_log, "critic_result", None),
    }


@router.post("/analyze", response_model=CriticAnalyzeResponse)
def run_critic_analysis(
    body: CriticAnalyzeRequest,
    _: CurrentUser = Depends(get_current_user),
) -> CriticAnalyzeResponse:
    try:
        from src.critic_step import build_critic_prompt
        sys_prompt, user_prompt = build_critic_prompt(
            task_input=body.task_input,
            steps_summary=body.steps_summary,
            qa_result=body.qa_result,
        )
        return CriticAnalyzeResponse(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
