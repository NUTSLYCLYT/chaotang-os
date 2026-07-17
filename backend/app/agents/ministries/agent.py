"""Single-ministry (六部) agent invocation helper.

:func:`invoke_ministry_agent` is the one place that calls a single
department's chat model turn and parses/validates its strict JSON opinion
contract (``{"opinion": "<non-empty opinion text>"}``). Its signature is
deliberately stable because it is shared by two callers: the Chancellor
graph's single-department branch (``app.agents.chancellor.graph``, module 1)
and the 军机处/junjichu multi-department council orchestration
(module 2), which will call it once per department, in a fixed order, inside
a plain Python ``for`` loop.

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

from app.agents.ministries.prompts import ministry_system_prompt
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel


class MinistryAgentInvocationError(Exception):
    """Raised when invoking a single ministry (六部) agent fails.

    Covers: the underlying chat model call raising, the model returning a
    non-string or empty response, the response failing strict-JSON parsing,
    the parsed JSON missing (or mistyping) the required ``opinion`` key, or
    ``opinion`` being empty/whitespace-only after stripping.

    The original exception (when applicable) is always preserved via
    ``raise ... from exc`` (available as ``__cause__``), but this
    exception's own message never echoes the raw model output or the
    underlying exception's ``str()`` -- callers are expected to catch this
    exception and re-raise their own sanitized, package-specific exception
    (e.g. ``app.agents.chancellor.graph.ChancellorGraphInvocationError``)
    without risking an information leak from arbitrary model output.
    """


def invoke_ministry_agent(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
) -> str:
    """Invoke ``department``'s single-ministry agent and return its opinion.

    Args:
        department: One of the six fixed ``app.agents.ministries.MINISTRIES``
            names.
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale, given to the
            department as context for why this matter was routed to it.
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests).

    Returns:
        The department's non-empty, stripped opinion text.

    Raises:
        ValueError: ``department`` is not one of the fixed six ministries
            (propagated, unwrapped, from
            ``app.agents.ministries.prompts.ministry_system_prompt`` -- this
            indicates a caller bug, e.g. an unvalidated department slipping
            through, not a model failure).
        MinistryAgentInvocationError: the model call failed, or its response
            did not satisfy the strict ``{"opinion": "<non-empty text>"}``
            JSON contract.
    """
    system_prompt = ministry_system_prompt(department)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"旨意：{decree_text}\n\n丞相判断说明：{rationale}",
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

    opinion = parsed.get("opinion")
    if not isinstance(opinion, str) or not opinion.strip():
        raise MinistryAgentInvocationError(
            f"{department} agent response JSON is missing a non-empty 'opinion' string."
        )
    return opinion.strip()
