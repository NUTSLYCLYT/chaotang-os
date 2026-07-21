"""合同契约路由（R0-W02）——只做契约 schema 往返，不做真实摄取/风控/LLM 逻辑（W03/W05 territory）。

响应用 FastAPI 原生 `response_model=`（照抄 web/routers/auth.py 的约定），不用 `ok()/fail()`
信封——W02 的核心产物就是"后端 Pydantic/OpenAPI 为跨端契约事实源"，信封包一层会让
`app.openapi()` 生成的 schema 跟真实响应体形状对不上，违背 REQ-004 的退出证据要求。

mission draft/confirm 用进程内 dict 当存储桩——明确标注是 W02 的 schema-proving stub，不是
真实单一事实源（REQ-008 边界属于 W04），重启即丢，不做持久化承诺。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from src.contracts.contract_capability import (
    HARD_REQUIRED_CAPABILITIES_R0,
    CapabilityGrantV1,
    activate_capabilities,
)
from src.contracts.contract_decision import ContractDecisionV1
from src.contracts.contract_lineage import ContractLineageStatusV1
from src.contracts.contract_support import ContractSupportDecisionV1, evaluate_support
from src.contracts.mission_confirmation import MissionConfirmationConflict, confirm_mission
from src.contracts.mission_contract import (
    ContractIntakeV1,
    MissionContractV1,
    compute_mission_content_digest,
)
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.contracts import CapabilityActivationRequest, MissionConfirmRequest

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

# W02 schema-proving stub，不是真实单一事实源；W04 提供真正的持久化 single-writer 存储。
_MISSION_DRAFT_STORE: dict[str, MissionContractV1] = {}
_MISSION_LINEAGE_STORE: dict[str, ContractLineageStatusV1] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/support/evaluate", response_model=ContractSupportDecisionV1)
def evaluate_contract_support(
    body: ContractIntakeV1,
    _: CurrentUser = Depends(get_current_user),
) -> ContractSupportDecisionV1:
    """四维度支持/拒答评估——缺失或超范围一律 DECLINED，绝不静默放行（REQ-003）。"""
    return evaluate_support(
        body,
        mission_contract_id="pending",
        revision=0,
        evaluated_at=_now_iso(),
        capability_active=True,
    )


@router.post("/mission/draft", response_model=MissionContractV1)
def draft_mission_contract(
    body: MissionContractV1,
    _: CurrentUser = Depends(get_current_user),
) -> MissionContractV1:
    """服务端重算 content_digest（不信任客户端传入的摘要），落草稿桩存储。"""
    recomputed = body.model_copy(update={"content_digest": compute_mission_content_digest(body)})
    _MISSION_DRAFT_STORE[recomputed.mission_contract_id] = recomputed
    _MISSION_LINEAGE_STORE[recomputed.mission_contract_id] = ContractLineageStatusV1(
        lineage_id=f"lineage-{recomputed.mission_contract_id}",
        mission_contract_id=recomputed.mission_contract_id,
        revision=recomputed.revision,
        supersedes_revision=None,
        content_digest=recomputed.content_digest,
        mission_status="AWAITING_CONFIRMATION",
        support_status="SUPPORTED",
        capability_activation_status="NOT_ACTIVATED",
        decision_status="NOT_DECIDED",
    )
    return recomputed


@router.post(
    "/mission/{mission_contract_id}/confirm",
    response_model=ContractLineageStatusV1,
)
def confirm_mission_contract(
    mission_contract_id: str,
    body: MissionConfirmRequest,
    _: CurrentUser = Depends(get_current_user),
) -> ContractLineageStatusV1:
    """revision+digest 必须与已落草稿的值同时匹配，否则 409（REQ-005）。"""
    stored = _MISSION_DRAFT_STORE.get(mission_contract_id)
    if stored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mission_contract_id 不存在")
    try:
        confirm_mission(
            stored_revision=stored.revision,
            stored_digest=stored.content_digest,
            requested_revision=body.revision,
            requested_digest=body.content_digest,
        )
    except MissionConfirmationConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "mission confirmation conflict",
                "stored_revision": exc.stored_revision,
                "stored_digest": exc.stored_digest,
                "requested_revision": exc.requested_revision,
                "requested_digest": exc.requested_digest,
            },
        ) from exc

    lineage = _MISSION_LINEAGE_STORE[mission_contract_id].model_copy(
        update={"mission_status": "CONFIRMED"}
    )
    _MISSION_LINEAGE_STORE[mission_contract_id] = lineage
    return lineage


@router.post("/capability/activate", response_model=list[CapabilityGrantV1])
def activate_contract_capabilities(
    body: CapabilityActivationRequest,
    _: CurrentUser = Depends(get_current_user),
) -> list[CapabilityGrantV1]:
    """只对 candidate ∩ hard_required 的交集给 ACTIVATED，其余全零权限（REQ-006/007）。"""
    stored = _MISSION_DRAFT_STORE.get(body.mission_contract_id)
    if stored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="mission_contract_id 不存在")
    return activate_capabilities(
        stored, body.candidate_capability_ids, HARD_REQUIRED_CAPABILITIES_R0
    )


@router.post("/decision", response_model=ContractDecisionV1)
def submit_contract_decision(
    body: ContractDecisionV1,
    _: CurrentUser = Depends(get_current_user),
) -> ContractDecisionV1:
    """契约往返 stub——真实接入 FinalMemorial 生命周期是 W05/W07 territory。"""
    return body
