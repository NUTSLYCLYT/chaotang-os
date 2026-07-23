"""Generic invocation helper shared by all 39 bureau-level agents."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.agents.bureaus.prompts import bureau_system_prompt
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel

if TYPE_CHECKING:
    from app.agents.evidence_protocol import AgentEvidenceSession


class BureauAgentInvocationError(Exception):
    """A sanitized, fail-closed bureau invocation failure."""


def _evidence_protocol_prompt(node_id: str) -> str:
    return f"""
This is an evidence-session response. Return only one strict JSON envelope.
If no externally verifiable fact is necessary, return exactly
{{"status":"READY","result":{{"opinion":"<non-empty bureau opinion>","factual_claims":[]}},
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
"expected_shape":null}}],"decision_context":"<context>",
"freshness":{{"max_age_seconds":3600}},"existing_evidence_ids":[]}}}}.
Do not return a bare opinion. Declare every factual claim used in the final opinion.
Each declaration must use NORMATIVE, USER_PROVIDED, ARCHIVED, or CITED; only
ARCHIVED and CITED declarations may name evidence IDs, and every named ID must be
adopted. ARCHIVED and CITED declarations must copy the matching fact_key, category,
and subject from the evidence pack. NORMATIVE and USER_PROVIDED declarations must
set evidence_ids to [] and fact_key/category/subject to null. USER_PROVIDED is only
valid for a fact explicitly stated by the user, never a question or lookup request.
Every non-normative opinion clause must exactly match one declaration. Do not label an externally
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
) -> str:
    """Invoke one bureau selected by its compound identity and return its opinion."""

    try:
        system_prompt = bureau_system_prompt(department, bureau)
    except ValueError as exc:
        raise BureauAgentInvocationError("Bureau identity validation failed.") from exc

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"旨意：{decree_text}\n\n部级路由判断：{rationale}",
        },
    ]
    if evidence_session is not None:
        from app.agents.evidence_protocol import (
            EvidenceProtocolError,
            bureau_node_id,
            invoke_bureau_with_evidence,
        )

        node_id = bureau_node_id(department, bureau)
        messages[0] = {
            "role": "system",
            "content": f"{system_prompt}\n\n{_evidence_protocol_prompt(node_id)}",
        }
        try:
            return invoke_bureau_with_evidence(
                node_id=node_id,
                department=department,
                bureau=bureau,
                matter_type="MEMORIAL",
                messages=messages,
                chat_model=chat_model,
                legacy_parser=_parse_opinion,
                fallback=lambda reason: (
                    f"数据不足（{reason}），无法形成事实结论；"
                    "待取得可验证数据后再行复核。"
                ),
                session=evidence_session,
            )
        except EvidenceProtocolError as exc:
            raise BureauAgentInvocationError("Bureau evidence protocol failed.") from exc

    try:
        raw_response = chat_model(messages)
    except Exception as exc:  # noqa: BLE001 - model boundary must fail closed
        raise BureauAgentInvocationError("Bureau model invocation failed.") from exc

    if not isinstance(raw_response, str) or not raw_response.strip():
        cause = ValueError("The bureau model returned no usable text.")
        raise BureauAgentInvocationError("Bureau response validation failed.") from cause

    try:
        return _parse_opinion(parse_strict_json_object(raw_response))
    except StructuredOutputError as exc:
        raise BureauAgentInvocationError("Bureau response parsing failed.") from exc
    except ValueError as exc:
        raise BureauAgentInvocationError("Bureau response validation failed.") from exc


def _parse_opinion(value: object) -> str:
    if not isinstance(value, dict) or set(value) != {"opinion"}:
        raise ValueError("The bureau response has an invalid schema.")
    opinion = value["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("The bureau opinion is not a non-empty string.")
    return opinion.strip()
