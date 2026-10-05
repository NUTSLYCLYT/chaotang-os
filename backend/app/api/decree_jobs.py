from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from functools import lru_cache
from importlib import import_module
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, field_validator

from app.api.auth import CurrentUser
from app.decree_jobs import (
    DecreeJob,
    DecreeJobState,
    DecreeJobStore,
    JobNotFound,
)
from app.decree_jobs.models import TERMINAL_STATES
from app.decree_jobs.storage import (
    ClaimEvidenceCommitmentUnavailable,
    DecreeJobStoreError,
    JobHistoryArchiveRejected,
)

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
        "queue",
        "execution",
        "side_effect",
        "bureau_tool",
        "validation",
        "model",
        "artifact",
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


def _safe_error_category(job: DecreeJob, public_code: PublicErrorCode) -> ErrorCategory:
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


class DecreeJobListItem(DecreeJobResponse):
    title: str
    decree_text: str
    history_archived: bool


class DecreeJobPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[DecreeJobListItem]
    total: int
    limit: int
    offset: int


class HistoryAnnotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: StrictBool


class HistoryAnnotationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str
    history_archived: bool
    updated_at: datetime | None


class FirstLoopRequest(BaseModel):
    """Inputs for the deterministic first-loop contract preview.

    Evidence references stay opaque and must be supplied by the caller.  The
    endpoint never derives evidence from task metadata or invokes a model.
    """

    model_config = ConfigDict(extra="forbid")

    evidence_refs: list[StrictStr] = Field(default_factory=list, max_length=64)
    department: str = Field(default="hubu", min_length=1, max_length=64)
    final_verdict: str = Field(default="Result ready", min_length=1, max_length=2000)
    recommendations: list[str] = Field(
        default_factory=lambda: [
            "Review evidence",
            "Confirm scope",
            "Archive reply",
        ],
        min_length=3,
        max_length=3,
    )
    reply_ref: str = Field(default="reply-1", min_length=1, max_length=256)

    @field_validator("evidence_refs")
    @classmethod
    def _validate_evidence_refs(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("evidence_refs_must_be_nonblank_strings")
        if len(normalized) != len(set(normalized)):
            raise ValueError("evidence_refs_must_be_unique")
        if any(len(item.encode("utf-8")) > 256 for item in normalized):
            raise ValueError("evidence_ref_too_long")
        return normalized


def _trusted_first_loop_evidence_refs(job: DecreeJob) -> tuple[str, ...] | None:
    """Read only evidence ids already persisted by the completed worker.

    The first-loop adapter has no evidence store of its own. Client supplied
    ids therefore cannot establish evidence provenance; when a job has no
    durable result, only an empty evidence list is trusted.
    """

    if job.result_json is None:
        return ()
    try:
        raw = json.loads(job.result_json)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(raw, dict):
        return None
    internal = raw.get("internal_result")
    if not isinstance(internal, dict):
        return None
    refs = internal.get("adopted_evidence_ids", ())
    if not isinstance(refs, list) or any(
        not isinstance(item, str) or not item.strip() for item in refs
    ):
        return None
    normalized = tuple(item.strip() for item in refs)
    if len(normalized) != len(set(normalized)):
        return None
    return normalized


def _first_loop_contracts():
    """Load the optional comparison adapter only when its endpoint is used.

    The ordinary decree-job API must remain importable without wiring the
    comparison-contract package into the existing runtime.  The explicit
    first-loop endpoint is the opt-in boundary for that adapter.
    """

    return import_module("app.orchestration")


def _first_loop_request(job: DecreeJob):
    """Project one accepted job onto the existing first-loop request contract.

    The projection uses only immutable job fields.  ``attempt_ref`` is an
    opaque, stable reference because the legacy job schema has no attempt
    lineage column; no attempt record is created here.
    """

    resource_manifest_digest = (
        "sha256:" + hashlib.sha256(job.approved_route_json.encode("utf-8")).hexdigest()
    )
    decree_id = job.draft_fingerprint or job.request_hash or job.job_id
    contracts = _first_loop_contracts()
    return contracts.OrchestrationRequest(
        identity=contracts.ExecutionIdentity(
            owner_user_id=job.owner_user_id,
            run_id=job.job_id,
            decree_id=decree_id,
        ),
        decree_text=job.decree_text,
        input_digest=contracts.decree_input_digest(job.decree_text),
        resource_manifest_digest=resource_manifest_digest,
        provider_budget=contracts.ProviderBudget(
            # Contract preview performs no provider calls or token accounting.
            max_calls=0,
            max_tokens=0,
            timeout_ms=90_000,
        ),
    )


@router.post("/{job_id}/first-loop", response_model=None)
def run_first_loop(
    job_id: str,
    payload: FirstLoopRequest,
    current_user: CurrentUser,
    store: JobStore,
) -> dict[str, object] | JSONResponse:
    """Run the completed first-loop contracts against one existing job.

    This is intentionally a read-only adapter: it returns a validated trace,
    while the existing worker remains the only writer of task state and the
    only path that can execute the real Chancellor graph.
    """

    try:
        job = store.get_for_owner(job_id, current_user.id)
        if job.state not in TERMINAL_STATES:
            return JSONResponse(
                status_code=409,
                content={"status": "error", "reason": "first_loop_requires_terminal_job"},
            )
        trusted_evidence_refs = _trusted_first_loop_evidence_refs(job)
        if trusted_evidence_refs is None:
            return _job_unavailable()
        if tuple(payload.evidence_refs) != trusted_evidence_refs:
            return JSONResponse(
                status_code=422,
                content={"status": "error", "reason": "evidence_refs_not_verified"},
            )
        request = _first_loop_request(job)
        contracts = _first_loop_contracts()
        trace = contracts.FirstLoopAdapter().run(
            contracts.FirstLoopSubmission(
                request=request,
                task_ref=job.job_id,
                attempt_ref=f"attempt:{job.job_id}",
                evidence_refs=tuple(payload.evidence_refs),
                department=payload.department,
                final_verdict=payload.final_verdict,
                recommendations=tuple(payload.recommendations),
                reply_ref=payload.reply_ref,
            )
        )
        return trace.model_dump(mode="json")
    except JobNotFound:
        return _not_found()
    except ClaimEvidenceCommitmentUnavailable:
        return _job_unavailable()
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "reason": str(exc)},
        )
    except (DecreeJobStoreError, sqlite3.Error):
        return _job_unavailable()


@router.get("", response_model=DecreeJobPage)
def list_decree_jobs(
    current_user: CurrentUser,
    store: JobStore,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
    q: Annotated[str, Query(max_length=500)] = "",
    archived: Literal["active", "archived", "all"] = "active",
) -> DecreeJobPage | JSONResponse:
    try:
        rows, total = store.list_for_owner(
            current_user.id,
            limit=limit,
            offset=offset,
            q=q,
            archived=archived,
        )
        items = [
            DecreeJobListItem(
                **_response(job).model_dump(),
                title=job.decree_text.strip()[:120],
                decree_text=job.decree_text,
                history_archived=is_archived,
            )
            for job, is_archived in rows
        ]
        return DecreeJobPage(items=items, total=total, limit=limit, offset=offset)
    except (DecreeJobStoreError, sqlite3.Error, ValueError):
        return _job_unavailable()


@router.get("/{job_id}/history-annotation", response_model=HistoryAnnotationResponse)
def get_history_annotation(
    job_id: str,
    current_user: CurrentUser,
    store: JobStore,
) -> HistoryAnnotationResponse | JSONResponse:
    try:
        return HistoryAnnotationResponse(**store.get_history_annotation(job_id, current_user.id))
    except JobNotFound:
        return _not_found()
    except (DecreeJobStoreError, sqlite3.Error, ValueError):
        return _job_unavailable()


@router.put("/{job_id}/history-annotation", response_model=HistoryAnnotationResponse)
def set_history_annotation(
    job_id: str,
    payload: HistoryAnnotationRequest,
    current_user: CurrentUser,
    store: JobStore,
) -> HistoryAnnotationResponse | JSONResponse:
    try:
        return HistoryAnnotationResponse(
            **store.set_history_annotation(
                job_id,
                current_user.id,
                payload.archived,
            )
        )
    except JobNotFound:
        return _not_found()
    except JobHistoryArchiveRejected:
        return JSONResponse(
            status_code=409, content={"status": "error", "reason": "job_history_archive_rejected"}
        )
    except (DecreeJobStoreError, sqlite3.Error, ValueError):
        return _job_unavailable()


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
