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

import secrets
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.accounting_reports.intent import detect_accounting_report_intent
from app.accounting_reports.models import PublishedReportArtifact
from app.accounting_reports.session import AccountingReportSession
from app.accounting_reports.storage import DEFAULT_ARTIFACT_DIR, DEFAULT_DB_PATH
from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor_draft.authority import draft_authority_registry
from app.agents.chancellor_draft.routing import (
    ApprovedRouteSnapshot,
    validate_route_snapshot,
)
from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillInvocationError,
    ChancellorSkillRegistryError,
    GraphSkillHandler,
    build_default_skill_registry,
    complete_chancellor_audit,
    emit_chancellor_audit,
)
from app.agents.junjichu.agent import CaseLifecycleObserver
from app.agents.ministries import MINISTRIES
from app.agents.synthesis_failures import (
    SynthesisFailureCode,
    SynthesisStage,
    classify_synthesis_failure,
)
from app.api.auth import CurrentUser
from app.junjichu_cases import (
    JunjichuCaseOpenInput,
    archive_case,
    fail_case,
    open_case,
    record_checkpoint,
)
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekConfigError
from app.shiguan.archive_decree import archive_chancellor_decree

_SANITIZED_MESSAGE = "丞相暂时无法处理旨意，请稍后再试"

_MIN_DECREE_LENGTH = 1
_MAX_DECREE_LENGTH = 2000
_FIXED_FAILURE_REASON = "processing_failed"
_FAILURE_STAGES = frozenset(
    {"route", "bureau", "ministry", "council", "finalize", "archive", "report"}
)
_ACCOUNTING_SOURCE_DIR = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "财务数据资料"
    / "20-25年财务报表及科目余额表"
)


class AccountingReportPublicationError(RuntimeError):
    """Raised when a pending report cannot be attached to an archived reply."""


def build_accounting_report_session(
    *, owner_user_id: str, run_id: str
) -> AccountingReportSession:
    return AccountingReportSession(
        owner_user_id=owner_user_id,
        run_id=run_id,
        source_dir=_ACCOUNTING_SOURCE_DIR,
        artifact_dir=DEFAULT_ARTIFACT_DIR,
        db_path=DEFAULT_DB_PATH,
    )


class _StorageCaseLifecycleObserver(CaseLifecycleObserver):
    """Bind validated lifecycle events to one authenticated owner's case."""

    def __init__(self, owner_user_id: str) -> None:
        self._owner_user_id = owner_user_id
        self._case_id: str | None = None
        self._completed_ministry_opinions: list[dict[str, object]] = []
        self._failure_stage: SynthesisStage = "route"
        self._failure_recorded = False

    @property
    def case_created(self) -> bool:
        return self._case_id is not None

    def open_case(
        self, *, decree_text: str, departments: list[str], processing_path: list[str]
    ) -> None:
        case = open_case(
            JunjichuCaseOpenInput(
                decree_text=decree_text,
                route_type="multi",
                departments=departments,
                processing_path=processing_path,
            ),
            owner_user_id=self._owner_user_id,
        )
        self._case_id = case.id
        self._failure_stage = "ministry"

    def record_ministry_opinion(self, opinion: dict[str, object]) -> None:
        if self._case_id is None:
            return
        self._failure_stage = "ministry"
        self._completed_ministry_opinions.append(opinion)
        record_checkpoint(
            self._case_id,
            owner_user_id=self._owner_user_id,
            status="MINISTRY_REVIEWING",
            completed_ministry_opinions=self._completed_ministry_opinions,
        )

    def record_checkpoint(
        self,
        *,
        status: str,
        processing_path: list[str],
        council_verdict: str | None = None,
    ) -> None:
        if self._case_id is None:
            return
        if status == "COUNCIL_REVIEWING":
            self._failure_stage = "council"
        elif status == "CHANCELLOR_FINALIZING":
            self._failure_stage = "finalize"
        record_checkpoint(
            self._case_id,
            owner_user_id=self._owner_user_id,
            status=status,  # type: ignore[arg-type]
            processing_path=processing_path,
            completed_ministry_opinions=self._completed_ministry_opinions,
            council_verdict=council_verdict,
        )

    def archive(self, reply_id: str) -> None:
        if self._case_id is not None:
            archive_case(
                self._case_id,
                owner_user_id=self._owner_user_id,
                reply_id=reply_id,
            )

    def fail(
        self,
        *,
        stage: SynthesisStage | None = None,
        code: SynthesisFailureCode = "state_invalid",
    ) -> None:
        if self._case_id is not None and not self._failure_recorded:
            self._failure_recorded = True
            fail_case(
                self._case_id,
                owner_user_id=self._owner_user_id,
                reason=_FIXED_FAILURE_REASON,
                failure_stage=stage or self._failure_stage,
                failure_code=code,
            )


