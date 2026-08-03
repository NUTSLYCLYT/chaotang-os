"""Generic invocation helper shared by all 39 bureau-level agents."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import uuid4

from app.agents.bureaus.prompts import bureau_runtime_skill_for, bureau_system_prompt
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession
    from app.agents.evidence_protocol import AgentEvidenceSession
    from app.agents.runtime_skills.models import BureauReport, RuntimeSkillDefinition


class BureauAgentInvocationError(Exception):
    """A sanitized, fail-closed bureau invocation failure."""

    failure_stage = "bureau"


@dataclass(frozen=True, slots=True)
class BureauAgentInvocationResult:
    """Explicit internal result; the legacy public entry still returns plain text."""

    opinion: str
    runtime_report: BureauReport


@dataclass(frozen=True, slots=True)
class _BureauSynthesis:
    opinion: str
    analysis: tuple[str, ...] = ()
    professional_findings: tuple[str, ...] = ()
    risks: tuple[str, ...] = ()
    recommendations: tuple[str, ...] = ()
    out_of_scope_items: tuple[str, ...] = ()
    legacy: bool = False


def _result_with_runtime_report(
    synthesis: _BureauSynthesis,
    skill: RuntimeSkillDefinition,
    *,
    evidence_session: AgentEvidenceSession | None,
    node_id: str | None = None,
    selection_start: int = 0,
    degradation_start: int = 0,
    requirement_data_refs: Mapping[str, tuple[str, ...]] | None = None,
    approved_data_refs: Sequence[str] = (),
) -> BureauAgentInvocationResult:
    from app.agents.runtime_skills.models import (
        BureauReport,
        EvidenceSufficiency,
        ReportStatus,
        RuntimeService,
        SkillInvocation,
    )

    evidence_refs: tuple[str, ...] = ()
    degradation_reasons: tuple[str, ...] = ()
    snapshot_reader = getattr(evidence_session, "snapshot", None)
    if callable(snapshot_reader):
        snapshot = snapshot_reader()
        current_selections = tuple(
            selected_ids
            for selected_node_id, selected_ids in snapshot.bureau_selections[selection_start:]
            if selected_node_id == node_id
        )
        evidence_refs = tuple(
            dict.fromkeys(evidence_id for ids in current_selections for evidence_id in ids)
        )
        degradation_reasons = tuple(
            reason
            for reason in snapshot.degradation_reasons[degradation_start:]
            if reason.endswith(f":{node_id}")
        )
    approved_evidence = frozenset((*evidence_refs, *approved_data_refs))
    supplied_coverage = requirement_data_refs or {}
    covered_requirements = {
        requirement
        for requirement in skill.data_requirements
        if supplied_coverage.get(requirement)
        and all(ref in approved_evidence for ref in supplied_coverage[requirement])
    }
    missing_requirements = tuple(
        requirement
        for requirement in skill.data_requirements
        if requirement not in covered_requirements
    )
    data_gaps = (*missing_requirements, *degradation_reasons)
    opinion = synthesis.opinion
    fully_covered = not data_gaps and not synthesis.legacy and "数据不足" not in opinion
    partially_covered = bool(covered_requirements)
    input_refs = tuple(dict.fromkeys(ref for refs in supplied_coverage.values() for ref in refs))
    candidate = BureauReport(
        report_id=f"bureau-report:{uuid4()}",
        request_id=f"bureau-request:{uuid4()}",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        subject=skill.purpose,
        executive_summary=opinion,
        input_refs=input_refs,
        evidence_refs=evidence_refs,
        data_gaps=data_gaps,
        evidence_sufficiency=(
            EvidenceSufficiency.SUFFICIENT
            if fully_covered
            else (
                EvidenceSufficiency.PARTIAL
                if partially_covered
                else EvidenceSufficiency.INSUFFICIENT
            )
        ),
        status=ReportStatus.COMPLETED if fully_covered else ReportStatus.DEGRADED,
        analysis=synthesis.analysis if fully_covered else (),
        professional_findings=synthesis.professional_findings if fully_covered else (),
        risks=synthesis.risks if fully_covered else (),
        recommendations=synthesis.recommendations or (opinion,),
        evidence_requests=(),
        out_of_scope_items=synthesis.out_of_scope_items,
    )
    from app.agents.runtime_skills import executor as runtime_executor

    requested_services = (
        frozenset({RuntimeService.EVIDENCE_PROTOCOL})
        if evidence_session is not None
        else frozenset()
    )
    invocation = SkillInvocation(
        request_id=candidate.request_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=input_refs,
        evidence_refs=evidence_refs,
        requested_services=requested_services,
        requirement_data_refs=dict(supplied_coverage),
    )
    result = runtime_executor.execute_runtime_skill(
        invocation,
        skill,
        (
            {RuntimeService.EVIDENCE_PROTOCOL: evidence_session}
            if evidence_session is not None
            else {}
        ),
        lambda _messages: "",
        precomputed_report=candidate,
    )
    report = result.report
    if not isinstance(report, BureauReport):
        raise BureauAgentInvocationError("Bureau runtime skill returned an invalid report.")
    return BureauAgentInvocationResult(opinion=opinion, runtime_report=report)


def _evidence_protocol_prompt(node_id: str) -> str:
    from app.agents.evidence_protocol import MARKET_METRIC_PROMPT_CONTRACT

    return f"""
