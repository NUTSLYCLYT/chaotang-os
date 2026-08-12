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

import hashlib
import json
import logging
import secrets
from collections.abc import Callable
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import get_args

from fastapi import APIRouter, FastAPI, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.accounting_reports.config import APPROVED_ACCOUNTING_SOURCE_DIR
from app.accounting_reports.models import (
    AccountingRequestKind,
    PublishedReportArtifact,
    ReportPeriod,
)
from app.accounting_reports.session import AccountingReportSession
from app.accounting_reports.source_manifest import resolve_accounting_source_dir
from app.accounting_reports.sources import AccountingSourceError
from app.accounting_reports.storage import DEFAULT_ARTIFACT_DIR, DEFAULT_DB_PATH
from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor_draft.authority import (
    AccountingAuthorityContext,
    ConsumedDraftAuthority,
    draft_authority_registry,
)
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
from app.api.decree_jobs import JobStore
from app.decree_jobs import AcceptDecreeJob, IdempotencyConflict
from app.junjichu_cases import (
    JunjichuCaseOpenInput,
    archive_case,
    fail_case,
    open_case,
    record_checkpoint,
)
from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    DeepSeekModelNameError,
    FailureCategory,
)
from app.langgraph_runtime.deepseek_config import DeepSeekConfigError
from app.shiguan.archive_decree import archive_chancellor_decree

_LOGGER = logging.getLogger(__name__)
_SANITIZED_MESSAGE = "丞相暂时无法处理旨意，请稍后再试"
_PROVIDER_FAILURE_CATEGORIES = frozenset(get_args(FailureCategory))
_RUN_ID_LENGTH = 32

_MIN_DECREE_LENGTH = 1
_MAX_DECREE_LENGTH = 2000
_FIXED_FAILURE_REASON = "processing_failed"
_FAILURE_STAGES = frozenset(
    {"route", "bureau", "ministry", "council", "finalize", "archive", "report"}
)


def _model_failure_metadata(
    error: ChancellorGraphInvocationError,
) -> tuple[str, str, int | str, int]:
    """Extract only fixed, validated provider metadata from an exception chain."""
    current: BaseException | None = error
    seen: set[int] = set()
    for _ in range(8):
        if current is None or id(current) in seen:
            break
        seen.add(id(current))
        if isinstance(current, DeepSeekModelInvocationError):
            category = current.failure_category
            provider_status = current.provider_http_status
            retry_count = current.retry_count
            return (
                "provider_request",
                (
                    category
                    if type(category) is str
                    and category in _PROVIDER_FAILURE_CATEGORIES
                    else "unexpected"
                ),
                (
                    provider_status
                    if type(provider_status) is int
                    and 100 <= provider_status <= 599
                    else "none"
                ),
                (
                    retry_count
                    if type(retry_count) is int and 0 <= retry_count <= 1
                    else 0
                ),
            )
        current = current.__cause__
    return "chancellor_graph", "graph_invocation", "none", 0


def _trusted_run_id(error: ChancellorGraphInvocationError) -> str:
    request_id = error.request_id
    if (
        type(request_id) is str
        and len(request_id) == _RUN_ID_LENGTH
        and all(character in "0123456789abcdef" for character in request_id)
    ):
        return request_id
    return "unavailable"


class AccountingReportPublicationError(RuntimeError):
    """Raised when a pending report cannot be attached to an archived reply."""


class SourceNotCurrentError(RuntimeError):
    """The one-time authority was consumed but its bound source no longer matches."""


class DeliveryKind(StrEnum):
    NONE = "none"
    ACCOUNTING_REPORT = "accounting_report"
    ACCOUNTING_ANALYSIS = "accounting_analysis"


def _generated_report_identity(
    report_session: AccountingReportSession,
    *,
    accounting_context: AccountingAuthorityContext | None,
) -> str | None:
    generations = getattr(report_session, "generations", ())
    if not isinstance(generations, tuple):
        raise AccountingReportPublicationError("report_generation_invalid")
    if accounting_context is None:
        if generations:
            raise AccountingReportPublicationError("report_generation_unexpected")
        return None
    if len(generations) != 1:
        raise AccountingReportPublicationError("report_generation_invalid")
    generation = generations[0]
    if (
        getattr(generation, "request_kind", None) is not accounting_context.request_kind
        or getattr(generation, "period", None) != accounting_context.period
        or getattr(generation, "owner_user_id", None) != report_session.owner_user_id
        or getattr(generation, "run_id", None) != report_session.run_id
        or getattr(generation, "report_type", None) != "management"
        or not report_session.is_publishable_generation(generation)
    ):
        raise AccountingReportPublicationError("report_generation_invalid")
    artifact_id = getattr(generation, "artifact_id", None)
    if not isinstance(artifact_id, str) or not artifact_id.strip():
        raise AccountingReportPublicationError("report_generation_invalid")
    return artifact_id.strip()


