"""钦天监端点 — 最小可行片,镜像 web/routers/bingbu.py 的模式。

flow_tianjian 蜂群本身真实存在且已被 decree_swarm_router 路由,这里只接一条真实产出到
build_court_doc,证明"钦天监能产出六部统一格式的天象策"这条链路是通的。**未完成**:
把各字段里的具体数字/来源逐条过锦衣卫 vet_intel 核实(见 docs/qintianjian.md 会审记录)。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src.tianjian_verdict import run_tianjian_forecast
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/qintianjian", tags=["qintianjian"])


@router.post("/forecast")
def qintianjian_forecast(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """钦天监天象策(最小片):任务描述 → 真实 flow_tianjian → court_doc(forecast)。

    body = {task_input}。真实 LLM 调用(flow_tianjian),非确定性、无缓存。
    """
    task_input = str(body.get("task_input") or "").strip()
    if not task_input:
        return fail("task_input 不能为空(要推演的任务/问题描述)")
    try:
        doc = run_tianjian_forecast(task_input, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"天象策生成失败: {exc}")
    return ok(doc)


# ── 可证伪触发器核销(2026-07-08 · 完善油箱):发出的每个"若X发生重开镜片"都要能被盯 ──


@router.get("/triggers/pending")
def qintianjian_pending_triggers(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """未核销触发器清单(按当前租户),供前端催问/复判入口。"""
    from src.qintianjian_signals import pending_triggers

    return pending_triggers()


@router.post("/triggers/{trigger_id}/resolve")
def qintianjian_resolve_trigger(
    trigger_id: str,
    body: dict[str, Any] = Body(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """核销触发器:fired=true(X发生了,须重开镜片复判)/false(核实未发生)。留名取登录身份。"""
    from fastapi import HTTPException

    from src.qintianjian_signals import resolve_trigger

    try:
        return resolve_trigger(
            trigger_id,
            fired=bool(body.get("fired")),
            resolved_by=user.username or "",
            note=str(body.get("note") or ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
