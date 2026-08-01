"""``POST /api/v1/chancellor-consult`` -- the FastAPI contract for a
non-business, advisory-only chat with the Chancellor (丞相).

This module is deliberately the *only* place where the Chancellor
consultation agent (``app.agents.chancellor_consult``) is wired to HTTP. It
does not modify ``app.agents.chancellor_consult`` or
``app.langgraph_runtime`` -- it only imports and calls their public,
read-only interfaces.

Independence from the decree/evidence business flow (ADR 0028)
-----------------------------------------------------------------
This endpoint is a parallel, independent business entry point from
``POST /api/v1/decrees/chancellor`` (``app.api.decrees``): it never imports
``app.api.decrees``, ``app.agents.chancellor``, ``app.agents.ministries``,
``app.agents.junjichu``, ``app.agents.bureaus``,
``app.agents.evidence_protocol``, ``app.jinyiwei``, ``app.shiguan``, or
``app.junjichu_cases``, and it never writes to any of their storage. See
``docs/decisions/0030-chancellor-consult-chat-contract.md``.

Provider wiring pitfall (verified in ``app.api.decrees``, must not regress
here either)
---------------------------------------------------------------------------
``get_chancellor_consult_graph()`` below is called *explicitly from inside
the endpoint function body*, not injected via FastAPI's ``Depends()``. This
is intentional: FastAPI evaluates ``Depends()`` callables even when the
request body subsequently fails Pydantic validation (422), which would mean
the consultation agent (and, in the non-test path, a real DeepSeek client)
could be constructed on every malformed request -- silently breaking the
"validation failures never call the model" acceptance criterion. Calling
``get_chancellor_consult_graph()`` as a plain statement inside the endpoint
body guarantees it only executes once FastAPI has already validated
``payload`` against :class:`ChancellorConsultRequest`. See
``backend/tests/test_chancellor_consult_api.py`` for the regression test
asserting a zero call count on every validation-failure case.

Error responses are deliberately sanitized: every exception handler below
returns a fixed, generic Chinese message and never includes the original
exception's ``str()``, a model prompt, an API key, or a backend address, so
none of those can ever reach the HTTP response body. This module registers
its *own* exception-handler classes (:class:`ChancellorConsultConfigError`,
``ChancellorConsultGraphInvocationError``) rather than reusing
``DeepSeekConfigError``/``DeepSeekModelNameError`` directly, so that
registering this module's handlers on the shared FastAPI ``app`` instance
can never overwrite (or be overwritten by) ``app.api.decrees``'s handlers for
the same underlying DeepSeek exception classes.
"""

from __future__ import annotations

import secrets
from typing import Literal

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator

from app.agents.chancellor_consult import (
    CHANCELLOR_CONSULT_IDENTITY,
    ChancellorConsultGraphInvocationError,
    build_chancellor_consult_graph,
)
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

_SANITIZED_MESSAGE = "丞相（咨询）暂时无法回应，请稍后再试"

_MIN_MESSAGE_COUNT = 1
_MAX_MESSAGE_COUNT = 20
_MIN_MESSAGE_LENGTH = 1
_MAX_MESSAGE_LENGTH = 4000
_MAX_TOTAL_LENGTH = 20000


class ChancellorConsultConfigError(Exception):
    """Raised when the DeepSeek provider configuration required for the
    Chancellor consultation graph is missing or invalid.

    Wraps the original ``DeepSeekConfigError``/``DeepSeekModelNameError``
    without concatenating its message, so no secret, environment variable
    value, or file path contained in that message can leak into the HTTP
    response. Kept as this module's own exception type (rather than
    registering a handler directly on ``DeepSeekConfigError``) so this
    module's exception-handler registration never collides with
    ``app.api.decrees.register_chancellor_exception_handlers``, which also
    registers a handler for the same shared ``DeepSeekConfigError`` class on
    the same FastAPI ``app`` instance.
    """