_lifecycle_observer_context: ContextVar[CaseLifecycleObserver | None] = ContextVar(
    "lifecycle_observer", default=None
)


class ChancellorDecreeRequest(BaseModel):
    """Request body for ``POST /api/v1/decrees/chancellor``."""

    decree_text: str
    draft_version: int | None = None
    draft_fingerprint: str | None = None

    model_config = ConfigDict(extra="forbid")

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

    @field_validator("draft_version")
    @classmethod
    def _validate_draft_version(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1:
            raise ValueError("draft_version must be positive")
        return value

    @field_validator("draft_fingerprint")
    @classmethod
    def _validate_draft_fingerprint(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
            raise ValueError("draft_fingerprint must be a lowercase SHA-256 value")
        return value


class DraftNotCurrentError(Exception):
    """Raised before execution when the supplied draft authority is stale."""


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


class ReportArtifactResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    kind: str
    display_name: str
    period_start: int
    period_end: int
    generated_at: datetime

    @classmethod
    def from_domain(cls, item: PublishedReportArtifact) -> ReportArtifactResponse:
        return cls(
            artifact_id=item.artifact_id,
            kind="ACCOUNTING_MANAGEMENT_REPORT_XLSX",
            display_name=item.display_name,
            period_start=item.period.start_year,
            period_end=item.period.end_year,
            generated_at=item.generated_at,
        )


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
    artifacts: list[ReportArtifactResponse] = Field(default_factory=list)


def _non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _build_response_from_graph_result(
    result: object,
    approved_route: ApprovedRouteSnapshot,
    *,
    decree_text: str,
) -> ChancellorDecreeResponse:
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
        approved_departments = [
            route.department for route in approved_route.departments
        ]
        if departments != approved_departments:
            raise ValueError("departments must exactly match the approved route")
        if not isinstance(ministry_opinions, list) or len(ministry_opinions) != len(
            departments
        ):
            raise ValueError("ministry_opinions must correspond to departments")

        parsed_ministry_opinions: list[MinistryOpinionResponse] = []
        for approved_department, opinion in zip(
            approved_route.departments, ministry_opinions, strict=True
        ):
            if not isinstance(opinion, dict) or set(opinion) != {
                "department",
                "bureau_opinions",
                "opinion",
            }:
                raise ValueError("ministry opinion has an invalid schema")
            if opinion.get("department") != approved_department.department:
                raise ValueError("ministry opinion order must match departments")
            parsed_opinion = MinistryOpinionResponse.model_validate(opinion)
            actual_bureaus = [
                bureau_opinion.bureau
                for bureau_opinion in parsed_opinion.bureau_opinions
            ]
            if len(actual_bureaus) != len(set(actual_bureaus)):
                raise ValueError(
                    "ministry opinion must not contain duplicate bureaus"
                )
            department_bureaus = {
                profile.bureau
                for profile in bureau_profiles_for(approved_department.department)
            }
            if any(bureau not in department_bureaus for bureau in actual_bureaus):
                raise ValueError(
                    "ministry opinion bureaus must belong to the department"
                )
            if not set(approved_department.required_bureaus).issubset(
                set(actual_bureaus)
            ):
                raise ValueError(
                    "ministry opinion must include every required bureau"
                )
            parsed_ministry_opinions.append(parsed_opinion)

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

        if detect_accounting_report_intent(decree_text).requested:
            if (
                route_type != "single"
                or len(approved_route.departments) != 1
                or approved_route.departments[0].department != "户部"
                or approved_route.departments[0].required_bureaus != ("会计司",)
            ):
                raise ValueError(
                    "accounting reports require the approved 户部·会计司 route"
                )
            actual_bureaus = [
                item.bureau
                for item in parsed_ministry_opinions[0].bureau_opinions
            ]
            if actual_bureaus != ["会计司"]:
                raise ValueError(
                    "accounting reports must be handled only by 会计司"
                )
            expected_processing_path = [
                "上书房",
                "丞相（首次分流）",
                "户部",
                "户部·会计司",
                "户部（部级补充）",
                "丞相（最终汇总）",
            ]
            if processing_path != expected_processing_path:
                raise ValueError(
                    "accounting report processing path must exactly match "
                    "the approved single-department route"
                )

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


def get_chancellor_graph(*, report_session: AccountingReportSession | None = None):
    """Build the real Chancellor graph.

    A plain module-level function (not a FastAPI ``Depends()``) so it is
    only ever invoked explicitly from inside the endpoint body, after
    request validation has already succeeded. See the module docstring for
    why this matters. Tests monkeypatch this function directly (i.e.
    ``monkeypatch.setattr(decrees_module, "get_chancellor_graph", ...)``) to
    inject a fake graph without touching configuration, environment
    variables, or the network.
    """
    return build_chancellor_graph(
        lifecycle_observer=_lifecycle_observer_context.get(),
        report_session=report_session,
    )


def get_execution_chancellor_agent(
    *, report_session: AccountingReportSession
) -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.EXECUTE_DECREE: GraphSkillHandler(
                lambda: get_chancellor_graph(report_session=report_session)
            )
        },
    )


