"""用户偏好记忆端点 — 越用越聪明。

  GET  /api/preferences/{user_id}                  — 取偏好
  POST /api/preferences/{user_id}                  — 更新偏好（style/domain/avoid）
  POST /api/preferences/{user_id}/corrections      — 记录纠错
  POST /api/preferences/{user_id}/accepted-designs — 记录接受的设计
  POST /api/preferences/{user_id}/suggest-flow     — 根据偏好推荐 Flow
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.tenant import get_current_tenant
from src.user_preference import UserPreference

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.preferences import (
    AcceptedDesignRequest,
    CorrectionRecordRequest,
    PreferenceUpdateRequest,
    SuggestFlowRequest,
)

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("/{user_id}")
def get_user_preference(
    user_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        tenant = get_current_tenant()
        pref = UserPreference(user_id=user_id, tenant=tenant)
        return {
            "user_id": user_id,
            "tenant": tenant,
            "preference_data": pref.preference_data,
            "injection_text": pref.to_injection_text(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{user_id}")
def update_user_preference(
    user_id: str,
    body: PreferenceUpdateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        tenant = get_current_tenant()
        pref = UserPreference(user_id=user_id, tenant=tenant)

        if body.style_preferences:
            pref.preference_data["style_preferences"].update(body.style_preferences)

        if body.domain_expertise:
            for domain_info in body.domain_expertise:
                pref.add_domain_expertise(
                    domain=domain_info.domain,
                    keywords=domain_info.keywords,
                )

        if body.avoid_pattern:
            pref.add_avoid_pattern(
                pattern=body.avoid_pattern,
                reason=body.reason,
            )

        pref.save()
        return {
            "status": "updated",
            "user_id": user_id,
            "preference_data": pref.preference_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{user_id}/corrections")
def record_correction(
    user_id: str,
    body: CorrectionRecordRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        tenant = get_current_tenant()
        pref = UserPreference(user_id=user_id, tenant=tenant)
        pref.record_correction(
            step_id=body.step_id,
            issue=body.issue,
            fix=body.fix,
            severity=body.severity,
        )
        return {
            "status": "recorded",
            "corrections_count": len(
                pref.preference_data.get("past_corrections", []) or []
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{user_id}/accepted-designs")
def record_accepted_design(
    user_id: str,
    body: AcceptedDesignRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        tenant = get_current_tenant()
        pref = UserPreference(user_id=user_id, tenant=tenant)
        pref.record_accepted_design(
            step_id=body.step_id,
            design_choice=body.design_choice,
            context=body.context,
        )
        return {
            "status": "recorded",
            "accepted_designs_count": len(
                pref.preference_data.get("accepted_designs", []) or []
            ),
            "message": "已记录偏好，后续 critic 将不再质疑此设计选择",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{user_id}/suggest-flow")
def suggest_flow_from_preference(
    user_id: str,
    body: SuggestFlowRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        tenant = get_current_tenant()
        pref = UserPreference(user_id=user_id, tenant=tenant)
        suggested = pref.suggest_flow(body.task_input)
        return {
            "suggested_flow": suggested,
            "confidence": 0.8 if suggested else 0.0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
