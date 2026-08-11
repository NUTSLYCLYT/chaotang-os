from __future__ import annotations

import sqlite3
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, field_validator

from app.accounting_reports.storage import (
    DEFAULT_ARTIFACT_DIR,
    DEFAULT_DB_PATH,
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
    read_verified_published_artifact,
)
from app.api.auth import CurrentUser
from app.work_products import ConfirmationStatus, WorkProductEnvelope

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_configured_db_path: Path = DEFAULT_DB_PATH

router = APIRouter(prefix="/api/v1/report-artifacts")


class ConfirmationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: ConfirmationStatus
    structured_reason: str

    @field_validator("decision")
    @classmethod
    def _reject_pending(cls, value: ConfirmationStatus) -> ConfirmationStatus:
        if value is ConfirmationStatus.PENDING:
            raise ValueError("decision must be a terminal confirmation status")
        return value

    @field_validator("structured_reason")
    @classmethod
    def _require_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("structured_reason must not be blank")
        return value.strip()


def configure_report_artifact_db(db_path: Path | None) -> None:
    global _configured_db_path
    _configured_db_path = DEFAULT_DB_PATH if db_path is None else Path(db_path)


def _storage() -> ArtifactStorage:
    try:
        artifact_dir = (
            DEFAULT_ARTIFACT_DIR
            if _configured_db_path.resolve() == DEFAULT_DB_PATH.resolve()
            else _configured_db_path.parent / "report_artifacts"
        )
        return ArtifactStorage(artifact_dir=artifact_dir, db_path=_configured_db_path)
    except (OSError, sqlite3.Error):
        raise ArtifactStorageError("artifact_unavailable") from None


def _public_snapshot(
    artifact_id: str, owner_user_id: str, envelope: WorkProductEnvelope
) -> dict[str, object]:
    storage = _storage()
    body = envelope.model_dump(
        mode="json",
        exclude={"owner_user_id", "file_path", "review_status"},
    )
    body["artifact_id"] = artifact_id
    body["confirmation_receipts"] = [
        receipt.model_dump(mode="json")
        for receipt in storage.list_confirmation_receipts(
            owner_user_id, envelope.work_product_id
        )
    ]
    return body


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=404, content={"message": "artifact not found"})


def _unavailable() -> JSONResponse:
    return JSONResponse(status_code=503, content={"message": "artifact unavailable"})


@router.get("/{artifact_id}/work-product", response_model=None)
def get_report_work_product(
    artifact_id: str,
    current_user: CurrentUser,
) -> dict[str, object] | JSONResponse:
    try:
        envelope = _storage().get_work_product_for_artifact(
            current_user.id, artifact_id
        )
        return _public_snapshot(artifact_id, current_user.id, envelope)
    except ArtifactNotFound:
        return _not_found()
    except ArtifactStorageError:
        return _unavailable()


@router.post("/{artifact_id}/confirmation", response_model=None)
def confirm_report_work_product(
    artifact_id: str,
    payload: ConfirmationRequest,
    current_user: CurrentUser,
) -> dict[str, object] | JSONResponse:
    try:
        storage = _storage()
        envelope = storage.get_work_product_for_artifact(current_user.id, artifact_id)
        storage.append_confirmation(
            current_user.id,
            envelope.work_product_id,
            payload.decision,
            f"user:{current_user.id}",
            payload.structured_reason,
        )
        updated = storage.get_work_product_for_artifact(current_user.id, artifact_id)
        return _public_snapshot(artifact_id, current_user.id, updated)
    except ArtifactNotFound:
        return _not_found()
    except ArtifactStorageError as exc:
        if str(exc) == "confirmation_transition_invalid":
            return JSONResponse(
                status_code=409,
                content={"message": "confirmation transition invalid"},
            )
        return _unavailable()


@router.get("/{artifact_id}/download", response_model=None)
def download_report_artifact(
    artifact_id: str,
    current_user: CurrentUser,
) -> Response:
    try:
        artifact, content = read_verified_published_artifact(
            artifact_id,
            current_user.id,
            _configured_db_path,
        )
    except ArtifactNotFound:
        return JSONResponse(
            status_code=404,
            content={"message": "artifact not found"},
        )
    except ArtifactStorageError:
        return JSONResponse(
            status_code=503,
            content={"message": "artifact unavailable"},
        )

    safe_name = Path(artifact.display_name).name
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_name)}",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Length": str(len(content)),
    }
    return StreamingResponse(
        iter((content,)),
        media_type=_XLSX_MIME,
        headers=headers,
    )