def build_accounting_report_session(
    *,
    owner_user_id: str,
    run_id: str,
    accounting_context: AccountingAuthorityContext | None = None,
) -> AccountingReportSession:
    source_dir = APPROVED_ACCOUNTING_SOURCE_DIR
    if accounting_context is not None:
        try:
            source_dir = resolve_accounting_source_dir()
        except AccountingSourceError:
            raise SourceNotCurrentError from None
    return AccountingReportSession(
        owner_user_id=owner_user_id,
        run_id=run_id,
        source_dir=source_dir,
        artifact_dir=DEFAULT_ARTIFACT_DIR,
        db_path=DEFAULT_DB_PATH,
        request_kind=(accounting_context.request_kind if accounting_context else None),
        period=(accounting_context.period if accounting_context else None),
        dataset=None,
        expected_source_fingerprint=(
            accounting_context.source_fingerprint if accounting_context else None
        ),
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
    delivery_kind: DeliveryKind
    delivery_period: ReportPeriod | None = None
    artifacts: list[ReportArtifactResponse] = Field(default_factory=list)


class PreparedDecreeExecution(BaseModel):
    """Durable model checkpoint; it contains no completed business side effect."""

    model_config = ConfigDict(extra="forbid")

    response: ChancellorDecreeResponse
    internal_result: dict[str, object]
    generated_artifact_id: str | None = None


def _durable_internal_result(result: dict[str, object]) -> dict[str, object]:
    """Copy graph output without live runtime services that cannot be recovered."""

    durable = dict(result)
    durable.pop("evidence_session", None)
    return durable


def _non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _build_response_from_graph_result(
    result: object,
    approved_route: ApprovedRouteSnapshot,
    *,
    accounting_context: AccountingAuthorityContext | None = None,
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

        if accounting_context is not None:
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
            delivery_kind=DeliveryKind.NONE,
        )
    except ChancellorGraphInvocationError:
        raise
    except Exception as exc:  # noqa: BLE001 - normalize every malformed result to sanitized 502
        raise ChancellorGraphInvocationError(
            "Chancellor graph returned an invalid layered memorial result."
        ) from exc


def get_chancellor_graph(
    *,
    report_session: AccountingReportSession,
    execution_boundary: Callable[[], None] | None = None,
):
    """Build the real Chancellor graph.

    A plain module-level function (not a FastAPI ``Depends()``) so it is
    only ever invoked explicitly from inside the endpoint body, after
    request validation has already succeeded. See the module docstring for
    why this matters. Tests monkeypatch this function directly (i.e.
    ``monkeypatch.setattr(decrees_module, "get_chancellor_graph", ...)``) to
    inject a fake graph without touching configuration, environment
    variables, or the network.
    """
    graph_kwargs = {
        "lifecycle_observer": _lifecycle_observer_context.get(),
        "report_session": report_session,
        "owner_user_id": report_session.owner_user_id,
    }
    if execution_boundary is not None:
        graph_kwargs["execution_boundary"] = execution_boundary
    return build_chancellor_graph(**graph_kwargs)


def get_execution_chancellor_agent(
    *,
    report_session: AccountingReportSession,
    execution_boundary: Callable[[], None] | None = None,
) -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.EXECUTE_DECREE: GraphSkillHandler(
                lambda: (
                    get_chancellor_graph(report_session=report_session)
                    if execution_boundary is None
                    else get_chancellor_graph(
                        report_session=report_session,
                        execution_boundary=execution_boundary,
                    )
                )
            )
        },
    )


router = APIRouter()


class AcceptedDecreeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    state: str
    status_url: str
    cancel_url: str
    accepted_at: datetime
    replayed: bool


