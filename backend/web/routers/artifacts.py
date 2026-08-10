from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.artifacts.service import (
    DeliveryConflict,
    DeliveryExpired,
    DeliveryForbidden,
    DeliveryIntegrityError,
    DeliveryManifestAccess,
    DeliveryNotFound,
    DeliveryPacket,
    deliver_artifact_packet,
    get_delivery_manifest_for_tenant,
    read_verified_delivery_artifact,
    resume_artifact_packet,
)
from src.contracts.contract_review_pack import ContractReviewPackV1
from src.runtime_paths import resolve_runtime_paths
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class CreateDeliveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str = Field(min_length=1)
    final_memorial_id: str = Field(min_length=1)
    final_memorial_version: int = Field(ge=1)
    contract_review_pack: ContractReviewPackV1
    delivery_formula_version: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1)
    expiry_seconds: int = Field(gt=0, le=86400)

    @model_validator(mode="after")
    def review_pack_matches_task(self) -> "CreateDeliveryRequest":
        if self.contract_review_pack.task_id != self.task_id:
            raise ValueError("contract review pack task does not match delivery task")
        return self


class ResumeDeliveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_token: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1)


class PublicArtifactItem(BaseModel):
    artifact_id: str
    kind: str
    mime_type: str
    byte_size: int
    content_hash: str
    lineage_hash: str
    status: str
    incomplete_reason: str | None = None
    expires_at: datetime | None = None
    download_url: str | None = None


class PublicArtifactManifest(BaseModel):
    schema_version: str
    manifest_id: str
    tenant_id: int
    task_id: str
    final_memorial_id: str
    final_memorial_version: int
    delivery_formula_version: str
    delivery_revision: int
    payload_hash: str
    artifacts: list[PublicArtifactItem]
    overall_status: str
    resume_token_expires_at: datetime | None = None


class DeliveryCommandResponse(BaseModel):
    manifest: PublicArtifactManifest
    resume_token: str | None = None


SessionFactory = Callable[[], Any]


def get_artifact_session_factory() -> SessionFactory:
    from src.db.engine import SessionLocal

    return SessionLocal


def get_artifact_storage_root() -> Path:
    return resolve_runtime_paths().root / "artifacts"


def _tenant_id(user: CurrentUser) -> int:
    if user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant 无法解析")
    return user.tenant_id


def _raise_domain_http(exc: Exception) -> None:
    if isinstance(exc, (DeliveryNotFound, DeliveryForbidden)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="artifact delivery 不存在",
        ) from exc
    if isinstance(exc, DeliveryExpired):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="artifact delivery 已过期",
        ) from exc
    if isinstance(exc, (DeliveryConflict, DeliveryIntegrityError)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="artifact delivery 冲突或完整性校验失败",
        ) from exc
    raise exc


def _public_manifest(access: DeliveryManifestAccess) -> PublicArtifactManifest:
    manifest = access.manifest
    return PublicArtifactManifest(
        schema_version=manifest.schema_version,
        manifest_id=manifest.manifest_id,
        tenant_id=manifest.tenant_id,
        task_id=manifest.task_id,
        final_memorial_id=manifest.final_memorial_id,
        final_memorial_version=manifest.final_memorial_version,
        delivery_formula_version=manifest.delivery_formula_version,
        delivery_revision=manifest.delivery_revision,
        payload_hash=manifest.payload_hash,
        artifacts=[
            PublicArtifactItem(
                artifact_id=item.artifact_id,
                kind=item.kind,
                mime_type=item.mime_type,
                byte_size=item.byte_size,
                content_hash=item.content_hash,
                lineage_hash=item.lineage_hash,
                status=item.status,
                incomplete_reason=item.incomplete_reason,
                expires_at=item.expires_at,
                download_url=(
                    f"/api/artifacts/{item.artifact_id}/download"
                    if item.downloadable
                    else None
                ),
            )
            for item in access.items
        ],
        overall_status=manifest.overall_status,
        resume_token_expires_at=manifest.resume_token_expires_at,
    )


def _command_response(
    db,
    *,
    packet: DeliveryPacket,
    storage_root: Path,
    tenant_id: int,
) -> DeliveryCommandResponse:
    access = get_delivery_manifest_for_tenant(
        db,
        storage_root=storage_root,
        manifest_id=packet.manifest.manifest_id,
        tenant_id=tenant_id,
    )
    return DeliveryCommandResponse(
        manifest=_public_manifest(access),
        resume_token=packet.resume_token,
    )


