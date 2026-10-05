"""Single-ministry (六部) layered bureau consultation and synthesis helper.

:func:`invoke_ministry_agent` first validates the approved required-bureau
constraint, then parses a department's strict bureau-route contract (non-empty
``rationale`` plus one or more unique in-department ``bureaus``), consults
those bureaus serially, and performs one additional ministry-level model call
over all ordered bureau opinions.

This module deliberately does **not** import anything from
``app.agents.chancellor``: ``app.agents.chancellor.graph`` imports *this*
module (to invoke a ministry from its single-department branch), so an
import back in the other direction would form an import cycle. Instead, this
module defines its own :class:`MinistryAgentInvocationError`; callers that
need to unify error handling under a different exception type (e.g. the
Chancellor graph wrapping every internal failure into its own
``ChancellorGraphInvocationError``) catch this exception and re-raise their
own, exactly like this module itself does with
``app.agents.structured_output.StructuredOutputError``.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from app.accounting_reports.intent import detect_accounting_report_intent
from app.agents.bureaus import (
    BureauAgentInvocationError,
    BureauAgentInvocationResult,
    bureau_profiles_for,
    capability_profiles_for,
    invoke_bureau_agent,
    invoke_bureau_agent_with_report,
)
from app.agents.evidence_protocol import AgentEvidenceSession
from app.agents.evidence_rendering import render_mainland_last_price
from app.agents.market_intent import (
    is_mainland_last_price_intent,
)
from app.agents.ministries.prompts import (
    ministry_required_bureaus_correction_prompt,
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import parse_strict_json_object
from app.agents.synthesis_failures import is_locally_degradable
from app.jinyiwei.models import FactCategory, MarketMetric
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession
    from app.agents.runtime_skills.models import BureauReport, MinistryReport


class MinistryAgentInvocationError(Exception):
    """Raised when invoking a single ministry (六部) agent fails.

    Covers invalid or failed ministry routing and failures from any selected
    bureau. Every failure is fail-closed: no partial aggregation is returned.

    The original exception (when applicable) is always preserved via
    ``raise ... from exc`` (available as ``__cause__``), but this
    exception's own message never echoes the raw model output or the
    underlying exception's ``str()`` -- callers are expected to catch this
    exception and re-raise their own sanitized, package-specific exception
    (e.g. ``app.agents.chancellor.graph.ChancellorGraphInvocationError``)
    without risking an information leak from arbitrary model output.
    """

    failure_stage = "ministry"


class BureauOpinion(TypedDict):
    """One selected bureau's validated opinion, in consultation order."""

    bureau: str
    opinion: str


class MinistryOpinion(TypedDict):
    """Stable layered result returned by one ministry invocation."""

    department: str
    bureau_opinions: list[BureauOpinion]
    opinion: str


@dataclass(frozen=True, slots=True)
class MinistryAgentInvocationResult:
    opinion: MinistryOpinion
    runtime_report: MinistryReport


@dataclass(frozen=True, slots=True)
class _MinistrySynthesis:
    opinion: str
    status: str = "completed"
    shared_findings: tuple[str, ...] = ()
    conflicts: tuple[str, ...] = ()
    cross_bureau_impacts: tuple[str, ...] = ()
    ministry_position: tuple[str, ...] = ()
    unresolved_items: tuple[str, ...] = ()
    degradation_reason: str | None = None


_DEFAULT_LEGACY_BUREAU_INVOKER = invoke_bureau_agent
_STABLE_BUREAU_FAILURE_MESSAGES = frozenset(
    {
        "Bureau identity validation failed.",
        "Accounting report generation failed.",
        "Bureau deterministic fact plan was rejected.",
        "Bureau evidence protocol failed.",
        "Bureau structured response failed.",
    }
)


def _ministry_runtime_skill_for(department: str):
    from app.agents.runtime_skills.roles.ministries import MINISTRY_SKILLS

    skill = next((item for item in MINISTRY_SKILLS if department in item.purpose), None)
    if skill is None:
        raise MinistryAgentInvocationError("Ministry runtime-skill identity validation failed.")
    return skill


def _runtime_skill_prompt(skill) -> str:
    return "\n\n".join(
        (
            f"Runtime Skill: {skill.skill_id} v{skill.version}",
            f"Agent: {skill.agent_id}",
            "Analysis procedure: " + json.dumps(skill.analysis_procedure, ensure_ascii=False),
            "Required findings: " + json.dumps(skill.required_findings, ensure_ascii=False),
            "Forbidden actions: " + json.dumps(skill.forbidden_actions, ensure_ascii=False),
        )
    )


