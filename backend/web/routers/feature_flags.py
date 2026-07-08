"""Feature Flag 端点 —

  GET /api/feature-flags
  PUT /api/feature-flags/{name}
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.feature_flags import FeatureFlagUpdateRequest

router = APIRouter(prefix="/api/feature-flags", tags=["feature_flags"])


@router.get("")
def list_feature_flags(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.deploy_manager import FeatureFlagManager
        fm = FeatureFlagManager()
        flags = fm.list_flags()
        return {
            "flags": [
                {
                    "name": f.name,
                    "enabled": f.enabled,
                    "description": f.description,
                    "roll_percentage": f.roll_percentage,
                }
                for f in flags
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{name}")
def update_feature_flag(
    name: str,
    body: FeatureFlagUpdateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    try:
        from src.deploy_manager import FeatureFlagManager
        fm = FeatureFlagManager()
        fm.set_flag(
            name=name,
            enabled=body.enabled,
            description=body.description,
            roll_percentage=body.roll_percentage,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
