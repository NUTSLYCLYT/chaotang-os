"""御史封驳/放行端点 — 专署能力核查挖出的洞(docs/dept_design/yushi.md §四设计好的端点一直没建)。

harness/yushi_global_gate/scripts/run_gate.py 是真实、测过的四维确定性门禁,但一直没有
build_court_doc(dept="yushi") 的生产调用方。src/yushi_verdict.py 是薄包装,不改 run_gate
本身、不碰它原生的"部门协同契约"消费方(harness/chaotang_department_protocol)。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src import yushi_verdict as yv
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/yushi", tags=["yushi"])


@router.post("/review")
def yushi_review(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """御史封驳/放行书:统一 payload → 真实四维确定性门(依赖安全/客户承诺/自动化/Web漂移/
    无据数字)→ court_doc(review,獬豸印,黑金)。

    body = {run_id?, department, output_type, summary, evidence?, benefit_score?,
            automation_level_requested?, human_signoff?, security_status?, finding_summary?}
    (跟 harness/chaotang_department_protocol 的统一输出契约同一套字段)
    """
    if not str(body.get("department") or "").strip():
        return fail("department 不能为空")
    try:
        doc = yv.build_yushi_review(body, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"封驳/放行生成失败: {exc}")
    return ok(doc)