def _fallback_ministry_opinion(department: str, bureau_opinions: Sequence[BureauOpinion]) -> str:
    bureau_names = "、".join(item["bureau"] for item in bureau_opinions)
    return (
        f"{department}已汇总{bureau_names}司议；当前仅形成规范性办理建议，"
        "不形成未经证据支持的事实结论。"
    )


def _has_canonical_last_price_evidence(session: AgentEvidenceSession) -> bool:
    return session.has_adopted_fact(
        node_id="bureau:户部:投资司",
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )


def _format_recall_context(context: RecallContext) -> str:
    if not context.available:
        return "史馆旧案召回失败：不可把召回失败伪装成已有历史经验。"
    if not context.entries:
        return "史馆旧案召回：未命中旧案。"
    return "史馆旧案召回：" + json.dumps(
        [entry.model_dump() for entry in context.entries],
        ensure_ascii=False,
    )


def invoke_ministry_skill_with_report(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus: Sequence[str],
    bureau_invoker: Callable[[str, str], BureauAgentInvocationResult],
    recall_context: RecallContext | None = None,
    market_evidence_required: bool = False,
) -> MinistryAgentInvocationResult:
    """Consult selected bureaus serially, then produce a ministry synthesis.

    Args:
        department: One of the six fixed ``app.agents.ministries.MINISTRIES``
            names.
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale, given to the
            department as context for why this matter was routed to it.
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests).

    Returns:
        A structured department result containing ordered bureau opinions and
        a separately generated, non-empty ministry-level opinion.

    Raises:
        ValueError: ``department`` is not one of the fixed six ministries
            (propagated, unwrapped, from
            ``app.agents.ministries.prompts.ministry_system_prompt`` -- this
            indicates a caller bug, e.g. an unvalidated department slipping
            through, not a model failure).
        MinistryAgentInvocationError: the model call failed, or its response
            did not satisfy the strict bureau-routing contract, or any selected
            bureau invocation failed.
    """
    system_prompt = ministry_system_prompt(department)
    runtime_skill = _ministry_runtime_skill_for(department)
    allowed_bureau_order = tuple(profile.bureau for profile in bureau_profiles_for(department))
    allowed_bureaus = set(allowed_bureau_order)
    if (
        isinstance(required_bureaus, (str, bytes))
        or not required_bureaus
        or any(
            not isinstance(bureau, str) or bureau not in allowed_bureaus
            for bureau in required_bureaus
        )
        or len(required_bureaus) != len(set(required_bureaus))
    ):
        error = MinistryAgentInvocationError(
            f"{department} agent received invalid required bureaus."
        )
        error.failure_stage = "bureau"
        raise error
    required_bureaus = tuple(required_bureaus)
    is_accounting_report = (
        department == "户部" and detect_accounting_report_intent(decree_text).requested
    )
    if recall_context is None:
        recall_context = safe_recall_context_for_department(department)
    recall_context_text = _format_recall_context(recall_context)

    if department == "户部" and is_mainland_last_price_intent(decree_text):
        route_rationale = "明确的中国大陆证券最新价查询，由投资司办理。"
        selected_bureaus = ["投资司"]
    else:
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n{recall_context_text}"
                ),
            },
        ]

        def parse_route(response: object) -> tuple[str, list[str]]:
            if not isinstance(response, str) or not response.strip():
                raise ValueError("The ministry routing response is empty.")
            parsed = parse_strict_json_object(response)
            if set(parsed) != {"rationale", "bureaus"}:
                raise ValueError("The ministry routing response has an invalid schema.")
            parsed_rationale = parsed["rationale"]
            parsed_bureaus = parsed["bureaus"]
            if not isinstance(parsed_rationale, str) or not parsed_rationale.strip():
                raise ValueError("The ministry routing rationale is not a non-empty string.")
            if (
                not isinstance(parsed_bureaus, list)
                or not parsed_bureaus
                or any(not isinstance(bureau, str) for bureau in parsed_bureaus)
                or len(parsed_bureaus) != len(set(parsed_bureaus))
                or any(bureau not in allowed_bureaus for bureau in parsed_bureaus)
            ):
                raise ValueError("The ministry bureau selection is invalid.")
            return parsed_rationale, parsed_bureaus

        def route_satisfies_approved_bureaus(bureaus: Sequence[str]) -> bool:
            if is_accounting_report:
                return tuple(bureaus) == required_bureaus
            return set(required_bureaus).issubset(bureaus)

        def parse_approved_route(response: object) -> tuple[str, list[str]]:
            parsed_rationale, parsed_bureaus = parse_route(response)
            if not route_satisfies_approved_bureaus(parsed_bureaus):
                raise ValueError("The ministry route omitted approved bureaus.")
            return parsed_rationale, parsed_bureaus

        correction_instruction = ministry_required_bureaus_correction_prompt(
            department,
            allowed_bureaus=allowed_bureau_order,
            required_bureaus=required_bureaus,
        ) + (
            "\n本旨意为确定性财务报表任务，bureaus 必须严格等于"
            f"{json.dumps(required_bureaus, ensure_ascii=False)}，不得增加其他司。"
            if is_accounting_report
            else ""
        )
        try:
            route_rationale, selected_bureaus = invoke_strict_structured(
                chat_model,
                messages,
                parse_approved_route,
                stage="ministry_route",
                correction_instruction=correction_instruction,
            )
        except StructuredInvocationError as exc:
            error = MinistryAgentInvocationError(
                f"{department} agent returned an invalid bureau selection."
            )
            error.failure_stage = (
                "ministry" if exc.failure_code == "provider_unavailable" else "bureau"
            )
            cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
            raise error from cause
    if (
        tuple(selected_bureaus) != required_bureaus
        if is_accounting_report
        else not set(required_bureaus).issubset(selected_bureaus)
    ):
        error = MinistryAgentInvocationError(f"{department} agent violated approved bureaus.")
        error.failure_stage = "bureau"
        raise error

    for bureau in selected_bureaus:
        try:
            capability_profiles_for(department, bureau)
        except Exception as exc:  # noqa: BLE001 - fail closed at the integrity boundary
            raise MinistryAgentInvocationError(
                f"{department} agent failed selected-bureau capability integrity validation."
            ) from exc

    bureau_opinions: list[BureauOpinion] = []
    bureau_reports: list[BureauReport] = []
    bureau_report_entries: list[tuple[str, BureauReport]] = []
    bureau_failures: list[str] = []
    for bureau in selected_bureaus:
        try:
            bureau_result = bureau_invoker(bureau, route_rationale.strip())
        except BureauAgentInvocationError as exc:
            if exc.__cause__ is not None or str(exc) not in _STABLE_BUREAU_FAILURE_MESSAGES:
                error = MinistryAgentInvocationError(
                    f"{department} agent failed while consulting a selected bureau."
                )
                error.failure_stage = exc.failure_stage
                raise error from exc
            bureau_failures.append(
                f"bureau_failed:{bureau}:{getattr(exc, 'failure_stage', 'bureau')}"
            )
            continue
        from app.agents.runtime_skills.registry import (
            build_default_downstream_skill_registry,
            bureau_agent_id,
        )

        expected = build_default_downstream_skill_registry().get_by_agent(
            bureau_agent_id(department, bureau)
        )
        report = bureau_result.runtime_report
        if (report.agent_id, report.skill_id, report.skill_version) != (
            expected.agent_id,
            expected.skill_id,
            expected.version,
        ):
            raise MinistryAgentInvocationError("Selected bureau report identity validation failed.")
        bureau_reports.append(report)
        bureau_report_entries.append((bureau, report))
        bureau_opinions.append({"bureau": bureau, "opinion": bureau_result.opinion})

    if (
        department == "户部"
        and is_mainland_last_price_intent(decree_text)
        and market_evidence_required
        and not any(report.evidence_refs for report in bureau_reports)
    ):
        raise MinistryAgentInvocationError("户部 market synthesis requires adopted evidence.")

    compact_bureau_reports = [
        {
            "bureau": bureau,
            "report_ref": report.report_id,
            "opinion": report.executive_summary,
            "status": report.status.value,
            "evidence_refs": report.evidence_refs,
            "data_gaps": report.data_gaps,
        }
        for bureau, report in bureau_report_entries
    ]
    synthesis_messages = [
        {
            "role": "system",
            "content": ministry_synthesis_system_prompt(department),
        },
        {
            "role": "user",
            "content": (
                f"原始旨意：{decree_text}\n\n"
                f"丞相判断说明：{rationale}\n\n"
                f"{recall_context_text}\n\n"
                f"本部司级路由说明：{route_rationale.strip()}\n\n"
                "已调用司级报告摘要与引用（按路由顺序，JSON）："
                f"{json.dumps(compact_bureau_reports, ensure_ascii=False)}"
            ),
        },
    ]
    try:

        def parse_synthesis(response: object) -> _MinistrySynthesis:
            if not isinstance(response, str) or not response.strip():
                raise ValueError("The ministry synthesis returned no usable text.")
            synthesis = parse_strict_json_object(response)
            if set(synthesis) == {"opinion"}:
                opinion = synthesis["opinion"]
                if not isinstance(opinion, str) or not opinion.strip():
                    raise ValueError("The ministry opinion is not a non-empty string.")
                return _MinistrySynthesis(
                    opinion=opinion.strip(),
                    status="degraded",
                    degradation_reason="ministry_synthesis_legacy_contract",
                )
            fields = {
                "opinion",
                "shared_findings",
                "conflicts",
                "cross_bureau_impacts",
                "ministry_position",
                "unresolved_items",
            }
            if set(synthesis) != fields:
                raise ValueError("The ministry synthesis response has an invalid schema.")
            opinion = synthesis["opinion"]
            if not isinstance(opinion, str) or not opinion.strip():
                raise ValueError("The ministry opinion is not a non-empty string.")
            lists: dict[str, tuple[str, ...]] = {}
            for field in fields - {"opinion"}:
                value = synthesis[field]
                if not isinstance(value, list) or any(
                    not isinstance(item, str) or not item.strip() for item in value
                ):
                    raise ValueError("The ministry synthesis list field is invalid.")
                lists[field] = tuple(item.strip() for item in value)
            normalize = lambda value: " ".join(value.split())  # noqa: E731
            opinion_key = normalize(opinion)
            semantic_fields = (
                "shared_findings",
                "conflicts",
                "cross_bureau_impacts",
                "ministry_position",
            )
            normalized_fields = {
                field: tuple(normalize(item) for item in lists[field]) for field in semantic_fields
            }
            if any(opinion_key in normalized_fields[field] for field in semantic_fields):
                raise ValueError("The ministry synthesis duplicates its opinion.")
            seen: set[str] = set()
            for field in semantic_fields:
                values = normalized_fields[field]
                if len(values) != len(set(values)) or seen.intersection(values):
                    raise ValueError("The ministry synthesis duplicates semantic fields.")
                seen.update(values)
            return _MinistrySynthesis(opinion=opinion.strip(), **lists)

        try:
            synthesis_result = invoke_strict_structured(
                chat_model,
                synthesis_messages,
                parse_synthesis,
                stage="ministry_synthesis",
                # Ministry synthesis already has a deterministic, auditable
                # degradation path below. A single provider attempt prevents
                # schema retries from reserving the same 2,500-token output
                # ceiling repeatedly under the task's hard budget.
                max_attempts=1 if market_evidence_required else 3,
            )
        except StructuredInvocationError as exc:
            error = MinistryAgentInvocationError(f"{department} agent ministry synthesis failed.")
            error.failure_stage = "ministry"
            error.failure_code = exc.failure_code
            cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
            raise error from cause
        if department == "户部" and is_mainland_last_price_intent(decree_text):
            authoritative_opinion = "\n".join(item["opinion"] for item in bureau_opinions)
            if synthesis_result.opinion != authoritative_opinion:
                synthesis_result = _MinistrySynthesis(
                    opinion=authoritative_opinion,
                    status="degraded",
                    degradation_reason="ministry_synthesis_evidence_override",
                )
    except MinistryAgentInvocationError as exc:
        if getattr(exc, "failure_code", None) == "provider_unavailable":
            raise
        can_degrade = (
            department == "户部"
            and is_mainland_last_price_intent(decree_text)
            and any(report.evidence_refs for report in bureau_reports)
            and bool(bureau_opinions)
        )
        if is_locally_degradable(exc):
            if can_degrade:
                fallback_opinion = "\n".join(item["opinion"] for item in bureau_opinions)
            else:
                fallback_opinion = _fallback_ministry_opinion(department, bureau_opinions)
            synthesis_result = _MinistrySynthesis(
                opinion=fallback_opinion,
                status="degraded",
                degradation_reason="ministry_synthesis_invalid",
            )
        elif not can_degrade:
            raise
        else:
            synthesis_result = _MinistrySynthesis(
                opinion="\n".join(item["opinion"] for item in bureau_opinions),
                status="degraded",
                degradation_reason="ministry_synthesis_evidence_override",
            )

    ministry_opinion = synthesis_result.opinion
    opinion_result: MinistryOpinion = {
        "department": department,
        "bureau_opinions": bureau_opinions,
        "opinion": ministry_opinion,
    }
    from app.agents.runtime_skills.models import (
        EvidenceSufficiency,
        MinistryReport,
        ReportStatus,
    )

    report_gaps = tuple(gap for report in bureau_reports for gap in report.data_gaps)
    noncompleted = tuple(
        f"bureau_{report.status.value}:{bureau}"
        for bureau, report in bureau_report_entries
        if report.status is not ReportStatus.COMPLETED
    )
    synthesis_unresolved = (
        (synthesis_result.degradation_reason,) if synthesis_result.degradation_reason else ()
    )
    synthesis_conflicts = tuple(
        f"synthesis_conflict:{conflict}" for conflict in synthesis_result.conflicts
    )
    unresolved = tuple(
        dict.fromkeys(
            (
                *report_gaps,
                *noncompleted,
                *bureau_failures,
                *synthesis_result.unresolved_items,
                *synthesis_conflicts,
                *synthesis_unresolved,
            )
        )
    )
    degraded = synthesis_result.status != "completed" or bool(unresolved)
    request_id = (
        bureau_reports[0].request_id if bureau_reports else f"ministry-request:{department}"
    )
    candidate_report = MinistryReport(
        report_id=f"ministry-report:{department}:{request_id}",
        request_id=request_id,
        agent_id=runtime_skill.agent_id,
        skill_id=runtime_skill.skill_id,
        skill_version=runtime_skill.version,
        subject=runtime_skill.purpose,
        executive_summary=ministry_opinion,
        input_refs=tuple(report.report_id for report in bureau_reports),
        evidence_refs=tuple(
            dict.fromkeys(ref for report in bureau_reports for ref in report.evidence_refs)
        ),
        data_gaps=unresolved,
        evidence_sufficiency=(
            EvidenceSufficiency.INSUFFICIENT
            if not bureau_reports or synthesis_result.degradation_reason
            else (EvidenceSufficiency.PARTIAL if degraded else EvidenceSufficiency.SUFFICIENT)
        ),
        status=ReportStatus.DEGRADED if degraded else ReportStatus.COMPLETED,
        selected_bureaus=tuple(selected_bureaus),
        selection_reasons=(route_rationale.strip(),),
        bureau_report_refs=tuple(report.report_id for report in bureau_reports),
        shared_findings=synthesis_result.shared_findings,
        conflicts=tuple(
            dict.fromkeys((*synthesis_result.conflicts, *noncompleted, *bureau_failures))
        ),
        cross_bureau_impacts=synthesis_result.cross_bureau_impacts,
        ministry_position=synthesis_result.ministry_position,
        unresolved_items=unresolved,
    )
    from app.agents.runtime_skills import executor as runtime_executor
    from app.agents.runtime_skills.models import RuntimeService, SkillInvocation

    route_ref = f"approved-route:{department}:{'|'.join(selected_bureaus)}"
    bureau_report_refs = tuple(report.report_id for report in bureau_reports)
    invocation = SkillInvocation(
        request_id=request_id,
        agent_id=runtime_skill.agent_id,
        skill_id=runtime_skill.skill_id,
        skill_version=runtime_skill.version,
        input_refs=(route_ref, *bureau_report_refs),
        evidence_refs=candidate_report.evidence_refs,
        requested_services=frozenset({RuntimeService.BUREAU_AGENTS}),
        requirement_data_refs={
            runtime_skill.data_requirements[0]: (route_ref,),
            **(
                {runtime_skill.data_requirements[1]: bureau_report_refs}
                if bureau_report_refs
                else {}
            ),
        },
    )
    execution = runtime_executor.execute_runtime_skill(
        invocation,
        runtime_skill,
        {RuntimeService.BUREAU_AGENTS: bureau_invoker},
        lambda _messages: "",
        precomputed_report=candidate_report,
    )
    runtime_report = execution.report
    if not isinstance(runtime_report, MinistryReport):
        raise MinistryAgentInvocationError("Ministry runtime skill returned an invalid report.")
    return MinistryAgentInvocationResult(opinion=opinion_result, runtime_report=runtime_report)


