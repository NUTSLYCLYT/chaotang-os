"""Single-ministry (六部) layered bureau consultation and synthesis helper.

:func:`invoke_ministry_agent` first parses a department's strict bureau-route
contract (non-empty ``rationale`` plus one or more unique in-department
``bureaus``), consults those bureaus serially, and performs one additional
ministry-level model call over all ordered bureau opinions. Its parameter
signature stays stable for the Chancellor
single-department branch and the 军机处 multi-department council.

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
from typing import TypedDict

from app.agents.bureaus import (
    BureauAgentInvocationError,
    bureau_profiles_for,
    invoke_bureau_agent,
)
from app.agents.ministries.prompts import (
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel
from app.shiguan.recall import RecallContext, safe_recall_context_for_department


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


class BureauOpinion(TypedDict):
    """One selected bureau's validated opinion, in consultation order."""

    bureau: str
    opinion: str


class MinistryOpinion(TypedDict):
    """Stable layered result returned by one ministry invocation."""

    department: str
    bureau_opinions: list[BureauOpinion]
    opinion: str


def _format_recall_context(context: RecallContext) -> str:
    if not context.available:
        return "史馆旧案召回失败：不可把召回失败伪装成已有历史经验。"
    if not context.entries:
        return "史馆旧案召回：未命中旧案。"
    return "史馆旧案召回：" + json.dumps(
        [entry.model_dump() for entry in context.entries],
        ensure_ascii=False,
    )


def invoke_ministry_agent(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
) -> MinistryOpinion:
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
    recall_context = safe_recall_context_for_department(department)
    recall_context_text = _format_recall_context(recall_context)

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"旨意：{decree_text}\n\n"
                f"丞相判断说明：{rationale}\n\n"
                f"{recall_context_text}"
            ),
        },
    ]

    try:
        raw_response = chat_model(messages)
    except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
        raise MinistryAgentInvocationError(
            f"{department} agent failed to obtain a model response; "
            "see __cause__ for the original exception."
        ) from exc

    if not isinstance(raw_response, str) or not raw_response.strip():
        raise MinistryAgentInvocationError(f"{department} agent returned an empty model response.")

    try:
        parsed = parse_strict_json_object(raw_response)
    except StructuredOutputError as exc:
        raise MinistryAgentInvocationError(
            f"{department} agent response failed strict JSON parsing."
        ) from exc

    if set(parsed) != {"rationale", "bureaus"}:
        cause = ValueError("The ministry routing response has an invalid schema.")
        raise MinistryAgentInvocationError(
            f"{department} agent response failed bureau-routing validation."
        ) from cause

    route_rationale = parsed["rationale"]
    selected_bureaus = parsed["bureaus"]
    allowed_bureaus = {profile.bureau for profile in bureau_profiles_for(department)}
    if not isinstance(route_rationale, str) or not route_rationale.strip():
        cause = ValueError("The ministry routing rationale is not a non-empty string.")
        raise MinistryAgentInvocationError(
            f"{department} agent response failed bureau-routing validation."
        ) from cause
    if (
        not isinstance(selected_bureaus, list)
        or not selected_bureaus
        or any(not isinstance(bureau, str) for bureau in selected_bureaus)
        or len(selected_bureaus) != len(set(selected_bureaus))
        or any(bureau not in allowed_bureaus for bureau in selected_bureaus)
    ):
        cause = ValueError("The ministry bureau selection is invalid.")
        raise MinistryAgentInvocationError(
            f"{department} agent response failed bureau-routing validation."
        ) from cause

    bureau_opinions: list[BureauOpinion] = []
    for bureau in selected_bureaus:
        try:
            opinion = invoke_bureau_agent(
                department,
                bureau,
                decree_text,
                route_rationale.strip(),
                chat_model,
            )
        except BureauAgentInvocationError as exc:
            raise MinistryAgentInvocationError(
                f"{department} agent failed while consulting a selected bureau."
            ) from exc
        bureau_opinions.append({"bureau": bureau, "opinion": opinion})

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
                "全部司级意见（按本部路由顺序，JSON）："
                f"{json.dumps(bureau_opinions, ensure_ascii=False)}"
            ),
        },
    ]
    try:
        synthesis_response = chat_model(synthesis_messages)
    except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
        raise MinistryAgentInvocationError(
            f"{department} agent failed to obtain a ministry synthesis; "
            "see __cause__ for the original exception."
        ) from exc

    if not isinstance(synthesis_response, str) or not synthesis_response.strip():
        cause = ValueError("The ministry synthesis returned no usable text.")
        raise MinistryAgentInvocationError(
            f"{department} agent ministry synthesis validation failed."
        ) from cause

    try:
        synthesis = parse_strict_json_object(synthesis_response)
    except StructuredOutputError as exc:
        raise MinistryAgentInvocationError(
            f"{department} agent ministry synthesis failed strict JSON parsing."
        ) from exc

    if set(synthesis) != {"opinion"}:
        cause = ValueError("The ministry synthesis response has an invalid schema.")
        raise MinistryAgentInvocationError(
            f"{department} agent ministry synthesis validation failed."
        ) from cause
    ministry_opinion = synthesis["opinion"]
    if not isinstance(ministry_opinion, str) or not ministry_opinion.strip():
        cause = ValueError("The ministry opinion is not a non-empty string.")
        raise MinistryAgentInvocationError(
            f"{department} agent ministry synthesis validation failed."
        ) from cause

    return {
        "department": department,
        "bureau_opinions": bureau_opinions,
        "opinion": ministry_opinion.strip(),
    }
