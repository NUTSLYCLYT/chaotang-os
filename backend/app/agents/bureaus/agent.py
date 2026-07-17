"""Generic invocation helper shared by all 39 bureau-level agents."""

from __future__ import annotations

from app.agents.bureaus.prompts import bureau_system_prompt
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel


class BureauAgentInvocationError(Exception):
    """A sanitized, fail-closed bureau invocation failure."""


def invoke_bureau_agent(
    department: str,
    bureau: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
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
    try:
        raw_response = chat_model(messages)
    except Exception as exc:  # noqa: BLE001 - model boundary must fail closed
        raise BureauAgentInvocationError("Bureau model invocation failed.") from exc

    if not isinstance(raw_response, str) or not raw_response.strip():
        cause = ValueError("The bureau model returned no usable text.")
        raise BureauAgentInvocationError("Bureau response validation failed.") from cause

    try:
        parsed = parse_strict_json_object(raw_response)
    except StructuredOutputError as exc:
        raise BureauAgentInvocationError("Bureau response parsing failed.") from exc

    if set(parsed) != {"opinion"}:
        cause = ValueError("The bureau response has an invalid schema.")
        raise BureauAgentInvocationError("Bureau response validation failed.") from cause
    opinion = parsed["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        cause = ValueError("The bureau opinion is not a non-empty string.")
        raise BureauAgentInvocationError("Bureau response validation failed.") from cause
    return opinion.strip()
