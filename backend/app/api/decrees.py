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


class MinistryOpinionResponse(BaseModel):
    """One consulted department's opinion, in call order.

    ``department`` is intentionally typed ``str`` (not ``Literal``/``Enum``):
    the graph layer already validates it is one of the fixed six ministries
    before this response model is ever constructed, so the response model
    must not re-validate a value that is already known-safe and risk turning
    a (theoretically impossible) unexpected value into an uncaught 500.
    """

    department: str
    opinion: str


class ChancellorDecreeResponse(BaseModel):
    """Successful response body for ``POST /api/v1/decrees/chancellor``.

    Replaces the old single-paragraph ``memorial_text`` field with the full
    routing/processing result produced by ``build_chancellor_graph()``:
    the Chancellor's routing judgement (``rationale``), the route type
    (``"single"`` or ``"multi"``), the ordered processing path, the
    consulted departments, each department's opinion, and the final
    verdict. ``route_type`` is intentionally typed ``str`` (not
    ``Literal["single", "multi"]``) for the same reason as
    ``MinistryOpinionResponse.department`` -- the graph layer is the single
    place that enforces this contract.
    """

    status: str
    chancellor: str
    route_type: str
    rationale: str
    processing_path: list[str]
    departments: list[str]
    ministry_opinions: list[MinistryOpinionResponse]
    final_verdict: str


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
    """Submit a decree (旨意) to the Chancellor agent and return its full result.

    ``payload`` has already passed :class:`ChancellorDecreeRequest` validation
    by the time this function body runs -- ``get_chancellor_graph()`` below
    is therefore never reached for a malformed/invalid request.

    A single ``graph.invoke(...)`` call covers both the ``"single"`` (one
    ministry) and ``"multi"`` (军机处 multi-department council) routes; the
    graph's own nodes/conditional edges decide which branch runs, so this
    function never invokes the graph more than once and never re-implements
    any routing/orchestration logic itself (see ``backend/AGENTS.md``: "api
    不实现 agent 图逻辑").
    """
    graph = get_chancellor_graph()
    result = graph.invoke({"decree_text": payload.decree_text})

    final_verdict = result.get("final_verdict")
    if not isinstance(final_verdict, str) or not final_verdict.strip():
        raise ChancellorGraphInvocationError(
            "Chancellor graph returned an empty final verdict."
        )

    rationale = result.get("chancellor_rationale")
    route_type = result.get("route_type")
    processing_path = result.get("processing_path")
    departments = result.get("departments")
    ministry_opinions = result.get("ministry_opinions")
    if (
        not isinstance(rationale, str)
        or not rationale.strip()
        or not isinstance(route_type, str)
        or not route_type
        or not isinstance(processing_path, list)
        or not processing_path
        or not isinstance(departments, list)
        or not departments
        or not isinstance(ministry_opinions, list)
        or not ministry_opinions
    ):
        raise ChancellorGraphInvocationError(
            "Chancellor graph returned an incomplete routing result."
        )

    return ChancellorDecreeResponse(
        status="ok",
        chancellor=CHANCELLOR_IDENTITY,
        route_type=route_type,
        rationale=rationale.strip(),
        processing_path=processing_path,
        departments=departments,
        ministry_opinions=[
            MinistryOpinionResponse(
                department=opinion.get("department", ""),
                opinion=opinion.get("opinion", ""),
            )
            for opinion in ministry_opinions
        ],
        final_verdict=final_verdict.strip(),
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
