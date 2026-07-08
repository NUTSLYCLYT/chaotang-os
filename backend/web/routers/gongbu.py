"""工部验收端点 — 六部能力评估挖出的洞(docs/dept_design/gongbu.md §五"落地"明确列了这条待建)。

build_court_doc(dept="gongbu", ...) 的真实调用方 src.gongbu_review_verdict.run_gongbu_review
是真的、确定性接地(pack_rd_sizing 重算门,非 LLM 自评),但之前没有任何活的 API 路由调用它——
docs/dept_design/gongbu.md 自己的落地清单写着"新增 POST /api/gongbu/review",一直没建。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src import gongbu_review_verdict as gv
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/gongbu", tags=["gongbu"])


@router.post("/review")
def gongbu_review(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """工部验收单:精算 agent 输出 → 确定性重算门(pack_rd_sizing)→ court_doc(review)。

    body = {presale_output, task_input, case_id?}
    - presale_output: 精算 agent 的原始输出文本(含围栏 JSON,如 cell_model/series_S/parallel_P)
    - task_input: 工单/spec 描述文本(如"客户要 12V 1100Wh 电池包"),用于锚定真值(targetWh/nominalV)
    抽不到围栏 JSON / 解析失败 → UNKNOWN,禁假 PASS,gate 降级"不予验收·需人工"。
    """
    presale_output = str(body.get("presale_output") or "").strip()
    task_input = str(body.get("task_input") or "").strip()
    if not presale_output:
        return fail("presale_output 不能为空(精算 agent 输出)")
    try:
        doc = gv.run_gongbu_review(
            presale_output, task_input,
            case_id=body.get("case_id"), archive=True,
        )
    except Exception as exc:  # noqa: BLE001
        return fail(f"验收生成失败: {exc}")
    return ok(doc)
