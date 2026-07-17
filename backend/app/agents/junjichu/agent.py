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
collecting each department's opinion in call order, and only once every
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

from app.agents.junjichu.prompts import junjichu_system_prompt
from app.agents.ministries.agent import invoke_ministry_agent
from app.agents.structured_output import parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel


def _format_ministry_opinions(ministry_opinions: list[dict[str, str]]) -> str:
    return "\n".join(
        f"{item['department']}：{item['opinion']}" for item in ministry_opinions
    )


def invoke_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    ministry_opinions: list[dict[str, str]],
    chat_model: DeepSeekChatModel,
) -> str:
    """Invoke 军机处's own council-verdict model turn and return the verdict.

    Args:
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale.
        departments: The ordered list of departments consulted (used to
            build 军机处's system prompt).
        ministry_opinions: Every consulted department's already-collected
            opinion, as ``{"department": ..., "opinion": ...}`` dicts, in
            call order.
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
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n"
                f"各部门意见：\n{opinions_text}"
            ),
        },
    ]

    raw_response = chat_model(messages)
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise ValueError("军机处 agent returned an empty model response.")

    parsed = parse_strict_json_object(raw_response)

    verdict = parsed.get("verdict")
    if not isinstance(verdict, str) or not verdict.strip():
        raise ValueError(
            "军机处 agent response JSON is missing a non-empty 'verdict' string."
        )
    return verdict.strip()


def run_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
) -> tuple[list[dict[str, str]], str]:
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
        every consulted department's opinion, as
        ``{"department": ..., "opinion": ...}`` dicts, in call order;
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
    ministry_opinions: list[dict[str, str]] = []
    for department in departments:
        opinion = invoke_ministry_agent(department, decree_text, rationale, chat_model)
        ministry_opinions.append({"department": department, "opinion": opinion})

    verdict = invoke_junjichu_council(
        decree_text, rationale, departments, ministry_opinions, chat_model
    )
    return ministry_opinions, verdict