This is an evidence-session response. Return only one strict JSON envelope.
If no externally verifiable fact is necessary, return exactly
{{"status":"READY","result":{{"opinion":"<complete normative clause>",
"factual_claims":[{{"claim":"<same complete normative clause>","basis":"NORMATIVE",
"evidence_ids":[],"fact_key":null,"category":null,"subject":null}}]}},
"adopted_evidence_ids":[],"fact_basis":"NOT_REQUIRED"}}.
If the opinion relies on archive or Jinyiwei evidence, return exactly
{{"status":"READY","result":{{"opinion":"<non-empty bureau opinion>",
"factual_claims":[{{"claim":"<complete opinion clause>","basis":"<ARCHIVED|CITED>",
"evidence_ids":["<provided evidence id>"],"fact_key":"<provided fact key>",
"category":"<provided fact category>","subject":"<provided canonical subject>"}}]}},
"adopted_evidence_ids":["<provided evidence id>"],"fact_basis":"CITED"}}.
When any necessary public fact is missing, return exactly
{{"status":"NEEDS_DATA","data_gap":{{"requesting_agent":"{node_id}",
"question":"<question>","required_facts":[{{"key":"<key>","description":"<description>",
"category":"<MARKET_QUOTE|REGULATORY_FILING|NEWS_EVENT|PUBLIC_STATISTIC|ENTITY_REFERENCE>",
"data_scope":"<INTERNAL_BUSINESS|EXTERNAL_PUBLIC|HYBRID>",
"subject":"<entity or topic>","jurisdiction":null,"expected_unit":null,
"expected_shape":null,"market_metric":"LAST_PRICE"}}],"decision_context":"<context>",
"freshness":{{"max_age_seconds":3600}},"existing_evidence_ids":[]}}}}.
{MARKET_METRIC_PROMPT_CONTRACT}
Do not return a bare opinion.
A declaration may cover one or more contiguous substantive opinion clauses.
Together the declarations must provide complete ordered coverage of the opinion
after normalization; reordered, overlapping, duplicate,
missing, extra, or partial coverage is invalid. The empty factual_claims list is invalid
for a nonempty opinion.
Each declaration must use NORMATIVE, USER_PROVIDED, ARCHIVED, or CITED; only
ARCHIVED and CITED declarations may name evidence IDs, and every named ID must be
adopted. ARCHIVED and CITED declarations must copy the matching fact_key, category,
and subject from the evidence pack. NORMATIVE and USER_PROVIDED declarations must
set evidence_ids to [] and fact_key/category/subject to null. USER_PROVIDED is only
valid for a fact explicitly stated by the user, never a question or lookup request.
Every opinion clause must be covered exactly once in order. Do not label an externally
verifiable factual dependency as NOT_REQUIRED; request it with NEEDS_DATA or cite it.
If the decree asks for current/latest external facts or current business-system state,
you must return NEEDS_DATA unless the supplied evidence already supports every fact.
Only this bureau may request evidence. Never claim that the ministry, Grand Council,
Chancellor, or a routing/finalization turn can investigate.
""".strip()


def _invoke_bureau_agent_with_report_authorized(
    department: str,
    bureau: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    requirement_data_refs: Mapping[str, tuple[str, ...]] | None = None,
    approved_data_refs: Sequence[str] = (),
) -> BureauAgentInvocationResult:
    """Invoke one bureau once and return its opinion with an internal report."""

    try:
        runtime_skill = bureau_runtime_skill_for(department, bureau)
        system_prompt = bureau_system_prompt(
            department,
            bureau,
            evidence_session=evidence_session is not None,
            runtime_skill=runtime_skill,
        )
    except ValueError as exc:
        raise BureauAgentInvocationError("Bureau identity validation failed.") from exc

    report_summary = None
    if report_session is not None and (department, bureau) == ("户部", "会计司"):
        from app.accounting_reports.intent import detect_accounting_report_intent

        if detect_accounting_report_intent(decree_text).requested:
            try:
                report_summary = report_session.maybe_generate(department, bureau, decree_text)
            except Exception as exc:  # noqa: BLE001 - sanitized report boundary
                error = BureauAgentInvocationError("Accounting report generation failed.")
                error.failure_stage = "report"
                raise error from exc

    user_content = f"旨意：{decree_text}\n\n部级路由判断：{rationale}"
    if report_summary is not None:
        user_content += f"\n\n会计司确定性报表摘要：\n{report_summary}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    if evidence_session is not None:
        from app.agents.evidence_protocol import (
            EvidenceProtocolError,
            bureau_node_id,
            invoke_bureau_with_evidence,
        )
        from app.agents.evidence_rendering import render_mainland_last_price
        from app.agents.fact_plans import FactPlanDisposition
        from app.agents.market_fact_plan import (
            compile_mainland_last_price_plan,
            extract_mainland_market_entity,
        )

        node_id = bureau_node_id(department, bureau)
        snapshot_reader = getattr(evidence_session, "snapshot", None)
        if callable(snapshot_reader):
            before_snapshot = snapshot_reader()
            selection_start = len(before_snapshot.bureau_selections)
            degradation_start = len(before_snapshot.degradation_reasons)
        else:
            selection_start = 0
            degradation_start = 0
        messages[0] = {
            "role": "system",
            "content": f"{system_prompt}\n\n{_evidence_protocol_prompt(node_id)}",
        }
        evidence_kwargs: dict[str, object] = {}
        if (department, bureau) == ("户部", "投资司"):
            fact_plan = compile_mainland_last_price_plan(
                decree_text=decree_text,
                node_id=node_id,
                entity_extractor=lambda text: extract_mainland_market_entity(
                    text,
                    chat_model,
                ),
            )
            if fact_plan.disposition is FactPlanDisposition.REJECTED:
                cause = ValueError(fact_plan.reason or "data_plan_invalid")
                raise BureauAgentInvocationError(
                    "Bureau deterministic fact plan was rejected."
                ) from cause
            if fact_plan.disposition is FactPlanDisposition.PLANNED:
                evidence_kwargs = {
                    "fact_plan": fact_plan,
                    "evidence_renderer": render_mainland_last_price,
                }
        try:
            opinion = invoke_bureau_with_evidence(
                node_id=node_id,
                department=department,
                bureau=bureau,
                matter_type="MEMORIAL",
                decree_text=decree_text,
                messages=messages,
                chat_model=chat_model,
                legacy_parser=_parse_opinion,
                fallback=lambda reason: (
                    f"数据不足（{reason}），无法形成事实结论；待取得可验证数据后再行复核。"
                ),
                session=evidence_session,
                **evidence_kwargs,
            )
            return _result_with_runtime_report(
                _BureauSynthesis(opinion=opinion, recommendations=(opinion,), legacy=True),
                runtime_skill,
                evidence_session=evidence_session,
                node_id=node_id,
                selection_start=selection_start,
                degradation_start=degradation_start,
                requirement_data_refs=requirement_data_refs,
                approved_data_refs=approved_data_refs,
            )
        except EvidenceProtocolError as exc:
            from app.agents.synthesis_failures import is_locally_degradable

            if is_locally_degradable(exc):
                evidence_session.record_degradation(node_id)
                opinion = (
                    "数据不足（model_synthesis_invalid），无法形成事实结论；"
                    "待取得可验证数据后再行复核。"
                )
                return _result_with_runtime_report(
                    _BureauSynthesis(opinion=opinion, recommendations=(opinion,), legacy=True),
                    runtime_skill,
                    evidence_session=evidence_session,
                    node_id=node_id,
                    selection_start=selection_start,
                    degradation_start=degradation_start,
                    requirement_data_refs=requirement_data_refs,
                    approved_data_refs=approved_data_refs,
                )
            raise BureauAgentInvocationError("Bureau evidence protocol failed.") from exc

    try:
        synthesis = invoke_strict_structured(
            chat_model,
            messages,
            lambda raw: _parse_bureau_synthesis(parse_strict_json_object(raw)),
            stage="bureau",
        )
        return _result_with_runtime_report(
            synthesis,
            runtime_skill,
            evidence_session=None,
            requirement_data_refs=requirement_data_refs,
            approved_data_refs=approved_data_refs,
        )
    except StructuredInvocationError as exc:
        error = BureauAgentInvocationError("Bureau structured response failed.")
        error.failure_stage = exc.failure_stage
        cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
        raise error from cause


def invoke_bureau_agent_with_report(
    department: str,
    bureau: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    requirement_data_refs: Mapping[str, tuple[str, ...]] | None = None,
    approved_data_refs: Sequence[str] = (),
) -> BureauAgentInvocationResult:
    """Authorize the bureau boundary before model, evidence, or report side effects."""

    from app.agents.runtime_skills import executor as runtime_executor
    from app.agents.runtime_skills.models import RuntimeService, SkillInvocation

    try:
        skill = bureau_runtime_skill_for(department, bureau)
    except ValueError as exc:
        raise BureauAgentInvocationError("Bureau identity validation failed.") from exc
    requested = (
        frozenset({RuntimeService.EVIDENCE_PROTOCOL})
        if evidence_session is not None
        else frozenset()
    )
    invocation = SkillInvocation(
        request_id=f"bureau-operation:{uuid4()}",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=tuple(approved_data_refs),
        requested_services=requested,
        requirement_data_refs=dict(requirement_data_refs or {}),
    )
    return runtime_executor.run_authorized_runtime_operation(
        invocation,
        skill,
        ({RuntimeService.EVIDENCE_PROTOCOL: evidence_session} if evidence_session else {}),
        lambda: _invoke_bureau_agent_with_report_authorized(
            department,
            bureau,
            decree_text,
            rationale,
            chat_model,
            evidence_session=evidence_session,
            report_session=report_session,
            requirement_data_refs=requirement_data_refs,
            approved_data_refs=approved_data_refs,
        ),
    )


def invoke_bureau_agent(
    department: str,
    bureau: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
) -> str:
    """Invoke one bureau and preserve the exact legacy plain-string contract."""

    return invoke_bureau_agent_with_report(
        department,
        bureau,
        decree_text,
        rationale,
        chat_model,
        evidence_session=evidence_session,
        report_session=report_session,
    ).opinion


def _parse_opinion(value: object) -> str:
    if not isinstance(value, dict) or set(value) != {"opinion"}:
        raise ValueError("The bureau response has an invalid schema.")
    opinion = value["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("The bureau opinion is not a non-empty string.")
    return opinion.strip()


def _parse_bureau_synthesis(value: object) -> _BureauSynthesis:
    if not isinstance(value, dict):
        raise ValueError("The bureau response has an invalid schema.")
    if set(value) == {"opinion"}:
        opinion = _parse_opinion(value)
        return _BureauSynthesis(opinion=opinion, recommendations=(opinion,), legacy=True)
    fields = {
        "opinion",
        "analysis",
        "professional_findings",
        "risks",
        "recommendations",
        "out_of_scope_items",
    }
    if set(value) != fields:
        raise ValueError("The bureau response has an invalid schema.")
    opinion = value["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("The bureau opinion is not a non-empty string.")
    sections: dict[str, tuple[str, ...]] = {}
    for field in fields - {"opinion"}:
        items = value[field]
        if not isinstance(items, list) or any(
            not isinstance(item, str) or not item.strip() for item in items
        ):
            raise ValueError("The bureau response section is invalid.")
        sections[field] = tuple(item.strip() for item in items)
    normalized = [
        " ".join(opinion.split()).casefold(),
        *[
            " ".join(item.split()).casefold()
            for field in fields - {"opinion"}
            for item in sections[field]
        ],
    ]
    if len(normalized) != len(set(normalized)):
        raise ValueError("The bureau response duplicates structured content.")
    return _BureauSynthesis(opinion=opinion.strip(), **sections)
