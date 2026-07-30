"""Authenticated HTTP contract for the independent Chancellor draft flow."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.agents.chancellor_draft import (
    ChancellorDraftGraphInvocationError,
    ChancellorDraftResponse,
    ChancellorDraftSkillError,
    build_chancellor_draft_graph,
)
from app.agents.chancellor_draft.authority import draft_authority_registry
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
        ChancellorDraftSkillError,
        DeepSeekConfigError,
        DeepSeekModelNameError,
    ) as exc:
        raise ChancellorDraftConfigError(
            "Chancellor draft graph configuration is unavailable."
        ) from exc


router = APIRouter()


@router.post("/api/v1/chancellor-drafts", response_model=ChancellorDraftResponse)
def submit_chancellor_draft(
    payload: ChancellorDraftRequest,
    current_user: CurrentUser,
) -> ChancellorDraftResponse:
    """Prepare a draft only; this endpoint has no execution dependencies."""

    graph = get_chancellor_draft_graph()
    result = graph.invoke(
        {
            "messages": [
                {"role": message.role, "content": message.content}
                for message in payload.messages
            ],
            "version": payload.version,
        }
    )
    response = result.get("response") if isinstance(result, dict) else None
    try:
        validated = ChancellorDraftResponse.model_validate(response)
    except Exception as exc:  # noqa: BLE001
        raise ChancellorDraftGraphInvocationError(
            "Chancellor draft graph returned an invalid response."
        ) from exc
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
        )
    else:
        draft_authority_registry.revoke(owner_user_id=current_user.id)
    return validated


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
