"""户部 P0 预览 API。

当前只暴露无副作用的户部 preview, 不执行付款、不写库、不触发真实蜂群。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src.hubu_finance_intake import build_hubu_finance_intake_preview
from src.hubu_financial_reporting import (
    build_hubu_finance_reporting_decision_preview,
    build_hubu_finance_reporting_preview,
)
from src.hubu_memorial_verdict import preview_cashflow_court_doc
from src.hubu_payment_preview import build_boss_decision_preview, build_hubu_payment_preview
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/chaotang/hubu", tags=["hubu"])


@router.post("/payment/preview")
def preview_hubu_payment(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览户部付款裁决。

    该接口只返回会计/审计、出纳、预算和户部奏折结论; 不执行真实付款。
    """
    try:
        return ok(build_hubu_payment_preview(body))
    except ValueError as exc:
        return fail(str(exc))


@router.post("/payment/decision/preview")
def preview_hubu_payment_decision(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览老板裁决输入是否合法。

    该接口只生成裁决收据草稿; 不执行付款、不写库、不归档。
    """
    fact_pack = body.get("factPack")
    decision_input = body.get("decisionInput")
    if not isinstance(fact_pack, dict):
        return fail("factPack 必须是 object")
    if not isinstance(decision_input, dict):
        return fail("decisionInput 必须是 object")
    try:
        return ok(build_boss_decision_preview(fact_pack, decision_input))
    except ValueError as exc:
        return fail(str(exc))


@router.post("/finance/reporting/preview")
def preview_hubu_finance_reporting(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览财务报表、审计异常、融资/贷款材料草稿。

    该接口只生成报表与材料草稿; 不执行外部报送、不连接银行/税务、不写库。
    """
    try:
        return ok(build_hubu_finance_reporting_preview(body))
    except ValueError as exc:
        return fail(str(exc))


@router.post("/finance/reporting/decision/preview")
def preview_hubu_finance_reporting_decision(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览老板对财务报表草稿的裁决动作是否合法。

    该接口只生成裁决收据草稿; 不写史馆、不提交融资、不连接银行/税务。
    """
    fact_pack = body.get("factPack")
    decision_input = body.get("decisionInput")
    if not isinstance(fact_pack, dict):
        return fail("factPack 必须是 object")
    if not isinstance(decision_input, dict):
        return fail("decisionInput 必须是 object")
    try:
        return ok(build_hubu_finance_reporting_decision_preview(fact_pack, decision_input))
    except ValueError as exc:
        return fail(str(exc))


@router.post("/finance/intake/preview")
def preview_hubu_finance_intake(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览真实财务数据接入总闸。

    该接口只做结构化数据核验与报表 factPack 草稿; 不写库、不改账、不执行付款、不报税。
    """
    try:
        return ok(build_hubu_finance_intake_preview(body))
    except ValueError as exc:
        return fail(str(exc))


@router.post("/cashflow/preview")
def preview_hubu_cashflow_court_doc(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """预览现金跑道户部奏报(court_doc)。

    顶尖高手会审扫出的洞:src.hubu_memorial_verdict.run_cashflow_court_doc 是真实的
    确定性现金流引擎,但之前没有任何活的 API 路由调用它——只有测试和一致性校验脚本能碰到,
    用户端不可达。补这一个端点,和其余 4 个户部端点同款约束:只预览、不落库、不归档、
    不执行任何真实动作(archive=False)。body 形状见 src.hubu_memorial_verdict.pack_from_body。
    """
    try:
        return ok(preview_cashflow_court_doc(body))
    except (ValueError, KeyError, TypeError) as exc:
        return fail(f"cashflow evidence pack 格式错误: {exc}")
