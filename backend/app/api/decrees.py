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
from pydantic import BaseModel, ConfigDict, field_validator

from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.ministries import MINISTRIES
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


class BureauOpinionResponse(BaseModel):
    """One bureau opinion, preserved in the ministry's consultation order."""

    model_config = ConfigDict(extra="forbid")

    bureau: str
    opinion: str

    @field_validator("bureau", "opinion")
    @classmethod
    def _validate_non_empty_text(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("bureau opinion fields must be non-empty strings")
        return value.strip()


class MinistryOpinionResponse(BaseModel):
    """One consulted department's opinion, in call order.

    ``department`` is intentionally typed ``str`` (not ``Literal``/``Enum``):
    the graph layer already validates it is one of the fixed six ministries
    before this response model is ever constructed, so the response model
    must not re-validate a value that is already known-safe and risk turning
    a (theoretically impossible) unexpected value into an uncaught 500.
    """

    model_config = ConfigDict(extra="forbid")

    department: str
    bureau_opinions: list[BureauOpinionResponse]
    opinion: str

    @field_validator("department", "opinion")
    @classmethod
    def _validate_non_empty_text(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("ministry opinion fields must be non-empty strings")
        return value.strip()

    @field_validator("bureau_opinions")
    @classmethod
    def _validate_bureau_opinions(
        cls, value: list[BureauOpinionResponse]
    ) -> list[BureauOpinionResponse]:
        if not value:
            raise ValueError("bureau_opinions must not be empty")
        bureau_names = [entry.bureau for entry in value]
        if len(bureau_names) != len(set(bureau_names)):
            raise ValueError("bureau_opinions must not contain duplicate bureaus")
        return value


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
    council_verdict: str | None
    final_verdict: str
    recommendations: list[str]


def _non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _build_response_from_graph_result(result: object) -> ChancellorDecreeResponse:
    """Validate the complete graph result and construct the HTTP response.

    This is one fail-closed boundary: malformed graph state never escapes as
    an unhandled ``TypeError``/Pydantic validation error (500), and never
    returns a partially valid memorial. Every failure is normalized to the
    existing sanitized graph invocation error handled below as HTTP 502.
    """

    try:
        if not isinstance(result, dict):
            raise ValueError("graph result must be an object")
        required_result_fields = {
            "chancellor_rationale",
            "route_type",
            "processing_path",
            "departments",
            "ministry_opinions",
            "council_verdict",
            "final_verdict",
            "recommendations",
        }
        if not required_result_fields.issubset(result):
            raise ValueError("graph result is missing layered memorial fields")

        rationale = result.get("chancellor_rationale")
        route_type = result.get("route_type")
        processing_path = result.get("processing_path")
        departments = result.get("departments")
        ministry_opinions = result.get("ministry_opinions")
        council_verdict = result.get("council_verdict")
        final_verdict = result.get("final_verdict")
        recommendations = result.get("recommendations")

        if route_type not in ("single", "multi"):
            raise ValueError("route_type must be single or multi")
        if not _non_empty_string(rationale) or not _non_empty_string(final_verdict):
            raise ValueError("rationale and final_verdict must be non-empty strings")
        if (
            not isinstance(processing_path, list)
            or not processing_path
            or any(not _non_empty_string(step) for step in processing_path)
        ):
            raise ValueError("processing_path must be a non-empty string list")
        if (
            not isinstance(departments, list)
            or not departments
            or any(not _non_empty_string(department) for department in departments)
            or len(departments) != len(set(departments))
            or any(department not in MINISTRIES for department in departments)
        ):
            raise ValueError("departments must be a unique non-empty string list")
        if route_type == "single" and len(departments) != 1:
            raise ValueError("single routing must contain exactly one department")
        if route_type == "multi" and len(departments) < 2:
            raise ValueError("multi routing must contain at least two departments")
        if not isinstance(ministry_opinions, list) or len(ministry_opinions) != len(
            departments
        ):
            raise ValueError("ministry_opinions must correspond to departments")

        parsed_ministry_opinions: list[MinistryOpinionResponse] = []
        for department, opinion in zip(departments, ministry_opinions, strict=True):
            if not isinstance(opinion, dict) or set(opinion) != {
                "department",
                "bureau_opinions",
                "opinion",
            }:
                raise ValueError("ministry opinion has an invalid schema")
            if opinion.get("department") != department:
                raise ValueError("ministry opinion order must match departments")
            parsed_ministry_opinions.append(MinistryOpinionResponse.model_validate(opinion))

        if route_type == "single":
            if council_verdict is not None:
                raise ValueError("single routing must not have a council verdict")
        elif not _non_empty_string(council_verdict):
            raise ValueError("multi routing must have a council verdict")

        if (
            not isinstance(recommendations, list)
            or len(recommendations) != 3
            or any(not _non_empty_string(item) for item in recommendations)
        ):
            raise ValueError("recommendations must contain exactly three non-empty strings")
        normalized_recommendations = [item.strip() for item in recommendations]
        if len(set(normalized_recommendations)) != 3:
            raise ValueError("recommendations must be unique after stripping")

        return ChancellorDecreeResponse(
            status="ok",
            chancellor=CHANCELLOR_IDENTITY,
            route_type=route_type,
            rationale=rationale.strip(),
            processing_path=[step.strip() for step in processing_path],
            departments=[department.strip() for department in departments],
            ministry_opinions=parsed_ministry_opinions,
            council_verdict=(council_verdict.strip() if isinstance(council_verdict, str) else None),
            final_verdict=final_verdict.strip(),
            recommendations=normalized_recommendations,
        )
    except ChancellorGraphInvocationError:
        raise
    except Exception as exc:  # noqa: BLE001 - normalize every malformed result to sanitized 502
        raise ChancellorGraphInvocationError(
            "Chancellor graph returned an invalid layered memorial result."
        ) from exc


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
    return _build_response_from_graph_result(result)


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