def _authority_snapshot(consumed: ConsumedDraftAuthority) -> str:
    accounting = consumed.accounting_context
    return json.dumps(
        {
            "approved_route": consumed.route_snapshot.model_dump(mode="json"),
            "accounting_context": (
                None
                if accounting is None
                else {
                    "request_kind": accounting.request_kind.value,
                    "period": {
                        "start_year": accounting.period.start_year,
                        "end_year": accounting.period.end_year,
                    },
                    "source_fingerprint": accounting.source_fingerprint,
                }
            ),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _canonical_request_hash(
    payload: ChancellorDecreeRequest, owner_user_id: str
) -> str:
    canonical = json.dumps(
        {
            "v": 1,
            "owner_user_id": owner_user_id,
            "draft_version": payload.draft_version,
            "draft_fingerprint": payload.draft_fingerprint,
            "decree_text": payload.decree_text,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _accepted_response(job, *, replayed: bool) -> JSONResponse:
    body = AcceptedDecreeResponse(
        job_id=job.job_id,
        state="QUEUED",
        status_url=f"/api/v1/decree-jobs/{job.job_id}",
        cancel_url=f"/api/v1/decree-jobs/{job.job_id}/cancel",
        accepted_at=job.created_at,
        replayed=replayed,
    )
    return JSONResponse(
        status_code=202,
        headers={
            "Location": body.status_url,
            "Retry-After": "1",
            "Cache-Control": "private, no-store",
        },
        content=body.model_dump(mode="json"),
    )


@router.post(
    "/api/v1/decrees/chancellor",
    response_model=AcceptedDecreeResponse,
    status_code=202,
)
def accept_decree(
    payload: ChancellorDecreeRequest,
    current_user: CurrentUser,
    store: JobStore,
    idempotency_key: str = Header(
        alias="Idempotency-Key", min_length=1, max_length=128
    ),
) -> JSONResponse:
    request_hash = _canonical_request_hash(payload, current_user.id)
    try:
        recovered = store.recover_acceptance(
            owner_user_id=current_user.id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
    except IdempotencyConflict:
        return JSONResponse(
            status_code=409,
            content={"status": "error", "reason": "idempotency_conflict"},
        )
    if recovered is not None:
        return _accepted_response(recovered.job, replayed=True)

    reservation_id = secrets.token_hex(16)
    try:
        consumed = draft_authority_registry.reserve_with_context(
            owner_user_id=current_user.id,
            version=payload.draft_version or 0,
            fingerprint=payload.draft_fingerprint or "",
            decree_text=payload.decree_text,
            reservation_id=reservation_id,
        )
    except Exception:
        raise AccountingReportPublicationError(
            "draft_authority_unavailable"
        ) from None
    if consumed is None:
        raise DraftNotCurrentError

    try:
        approved_route = validate_route_snapshot(consumed.route_snapshot)
        consumed = ConsumedDraftAuthority(
            approved_route, consumed.accounting_context
        )
        accepted = store.accept(
            AcceptDecreeJob(
                owner_user_id=current_user.id,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                draft_fingerprint=payload.draft_fingerprint or "",
                decree_text=payload.decree_text,
                approved_route_json=_authority_snapshot(consumed),
                deadline_at=datetime.now(UTC) + timedelta(minutes=30),
                acceptance_committed=False,
            )
        )
    except IdempotencyConflict:
        draft_authority_registry.release_reservation(
            owner_user_id=current_user.id, reservation_id=reservation_id
        )
        return JSONResponse(
            status_code=409,
            content={"status": "error", "reason": "idempotency_conflict"},
        )
    except Exception:
        draft_authority_registry.release_reservation(
            owner_user_id=current_user.id, reservation_id=reservation_id
        )
        raise

    if accepted.replayed:
        draft_authority_registry.release_reservation(
            owner_user_id=current_user.id, reservation_id=reservation_id
        )
        return _accepted_response(accepted.job, replayed=True)

    if not draft_authority_registry.commit_reservation(
        owner_user_id=current_user.id, reservation_id=reservation_id
    ):
        store.abandon_acceptance(accepted.job.job_id, current_user.id)
        raise AccountingReportPublicationError("draft_authority_commit_failed")
    try:
        job = store.activate_acceptance(accepted.job.job_id, current_user.id)
    except Exception:
        abandoned = False
        try:
            store.abandon_acceptance(accepted.job.job_id, current_user.id)
        except Exception:
            pass
        else:
            abandoned = True
        if abandoned:
            draft_authority_registry.restore_if_absent(
                owner_user_id=current_user.id,
                version=payload.draft_version or 0,
                fingerprint=payload.draft_fingerprint or "",
                decree_text=payload.decree_text,
                consumed=consumed,
            )
        raise AccountingReportPublicationError(
            "draft_authority_activation_failed"
        ) from None
    return _accepted_response(job, replayed=False)


def execute_decree_now(
    payload: ChancellorDecreeRequest,
    current_user,
    *,
    consumed_authority: ConsumedDraftAuthority | None = None,
    execution_id: str | None = None,
    defer_business_side_effects: bool = False,
    execution_control: Callable[[], None] | None = None,
) -> ChancellorDecreeResponse | PreparedDecreeExecution:
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
        consumed_authority = (
            consumed_authority
            or draft_authority_registry.consume_with_context(
            owner_user_id=current_user.id,
            version=payload.draft_version or 0,
            fingerprint=payload.draft_fingerprint or "",
            decree_text=payload.decree_text,
            )
        )
    except Exception:
        raise AccountingReportPublicationError(
            "draft_authority_unavailable"
        ) from None
    if consumed_authority is None:
        raise DraftNotCurrentError
    approved_route = consumed_authority.route_snapshot
    accounting_context = consumed_authority.accounting_context
    try:
        approved_route = validate_route_snapshot(approved_route)
    except Exception:
        raise DraftNotCurrentError from None

    run_id = execution_id or secrets.token_hex(16)
    report_session = build_accounting_report_session(
        owner_user_id=current_user.id,
        run_id=run_id,
        accounting_context=accounting_context,
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
            agent = (
                get_execution_chancellor_agent(report_session=report_session)
                if execution_control is None
                else get_execution_chancellor_agent(
                    report_session=report_session,
                    execution_boundary=execution_control,
                )
            )
            runtime_result = agent.invoke(
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
            accounting_context=accounting_context,
        )
        audited_result = _durable_internal_result(result)
        pre_archive_side_effects = ["authority_consumed"]
        if observer.case_created:
            pre_archive_side_effects.append("case_created")
            final_side_effects.append("case_created")
        generated_artifact_id = _generated_report_identity(
            report_session,
            accounting_context=accounting_context,
        )
        if generated_artifact_id is not None:
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
        if defer_business_side_effects:
            audit_result = "success"
            audit_failure_code = None
            return PreparedDecreeExecution(
                response=response,
                internal_result=audited_result,
                generated_artifact_id=generated_artifact_id,
            )
        try:
            archive_kwargs = {"owner_user_id": current_user.id}
            if execution_id is not None:
                archive_kwargs["reply_id"] = execution_id
            archive_result = archive_chancellor_decree(
                payload.decree_text,
                response,
                audited_result,
                **archive_kwargs,
            )
        except Exception as exc:
            observer.fail(
                stage="archive", code=classify_synthesis_failure(exc)
            )
            raise AccountingReportPublicationError("reply_archive_failed") from None
        if getattr(archive_result, "archived", False):
            final_side_effects.append("reply_archived")
        if generated_artifact_id is not None:
            if not archive_result.archived or not archive_result.reply_id:
                raise AccountingReportPublicationError("reply_archive_required")
            try:
                published = report_session.publish(archive_result.reply_id)
                if (
                    len(published) != 1
                    or published[0].artifact_id != generated_artifact_id
                    or published[0].owner_user_id != current_user.id
                    or published[0].run_id != run_id
                    or published[0].reply_id != archive_result.reply_id
                    or published[0].report_type != "management"
                    or published[0].period != accounting_context.period
                ):
                    raise AccountingReportPublicationError(
                        "publication_identity_invalid"
                    )
                artifacts = [
                    ReportArtifactResponse.from_domain(item) for item in published
                ]
            except Exception:
                raise AccountingReportPublicationError("publication_failed") from None
            delivery_kind = (
                DeliveryKind.ACCOUNTING_ANALYSIS
                if accounting_context.request_kind
                is AccountingRequestKind.ACCOUNTING_ANALYSIS
                else DeliveryKind.ACCOUNTING_REPORT
            )
            response = response.model_copy(
                update={
                    "artifacts": artifacts,
                    "delivery_kind": delivery_kind,
                    "delivery_period": accounting_context.period,
                }
            )
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
        if isinstance(exc, ChancellorGraphInvocationError):
            exc.request_id = run_id
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
        stage, category, provider_http_status, retry_count = _model_failure_metadata(
            _exc
        )
        _LOGGER.warning(
            "decree_model_failure stage=%s category=%s provider_http_status=%s "
            "retry_count=%s request_id=%s",
            stage,
            category,
            provider_http_status,
            retry_count,
            _trusted_run_id(_exc),
        )
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "reason": "model_unavailable",
                "message": _SANITIZED_MESSAGE,
            },
        )

    @app.exception_handler(SourceNotCurrentError)
    async def _handle_source_not_current(
        _request, _exc: SourceNotCurrentError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={
                "status": "error",
                "reason": "source_not_current",
                "message": "会计数据源已变化，请重新拟旨后再下旨。",
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
