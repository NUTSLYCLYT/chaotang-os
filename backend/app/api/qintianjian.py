from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.api.auth import CurrentUser
from app.qintianjian import storage
from app.qintianjian.models import (
    Assumption,
    EvidenceRef,
    Forecast,
    ForecastReview,
    PendingTrigger,
    Scenario,
    Subject,
    Trigger,
)
from app.qintianjian.provider import (
    QintianProviderUnavailable,
    build_consult_provider,
    build_forecast_provider,
)
from app.shiguan import ArchiveNotFoundError, get_archive

router = APIRouter(prefix="/api/v1/qintianjian", tags=["qintianjian"])
_ERROR_MESSAGE = "钦天监暂时无法完成推演，请稍后再试"


class ConsultMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ConsultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ConsultMessage] = Field(min_length=1, max_length=20)

    @field_validator("messages")
    @classmethod
    def alternating(cls, value):
        if value[0].role != "user" or value[-1].role != "user":
            raise ValueError("conversation must begin and end with user")
        for left, right in zip(value, value[1:], strict=False):
            if left.role == right.role:
                raise ValueError("roles must alternate")
        return value


class ConsultResponse(BaseModel):
    status: Literal["ok"] = "ok"
    consultant: Literal["钦天监"] = "钦天监"
    reply: str


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = Field(min_length=8, max_length=128)
    subject: Subject
    question: str = Field(min_length=1, max_length=4000)
    evidence_refs: list[EvidenceRef] = Field(max_length=50)
    review_at: str

    @field_validator("review_at")
    @classmethod
    def valid_review_at(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            raise ValueError("review_at must be timezone-aware")
        return parsed.isoformat()


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["KEEP", "INVALIDATE", "REQUEST_RERUN", "ESCALATE_TO_CHANCELLOR"]
    trigger_id: str = Field(min_length=1, max_length=200)
    observation: str = Field(min_length=1, max_length=4000)
    judgment_invalidated: bool


class ForecastList(BaseModel):
    items: list[Forecast]


class PendingTriggerList(BaseModel):
    items: list[PendingTrigger]


def get_consult_provider():
    return build_consult_provider()


def get_forecast_provider():
    return build_forecast_provider()


def resolve_reply_subject(reference_id: str, owner_user_id: str) -> Subject:
    archive = get_archive(reference_id, owner_user_id=owner_user_id)
    if archive.type != "REPLY":
        raise ArchiveNotFoundError("reply archive not found")
    return Subject(
        kind="REPLY",
        id=archive.id,
        title=archive.title,
        content=archive.content,
    )


@router.post("/consult", response_model=ConsultResponse)
def consult(payload: ConsultRequest, current_user: CurrentUser) -> ConsultResponse:
    del current_user
    reply = get_consult_provider()([item.model_dump() for item in payload.messages])
    if not isinstance(reply, str) or not reply.strip():
        raise QintianProviderUnavailable("empty consult response")
    return ConsultResponse(reply=reply.strip())


@router.post("/forecasts", response_model=Forecast, status_code=201)
def create_forecast(payload: ForecastRequest, current_user: CurrentUser) -> Forecast:
    try:
        subject = (
            resolve_reply_subject(payload.subject.id, current_user.id)
            if payload.subject.kind == "REPLY"
            else payload.subject
        )
    except ArchiveNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "subject_not_found"},
        )
    provider_payload = payload.model_dump(exclude={"idempotency_key", "subject"})
    provider_payload["subject"] = subject.model_dump()
    request_hash = storage.canonical_request_hash(provider_payload)
    try:
        existing = storage.claim(current_user.id, payload.idempotency_key, request_hash)
    except storage.IdempotencyConflictError:
        return JSONResponse(
            status_code=409,
            content={"status": "error", "reason": "idempotency_conflict"},
        )
    except storage.ForecastClaimedError:
        return JSONResponse(
            status_code=409,
            content={"status": "error", "reason": "forecast_in_progress"},
        )
    if existing is not None:
        return existing
    try:
        raw = get_forecast_provider()(provider_payload)
    except Exception:
        storage.release_claim(current_user.id, payload.idempotency_key, request_hash)
        raise
    try:
        scenarios = [
            Scenario.model_validate(item).model_copy(update={"probability_interval": None})
            for item in raw["scenarios"]
        ]
        assumptions = [Assumption.model_validate(item) for item in raw["assumptions"]]
        triggers = [
            Trigger(
                id=str(uuid.uuid4()),
                review_at=payload.review_at,
                **item,
            )
            for item in raw["triggers"]
        ]
        forecast = Forecast(
            id=str(uuid.uuid4()),
            created_at=datetime.now(UTC).isoformat(),
            subject=subject,
            question=payload.question,
            judgment=raw["judgment"],
            confidence=raw["confidence"],
            confidence_basis=raw["confidence_basis"],
            review_at=payload.review_at,
            scenarios=scenarios,
            assumptions=assumptions,
            evidence_refs=payload.evidence_refs,
            triggers=triggers,
            human_signoff_required=raw.get("human_signoff_required", True),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        storage.release_claim(current_user.id, payload.idempotency_key, request_hash)
        raise QintianProviderUnavailable("invalid forecast provider output") from exc
    return storage.finalize(current_user.id, payload.idempotency_key, request_hash, forecast)


@router.get("/forecasts", response_model=ForecastList)
def list_forecasts(current_user: CurrentUser) -> ForecastList:
    return ForecastList(items=storage.list_forecasts(current_user.id))


@router.get("/forecasts/{forecast_id}", response_model=Forecast)
def get_forecast(forecast_id: str, current_user: CurrentUser):
    forecast = storage.get_forecast(current_user.id, forecast_id)
    if forecast is None:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "forecast_not_found"},
        )
    return forecast


@router.get("/triggers/pending", response_model=PendingTriggerList)
def get_pending_triggers(current_user: CurrentUser) -> PendingTriggerList:
    return PendingTriggerList(items=storage.pending_triggers(current_user.id))


@router.post(
    "/forecasts/{forecast_id}/reviews",
    response_model=ForecastReview,
    status_code=201,
)
def append_review(forecast_id: str, payload: ReviewRequest, current_user: CurrentUser):
    forecast = storage.get_forecast(current_user.id, forecast_id)
    if forecast is None:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "forecast_not_found"},
        )
    if payload.trigger_id not in {item.id for item in forecast.triggers}:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "trigger_not_found"},
        )
    review = storage.append_review(
        current_user.id,
        forecast_id,
        payload.trigger_id,
        payload.decision,
        payload.observation.strip(),
        payload.judgment_invalidated,
    )
    if review is None:
        return JSONResponse(
            status_code=404,
            content={"status": "error", "reason": "forecast_not_found"},
        )
    return review


def register_qintianjian_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(QintianProviderUnavailable)
    async def unavailable(_request, _exc: QintianProviderUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "model_unavailable",
                "message": _ERROR_MESSAGE,
            },
        )
