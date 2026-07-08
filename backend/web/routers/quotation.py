"""报价红线复核端点 — 最小可行片,镜像 web/routers/bingbu.py 的模式。

flow_quotation 蜂群本身真实存在(已注册进 swarm_orchestrator.yaml 的 "quotation"),这里只把
它自带的 QA 硬核查(C1-C10,含毛利率红线C7)装配成 court_doc,让红线结果有红黄绿灯和签字门,
不是新建检查逻辑。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src.quotation_verdict import run_quotation_verdict
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/quotation", tags=["quotation"])


@router.post("/verdict")
def quotation_verdict(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """报价红线复核(最小片):任务描述 → 真实 flow_quotation → court_doc(brief)。

    body = {task_input}。真实 LLM 调用(flow_quotation),非确定性、无缓存。
    """
    task_input = str(body.get("task_input") or "").strip()
    if not task_input:
        return fail("task_input 不能为空(报价需求描述)")
    try:
        doc = run_quotation_verdict(task_input, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"报价复核生成失败: {exc}")
    return ok(doc)
