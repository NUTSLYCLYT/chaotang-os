"""军机处 (Grand Council) multi-department review orchestration.

:func:`run_junjichu_council` is the single place that implements the
multi-department (``"multi"`` route type) call sequence: given the
Chancellor's chosen ``departments`` (already validated upstream -- fixed
six-ministries membership, no duplicates, at least 2 entries -- by
``app.agents.chancellor.graph``'s ``_decide_route`` node; this module does
not repeat that validation), it invokes
``app.agents.ministries.agent.invoke_ministry_agent`` once per department,
**strictly serially, in a plain Python ``for`` loop, in ``departments``
order** -- never concurrently, and never via a LangGraph ``Send``/fan-out --
collecting each department's layered bureau/ministry opinion in call order, and only once every
department has answered does it invoke 军机处's own model turn (via
:func:`invoke_junjichu_council`) to produce the final council verdict under
the strict ``{"verdict": "<non-empty text>"}`` JSON contract.

This module deliberately does **not** import anything from
``app.agents.chancellor``: ``app.agents.chancellor.graph`` imports *this*
module (to run the 军机处 council from its multi-department branch), so an
import back in the other direction would form an import cycle -- the same
reasoning documented in ``app.agents.ministries.agent``'s module docstring.
Consistent with the product task's Technical Plan ("新增的所有结构化校验失败
统一复用/继承既有 ChancellorGraphInvocationError -> 502 映射，不新增异常类型或
异常处理器"), this module does **not** define its own exception type: model
call failures propagate unwrapped, empty-response/empty-``verdict`` failures
raise the built-in ``ValueError``, malformed-JSON failures raise the shared
``app.agents.structured_output.StructuredOutputError``, and a failing
department's call raises the existing
``app.agents.ministries.agent.MinistryAgentInvocationError`` -- unmodified,
uncaught, propagated straight through. The Chancellor graph's own
multi-department node is the single place that catches all of these and
re-raises its own ``ChancellorGraphInvocationError`` (with ``__cause__``
preserved), exactly like it already does for the single-department branch.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from app.agents.evidence_protocol import AgentEvidenceSession
from app.agents.junjichu.prompts import junjichu_system_prompt
from app.agents.ministries.agent import (
    MinistryAgentInvocationError,
    MinistryAgentInvocationResult,
    MinistryOpinion,
    invoke_ministry_agent,
    invoke_ministry_agent_with_report,
)
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.agents.synthesis_failures import (
    SynthesisFailureCode,
    SynthesisStage,
    is_locally_degradable,
)
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession
    from app.agents.runtime_skills.models import CouncilReport, MinistryReport


class CaseLifecycleObserver(Protocol):
    """Receives validated, storage-agnostic multi-case lifecycle events."""

    def open_case(
        self, *, decree_text: str, departments: list[str], processing_path: list[str]
    ) -> None: ...

    def record_ministry_opinion(self, opinion: MinistryOpinion) -> None: ...

    def record_ministry_report(self, report: MinistryReport) -> None: ...

    def record_council_report(self, report: CouncilReport) -> None: ...

    def record_checkpoint(
        self,
        *,
        status: str,
        processing_path: list[str],
        council_verdict: str | None = None,
    ) -> None: ...

    def archive(self, reply_id: str) -> None: ...

    def fail(
        self,
        *,
        stage: SynthesisStage = "route",
        code: SynthesisFailureCode = "state_invalid",
    ) -> None: ...


class _CouncilContentError(ValueError):
    """Marks only locally degradable council response-content failures."""


@dataclass(frozen=True, slots=True)
class JunjichuCouncilInvocationResult:
    ministry_opinions: list[MinistryOpinion]
    verdict: str
    runtime_report: CouncilReport


@dataclass(frozen=True, slots=True)
class _CouncilSynthesis:
    verdict: str
    consensus: tuple[str, ...] = ()
    disagreements: tuple[str, ...] = ()
    cross_ministry_dependencies: tuple[str, ...] = ()
    joint_options: tuple[str, ...] = ()
    matters_for_chancellor_decision: tuple[str, ...] = ()
    legacy: bool = False


def _format_ministry_opinions(ministry_opinions: list[MinistryOpinion]) -> str:
    """Serialize every bureau and ministry opinion without flattening layers."""
    return json.dumps(ministry_opinions, ensure_ascii=False)


def _format_recall_contexts(
    departments: list[str], recall_contexts: Mapping[str, RecallContext] | None = None
) -> str:
    contexts = {
        department: (
            recall_contexts[department]
            if recall_contexts is not None
            else safe_recall_context_for_department(department)
        ).model_dump()
        for department in departments
    }
    return json.dumps(contexts, ensure_ascii=False)


def _fallback_council_verdict(
    ministry_opinions: Sequence[MinistryOpinion],
) -> str:
    departments = "、".join(item["department"] for item in ministry_opinions)
    return f"军机处已会审{departments}意见；仅确认协同办理顺序，不形成未经证据支持的事实判断。"


def _parse_council_verdict(raw_response: object) -> str:
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise _CouncilContentError("军机处 agent returned an empty model response.")
    parsed = parse_strict_json_object(raw_response)
    if set(parsed) != {"verdict"}:
        raise _CouncilContentError("军机处 agent response JSON has an invalid schema.")
    verdict = parsed.get("verdict")
    if not isinstance(verdict, str) or not verdict.strip():
        raise _CouncilContentError(
            "军机处 agent response JSON is missing a non-empty 'verdict' string."
        )
    return verdict.strip()


def _parse_council_synthesis(raw_response: object) -> _CouncilSynthesis:
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise _CouncilContentError("军机处 agent returned an empty model response.")
    parsed = parse_strict_json_object(raw_response)
    if set(parsed) == {"verdict"}:
        return _CouncilSynthesis(verdict=_parse_council_verdict(raw_response), legacy=True)
    fields = {
        "verdict",
        "consensus",
        "disagreements",
        "cross_ministry_dependencies",
        "joint_options",
        "matters_for_chancellor_decision",
    }
    if set(parsed) != fields:
        raise _CouncilContentError("军机处 agent response JSON has an invalid schema.")
    verdict = parsed["verdict"]
    if not isinstance(verdict, str) or not verdict.strip():
        raise _CouncilContentError("军机处 verdict must be a non-empty string.")
    values: dict[str, tuple[str, ...]] = {}
    for field in fields - {"verdict"}:
        value = parsed[field]
        if not isinstance(value, list) or any(
            not isinstance(item, str) or not item.strip() for item in value
        ):
            raise _CouncilContentError(f"军机处 {field} must be a string array.")
        values[field] = tuple(item.strip() for item in value)
    normalize = lambda value: " ".join(value.split()).casefold()  # noqa: E731
    verdict_key = normalize(verdict)
    seen: set[str] = set()
    for field in (
        "consensus",
        "disagreements",
        "cross_ministry_dependencies",
        "joint_options",
        "matters_for_chancellor_decision",
    ):
        normalized = tuple(normalize(item) for item in values[field])
        if verdict_key in normalized or len(normalized) != len(set(normalized)):
            raise _CouncilContentError("军机处 response duplicates semantic content.")
        if seen.intersection(normalized):
            raise _CouncilContentError("军机处 response duplicates semantic content.")
        seen.update(normalized)
    return _CouncilSynthesis(verdict=verdict.strip(), **values)


def _invoke_junjichu_council_with_report_authorized(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
    *,
    approved_departments: Sequence[str],
    required_bureaus_by_department: Mapping[str, Sequence[str]],
    ministry_invoker: Callable[[str, tuple[str, ...]], MinistryAgentInvocationResult],
    execution_boundary: Callable[[], None] | None = None,
) -> JunjichuCouncilInvocationResult:
    """Run one typed ministry call per approved department and synthesize a CouncilReport."""
    approved = tuple(approved_departments)
    selected = tuple(departments)
    if selected != approved or tuple(required_bureaus_by_department) != approved:
        raise ValueError("approved_department_order_mismatch")

    ministry_results: list[MinistryAgentInvocationResult] = []
    missing_ministries: list[str] = []
    for department in approved:
        try:
            result = ministry_invoker(department, tuple(required_bureaus_by_department[department]))
            ministry_results.append(result)
        except MinistryAgentInvocationError as exc:
            if exc.__cause__ is not None:
                raise
            missing_ministries.append(department)

    reports = [item.runtime_report for item in ministry_results]
    opinions = [item.opinion for item in ministry_results]
    compact_reports = [
        {
            "department": item.opinion["department"],
            "report_ref": item.runtime_report.report_id,
            "executive_summary": item.runtime_report.executive_summary,
            "bureau_opinions": item.opinion["bureau_opinions"],
            "opinion": item.opinion["opinion"],
            "status": item.runtime_report.status.value,
            "data_gaps": item.runtime_report.data_gaps,
            "conflicts": item.runtime_report.conflicts,
            "unresolved_items": item.runtime_report.unresolved_items,
        }
        for item in ministry_results
    ]
    messages = [
        {"role": "system", "content": junjichu_system_prompt(departments)},
        {
            "role": "user",
            "content": (
                f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n"
                "已验证的部级结构化报告（按批准顺序）："
                + json.dumps(compact_reports, ensure_ascii=False)
            ),
        },
    ]
    if execution_boundary is not None:
        execution_boundary()
    try:
        synthesis = invoke_strict_structured(
            chat_model,
            messages,
            _parse_council_synthesis,
            stage="junjichu_council",
            max_attempts=3,
        )
    except StructuredInvocationError as exc:
        if exc.failure_code == "provider_unavailable" or not is_locally_degradable(exc):
            raise
        synthesis = _CouncilSynthesis(
            verdict=_fallback_council_verdict(opinions),
            matters_for_chancellor_decision=("council_synthesis_invalid",),
            legacy=True,
        )

    from app.agents.runtime_skills.models import (
        CouncilReport,
        EvidenceSufficiency,
        ReportStatus,
    )
    from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

    skill = build_default_downstream_skill_registry().get_by_agent("junjichu")
    report_issues: list[str] = [
        *(f"ministry_failed:{department}" for department in missing_ministries),
    ]
    for item in ministry_results:
        department = item.opinion["department"]
        report = item.runtime_report
        if report.status is not ReportStatus.COMPLETED:
            report_issues.append(f"{department}:status:{report.status.value}")
            report_issues.extend(f"{department}:data_gap:{gap}" for gap in report.data_gaps)
            report_issues.extend(
                f"{department}:unresolved:{issue}" for issue in report.unresolved_items
            )
            report_issues.extend(
                f"{department}:conflict:{conflict}" for conflict in report.conflicts
            )
    unresolved = tuple(
        dict.fromkeys(
            [
                *report_issues,
                *(("council_synthesis_legacy_contract",) if synthesis.legacy else ()),
            ]
        )
    )
    propagated_conflicts = tuple(
        f"{item.opinion['department']}:conflict:{conflict}"
        for item in ministry_results
        for conflict in item.runtime_report.conflicts
    )
    degraded = bool(unresolved) or any(
        report.status is not ReportStatus.COMPLETED for report in reports
    )
    request_id = reports[0].request_id if reports else "council-request:missing"
    candidate_report = CouncilReport(
        report_id=f"council-report:{request_id}",
        request_id=request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary=synthesis.verdict,
        input_refs=tuple(report.report_id for report in reports),
        evidence_refs=tuple(
            dict.fromkeys(ref for report in reports for ref in report.evidence_refs)
        ),
        data_gaps=unresolved,
        evidence_sufficiency=(
            EvidenceSufficiency.INSUFFICIENT
            if not reports
            else (EvidenceSufficiency.PARTIAL if degraded else EvidenceSufficiency.SUFFICIENT)
        ),
        status=ReportStatus.DEGRADED if degraded else ReportStatus.COMPLETED,
        participating_ministries=approved,
        review_order=approved,
        ministry_report_refs=tuple(report.report_id for report in reports),
        consensus=synthesis.consensus,
        disagreements=tuple(dict.fromkeys((*synthesis.disagreements, *propagated_conflicts))),
        cross_ministry_dependencies=synthesis.cross_ministry_dependencies,
        joint_options=synthesis.joint_options,
        matters_for_chancellor_decision=tuple(
            dict.fromkeys((*synthesis.matters_for_chancellor_decision, *unresolved))
        ),
    )
    from app.agents.runtime_skills import executor as runtime_executor
    from app.agents.runtime_skills.models import RuntimeService, SkillInvocation

    order_ref = f"approved-council-order:{'|'.join(approved)}"
    ministry_report_refs = tuple(report.report_id for report in reports)
    invocation = SkillInvocation(
        request_id=request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=(order_ref, *ministry_report_refs),
        evidence_refs=candidate_report.evidence_refs,
        requested_services=frozenset({RuntimeService.MINISTRY_AGENTS}),
        requirement_data_refs={
            skill.data_requirements[0]: (order_ref,),
            **({skill.data_requirements[1]: ministry_report_refs} if ministry_report_refs else {}),
        },
    )
    execution = runtime_executor.execute_runtime_skill(
        invocation,
        skill,
        {RuntimeService.MINISTRY_AGENTS: ministry_invoker},
        lambda _messages: "",
        precomputed_report=candidate_report,
    )
    report = execution.report
    if not isinstance(report, CouncilReport):
        raise ValueError("council_runtime_skill_report_invalid")
    return JunjichuCouncilInvocationResult(opinions, synthesis.verdict, report)


def invoke_junjichu_council_with_report(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
    *,
    approved_departments: Sequence[str],
    required_bureaus_by_department: Mapping[str, Sequence[str]],
    ministry_invoker: Callable[[str, tuple[str, ...]], MinistryAgentInvocationResult],
    execution_boundary: Callable[[], None] | None = None,
) -> JunjichuCouncilInvocationResult:
    """Authorize ministry access before any council-side production action."""

    from app.agents.runtime_skills import executor as runtime_executor
    from app.agents.runtime_skills.models import RuntimeService, SkillInvocation
    from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

    skill = build_default_downstream_skill_registry().get_by_agent("junjichu")
    invocation = SkillInvocation(
        request_id="council-operation",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        requested_services=frozenset({RuntimeService.MINISTRY_AGENTS}),
    )
    return runtime_executor.run_authorized_runtime_operation(
        invocation,
        skill,
        {RuntimeService.MINISTRY_AGENTS: ministry_invoker},
        lambda: _invoke_junjichu_council_with_report_authorized(
            decree_text,
            rationale,
            departments,
            chat_model,
            approved_departments=approved_departments,
            required_bureaus_by_department=required_bureaus_by_department,
            ministry_invoker=ministry_invoker,
            execution_boundary=execution_boundary,
        ),
    )


def run_junjichu_council_with_report(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus_by_department: Mapping[str, Sequence[str]],
    recall_contexts: Mapping[str, RecallContext] | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    lifecycle_observer: CaseLifecycleObserver | None = None,
    processing_path: list[str] | None = None,
    execution_boundary: Callable[[], None] | None = None,
) -> JunjichuCouncilInvocationResult:
    """Compatibility orchestration boundary that owns privileged ministry context."""

    def ministry_invoker(
        department: str, required_bureaus: tuple[str, ...]
    ) -> MinistryAgentInvocationResult:
        if execution_boundary is not None:
            execution_boundary()
        kwargs: dict[str, object] = {
            "required_bureaus": required_bureaus,
            "recall_context": recall_contexts[department] if recall_contexts else None,
        }
        if evidence_session is not None:
            kwargs["evidence_session"] = evidence_session
        if report_session is not None:
            kwargs["report_session"] = report_session
        result = invoke_ministry_agent_with_report(
            department,
            decree_text,
            rationale,
            chat_model,
            **kwargs,
        )
        if lifecycle_observer is not None:
            lifecycle_observer.record_ministry_opinion(result.opinion)
            record_runtime_report = getattr(
                lifecycle_observer, "record_ministry_report", None
            )
            if record_runtime_report is not None:
                record_runtime_report(result.runtime_report)
        return result

    result = invoke_junjichu_council_with_report(
        decree_text,
        rationale,
        departments,
        chat_model,
        approved_departments=tuple(departments),
        required_bureaus_by_department=required_bureaus_by_department,
        ministry_invoker=ministry_invoker,
        execution_boundary=execution_boundary,
    )
    if evidence_session is not None and result.runtime_report.status.value != "completed":
        evidence_session.record_degradation("junjichu:council")
    if lifecycle_observer is not None:
        record_council_report = getattr(
            lifecycle_observer, "record_council_report", None
        )
        if record_council_report is not None:
            record_council_report(result.runtime_report)
        council_path = [node for node in (processing_path or []) if node != "军机处（会审）"]
        council_path.append("军机处（会审）")
        lifecycle_observer.record_checkpoint(
            status="COUNCIL_REVIEWING",
            processing_path=council_path,
            council_verdict=result.verdict,
        )
    return result


def invoke_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    ministry_opinions: list[MinistryOpinion],
    chat_model: DeepSeekChatModel,
    *,
    recall_contexts: Mapping[str, RecallContext] | None = None,
    _max_attempts: int = 1,
) -> str:
    """Invoke 军机处's own council-verdict model turn and return the verdict.

    Args:
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale.
        departments: The ordered list of departments consulted (used to
            build 军机处's system prompt).
        ministry_opinions: Every consulted department's already-collected
            structured result, including ordered ``bureau_opinions`` and its
            independent ministry-level ``opinion``, in call order.
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests).

    Returns:
        军机处's non-empty, stripped council verdict text.

    Raises:
        Exception: whatever ``chat_model`` itself raises, propagated
            unwrapped.
        StructuredOutputError: the response is not valid strict JSON, or
            not a JSON object.
        ValueError: the response is empty/non-string, or the parsed JSON is
            missing a non-empty ``verdict`` string.
    """
    system_prompt = junjichu_system_prompt(departments)
    opinions_text = _format_ministry_opinions(ministry_opinions)
    recall_contexts_text = _format_recall_contexts(departments, recall_contexts)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n"
                f"史馆旧案上下文（按部门，召回失败与无旧案须区别处理）：\n{recall_contexts_text}\n\n"
                "各部门分层意见（按丞相选定部门顺序，JSON；每部包含按咨询顺序排列的"
                f"司级意见及独立的部级补充意见）：\n{opinions_text}"
            ),
        },
    ]

    if _max_attempts == 1:
        raw_response = chat_model(messages)
        return _parse_council_verdict(raw_response)
    return invoke_strict_structured(
        chat_model,
        messages,
        _parse_council_verdict,
        stage="junjichu_council",
        max_attempts=_max_attempts,
    )


_DEFAULT_LEGACY_MINISTRY_INVOKER = invoke_ministry_agent
_DEFAULT_LEGACY_COUNCIL_INVOKER = invoke_junjichu_council


def run_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus_by_department: Mapping[str, Sequence[str]],
    recall_contexts: Mapping[str, RecallContext] | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    lifecycle_observer: CaseLifecycleObserver | None = None,
    processing_path: list[str] | None = None,
    execution_boundary: Callable[[], None] | None = None,
) -> tuple[list[MinistryOpinion], str]:
    """Run the full multi-department 军机处 council sequence.

    Strictly serial: calls ``invoke_ministry_agent`` once per entry of
    ``departments``, in a plain Python ``for`` loop, in the given order --
    each call must return before the next one is issued, and no call is
    made concurrently. Only after every department has answered does this
    function call :func:`invoke_junjichu_council` for the final verdict.

    Args:
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale.
        departments: The Chancellor's chosen departments, in the order they
            should be consulted (already validated upstream: fixed
            six-ministries membership, no duplicates, at least 2 entries).
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests), used for both every
            department's call and 军机处's own final call.

    Returns:
        A ``(ministry_opinions, verdict)`` tuple: ``ministry_opinions`` is
        every consulted department's layered result in call order;
        ``verdict`` is 军机处's non-empty council verdict.

    Raises:
        MinistryAgentInvocationError: propagated, unwrapped, from
            ``invoke_ministry_agent`` when a department's call fails --
            this also means every department after the failing one, and
            军机处's own call, are never made.
        Exception / StructuredOutputError / ValueError: propagated,
            unwrapped, from :func:`invoke_junjichu_council` when 军机处's
            own call fails.
    """
    if (
        invoke_ministry_agent is _DEFAULT_LEGACY_MINISTRY_INVOKER
        and invoke_junjichu_council is _DEFAULT_LEGACY_COUNCIL_INVOKER
    ):
        result = run_junjichu_council_with_report(
            decree_text,
            rationale,
            departments,
            chat_model,
            required_bureaus_by_department=required_bureaus_by_department,
            recall_contexts=recall_contexts,
            evidence_session=evidence_session,
            report_session=report_session,
            lifecycle_observer=lifecycle_observer,
            processing_path=processing_path,
            execution_boundary=execution_boundary,
        )
        return result.ministry_opinions, result.verdict

    ministry_opinions: list[MinistryOpinion] = []
    for department in departments:
        if execution_boundary is not None:
            execution_boundary()
        ministry_kwargs = {
            "recall_context": (recall_contexts[department] if recall_contexts else None),
            "required_bureaus": tuple(required_bureaus_by_department[department]),
        }
        if evidence_session is not None:
            ministry_kwargs["evidence_session"] = evidence_session
        if report_session is not None:
            ministry_kwargs["report_session"] = report_session
        opinion = invoke_ministry_agent(
            department,
            decree_text,
            rationale,
            chat_model,
            **ministry_kwargs,
        )
        ministry_opinions.append(opinion)
        if lifecycle_observer is not None:
            lifecycle_observer.record_ministry_opinion(opinion)

    if lifecycle_observer is not None:
        council_processing_path = [
            node for node in (processing_path or []) if node != "军机处（会审）"
        ]
        council_processing_path.append("军机处（会审）")
        lifecycle_observer.record_checkpoint(
            status="COUNCIL_REVIEWING",
            processing_path=council_processing_path,
        )
    try:
        if execution_boundary is not None:
            execution_boundary()
        verdict = invoke_junjichu_council(
            decree_text,
            rationale,
            departments,
            ministry_opinions,
            chat_model,
            recall_contexts=recall_contexts,
            _max_attempts=3,
        )
    except StructuredInvocationError as exc:
        if exc.failure_code == "provider_unavailable":
            cause = exc.__cause__
            if cause is None:
                raise
            raise cause from exc
        if not is_locally_degradable(exc):
            raise
        if evidence_session is not None:
            evidence_session.record_degradation("junjichu:council")
        verdict = _fallback_council_verdict(ministry_opinions)
    except (_CouncilContentError, StructuredOutputError) as exc:
        if not is_locally_degradable(exc):
            raise
        if evidence_session is not None:
            evidence_session.record_degradation("junjichu:council")
        verdict = _fallback_council_verdict(ministry_opinions)
    return ministry_opinions, verdict
