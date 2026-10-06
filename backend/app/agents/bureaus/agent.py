"""Generic invocation helper shared by all 39 bureau-level agents."""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from app.agents.bureaus.prompts import bureau_runtime_skill_for, bureau_system_prompt
from app.agents.runtime_skills.tool_failures import AccountingToolChainError
from app.agents.structured_output import parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel

logger = logging.getLogger(__name__)

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
    result_refs: Sequence[str] = (),
    audit_refs: Sequence[str] = (),
    artifact_manifest: Sequence[Mapping[str, str]] = (),
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
    trusted_refs = frozenset((*evidence_refs, *result_refs))
    supplied_coverage = requirement_data_refs or {}
    covered_requirements = {
        requirement
        for requirement in skill.data_requirements
        if supplied_coverage.get(requirement)
        and all(ref in trusted_refs for ref in supplied_coverage[requirement])
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
    input_refs = tuple(dict.fromkeys([
        *(
            ref
            for refs in supplied_coverage.values()
            for ref in refs
            if ref in trusted_refs
        ),
        *result_refs,
    ]))
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
        audit_refs=tuple(dict.fromkeys(audit_refs)),
        artifact_manifest=tuple(dict(item) for item in artifact_manifest),
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
    approved_data_inputs: Mapping[str, Mapping[str, object]] | None = None,
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

    accounting_tool_session = (
        report_session is not None
        and runtime_skill.agent_id == "hubu-accounting"
        and isinstance(getattr(report_session, "run_id", None), str)
    )
    report_summary = None
    if (
        report_session is not None
        and runtime_skill.agent_id == "hubu-accounting"
        and not accounting_tool_session
    ):
        from app.accounting_reports.intent import detect_accounting_report_intent

        if detect_accounting_report_intent(decree_text).requested:
            generation = report_session.maybe_generate(department, bureau, decree_text)
            if isinstance(generation, str):
                report_summary = generation
            elif generation is not None:
                report_summary = generation.model_prompt

    user_content = f"旨意：{decree_text}\n\n部级路由判断：{rationale}"
    if report_summary is not None:
        user_content += f"\n\n会计司确定性报表摘要：\n{report_summary}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    node_id = None
    selection_start = 0
    degradation_start = 0
    if evidence_session is not None:
        from app.agents.evidence_protocol import bureau_node_id

        node_id = bureau_node_id(department, bureau)
        snapshot_reader = getattr(evidence_session, "snapshot", None)
        if callable(snapshot_reader):
            before_snapshot = snapshot_reader()
            selection_start = len(before_snapshot.bureau_selections)
            degradation_start = len(before_snapshot.degradation_reasons)
        messages[0] = {
            "role": "system",
            "content": f"{system_prompt}\n\n{_evidence_protocol_prompt(node_id)}",
        }

    try:
        from app.agents.bureaus.prompts import policy_projected_tool_descriptors
        from app.agents.runtime_skills.tool_handlers import build_bureau_tool_handlers
        from app.agents.runtime_skills.tool_issuance import (
            _issue_tool_authorization_context,
        )
        from app.agents.runtime_skills.tool_loop import run_bureau_tool_loop
        from app.agents.runtime_skills.tool_models import (
            ToolCallStatus,
            ToolName,
        )
        from app.agents.runtime_skills.tool_registry import (
            SYSTEM_MAX_RESULT_BYTES,
            SYSTEM_MAX_RESULT_ROWS,
            SYSTEM_MAX_TOOL_CALLS,
            SYSTEM_MAX_TOOL_ROUNDS,
        )

        policy = runtime_skill.tool_policy
        if policy is None:
            raise ValueError("bureau_tool_policy_missing")
        operation_id = str(uuid4())
        case_id = f"case-{operation_id}"
        decree_id = f"decree-{operation_id}"
        approved_material_ref = (
            f"input:case:{case_id}:decree:{decree_id}:bureau-request"
        )
        deterministic_fact_plan = None
        if (
            evidence_session is not None
            and node_id is not None
            and runtime_skill.agent_id == "hubu-investment"
        ):
            from app.agents.fact_plans import FactPlanDisposition
            from app.agents.market_fact_plan import (
                compile_mainland_last_price_plan,
                extract_mainland_market_entity,
            )

            deterministic_fact_plan = compile_mainland_last_price_plan(
                decree_text=decree_text,
                node_id=node_id,
                entity_extractor=lambda text: extract_mainland_market_entity(
                    text, chat_model
                ),
            )
            if deterministic_fact_plan.disposition is FactPlanDisposition.REJECTED:
                cause = ValueError(
                    deterministic_fact_plan.reason or "data_plan_invalid"
                )
                raise BureauAgentInvocationError(
                    "Bureau deterministic fact plan was rejected."
                ) from cause
            if deterministic_fact_plan.disposition is not FactPlanDisposition.PLANNED:
                deterministic_fact_plan = None
        elif (
            evidence_session is not None
            and node_id is not None
            and runtime_skill.agent_id == "libu-rites-content"
        ):
            from app.agents.entity_fact_plan import compile_entity_reference_plan
            from app.agents.fact_plans import FactPlanDisposition

            deterministic_fact_plan = compile_entity_reference_plan(
                decree_text=decree_text,
                node_id=node_id,
            )
            if deterministic_fact_plan.disposition is FactPlanDisposition.REJECTED:
                cause = ValueError(
                    deterministic_fact_plan.reason or "data_plan_invalid"
                )
                raise BureauAgentInvocationError(
                    "Bureau deterministic fact plan was rejected."
                ) from cause
            if deterministic_fact_plan.disposition is not FactPlanDisposition.PLANNED:
                deterministic_fact_plan = None
        supplied_data: dict[str, dict[str, object]] = {}
        for key, value in (approved_data_inputs or {}).items():
            if (
                not isinstance(key, str)
                or not key.strip()
                or ":" in key
                or not isinstance(value, Mapping)
            ):
                raise ValueError("approved_data_input_invalid")
            copied = deepcopy(dict(value))
            if set(copied) != {"columns", "rows", "values", "unit"}:
                raise ValueError("approved_data_input_invalid")
            columns, rows = copied["columns"], copied["rows"]
            if (
                not isinstance(columns, list)
                or not columns
                or not isinstance(rows, list)
                or any(not isinstance(row, Mapping) for row in rows)
            ):
                raise ValueError("approved_data_input_invalid")
            supplied_data[key] = copied
        canonical_data: dict[str, object] = {
            f"approved-data:case:{case_id}:decree:{decree_id}:{key}": value
            for key, value in supplied_data.items()
        }
        accounting_source_ref = None
        accounting_content_ref = None
        accounting_content_holder: dict[str, object] | None = None
        if accounting_tool_session:
            accounting_source_ref = (
                f"approved-data:case:{case_id}:decree:{decree_id}:accounting-source-root"
            )
            accounting_content_ref = (
                f"approved-data:case:{case_id}:decree:{decree_id}:accounting-content-"
                f"{report_session.run_id}"
            )
            canonical_data[accounting_source_ref] = {
                "capability": "approved_accounting_source_root"
            }
            accounting_content_holder = {
                "capability": "pending_accounting_content"
            }
            canonical_data[accounting_content_ref] = accounting_content_holder
        approved_refs = tuple(dict.fromkeys((*approved_data_refs, *canonical_data)))
        authorization_context = _issue_tool_authorization_context(
            request_id=f"bureau-tool-request:{operation_id}",
            case_id=case_id,
            decree_id=decree_id,
            agent_id=runtime_skill.agent_id,
            skill_id=runtime_skill.skill_id,
            skill_version=runtime_skill.version,
            policy=policy,
            approved_input_refs=(approved_material_ref,),
            approved_evidence_refs=(),
            approved_data_refs=approved_refs,
            business_state="ready",
            system_max_calls=SYSTEM_MAX_TOOL_CALLS,
            system_max_rounds=SYSTEM_MAX_TOOL_ROUNDS,
            system_max_result_rows=SYSTEM_MAX_RESULT_ROWS,
            system_max_result_bytes=SYSTEM_MAX_RESULT_BYTES,
            report_session_present=report_session is not None,
        )
        evidence_requester = None
        if evidence_session is not None and node_id is not None:
            from app.agents.evidence_protocol import build_bureau_evidence_tool_adapter

            evidence_requester = build_bureau_evidence_tool_adapter(
                session=evidence_session,
                node_id=node_id,
                department=department,
                matter_type="MEMORIAL",
                case_id=case_id,
                decree_id=decree_id,
            )
        def material_reader(context):
            fields = context.approved_call.normalized_arguments["fields"]
            authorized_summary = f"旨意：{decree_text}\n部级路由判断：{rationale}"
            projection = {
                str(field).rsplit(".", 1)[-1]: authorized_summary for field in fields
            }
            return {
                "result_schema": "approved_materials_result.v1",
                "data": {"materials": [{
                    "ref": approved_material_ref,
                    "summary": authorized_summary,
                    "projection": projection,
                }]},
                "input_refs": [approved_material_ref],
                "evidence_refs": [],
                "approved_data_refs": [],
                "data_quality": "SUFFICIENT",
                "limitations": [],
                "as_of": datetime.now(UTC).isoformat(),
            }

        def data_reader(context):
            selected = next(iter(context.resolved_approved_inputs.values()))
            return {
                "result_schema": "approved_data_result.v1",
                "data": {
                    "operation": context.approved_call.normalized_arguments["operation"],
                    "columns": list(selected["columns"]),
                    "rows": deepcopy(selected["rows"]),
                },
                "input_refs": [],
                "evidence_refs": [],
                "approved_data_refs": list(context.resolved_approved_inputs),
                "data_quality": "SUFFICIENT",
                "limitations": [],
                "as_of": datetime.now(UTC).isoformat(),
            }

        def inspect_accounting_content(context):
            if (
                report_session is None
                or accounting_source_ref is None
                or accounting_content_ref is None
                or context.approved_call.normalized_arguments["data_ref"]
                != accounting_source_ref
            ):
                raise ValueError("accounting_source_capability_invalid")
            projection = report_session.inspect_accounting_content(
                case_id=context.approved_call.case_id,
                decree_id=context.approved_call.decree_id,
                approved_ref=accounting_content_ref,
            )
            accounting_content_holder.clear()
            accounting_content_holder["projection"] = projection
            return {
                "result_schema": "accounting_content_result.v1",
                "data": projection.model_dump(mode="json"),
                "input_refs": [], "evidence_refs": [],
                "approved_data_refs": [accounting_content_ref],
                "data_quality": "SUFFICIENT", "limitations": [],
                "as_of": "1970-01-01T00:00:00Z",
            }

        def accounting_workbook_generator(context):
            if report_session is None:
                raise ValueError("report_session_unavailable")
            ref = context.approved_call.normalized_arguments["data_ref"]
            accepted_inspection = any(
                item.tool_name is ToolName.INSPECT_ACCOUNTING_CONTENT
                and item.status is ToolCallStatus.SUCCEEDED
                and item.approved_data_refs == (ref,)
                for item in context.accepted_results
            )
            if (
                ref != accounting_content_ref
                or not accepted_inspection
                or accounting_content_holder is None
                or not getattr(
                    accounting_content_holder.get("projection"),
                    "system_issued",
                    False,
                )
            ):
                raise ValueError("accounting_inspection_required")
            generation = report_session.maybe_generate(
                department, bureau, decree_text, decree_id=context.approved_call.decree_id
            )
            if generation is None:
                raise ValueError("report_intent_unavailable")
            return {
                "result_schema": "accounting_workbook_result.v1",
                "data": {
                    "artifact_id": generation.artifact_id,
                    "kind": "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
                    "publication_readiness": generation.publication_readiness,
                },
                "input_refs": [],
                "evidence_refs": [],
                "approved_data_refs": [ref],
                "data_quality": (
                    "SUFFICIENT"
                    if generation.publication_readiness == "verified"
                    else "PARTIAL"
                ),
                "limitations": (
                    []
                    if generation.publication_readiness == "verified"
                    else ["mapping_draft_only"]
                ),
                "as_of": "1970-01-01T00:00:00Z",
            }

        handlers = build_bureau_tool_handlers(
            material_reader=material_reader,
            data_reader=data_reader if canonical_data else None,
            evidence_requester=evidence_requester,
            accounting_workbook_generator=(
                accounting_workbook_generator
                if accounting_tool_session
                else None
            ),
            accounting_content_inspector=(
                inspect_accounting_content
                if accounting_tool_session
                else None
            ),
        )

        def model_adapter(loop_messages: tuple[Mapping[str, object], ...]) -> object:
            if deterministic_fact_plan is not None:
                from app.agents.evidence_protocol import evidence_draft_to_tool_call
                from app.agents.evidence_rendering import (
                    render_entity_reference,
                    render_mainland_last_price,
                )

                if len(loop_messages) == 2:
                    if deterministic_fact_plan.draft is None:
                        raise ValueError("data_plan_invalid")
                    return evidence_draft_to_tool_call(
                        deterministic_fact_plan.draft,
                        domain=next(iter(policy.allowed_data_domains)),
                    )
                pack = evidence_session.latest_frozen_pack()
                if pack is None:
                    raise ValueError("evidence_unavailable")
                renderer = (
                    render_entity_reference
                    if runtime_skill.agent_id == "libu-rites-content"
                    else render_mainland_last_price
                )
                rendered_opinion = renderer(pack)
                evidence_session.record_selection(
                    node_id, rendered_opinion.evidence_ids
                )
                return {
                    "status": "FINAL",
                    "report": {"opinion": rendered_opinion.opinion},
                }
            rendered = [dict(message) for message in messages]
            rendered[-1]["content"] = (
                f"{rendered[-1]['content']}\n\napproved_input_refs="
                f"{approved_material_ref}"
            )
            if canonical_data:
                rendered[-1]["content"] += (
                    f"\napproved_data_refs={','.join(canonical_data)}"
                )
            for message in loop_messages[2:]:
                role = message.get("role")
                content = message.get("content")
                rendered.append(
                    {
                        "role": "system" if role == "correction" else "user",
                        "content": json.dumps(
                            content,
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                        ),
                    }
                )
            try:
                raw = chat_model(rendered)
            except Exception as exc:  # noqa: BLE001 - provider boundary
                if evidence_session is not None:
                    from app.agents.evidence_protocol import EvidenceProtocolError

                    raise EvidenceProtocolError("model_unavailable") from exc
                raise BureauAgentInvocationError(
                    "Bureau structured response failed."
                ) from exc
            parsed: object = raw
            if isinstance(raw, str):
                try:
                    parsed = parse_strict_json_object(raw)
                except Exception as exc:  # normalized for the bounded loop
                    raise ValueError("malformed_model_envelope") from exc
            if (
                evidence_session is not None
                and node_id is not None
                and isinstance(parsed, Mapping)
                and parsed.get("status") == "NEEDS_DATA"
            ):
                from app.agents.evidence_protocol import legacy_gap_to_tool_call

                return legacy_gap_to_tool_call(
                    parsed,
                    node_id=node_id,
                    session=evidence_session,
                    decree_text=decree_text,
                    domain=next(iter(policy.allowed_data_domains)),
                )
            if (
                evidence_session is not None
                and node_id is not None
                and isinstance(parsed, Mapping)
                and parsed.get("status") == "READY"
            ):
                from app.agents.evidence_protocol import parse_bureau_ready_envelope

                try:
                    opinion = parse_bureau_ready_envelope(
                        parsed,
                        session=evidence_session,
                        node_id=node_id,
                        messages=messages,
                    )
                except Exception as exc:  # noqa: BLE001 - sanitized protocol boundary
                    from app.agents.evidence_protocol import (
                        EvidenceProtocolError,
                        _bare_opinion_correction,
                    )

                    if (
                        not isinstance(exc, EvidenceProtocolError)
                        or str(exc) != "unsupported_factual_dependency"
                        or evidence_session is None
                        or node_id is None
                    ):
                        raise
                    if not evidence_session.claim_protocol_correction():
                        evidence_session.record_degradation(node_id)
                        return {
                            "status": "FINAL",
                            "report": {
                                "opinion": (
                                    "数据不足（model_synthesis_invalid），无法形成事实结论；"
                                    "待取得可验证数据后再行复核。"
                                )
                            },
                        }
                    corrected = chat_model(
                        [
                            # The correction only needs the evidence contract
                            # and decree. Re-sending the full bureau prompt,
                            # Tool Loop catalog, and runtime context here
                            # needlessly reserves the same bytes a second time
                            # under the task cap.
                            {
                                "role": "system",
                                "content": _evidence_protocol_prompt(node_id),
                            },
                            messages[1],
                            {
                                "role": "user",
                                "content": _bare_opinion_correction(node_id)["content"],
                            },
                        ]
                    )
                    corrected_parsed: object = corrected
                    if isinstance(corrected, str):
                        corrected_parsed = parse_strict_json_object(corrected)
                    if (
                        isinstance(corrected_parsed, Mapping)
                        and corrected_parsed.get("status") == "NEEDS_DATA"
                    ):
                        from app.agents.evidence_protocol import legacy_gap_to_tool_call

                        return legacy_gap_to_tool_call(
                            corrected_parsed,
                            node_id=node_id,
                            session=evidence_session,
                            decree_text=decree_text,
                            domain=next(iter(policy.allowed_data_domains)),
                        )
                    if not (
                        isinstance(corrected_parsed, Mapping)
                        and corrected_parsed.get("status") == "READY"
                    ):
                        raise EvidenceProtocolError("unsupported_factual_dependency") from None
                    try:
                        opinion = parse_bureau_ready_envelope(
                            corrected_parsed,
                            session=evidence_session,
                            node_id=node_id,
                            messages=messages,
                        )
                    except EvidenceProtocolError as corrected_exc:
                        if str(corrected_exc) != "unsupported_factual_dependency":
                            raise
                        # Match the existing one-resume evidence adapter: a
                        # repeated protocol violation becomes an explicit,
                        # auditable degraded result rather than a fabricated
                        # bureau opinion.
                        evidence_session.record_degradation(node_id)
                        return {
                            "status": "FINAL",
                            "report": {
                                "opinion": (
                                    "数据不足（model_synthesis_invalid），无法形成事实结论；"
                                    "待取得可验证数据后再行复核。"
                                )
                            },
                        }
                if opinion is None:
                    raise ValueError("evidence_ready_invalid")
                return {"status": "FINAL", "report": {"opinion": opinion}}
            if isinstance(parsed, Mapping) and "status" not in parsed:
                return {"status": "FINAL", "report": dict(parsed)}
            return parsed

        loop_result = run_bureau_tool_loop(
            skill=runtime_skill,
            policy=policy,
            tool_descriptors=policy_projected_tool_descriptors(policy),
            canonical_context={
                "department": department,
                "bureau": bureau,
                "decree_text": decree_text,
                "rationale": rationale,
                "approved_data_refs": list(approved_refs),
            },
            model_adapter=model_adapter,
            authorization_context=authorization_context,
            handlers=handlers,
            resolved_approved_inputs={
                approved_material_ref: {
                    "decree_text": decree_text,
                    "rationale": rationale,
                },
                **canonical_data,
            },
        )
        if accounting_tool_session:
            artifact_ready = any(
                result.result_schema == "accounting_workbook_result.v1"
                for result in loop_result.accepted_results
            )
            if not artifact_ready:
                if loop_result.terminal_failure_code is not None:
                    raise AccountingToolChainError(loop_result.terminal_failure_code)
        if (
            evidence_session is not None
            and node_id is not None
            and isinstance(loop_result.final_synthesis, Mapping)
            and loop_result.final_synthesis.get("status") == "DEGRADED"
        ):
            logger.warning(
                "bureau tool loop degraded node=%s reasons=%s accepted_results=%d",
                node_id,
                ",".join(loop_result.degradation_reasons) or "unknown",
                len(loop_result.accepted_results),
            )
            evidence_session.record_degradation(node_id)
            opinion = (
                "数据不足（model_synthesis_invalid），无法形成事实结论；"
                "待取得可验证数据后再行复核。"
            )
            synthesis = _BureauSynthesis(
                opinion=opinion, recommendations=(opinion,), legacy=True
            )
        else:
            synthesis = _parse_bureau_synthesis(loop_result.final_synthesis)
        gated_refs = tuple(dict.fromkeys(
            ref
            for result in loop_result.accepted_results
            for ref in (
                *result.approved_input_refs,
                *result.evidence_refs,
                *result.approved_data_refs,
            )
        ))
        from app.agents.runtime_skills.models import BureauArtifactManifestItem
        artifact_manifest = tuple(
            BureauArtifactManifestItem(
                artifact_id=str(result.data["artifact_id"]),
                kind=str(result.data["kind"]),
                publication_readiness=str(result.data["publication_readiness"]),
            )
            for result in loop_result.accepted_results
            if result.result_schema == "accounting_workbook_result.v1"
        )
        if len(artifact_manifest) > 1:
            raise ValueError("multiple_accounting_artifacts_forbidden")
        return _result_with_runtime_report(
            synthesis,
            runtime_skill,
            evidence_session=evidence_session,
            node_id=node_id,
            selection_start=selection_start,
            degradation_start=degradation_start,
            requirement_data_refs=requirement_data_refs,
            result_refs=gated_refs,
            audit_refs=loop_result.audit_refs,
            artifact_manifest=artifact_manifest,
        )
    except AccountingToolChainError:
        raise
    except (TypeError, ValueError) as exc:
        raise BureauAgentInvocationError("Bureau structured response failed.") from exc
    except Exception as exc:
        from app.agents.evidence_protocol import EvidenceProtocolError

        if isinstance(exc, EvidenceProtocolError):
            raise BureauAgentInvocationError("Bureau evidence protocol failed.") from exc
        raise


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
    approved_data_inputs: Mapping[str, Mapping[str, object]] | None = None,
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
            approved_data_inputs=approved_data_inputs,
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