@router.post(
    "/deliveries",
    status_code=status.HTTP_201_CREATED,
    response_model=DeliveryCommandResponse,
    response_model_exclude_none=True,
)
def create_delivery(
    body: CreateDeliveryRequest,
    user: CurrentUser = Depends(get_current_user),
    session_factory: SessionFactory = Depends(get_artifact_session_factory),
    storage_root: Path = Depends(get_artifact_storage_root),
):
    tenant_id = _tenant_id(user)
    if body.contract_review_pack.tenant_id not in {
        str(tenant_id),
        user.tenant_slug,
    }:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="contract review pack tenant does not match current tenant",
        )
    db = session_factory()
    try:
        try:
            packet = deliver_artifact_packet(
                db,
                storage_root=storage_root,
                tenant_id=tenant_id,
                task_id=body.task_id,
                final_memorial_id=body.final_memorial_id,
                final_memorial_version=body.final_memorial_version,
                payload=body.contract_review_pack.model_dump(mode="json"),
                delivery_formula_version=body.delivery_formula_version,
                idempotency_key=body.idempotency_key,
                requested_expiry_seconds=body.expiry_seconds,
            )
            return _command_response(
                db,
                packet=packet,
                storage_root=storage_root,
                tenant_id=tenant_id,
            )
        except (
            DeliveryNotFound,
            DeliveryForbidden,
            DeliveryExpired,
            DeliveryConflict,
            DeliveryIntegrityError,
        ) as exc:
            _raise_domain_http(exc)
    finally:
        db.close()


@router.get(
    "/manifests/{manifest_id}",
    response_model=PublicArtifactManifest,
    response_model_exclude_none=True,
)
def read_manifest(
    manifest_id: str,
    user: CurrentUser = Depends(get_current_user),
    session_factory: SessionFactory = Depends(get_artifact_session_factory),
    storage_root: Path = Depends(get_artifact_storage_root),
):
    tenant_id = _tenant_id(user)
    db = session_factory()
    try:
        try:
            return _public_manifest(
                get_delivery_manifest_for_tenant(
                    db,
                    storage_root=storage_root,
                    manifest_id=manifest_id,
                    tenant_id=tenant_id,
                )
            )
        except (
            DeliveryNotFound,
            DeliveryForbidden,
            DeliveryExpired,
            DeliveryConflict,
            DeliveryIntegrityError,
        ) as exc:
            _raise_domain_http(exc)
    finally:
        db.close()


@router.get("/{artifact_id}/download")
def download_artifact(
    artifact_id: str,
    user: CurrentUser = Depends(get_current_user),
    session_factory: SessionFactory = Depends(get_artifact_session_factory),
    storage_root: Path = Depends(get_artifact_storage_root),
):
    tenant_id = _tenant_id(user)
    db = session_factory()
    try:
        try:
            verified = read_verified_delivery_artifact(
                db,
                storage_root=storage_root,
                artifact_id=artifact_id,
                tenant_id=tenant_id,
            )
            return Response(
                content=verified.content,
                media_type=verified.mime_type,
            )
        except (
            DeliveryNotFound,
            DeliveryForbidden,
            DeliveryExpired,
            DeliveryConflict,
            DeliveryIntegrityError,
        ) as exc:
            _raise_domain_http(exc)
    finally:
        db.close()


@router.post(
    "/manifests/{manifest_id}/resume",
    response_model=DeliveryCommandResponse,
    response_model_exclude_none=True,
)
def resume_delivery(
    manifest_id: str,
    body: ResumeDeliveryRequest,
    user: CurrentUser = Depends(get_current_user),
    session_factory: SessionFactory = Depends(get_artifact_session_factory),
    storage_root: Path = Depends(get_artifact_storage_root),
):
    tenant_id = _tenant_id(user)
    db = session_factory()
    try:
        try:
            packet = resume_artifact_packet(
                db,
                storage_root=storage_root,
                tenant_id=tenant_id,
                manifest_id=manifest_id,
                resume_token=body.resume_token,
                idempotency_key=body.idempotency_key,
            )
            return _command_response(
                db,
                packet=packet,
                storage_root=storage_root,
                tenant_id=tenant_id,
            )
        except (
            DeliveryNotFound,
            DeliveryForbidden,
            DeliveryExpired,
            DeliveryConflict,
            DeliveryIntegrityError,
        ) as exc:
            _raise_domain_http(exc)
    finally:
        db.close()
