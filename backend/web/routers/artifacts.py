from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from src.artifacts.service import get_manifest_for_tenant
from src.db.engine import SessionLocal
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


@router.get("/manifests/{manifest_id}")
def read_manifest(manifest_id: str, user: CurrentUser = Depends(get_current_user)):
    if user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant 无法解析")
    db = SessionLocal()
    try:
        try:
            return get_manifest_for_tenant(db, manifest_id=manifest_id, tenant_id=user.tenant_id).model_dump(mode="json")
        except (LookupError, PermissionError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="manifest 不存在")
    finally:
        db.close()
