from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app.accounting_reports.storage import (
    DEFAULT_DB_PATH,
    ArtifactNotFound,
    ArtifactStorageError,
    read_verified_published_artifact,
)
from app.api.auth import CurrentUser

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_configured_db_path: Path = DEFAULT_DB_PATH

router = APIRouter(prefix="/api/v1/report-artifacts")


def configure_report_artifact_db(db_path: Path | None) -> None:
    global _configured_db_path
    _configured_db_path = DEFAULT_DB_PATH if db_path is None else Path(db_path)


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