class ChancellorConsultMessage(BaseModel):
    """One message in the caller-supplied chat history."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def _validate_content(cls, value: str) -> str:
        stripped = value.strip()
        if not (_MIN_MESSAGE_LENGTH <= len(stripped) <= _MAX_MESSAGE_LENGTH):
            raise ValueError(
                "content must be between 1 and 4000 characters (inclusive) "
                "after stripping leading/trailing whitespace"
            )
        return stripped


class ChancellorConsultRequest(BaseModel):
    """Request body for ``POST /api/v1/chancellor-consult``."""

    model_config = ConfigDict(extra="forbid")

    messages: list[ChancellorConsultMessage]

    @field_validator("messages")
    @classmethod
    def _validate_messages(
        cls, value: list[ChancellorConsultMessage]
    ) -> list[ChancellorConsultMessage]:
        if not (_MIN_MESSAGE_COUNT <= len(value) <= _MAX_MESSAGE_COUNT):
            raise ValueError(
                f"messages must contain between {_MIN_MESSAGE_COUNT} and "
                f"{_MAX_MESSAGE_COUNT} entries (inclusive)"
            )

        total_length = sum(len(message.content) for message in value)
        if total_length > _MAX_TOTAL_LENGTH:
            raise ValueError(
                f"the combined length of every message's content must not "
                f"exceed {_MAX_TOTAL_LENGTH} characters"
            )

        expected_role: Literal["user", "assistant"] = "user"
        for message in value:
            if message.role != expected_role:
                raise ValueError(
                    "messages must strictly alternate starting with 'user' "
                    "(user, assistant, user, ...)"
                )
            expected_role = "assistant" if expected_role == "user" else "user"

        if value[-1].role != "user":
            raise ValueError("the last message must have role 'user'")

        return value


class ChancellorConsultResponse(BaseModel):
    """Successful response body for ``POST /api/v1/chancellor-consult``."""

    status: str
    consultant: str
    reply: str


def get_chancellor_consult_graph():
    """Build the real Chancellor consultation graph.

    A plain module-level function (not a FastAPI ``Depends()``) so it is
    only ever invoked explicitly from inside the endpoint body, after
    request validation has already succeeded. See the module docstring for
    why this matters. Tests monkeypatch this function directly (i.e.
    ``monkeypatch.setattr(chancellor_consult_module,
    "get_chancellor_consult_graph", ...)``) to inject a fake graph without
    touching configuration, environment variables, or the network.

    Raises:
        ChancellorConsultConfigError: wraps ``DeepSeekConfigError``/
            ``DeepSeekModelNameError`` from configuration loading/key
            resolution/model name normalization.
    """
    try:
        return build_chancellor_consult_graph()
    except (DeepSeekConfigError, DeepSeekModelNameError) as exc:
        raise ChancellorConsultConfigError(
            "Chancellor consultation graph failed to build due to invalid "
            "DeepSeek provider configuration; see __cause__ for the "
            "original exception."
        ) from exc


def get_chancellor_agent() -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.CONSULT: GraphSkillHandler(
                get_chancellor_consult_graph
            )
        },
    )


router = APIRouter()


@router.post("/api/v1/chancellor-consult", response_model=ChancellorConsultResponse)
def submit_chancellor_consult(
    payload: ChancellorConsultRequest, current_user: CurrentUser
) -> ChancellorConsultResponse:
    """Submit a chat turn to the Chancellor consultation agent.

    ``payload`` has already passed :class:`ChancellorConsultRequest`
    validation by the time this function body runs --
    ``get_chancellor_consult_graph()`` below is therefore never reached for
    a malformed/invalid request. This function calls the graph's
    ``.invoke(...)`` exactly once, which performs exactly one DeepSeek chat
    completion call (see ``app.agents.chancellor_consult.graph``); it never
    routes to a ministry, 军机处 or 锦衣卫, and never writes to 史馆.
    """
    normalized_messages = [
        {"role": message.role, "content": message.content}
        for message in payload.messages
    ]
    try:
        result = get_chancellor_agent().invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id=current_user.id,
            request_id=secrets.token_hex(16),
            payload={
                "messages": normalized_messages,
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
        if isinstance(exc.__cause__, ChancellorConsultConfigError):
            raise exc.__cause__ from exc
        if isinstance(exc.__cause__, (DeepSeekConfigError, DeepSeekModelNameError)):
            raise ChancellorConsultConfigError(
                "Chancellor consultation graph configuration is unavailable."
            ) from exc.__cause__
        raise ChancellorConsultGraphInvocationError(
            "Chancellor consultation graph invocation failed."
        ) from exc
    failure_code = None
    try:
        graph_result = result.output
        reply = graph_result.get("reply") if isinstance(graph_result, dict) else None
        if not isinstance(reply, str) or not reply.strip():
            failure_code = "response_invalid"
            raise ChancellorConsultGraphInvocationError(
                "Chancellor consultation graph returned an invalid result."
            )
        return ChancellorConsultResponse(
            status="ok",
            consultant=CHANCELLOR_CONSULT_IDENTITY,
            reply=reply.strip(),
        )
    finally:
        if getattr(result, "audit", None) is not None:
            try:
                emit_chancellor_audit(
                    complete_chancellor_audit(
                        result.audit,
                        side_effects=(),
                        result="failure" if failure_code else "success",
                        failure_code=failure_code,
                    )
                )
            except Exception:  # noqa: BLE001 - audit is best-effort
                pass


def register_chancellor_consult_exception_handlers(app: FastAPI) -> None:
    """Register sanitized error responses for the Chancellor consult route.

    - ``ChancellorConsultConfigError`` maps to a ``503`` with
      ``reason == "config_unavailable"``.
    - ``ChancellorConsultGraphInvocationError`` (the model call itself
      failed, or returned no usable text) maps to a ``502`` with
      ``reason == "model_unavailable"``.

    Both handlers return a fixed, generic message and never include the
    original exception's ``str()``, so neither a secret, a file path, a
    prompt, nor raw model output can leak into the HTTP response body.
    """

    @app.exception_handler(ChancellorConsultConfigError)
    async def _handle_config_unavailable(
        _request, _exc: ChancellorConsultConfigError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "config_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )

    @app.exception_handler(ChancellorConsultGraphInvocationError)
    async def _handle_model_unavailable(
        _request, _exc: ChancellorConsultGraphInvocationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "model_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )
