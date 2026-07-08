"""兵部端点 — 最小可行片(六部能力评估挖出的洞,只做能立刻验证的部分)。

docs/dept_design/bingbu.md §五设计的完整 MVP 是编排 flow_haolong + flow_opc +
flow_voice_sales + 四大神判官顾问入审 + 报价强制回链 + 售后回填史馆——那是独立的
大工作量,这里先不假装做完。只接 flow_haolong 一条真实产出到 build_court_doc,
证明"兵部真实业务输出能产出六部统一格式的判决卡"这条链路是通的。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src.bingbu_battlecard import run_bingbu_battlecard
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/bingbu", tags=["bingbu"])


@router.post("/battlecard")
def bingbu_battlecard(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """兵部战报(最小片):客户消息文本 → 真实 flow_haolong → court_doc(brief)。

    body = {task_input}。真实 LLM 调用(flow_haolong),非确定性、无缓存。
    **未完成**:竞品攻防(opc)、报价回链(quotation)、售后回填(storage_aftercare)、
    大神会审门——headline 会诚实标"未经战情复核",不冒充完整版设计。
    """
    task_input = str(body.get("task_input") or "").strip()
    if not task_input:
        return fail("task_input 不能为空(客户消息/线索文本)")
    try:
        doc = run_bingbu_battlecard(task_input, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"战报生成失败: {exc}")
    return ok(doc)
