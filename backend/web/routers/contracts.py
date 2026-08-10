"""合同契约路由。

响应用 FastAPI 原生 `response_model=`（照抄 web/routers/auth.py 的约定），不用 `ok()/fail()`
信封——W02 的核心产物就是"后端 Pydantic/OpenAPI 为跨端契约事实源"，信封包一层会让
`app.openapi()` 生成的 schema 跟真实响应体形状对不上，违背 REQ-004 的退出证据要求。

R0-W07 使用现有 CourtLoopRun 保存 MissionContract revision snapshot，并把
mission_contract_id 与 canonical DecisionTask.id 固定为同一兼容 lineage。该桥接不新增
task status 或数据库 schema；数据库唯一性与并发 hardening 属于后续 Checkpoint B。
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status

from src.contract_mission_repository import (
    MissionBindingConflict,
    PersistedMissionSnapshot,
    load_current_mission_snapshot,
    save_mission_snapshot,
)
from src.contracts.contract_capability import (
    HARD_REQUIRED_CAPABILITIES_R0,
    CapabilityGrantV1,
    activate_capabilities,
)
from src.contracts.contract_decision import ContractDecisionV1
from src.contracts.contract_lineage import ContractLineageStatusV1
from src.contracts.contract_support import ContractSupportDecisionV1, evaluate_support
from src.contracts.contract_task_read_model import ContractTaskReadModelV1
from src.contracts.mission_confirmation import MissionConfirmationConflict, confirm_mission
from src.contracts.mission_contract import (
    ContractIntakeV1,
    MissionContractV1,
    compute_mission_content_digest,
)
from src.db.models import DecisionTask
from src.runtime_paths import resolve_runtime_paths
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.contracts import CapabilityActivationRequest, MissionConfirmRequest

router = APIRouter(prefix="/api/contracts", tags=["contracts"])
SessionFactory = Callable[[], Any]

# Historical W02 test-only stores remain import-compatible but are no longer read or written by
# mission routes. W07 authority is the database-backed compatibility repository above.
_MISSION_DRAFT_STORE: dict[tuple[str, str], MissionContractV1] = {}
_MISSION_LINEAGE_STORE: dict[tuple[str, str], ContractLineageStatusV1] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_id(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or "anonymous")


def _owned_task(db, *, task_id: str, user: CurrentUser) -> DecisionTask:
    task = db.query(DecisionTask).filter_by(id=task_id).first()
    if (
        task is None
        or task.user_id != _user_id(user)
        or task.tenant_id != user.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="task_id 不存在",
        )
    return task


def get_contract_session_factory() -> SessionFactory:
    from src.db.engine import SessionLocal

    return SessionLocal


def get_contract_storage_root() -> Path:
    return resolve_runtime_paths().root / "artifacts"


def _support_for(mission: MissionContractV1) -> ContractSupportDecisionV1:
    return evaluate_support(
        ContractIntakeV1(
            jurisdiction=mission.jurisdiction,
            language=mission.language,
            contract_type=mission.contract_type,
            our_role=mission.our_role,
            legal_question=mission.legal_question,
        ),
        mission_contract_id=mission.mission_contract_id,
        revision=mission.revision,
        evaluated_at=_now_iso(),
        capability_active=True,
    )


def _lineage_for(
    snapshot: PersistedMissionSnapshot,
) -> ContractLineageStatusV1:
    support = _support_for(snapshot.mission)
    return ContractLineageStatusV1(
        lineage_id=f"lineage-{snapshot.mission.mission_contract_id}",
        mission_contract_id=snapshot.mission.mission_contract_id,
        revision=snapshot.mission.revision,
        supersedes_revision=None,
        content_digest=snapshot.mission.content_digest,
        mission_status=(
            "CONFIRMED" if snapshot.state == "confirmed" else "AWAITING_CONFIRMATION"
        ),
        support_status=support.support_status,
        capability_activation_status="NOT_ACTIVATED",
        decision_status="NOT_DECIDED",
    )


@router.post("/support/evaluate", response_model=ContractSupportDecisionV1)
def evaluate_contract_support(
    body: ContractIntakeV1,
    _: CurrentUser = Depends(get_current_user),
) -> ContractSupportDecisionV1:
    """五维度支持/拒答评估——缺失或超范围一律 DECLINED，绝不静默放行（REQ-003）。"""
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
    user: CurrentUser = Depends(get_current_user),
) -> MissionContractV1:
    """服务端重算 digest，并保存到 owned DecisionTask 的兼容 mission lineage。"""
    from src.db.engine import SessionLocal

    recomputed = body.model_copy(update={"content_digest": compute_mission_content_digest(body)})
    db = SessionLocal()
    try:
        task = _owned_task(db, task_id=recomputed.task_id, user=user)
        snapshot = save_mission_snapshot(
            db,
            task=task,
            mission=recomputed,
            state="draft",
        )
        db.commit()
        return snapshot.mission
    except MissionBindingConflict as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    finally:
        db.close()


@router.post(
    "/mission/{mission_contract_id}/confirm",
    response_model=ContractLineageStatusV1,
)
def confirm_mission_contract(
    mission_contract_id: str,
    body: MissionConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
) -> ContractLineageStatusV1:
    """revision+digest 必须与已落草稿的值同时匹配，否则 409（REQ-005）。"""
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = _owned_task(db, task_id=mission_contract_id, user=user)
        snapshot = load_current_mission_snapshot(db, task=task)
        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="mission_contract_id 不存在",
            )
        confirm_mission(
            stored_revision=snapshot.mission.revision,
            stored_digest=snapshot.mission.content_digest,
            requested_revision=body.revision,
            requested_digest=body.content_digest,
        )
        confirmed = save_mission_snapshot(
            db,
            task=task,
            mission=snapshot.mission,
            state="confirmed",
        )
        db.commit()
        return _lineage_for(confirmed)
    except MissionConfirmationConflict as exc:
        db.rollback()
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
    except MissionBindingConflict as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    finally:
        db.close()


@router.post("/capability/activate", response_model=list[CapabilityGrantV1])
def activate_contract_capabilities(
    body: CapabilityActivationRequest,
    user: CurrentUser = Depends(get_current_user),
) -> list[CapabilityGrantV1]:
    """只对 candidate ∩ hard_required 的交集给 ACTIVATED，其余全零权限（REQ-006/007）。"""
    from src.db.engine import SessionLocal

    db = SessionLocal()
    try:
        task = _owned_task(db, task_id=body.mission_contract_id, user=user)
        snapshot = load_current_mission_snapshot(db, task=task)
        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="mission_contract_id 不存在",
            )
        support = _support_for(snapshot.mission)
        if snapshot.state != "confirmed" or support.support_status != "SUPPORTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="mission must be confirmed and supported",
            )
        return activate_capabilities(
            snapshot.mission,
            body.candidate_capability_ids,
            HARD_REQUIRED_CAPABILITIES_R0,
        )
    except MissionBindingConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    finally:
        db.close()


@router.post("/decision", response_model=ContractDecisionV1)
def submit_contract_decision(
    body: ContractDecisionV1,
    _: CurrentUser = Depends(get_current_user),
) -> ContractDecisionV1:
    """契约往返 stub——真实接入 FinalMemorial 生命周期是 W05/W07 territory。"""
    return body


@router.get(
    "/tasks/{task_id}/read-model",
    response_model=ContractTaskReadModelV1,
    response_model_exclude_none=True,
)
def read_contract_task_model(
    task_id: str,
    user: CurrentUser = Depends(get_current_user),
    session_factory: SessionFactory = Depends(get_contract_session_factory),
    storage_root: Path = Depends(get_contract_storage_root),
) -> ContractTaskReadModelV1:
    from src.contract_task_projection import project_contract_task

    db = session_factory()
    try:
        task = _owned_task(db, task_id=task_id, user=user)
        return project_contract_task(
            db,
            storage_root=storage_root,
            task=task,
        )
    finally:
        db.close()
