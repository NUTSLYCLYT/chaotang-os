"""Generic invocation helper shared by all 39 bureau-level agents."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.agents.bureaus.prompts import bureau_system_prompt
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession
    from app.agents.evidence_protocol import AgentEvidenceSession


class BureauAgentInvocationError(Exception):
    """A sanitized, fail-closed bureau invocation failure."""

    failure_stage = "bureau"


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
    """Invoke one bureau selected by its compound identity and return its opinion."""

    try:
        system_prompt = bureau_system_prompt(
            department,
            bureau,
            evidence_session=evidence_session is not None,
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
            return invoke_bureau_with_evidence(
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
        except EvidenceProtocolError as exc:
            from app.agents.synthesis_failures import is_locally_degradable

            if is_locally_degradable(exc):
                evidence_session.record_degradation(node_id)
                return (
                    "数据不足（model_synthesis_invalid），无法形成事实结论；"
                    "待取得可验证数据后再行复核。"
                )
            raise BureauAgentInvocationError("Bureau evidence protocol failed.") from exc

    try:
        return invoke_strict_structured(
            chat_model,
            messages,
            lambda raw: _parse_opinion(parse_strict_json_object(raw)),
            stage="bureau",
        )
    except StructuredInvocationError as exc:
        error = BureauAgentInvocationError("Bureau structured response failed.")
        error.failure_stage = exc.failure_stage
        cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
        raise error from cause


def _parse_opinion(value: object) -> str:
    if not isinstance(value, dict) or set(value) != {"opinion"}:
        raise ValueError("The bureau response has an invalid schema.")
    opinion = value["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("The bureau opinion is not a non-empty string.")
    return opinion.strip()
