"""Authenticated, read-only HTTP contract for Grand Council case ledgers."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from app.api.auth import CurrentUser
from app.junjichu_cases import storage
from app.junjichu_cases.models import JunjichuCaseStatus

router = APIRouter(prefix="/api/v1/junjichu/cases", tags=["junjichu"])

_ALLOWED_QUERY_FIELDS = frozenset({"status", "department", "keyword"})
_ALLOWED_STATUSES = frozenset(
    {
        "MINISTRY_REVIEWING",
        "COUNCIL_REVIEWING",
        "CHANCELLOR_FINALIZING",
        "ARCHIVED",
        "FAILED",
    }
)


class BureauOpinionReadModel(BaseModel):
    """One safe bureau opinion already recorded by the council workflow."""

    model_config = ConfigDict(extra="forbid")

    bureau: str
    opinion: str


class MinistryOpinionReadModel(BaseModel):
    """One safe ministry opinion, constrained to its rendered fields."""

    model_config = ConfigDict(extra="forbid")

    department: str
    bureau_opinions: list[BureauOpinionReadModel]
    opinion: str


class JunjichuCaseReadModel(BaseModel):
    """The safe case projection consumed by the private council page."""

    model_config = ConfigDict(extra="forbid")

    id: str
    decree_text: str
    departments: list[str]
    status: JunjichuCaseStatus
    processing_path: list[str]
    completed_ministry_opinions: list[MinistryOpinionReadModel]
    council_verdict: str | None
    reply_id: str | None
    failure_reason: str | None
    created_at: str
    updated_at: str


def _read_model(case) -> JunjichuCaseReadModel:
    return JunjichuCaseReadModel.model_validate(case.model_dump(exclude={"owner_user_id"}))


def _validation_error() -> JSONResponse:
    return JSONResponse(status_code=400, content={"status": "error", "reason": "validation"})


def _case_unavailable_error() -> JSONResponse:
    return JSONResponse(status_code=503, content={"status": "error", "reason": "case_unavailable"})


def _validate_query_fields(request: Request) -> JSONResponse | None:
    keys = list(request.query_params.keys())
    if any(key not in _ALLOWED_QUERY_FIELDS for key in keys) or any(
        len(request.query_params.getlist(key)) != 1 for key in keys
    ):
        return _validation_error()
    return None


@router.get("", response_model=list[JunjichuCaseReadModel])
def list_junjichu_cases(
    request: Request,
    current_user: CurrentUser,
    status: str | None = None,
    department: str | None = None,
    keyword: str | None = None,
) -> list[JunjichuCaseReadModel] | JSONResponse:
    """List only the authenticated user's cases, with bounded safe filters."""

    invalid_query = _validate_query_fields(request)
    if invalid_query is not None:
        return invalid_query
    if status is not None and status not in _ALLOWED_STATUSES:
        return _validation_error()
    cases = storage.list_cases(owner_user_id=current_user.id)
    normalized_department = department.strip() if department else None
    normalized_keyword = keyword.strip() if keyword else None
    filtered = [
        case
        for case in cases
        if (status is None or case.status == status)
        and (normalized_department is None or normalized_department in case.departments)
        and (normalized_keyword is None or normalized_keyword in case.decree_text)
    ]
    try:
        return [_read_model(case) for case in filtered]
    except ValidationError:
        return _case_unavailable_error()


@router.get("/{case_id}", response_model=JunjichuCaseReadModel)
def get_junjichu_case(
    case_id: str, current_user: CurrentUser
) -> JunjichuCaseReadModel | JSONResponse:
    """Return one case only when it belongs to the authenticated owner."""

    case = storage.get_case(case_id, owner_user_id=current_user.id)
    if case is None:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "case_not_found"},
        )
    try:
        return _read_model(case)
    except ValidationError:
        return _case_unavailable_error()