router = APIRouter()


@router.post("/api/v1/decrees/chancellor", response_model=ChancellorDecreeResponse)
def submit_decree(
    payload: ChancellorDecreeRequest, current_user: CurrentUser
) -> ChancellorDecreeResponse:
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
    try:
        approved_route = draft_authority_registry.consume(
            owner_user_id=current_user.id,
            version=payload.draft_version or 0,
            fingerprint=payload.draft_fingerprint or "",
            decree_text=payload.decree_text,
        )
    except Exception:
        raise AccountingReportPublicationError(
            "draft_authority_unavailable"
        ) from None
    if approved_route is None:
        raise DraftNotCurrentError
    try:
        approved_route = validate_route_snapshot(approved_route)
    except Exception:
        raise DraftNotCurrentError from None

    run_id = secrets.token_hex(16)
    report_session = build_accounting_report_session(
        owner_user_id=current_user.id,
        run_id=run_id,
    )
    observer = _StorageCaseLifecycleObserver(current_user.id)
    context_token = None
    runtime_audit = None
    final_side_effects = ["authority_consumed"]
    audit_result = "failure"
    audit_failure_code = "execution_failed"
    try:
        context_token = _lifecycle_observer_context.set(observer)
        try:
            runtime_result = get_execution_chancellor_agent(
                report_session=report_session
            ).invoke(
                entrypoint=ChancellorEntrypoint.EXECUTE,
                requested_skill=ChancellorSkillId.EXECUTE_DECREE,
                owner_user_id=current_user.id,
                request_id=run_id,
                payload={
                    "decree_text": payload.decree_text,
                    "approved_route": approved_route,
                },
            )
        except (ChancellorRuntimeError, ChancellorSkillRegistryError) as exc:
            runtime_audit = getattr(exc, "audit", None)
            if runtime_audit is not None:
                audit_failure_code = runtime_audit.failure_code
            if (
                isinstance(exc, ChancellorSkillInvocationError)
                and exc.__cause__ is not None
            ):
                cause = exc.__cause__
                raise cause from cause.__cause__
            raise ChancellorGraphInvocationError(
                "Chancellor runtime skill invocation failed."
            ) from exc
        result = runtime_result.output
        runtime_audit = runtime_result.audit
        response = _build_response_from_graph_result(
            result,
            approved_route,
            decree_text=payload.decree_text,
        )
        audited_result = dict(result)
        pre_archive_side_effects = ["authority_consumed"]
        if observer.case_created:
            pre_archive_side_effects.append("case_created")
            final_side_effects.append("case_created")
        has_pending = getattr(
            report_session,
            "has_pending",
            getattr(report_session, "_summary", None) is not None,
        )
        if has_pending:
            pre_archive_side_effects.append("report_prepared")
            final_side_effects.append("report_prepared")
        persisted_audit = (
            complete_chancellor_audit(
                runtime_result.audit,
                side_effects=tuple(pre_archive_side_effects),
            )
            if runtime_result.audit is not None
            else None
        )
        audited_result.update(
            {
                "approved_route": approved_route,
                "draft_version": payload.draft_version,
                "draft_fingerprint": payload.draft_fingerprint,
                "runtime_audit": (
                    persisted_audit.model_dump(mode="json")
                    if persisted_audit is not None
                    else None
                ),
            }
        )
        try:
            archive_result = archive_chancellor_decree(
                payload.decree_text,
                response,
                audited_result,
                owner_user_id=current_user.id,
            )
        except Exception as exc:
            observer.fail(
                stage="archive", code=classify_synthesis_failure(exc)
            )
            raise AccountingReportPublicationError("reply_archive_failed") from None
        if getattr(archive_result, "archived", False):
            final_side_effects.append("reply_archived")
        if has_pending:
            if not archive_result.archived or not archive_result.reply_id:
                raise AccountingReportPublicationError("reply_archive_required")
            try:
                published = report_session.publish(archive_result.reply_id)
                artifacts = [
                    ReportArtifactResponse.from_domain(item) for item in published
                ]
            except Exception:
                raise AccountingReportPublicationError("publication_failed") from None
            response = response.model_copy(update={"artifacts": artifacts})
            if artifacts:
                final_side_effects.append("report_published")
        if response.route_type == "multi":
            reply_id = getattr(archive_result, "reply_id", None)
            if getattr(archive_result, "archived", False) and isinstance(reply_id, str):
                observer.archive(reply_id)
                final_side_effects.append("case_archived")
            else:
                observer.fail(stage="archive", code="state_invalid")
        audit_result = "success"
        audit_failure_code = None
        return response
    except Exception as exc:
        report_session.abort()
        failure_stage = (
            getattr(exc, "failure_stage", None)
            if isinstance(exc, ChancellorGraphInvocationError)
            else None
        )
        observer.fail(
            stage=failure_stage if failure_stage in _FAILURE_STAGES else None,
            code=classify_synthesis_failure(exc),
        )
        raise
    finally:
        if observer.case_created and "case_created" not in final_side_effects:
            final_side_effects.append("case_created")
        if runtime_audit is not None:
            try:
                emit_chancellor_audit(
                    complete_chancellor_audit(
                        runtime_audit,
                        side_effects=tuple(final_side_effects),
                        result=audit_result,
                        failure_code=audit_failure_code,
                    )
                )
            except Exception:  # noqa: BLE001 - audit is best-effort
                pass
        if context_token is not None:
            _lifecycle_observer_context.reset(context_token)


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

    @app.exception_handler(DraftNotCurrentError)
    async def _handle_draft_not_current(
        _request, _exc: DraftNotCurrentError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={
                "status": "error",
                "reason": "draft_not_current",
                "message": "拟旨草案已失效，请重新拟旨后再下旨",
            },
        )

    @app.exception_handler(AccountingReportPublicationError)
    async def _handle_report_publication_error(
        _request, _exc: AccountingReportPublicationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "report_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )
