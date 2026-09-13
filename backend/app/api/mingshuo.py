"""Authenticated HTTP boundary for Mingshuo project fact-pack revisions."""

from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.api.auth import CurrentUser
from app.mingshuo import fact_pack, service, storage
from app.mingshuo.models import CreateProjectRequest, DraftRequest, RevisionRequest

router = APIRouter(prefix="/api/v1/mingshuo", tags=["mingshuo"])
_PROJECT_ID = re.compile(r"^[0-9a-f]{32}$")
_Model = TypeVar("_Model", bound=BaseModel)


def _error(status_code: int, reason: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"status": "error", "reason": reason})


def _serialize_payload(value: object) -> dict[str, Any]:
    """Finish public response projection before a write transaction commits."""

    response = JSONResponse(content=value)
    projected = json.loads(response.body)
    if not isinstance(projected, dict):
        raise ValueError("response projection must be an object")
    return projected


async def _parse(request: Request, model: type[_Model]) -> _Model:
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > fact_pack.MAX_INPUT_BYTES:
                raise ValueError("INPUT_BYTES_LIMIT")
        except ValueError as exc:
            raise ValueError("INPUT_BYTES_LIMIT") from exc
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > fact_pack.MAX_INPUT_BYTES:
            raise ValueError("INPUT_BYTES_LIMIT")
        chunks.append(chunk)
    value = fact_pack.parse_json_wire(b"".join(chunks))
    if not isinstance(value, dict):
        raise ValueError("JSON_OBJECT_REQUIRED")
    return model.model_validate(value)


def _project_id_or_404(project_id: str) -> bool:
    return bool(_PROJECT_ID.fullmatch(project_id))


@router.post("/projects", response_model=None)
async def create_project(request: Request, current_user: CurrentUser):
    try:
        payload = await _parse(request, CreateProjectRequest)
        response, created = service.create_project(
            payload, current_user, serialize=_serialize_payload
        )
        return JSONResponse(status_code=201 if created else 200, content=response)
    except (ValueError, ValidationError, service.MingshuoValidationError):
        return _error(422, "validation")
    except storage.MingshuoConflictError:
        return _error(409, "conflict")
    except storage.MingshuoStorageError:
        return _error(503, "unavailable")


@router.post("/projects/{project_id}/revisions", response_model=None)
async def append_revision(project_id: str, request: Request, current_user: CurrentUser):
    if not _project_id_or_404(project_id):
        return _error(404, "not_found")
    try:
        payload = await _parse(request, RevisionRequest)
        response, created = service.append_revision(
            project_id, payload, current_user, serialize=_serialize_payload
        )
        return JSONResponse(status_code=201 if created else 200, content=response)
    except (ValueError, ValidationError, service.MingshuoValidationError):
        return _error(422, "validation")
    except storage.MingshuoNotFoundError:
        return _error(404, "not_found")
    except storage.MingshuoConflictError:
        return _error(409, "conflict")
    except storage.MingshuoStorageError:
        return _error(503, "unavailable")


@router.get("/projects/{project_id}", response_model=None)
def get_project(project_id: str, current_user: CurrentUser):
    if not _project_id_or_404(project_id):
        return _error(404, "not_found")
    try:
        return service.get_project(project_id, current_user, serialize=_serialize_payload)
    except storage.MingshuoNotFoundError:
        return _error(404, "not_found")
    except storage.MingshuoStorageError:
        return _error(503, "unavailable")


@router.post("/projects/{project_id}/draft-requests", response_model=None)
async def create_draft_request(project_id: str, request: Request, current_user: CurrentUser):
    if not _project_id_or_404(project_id):
        return _error(404, "not_found")
    try:
        payload = await _parse(request, DraftRequest)
        response, created = service.create_draft_request(
            project_id, payload, current_user, serialize=_serialize_payload
        )
        return JSONResponse(status_code=201 if created else 200, content=response)
    except (ValueError, ValidationError, service.MingshuoValidationError):
        return _error(422, "validation")
    except storage.MingshuoNotFoundError:
        return _error(404, "not_found")
    except storage.MingshuoConflictError:
        return _error(409, "conflict")
    except storage.MingshuoStorageError:
        return _error(503, "unavailable")


__all__ = ["router"]