def invoke_ministry_agent_with_report(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus: Sequence[str],
    recall_context: RecallContext | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    requirement_data_refs_by_bureau: Mapping[str, Mapping[str, tuple[str, ...]]] | None = None,
    approved_data_refs: Sequence[str] = (),
) -> MinistryAgentInvocationResult:
    """Authorize bureau access before routing, bureau, or model side effects."""

    from app.agents.runtime_skills import executor as runtime_executor
    from app.agents.runtime_skills.models import RuntimeService, SkillInvocation

    ministry_system_prompt(department)
    skill = _ministry_runtime_skill_for(department)
    coverage_by_bureau = requirement_data_refs_by_bureau or {}

    def restricted_bureau_invoker(bureau: str, route_rationale: str) -> BureauAgentInvocationResult:
        bureau_kwargs: dict[str, object] = {}
        is_accounting_bureau = (
            department == "户部"
            and bureau == "会计司"
            and report_session is not None
            and detect_accounting_report_intent(decree_text).requested
        )
        if evidence_session is not None and not is_accounting_bureau:
            bureau_kwargs["evidence_session"] = evidence_session
        if report_session is not None:
            bureau_kwargs["report_session"] = report_session
        if invoke_bureau_agent is not _DEFAULT_LEGACY_BUREAU_INVOKER:
            opinion = invoke_bureau_agent(
                department,
                bureau,
                decree_text,
                route_rationale,
                chat_model,
                **bureau_kwargs,
            )
            from app.agents.runtime_skills.models import (
                BureauReport,
                EvidenceSufficiency,
                ReportStatus,
            )
            from app.agents.runtime_skills.registry import (
                build_default_downstream_skill_registry,
                bureau_agent_id,
            )

            bureau_skill = build_default_downstream_skill_registry().get_by_agent(
                bureau_agent_id(department, bureau)
            )
            snapshot_reader = getattr(evidence_session, "snapshot", None)
            evidence_refs = (
                tuple(snapshot_reader().adopted_evidence_ids) if callable(snapshot_reader) else ()
            )
            if (
                department == "户部"
                and is_mainland_last_price_intent(decree_text)
                and evidence_session is not None
                and not _has_canonical_last_price_evidence(evidence_session)
            ):
                raise BureauAgentInvocationError(
                    "Bureau evidence protocol failed."
                ) from ValueError("canonical_market_evidence_missing")
            return BureauAgentInvocationResult(
                opinion,
                BureauReport(
                    report_id=f"legacy-test:{bureau_skill.agent_id}",
                    request_id="legacy-test",
                    agent_id=bureau_skill.agent_id,
                    skill_id=bureau_skill.skill_id,
                    skill_version=bureau_skill.version,
                    subject=bureau_skill.purpose,
                    executive_summary=opinion,
                    evidence_refs=evidence_refs,
                    data_gaps=bureau_skill.data_requirements,
                    evidence_sufficiency=EvidenceSufficiency.INSUFFICIENT,
                    status=ReportStatus.DEGRADED,
                    analysis=(),
                    professional_findings=(),
                    risks=(),
                    recommendations=(opinion,),
                ),
            )
        return invoke_bureau_agent_with_report(
            department,
            bureau,
            decree_text,
            route_rationale,
            chat_model,
            requirement_data_refs=coverage_by_bureau.get(bureau),
            approved_data_refs=approved_data_refs,
            **bureau_kwargs,
        )

    invocation = SkillInvocation(
        request_id=f"ministry-operation:{department}",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        requested_services=frozenset({RuntimeService.BUREAU_AGENTS}),
    )
    market_evidence_required = evidence_session is not None
    result = runtime_executor.run_authorized_runtime_operation(
        invocation,
        skill,
        {RuntimeService.BUREAU_AGENTS: restricted_bureau_invoker},
        lambda: invoke_ministry_skill_with_report(
            department,
            decree_text,
            rationale,
            chat_model,
            required_bureaus=required_bureaus,
            bureau_invoker=restricted_bureau_invoker,
            recall_context=recall_context,
            market_evidence_required=market_evidence_required,
        ),
    )
    if (
        evidence_session is not None
        and is_mainland_last_price_intent(decree_text)
        and any(
            item
            in {
                "ministry_synthesis_invalid",
                "ministry_synthesis_evidence_override",
            }
            for item in result.runtime_report.unresolved_items
        )
    ):
        record_degradation = getattr(evidence_session, "record_degradation", None)
        if callable(record_degradation):
            record_degradation("ministry:户部")
    return result


def invoke_ministry_agent(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus: Sequence[str],
    recall_context: RecallContext | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
) -> MinistryOpinion:
    """Preserve the exact legacy MinistryOpinion API."""
    return invoke_ministry_agent_with_report(
        department,
        decree_text,
        rationale,
        chat_model,
        required_bureaus=required_bureaus,
        recall_context=recall_context,
        evidence_session=evidence_session,
        report_session=report_session,
    ).opinion
