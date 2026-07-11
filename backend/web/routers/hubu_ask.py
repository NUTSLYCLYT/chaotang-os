"""户部问答(大屏可视化用，2026-07-11 补齐)。

frontend/src/components/chaotang/visual/WorldCourtStage.tsx 调用
/api/court/hubu/ask，后端从未实现过。经审计确认 WorldCourtStage 没有任何
真实页面渲染(孤立组件)，这里诚实返回"未接入实时问答"，不冒充户部单
agent 已经真实回奏。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body

router = APIRouter(prefix="/api/court/hubu", tags=["hubu-ask"])


@router.post("/ask")
def hubu_ask(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    return {
        "ok": False,
        "error": "户部单 agent 尚未接入实时问答，暂不生成回奏。",
    }
