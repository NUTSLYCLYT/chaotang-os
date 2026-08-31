from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.api.auth import CurrentUser
from app.decree_jobs import DecreeJob, DecreeJobState, DecreeJobStore, JobNotFound
from app.decree_jobs.storage import ClaimEvidenceCommitmentUnavailable

router = APIRouter(prefix="/api/v1/decree-jobs", tags=["decree-jobs"])

PublicJobState = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]


@lru_cache(maxsize=1)
def get_decree_job_store() -> DecreeJobStore:
    return DecreeJobStore()


JobStore = Annotated[DecreeJobStore, Depends(get_decree_job_store)]


ErrorStage = Literal[
    "queue", "execution", "side_effect", "bureau_tool", "validation", "model", "artifact"
]
ErrorCategory = Literal[
    "cancelled", "deadline", "budget", "provider", "retry", "internal",
    "format", "tool", "data", "validation", "model", "artifact",
]
PublicErrorCode = Literal[
    "cancelled",
    "deadline_exceeded",
    "provider_budget_exceeded",
    "provider_failed",
    "retry_exhausted",
    "accounting_source_unavailable",
    "format_unrecognized",
    "tool_unavailable",
    "source_not_found",
    "validation_failed",
    "model_failed",
    "artifact_failed",
    "job_failed",
]


class DecreeJobError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: PublicErrorCode
    stage: ErrorStage
    category: ErrorCategory


class DecreeJobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    state: PublicJobState
    stage: str
    attempt_count: int
    provider_request_count: int
    cancel_requested: bool
    result: dict[str, object] | None
    error: DecreeJobError | None
    created_at: datetime
    updated_at: datetime


def _public_state(state: DecreeJobState) -> PublicJobState:
    if state in {DecreeJobState.QUEUED, DecreeJobState.RETRY_WAIT}:
        return "QUEUED"
    if state in {
        DecreeJobState.RUNNING,
        DecreeJobState.RESULT_READY,
        DecreeJobState.ARCHIVING,
        DecreeJobState.PUBLISHING,
    }:
        return "RUNNING"
    return state.value  # type: ignore[return-value]


def _safe_error_stage(job: DecreeJob) -> ErrorStage:
    stable_stages: dict[str, ErrorStage] = {
        "format_unrecognized": "bureau_tool",
        "tool_unavailable": "bureau_tool",
        "source_not_found": "bureau_tool",
        "validation_failed": "validation",
        "model_failed": "model",
        "artifact_failed": "artifact",
        "accounting_source_unavailable": "bureau_tool",
    }
    if job.error_code in stable_stages:
        return stable_stages[job.error_code]
    if job.error_stage in {
        "queue", "execution", "side_effect", "bureau_tool", "validation", "model", "artifact"
    }:
        return job.error_stage  # type: ignore[return-value]
    if job.error_stage is not None:
        raise ValueError("invalid job error stage")
    if job.state is DecreeJobState.CANCELLED and job.attempt_count == 0:
        return "queue"
    return "execution"


def _safe_error_code(job: DecreeJob) -> PublicErrorCode:
    code = job.error_code or ""
    if code in {
        "cancelled",
        "deadline_exceeded",
        "provider_budget_exceeded",
        "retry_exhausted",
        "accounting_source_unavailable",
        "format_unrecognized",
        "tool_unavailable",
        "source_not_found",
        "validation_failed",
        "model_failed",
        "artifact_failed",
    }:
        return code  # type: ignore[return-value]
    if code in {"provider_timeout", "provider_failed"}:
        return "provider_failed"
    if code == "model_output_invalid":
        return "retry_exhausted"
    return "job_failed"


def _safe_error_category(
    job: DecreeJob, public_code: PublicErrorCode
) -> ErrorCategory:
    stable_categories: dict[str, ErrorCategory] = {
        "format_unrecognized": "format",
        "tool_unavailable": "tool",
        "source_not_found": "data",
        "validation_failed": "validation",
        "model_failed": "model",
        "artifact_failed": "artifact",
        "accounting_source_unavailable": "data",
    }
    if public_code in stable_categories:
        return stable_categories[public_code]
    if job.error_category not in {
        "cancelled",
        "deadline",
        "budget",
        "provider",
        "retry",
        "internal",
        "format",
        "tool",
        "data",
        "validation",
        "model",
        "artifact",
        None,
    }:
        raise ValueError("invalid job error category")
    if public_code == "cancelled":
        return "cancelled"
    if public_code == "deadline_exceeded":
        return "deadline"
    if public_code == "provider_budget_exceeded":
        return "budget"
    if public_code == "provider_failed":
        return "provider"
    if public_code == "retry_exhausted":
        return "retry"
    return "internal"


def _response(job: DecreeJob) -> DecreeJobResponse:
    result = None
    if job.state is DecreeJobState.SUCCEEDED and job.result_json is not None:
        parsed = json.loads(job.result_json)
        if not isinstance(parsed, dict):
            raise ValueError("terminal job result must be an object")
        result = parsed
    error = None
    if job.state in {DecreeJobState.FAILED, DecreeJobState.CANCELLED}:
        public_code = _safe_error_code(job)
        error = DecreeJobError(
            code=public_code,
            stage=_safe_error_stage(job),
            category=_safe_error_category(job, public_code),
        )
    return DecreeJobResponse(
        job_id=job.job_id,
        state=_public_state(job.state),
        stage=job.state.value,
        attempt_count=job.attempt_count,
        provider_request_count=job.provider_request_count,
        cancel_requested=job.cancel_requested,
        result=result,
        error=error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _not_found() -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"status": "error", "reason": "job_not_found"},
    )


def _job_unavailable() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"status": "error", "reason": "job_unavailable"},
    )


@router.get("/{job_id}", response_model=DecreeJobResponse)
def get_decree_job(
    job_id: str, current_user: CurrentUser, store: JobStore
) -> DecreeJobResponse | JSONResponse:
    try:
        job = store.get_for_owner(job_id, current_user.id)
    except JobNotFound:
        return _not_found()
    except ClaimEvidenceCommitmentUnavailable:
        return _job_unavailable()
    try:
        return _response(job)
    except (ValueError, json.JSONDecodeError):
        return _job_unavailable()


@router.post("/{job_id}/cancel", response_model=DecreeJobResponse)
def cancel_decree_job(
    job_id: str, current_user: CurrentUser, store: JobStore
) -> DecreeJobResponse | JSONResponse:
    try:
        job = store.request_cancel(job_id, current_user.id)
    except JobNotFound:
        return _not_found()
    except ClaimEvidenceCommitmentUnavailable:
        return _job_unavailable()
    try:
        return _response(job)
    except (ValueError, json.JSONDecodeError):
        return _job_unavailable()
