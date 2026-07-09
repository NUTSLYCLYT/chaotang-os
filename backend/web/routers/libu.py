"""吏部端点:任免司(libu_appointment_vet,纯确定性) + 招聘司(libu_vet,真实flow_libu)。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src import libu_appointment_vet, libu_vet
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.routers._envelope import fail, ok

router = APIRouter(prefix="/api/libu", tags=["libu"])


@router.post("/appointment/verdict")
def libu_appointment_verdict(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """任免司:确定性责任图红线 + agent 分席复核(无 LLM,纯规则+registry)。

    body = {task_text}。task_text 命中大神/席位关键词且能提取 persona 名 → agent 分席校验；
    否则走人事责任图(owner 缺失/高权限无人类 owner/自审无替补 → red)。
    """
    task_text = str(body.get("task_text") or "").strip()
    if not task_text:
        return fail("task_text 不能为空(任免/权限决策描述)")
    try:
        verdict = libu_appointment_vet.run_libu_appointment(task_text)
    except Exception as exc:  # noqa: BLE001
        return fail(f"任免复核失败: {exc}")
    return ok(verdict)


@router.post("/recruit/verdict")
def libu_recruit_verdict(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """招聘司:端到端跑真实 flow_libu → 决策锚定 + 资质红线 + 飞轮校准复核 → 吏部 court_doc。

    body = {task_input}。需 LLM 网关(active provider),跑完整 flow,耗时高于任免司。
    """
    task_input = str(body.get("task_input") or "").strip()
    if not task_input:
        return fail("task_input 不能为空(招聘需求描述)")
    try:
        verdict = libu_vet.run_libu_verdict(task_input)
    except Exception as exc:  # noqa: BLE001
        return fail(f"招聘裁决失败: {exc}")
    return ok(verdict)
