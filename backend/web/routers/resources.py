"""登录后资源配置端点。"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.resource_profile import normalize_resource_mode, resource_profile_payload, valid_resource_modes
from src.tenant import get_current_tenant
from src.user_preference import UserPreference
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.resources import ResourceProfileUpdateRequest

router = APIRouter(prefix="/api/resources", tags=["resources"])


def _preference_for(user: CurrentUser) -> UserPreference:
    user_id = str(user.user_id or user.username or "anonymous")
    return UserPreference(user_id=user_id, tenant=get_current_tenant())


def _load_resource_mode(pref: UserPreference) -> str:
    resources = pref.preference_data.get("resource_profile") or {}
    return normalize_resource_mode(resources.get("mode"))


def _has_user_resources(pref: UserPreference) -> bool:
    resources = pref.preference_data.get("resource_profile") or {}
    return bool(resources.get("has_user_resources"))


@router.get("/profile")
def get_resource_profile(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    pref = _preference_for(user)
    return resource_profile_payload(
        _load_resource_mode(pref),
        user_has_own_resources=_has_user_resources(pref),
    )


@router.post("/profile")
def update_resource_profile(
    body: ResourceProfileUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    mode = normalize_resource_mode(body.mode)
    if body.mode not in valid_resource_modes():
        raise HTTPException(
            status_code=422,
            detail="mode 必须是 chaotang_default / hybrid / user_own",
        )

    pref = _preference_for(user)
    profile = pref.preference_data.setdefault("resource_profile", {})
    profile["mode"] = mode
    profile.setdefault("has_user_resources", False)
    pref.save()
    return resource_profile_payload(
        mode,
        user_has_own_resources=bool(profile.get("has_user_resources")),
    )
