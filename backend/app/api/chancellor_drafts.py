"""Authenticated HTTP contract for the independent Chancellor draft flow."""

from __future__ import annotations

import secrets
from typing import Literal

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.agents.chancellor_draft import (
    ChancellorDraftGraphInvocationError,
    ChancellorDraftInstructionsError,
    ChancellorDraftResponse,
    build_chancellor_draft_graph,
)
from app.agents.chancellor_draft.authority import draft_authority_registry
from app.agents.chancellor_draft.routing import build_route_snapshot
from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillRegistryError,
    GraphSkillHandler,
    build_default_skill_registry,
    complete_chancellor_audit,
    emit_chancellor_audit,
)
from app.api.auth import CurrentUser
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekConfigError

_SANITIZED_MESSAGE = "丞相（拟旨）暂时无法回应，请稍后再试"


class ChancellorDraftConfigError(Exception):
    """Sanitized boundary for provider or governed-skill configuration."""


class ChancellorDraftMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def _content(cls, value: str) -> str:
        stripped = value.strip()
        if not 1 <= len(stripped) <= 4000:
            raise ValueError("content must contain 1 to 4000 characters")
        return stripped


class ChancellorDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChancellorDraftMessage] = Field(min_length=1, max_length=20)
    version: int = Field(default=1, ge=1)

    @field_validator("messages")
    @classmethod
    def _messages(
        cls, value: list[ChancellorDraftMessage]
    ) -> list[ChancellorDraftMessage]:
        if sum(len(item.content) for item in value) > 20000:
            raise ValueError("combined message content is too long")
        expected = "user"
        for item in value:
            if item.role != expected:
                raise ValueError("messages must alternate from user")
            expected = "assistant" if expected == "user" else "user"
        if value[-1].role != "user":
            raise ValueError("last message must be user")
        return value


def get_chancellor_draft_graph():
    try:
        return build_chancellor_draft_graph()
    except (
        ChancellorDraftInstructionsError,
        DeepSeekConfigError,
        DeepSeekModelNameError,
    ) as exc:
        raise ChancellorDraftConfigError(
            "Chancellor draft graph configuration is unavailable."
        ) from exc


def get_chancellor_agent() -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.DRAFT_DECREE: GraphSkillHandler(
                get_chancellor_draft_graph
            )
        },
    )


router = APIRouter()


@router.post("/api/v1/chancellor-drafts", response_model=ChancellorDraftResponse)
def submit_chancellor_draft(
    payload: ChancellorDraftRequest,
    current_user: CurrentUser,
) -> ChancellorDraftResponse:
    """Prepare a draft only; this endpoint has no execution dependencies."""

    try:
        result = get_chancellor_agent().invoke(
            entrypoint=ChancellorEntrypoint.DRAFT,
            requested_skill=ChancellorSkillId.DRAFT_DECREE,
            owner_user_id=current_user.id,
            request_id=secrets.token_hex(16),
            payload={
                "messages": [
                    {"role": message.role, "content": message.content}
                    for message in payload.messages
                ],
                "version": payload.version,
            },
        )
    except (ChancellorRuntimeError, ChancellorSkillRegistryError) as exc:
        failure_audit = getattr(exc, "audit", None)
        if failure_audit is not None:
            try:
                emit_chancellor_audit(
                    complete_chancellor_audit(
                        failure_audit,
                        side_effects=(),
                        result="failure",
                        failure_code=failure_audit.failure_code,
                    )
                )
            except Exception:  # noqa: BLE001 - audit is best-effort
                pass
        if isinstance(exc.__cause__, ChancellorDraftConfigError):
            raise exc.__cause__ from exc
        if isinstance(
            exc.__cause__,
            (
                ChancellorDraftInstructionsError,
                DeepSeekConfigError,
                DeepSeekModelNameError,
            ),
        ):
            raise ChancellorDraftConfigError(
                "Chancellor draft graph configuration is unavailable."
            ) from exc.__cause__
        raise ChancellorDraftGraphInvocationError(
            "Chancellor draft graph invocation failed."
        ) from exc
    failure_code = None
    side_effects: tuple[str, ...] = ()
    try:
        graph_result = result.output
        response = graph_result.get("response") if isinstance(graph_result, dict) else None
        validated = ChancellorDraftResponse.model_validate(response)
    except Exception as exc:  # noqa: BLE001
        failure_code = "response_invalid"
        if getattr(result, "audit", None) is not None:
            try:
                emit_chancellor_audit(
                    complete_chancellor_audit(
                        result.audit,
                        side_effects=(),
                        result="failure",
                        failure_code=failure_code,
                    )
                )
            except Exception:  # noqa: BLE001 - audit is best-effort
                pass
        raise ChancellorDraftGraphInvocationError(
            "Chancellor draft graph returned an invalid response."
        ) from exc
    try:
        if (
            validated.status.value == "DRAFT_READY"
            and validated.draft is not None
            and validated.decree_text is not None
        ):
            draft_authority_registry.register(
                owner_user_id=current_user.id,
                version=validated.version,
                fingerprint=validated.fingerprint,
                decree_text=validated.decree_text,
                route_snapshot=build_route_snapshot(validated.draft),
            )
            side_effects = ("authority_registered",)
        elif draft_authority_registry.revoke(owner_user_id=current_user.id):
            side_effects = ("authority_revoked",)
        return validated
    except Exception:
        failure_code = "draft_processing_failed"
        raise
    finally:
        if getattr(result, "audit", None) is not None:
            try:
                emit_chancellor_audit(
                    complete_chancellor_audit(
                        result.audit,
                        side_effects=side_effects,
                        result="failure" if failure_code else "success",
                        failure_code=failure_code,
                    )
                )
            except Exception:  # noqa: BLE001 - audit is best-effort
                pass


def register_chancellor_draft_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ChancellorDraftConfigError)
    async def _config_error(_request, _exc: ChancellorDraftConfigError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "config_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )

    @app.exception_handler(ChancellorDraftGraphInvocationError)
    async def _model_error(
        _request, _exc: ChancellorDraftGraphInvocationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "model_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )
