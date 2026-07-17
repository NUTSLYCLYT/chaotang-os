"""``POST /api/v1/decrees/chancellor`` -- the FastAPI contract for submitting
a decree (旨意) to the dedicated Chancellor (丞相) LangGraph agent.

This module is deliberately the *only* place where the Chancellor agent is
wired to HTTP. It does not modify ``app.agents.chancellor`` or
``app.langgraph_runtime`` -- it only imports and calls their public,
read-only interfaces.

Provider wiring pitfall (verified, must not regress)
-----------------------------------------------------
``get_chancellor_graph()`` below is called *explicitly from inside the
endpoint function body*, not injected via FastAPI's ``Depends()``. This is
intentional: FastAPI evaluates ``Depends()`` callables even when the request
body subsequently fails Pydantic validation (422), which would mean the
Chancellor agent (and, in the non-test path, a real DeepSeek client) could
be constructed on every malformed request -- silently breaking the
"validation failures never call the Agent" acceptance criterion. Calling
``get_chancellor_graph()`` as a plain statement inside the endpoint body
guarantees it only executes once FastAPI has already validated ``payload``
against :class:`ChancellorDecreeRequest`. See
``backend/tests/test_decrees_api.py`` for the regression test asserting a
zero call count on every validation-failure case.

Error responses are deliberately sanitized: both the config-error handler
and the model-error handler below return a fixed, generic Chinese message
and never include the original exception's ``str()``, so a leaking secret
or internal provider detail in an upstream exception message can never reach
the HTTP response body.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekConfigError

_SANITIZED_MESSAGE = "丞相暂时无法处理旨意，请稍后再试"

_MIN_DECREE_LENGTH = 1
_MAX_DECREE_LENGTH = 2000


class ChancellorDecreeRequest(BaseModel):
    """Request body for ``POST /api/v1/decrees/chancellor``."""

    decree_text: str

    @field_validator("decree_text")
    @classmethod
    def _validate_decree_text(cls, value: str) -> str:
        stripped_length = len(value.strip())
        if not (_MIN_DECREE_LENGTH <= stripped_length <= _MAX_DECREE_LENGTH):
            raise ValueError(
                "decree_text must be between 1 and 2000 characters "
                "(inclusive) after stripping leading/trailing whitespace"
            )
        return value.strip()


class ChancellorDecreeResponse(BaseModel):
    """Successful response body for ``POST /api/v1/decrees/chancellor``."""

    status: str
    chancellor: str
    memorial_text: str


def get_chancellor_graph():
    """Build the real Chancellor graph.

    A plain module-level function (not a FastAPI ``Depends()``) so it is
    only ever invoked explicitly from inside the endpoint body, after
    request validation has already succeeded. See the module docstring for
    why this matters. Tests monkeypatch this function directly (i.e.
    ``monkeypatch.setattr(decrees_module, "get_chancellor_graph", ...)``) to
    inject a fake graph without touching configuration, environment
    variables, or the network.
    """
    return build_chancellor_graph()


router = APIRouter()


@router.post("/api/v1/decrees/chancellor", response_model=ChancellorDecreeResponse)
def submit_decree(payload: ChancellorDecreeRequest) -> ChancellorDecreeResponse:
    """Submit a decree (旨意) to the Chancellor agent and return its memorial.

    ``payload`` has already passed :class:`ChancellorDecreeRequest` validation
    by the time this function body runs -- ``get_chancellor_graph()`` below
    is therefore never reached for a malformed/invalid request.
    """
    graph = get_chancellor_graph()
    result = graph.invoke({"decree_text": payload.decree_text, "memorial_text": ""})
    memorial_text = result.get("memorial_text")
    if not isinstance(memorial_text, str) or not memorial_text.strip():
        raise ChancellorGraphInvocationError(
            "Chancellor graph returned an empty memorial response."
        )
    return ChancellorDecreeResponse(
        status="ok",
        chancellor=CHANCELLOR_IDENTITY,
        memorial_text=memorial_text.strip(),
    )


def register_chancellor_exception_handlers(app: FastAPI) -> None:
    """Register sanitized error responses for the Chancellor decree route.

    - ``DeepSeekConfigError`` (and every subclass, e.g. missing/invalid API
      key or provider config) maps to a ``503`` with ``reason ==
      "config_unavailable"``.
    - ``ChancellorGraphInvocationError`` (the model call itself failed) maps
      to a ``502`` with ``reason == "model_unavailable"``.

    Both handlers return a fixed, generic message and never include the
    original exception's ``str()``, so neither a secret, a file path, nor
    internal graph state can leak into the HTTP response body.
    """

    @app.exception_handler(DeepSeekConfigError)
    async def _handle_config_unavailable(_request, _exc: DeepSeekConfigError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "config_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )

    @app.exception_handler(DeepSeekModelNameError)
    async def _handle_model_name_unavailable(
        _request, _exc: DeepSeekModelNameError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "reason": "config_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )

    @app.exception_handler(ChancellorGraphInvocationError)
    async def _handle_model_unavailable(
        _request, _exc: ChancellorGraphInvocationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "model_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )
