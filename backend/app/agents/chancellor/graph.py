"""LangGraph graph factory for the dedicated Chancellor (丞相) business agent.

This graph is independent of ``app.langgraph_runtime``: it does not modify or
reuse ``app.langgraph_runtime.graph``/``state.py``, and business code must not
call ``app.langgraph_runtime.deepseek_graph.build_deepseek_graph()`` directly
-- the Chancellor agent is its own dedicated, single-purpose graph with its
own explicit state type (:class:`ChancellorGraphState`) and its own
invocation-error type (:class:`ChancellorGraphInvocationError`).

It is, however, deliberately structurally symmetric with
``build_deepseek_graph`` and reuses (read-only, unmodified) the DeepSeek
configuration/client construction helpers
(:func:`app.langgraph_runtime.deepseek_config.load_deepseek_provider_config`,
:func:`app.langgraph_runtime.deepseek_client.build_deepseek_chat_model`) so
that this module never has to re-implement provider config parsing, API key
resolution, or ``openai.OpenAI`` client construction.

:func:`build_chancellor_graph` supports the same dependency-injection contract
as ``build_deepseek_graph``: callers may pass a fake ``chat_model`` for fully
offline tests. When no ``chat_model`` is supplied, the factory eagerly loads
configuration and validates/resolves the DeepSeek API key (raising a
``DeepSeekConfigError`` subclass immediately if that fails) and constructs the
real ``openai``-backed client *before* returning the compiled graph -- so a
missing/invalid configuration or API key fails fast at graph-build time,
before any outbound request could be attempted from ``.invoke()``.

Routing + single-department topology (this module, delivered by module 1)
---------------------------------------------------------------------------
``START -> decide_route -> (conditional edge on route_type) -> {"single":
handle_single_ministry} -> END``.

``decide_route`` asks the Chancellor model to classify the decree as
``"single"`` (exactly one ministry) or ``"multi"`` (at least two ministries,
to be escalated to 军机处/junjichu), under the strict JSON contract described
in ``chancellor/prompts.py``. Every way that response can fail the contract
(invalid JSON, invalid ``route_type``, unknown/duplicate department, wrong
department count for the chosen route type, empty ``rationale``) fails
closed into the existing :class:`ChancellorGraphInvocationError` -- no new
exception type is introduced for these validation failures.

``handle_single_ministry`` is reached only when ``route_type == "single"``;
it calls the single department chosen by the Chancellor via
``app.agents.ministries.agent.invoke_ministry_agent`` (shared, stable
signature -- module 2's 军机处 orchestration will call the very same
function, once per department, from its own node) and writes that
department's opinion into ``ministry_opinions``/``final_verdict``.

Multi-department topology (this module's other branch, delivered by module 2)
-------------------------------------------------------------------------------
``START -> decide_route -> (conditional edge on route_type) -> {"single":
handle_single_ministry, "multi": run_junjichu_council} -> END``.

``_route_condition`` returns ``state["route_type"]`` verbatim (i.e. either
``"single"`` or ``"multi"``); the ``"multi"`` branch is handled by the
``run_junjichu_council`` node, which is reached only when
``route_type == "multi"``. It calls
``app.agents.junjichu.agent.run_junjichu_council`` -- which, in a plain
Python ``for`` loop (never concurrently, never via a LangGraph ``Send``/
fan-out), invokes ``app.agents.ministries.agent.invoke_ministry_agent`` once
per department in ``state["departments"]`` order, then invokes 军机处's own
model turn for the final council verdict -- and merges the result into
``processing_path`` (appending ``"军机处"`` followed by every consulted
department, in order), ``ministry_opinions``, and ``final_verdict``. This
node does not touch, and was not required to touch,
``_decide_route``/``_handle_single_ministry``/the ``"single"`` edge to be
added.
"""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor.prompts import CHANCELLOR_SYSTEM_PROMPT
from app.agents.junjichu.agent import run_junjichu_council
from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import MINISTRIES
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config


class ChancellorGraphState(TypedDict, total=False):
    """State for the dedicated Chancellor (丞相) routing graph.

    Attributes:
        decree_text: The decree (旨意) text supplied by the caller. Required
            as part of the initial ``.invoke()`` input.
        chancellor_rationale: The Chancellor's non-empty routing judgement/
            explanation, written by ``decide_route``.
        route_type: ``"single"`` or ``"multi"``, written by ``decide_route``.
        departments: The department(s) the Chancellor selected -- exactly 1
            element for ``"single"``, at least 2 (no duplicates) for
            ``"multi"``. Every element is one of ``MINISTRIES``.
        processing_path: Ordered list of the stages this decree has passed
            through so far (e.g. ``["上书房", "丞相", "户部"]`` for a
            single-department decree). Started by ``decide_route`` as
            ``["上书房", "丞相"]`` and extended by the branch node(s).
        ministry_opinions: Each consulted department's opinion, as
            ``{"department": ..., "opinion": ...}`` dicts, in call order.
        final_verdict: The final, non-empty conclusion for this decree (for
            ``"single"`` routing, this is simply the one department's
            opinion; for ``"multi"`` routing it will be 军机处's council
            verdict, set by module 2's node).

    There is intentionally no ``error`` field: model-call and validation
    failures propagate as exceptions (``ChancellorGraphInvocationError``)
    instead of being captured into state.
    """

    decree_text: str
    chancellor_rationale: str
    route_type: str
    departments: list[str]
    processing_path: list[str]
    ministry_opinions: list[dict[str, str]]
    final_verdict: str


class ChancellorGraphInvocationError(Exception):
    """Raised by the graph's nodes when routing or ministry invocation fails.

    This is the single, existing exception type every failure-closed
    validation/invocation error in this graph maps to -- the Chancellor's
    routing JSON contract violations, and single-ministry invocation
    failures (wrapped from
    ``app.agents.ministries.agent.MinistryAgentInvocationError``) alike. No
    new exception type is introduced for any of these cases.

    The original exception (when applicable) is always available via
    ``__cause__``. This exception's own message never concatenates
    ``str(exc)`` from the original failure, nor echoes raw model output, so
    it cannot leak a secret or arbitrary model output that may appear in a
    third-party SDK error message or a malformed model response.
    """


def build_chancellor_graph(
    chat_model: DeepSeekChatModel | None = None, dotenv_path: Path | None = None
) -> CompiledStateGraph:
    """Build and compile the Chancellor (丞相) routing + single-ministry graph.

    Args:
        chat_model: Optional fake/compatible chat model callable for offline
            tests. When supplied, this factory never touches environment
            variables, configuration files, or network clients -- only the
            injected callable is used (for both the Chancellor's own routing
            call and every ministry's call). When omitted, the real DeepSeek
            configuration and environment variable are loaded/validated and
            a real ``openai.OpenAI``-backed client is constructed here (via
            the read-only, reused ``load_deepseek_provider_config`` and
            ``build_deepseek_chat_model`` helpers), so any configuration or
            missing-key error is raised before this function returns (i.e.
            before ``.invoke()`` could ever be called).
        dotenv_path: Optional override path to a dotenv file, forwarded
            unchanged to :func:`build_deepseek_chat_model` and used only as
            a fallback when the process environment variable is unset/empty.
            Ignored when ``chat_model`` is supplied.

    Returns:
        A compiled, callable graph object
        (``.invoke({"decree_text": "..."})``).

    Raises:
        DeepSeekConfigError: (or a subclass, e.g. ``DeepSeekApiKeyError``)
            propagated from configuration loading/key resolution when
            ``chat_model`` is not supplied.
    """
    resolved_chat_model: DeepSeekChatModel
    if chat_model is not None:
        resolved_chat_model = chat_model
    else:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(config, dotenv_path)

    def _decide_route(state: ChancellorGraphState) -> dict:
        messages = [
            {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT},
            {"role": "user", "content": state["decree_text"]},
        ]
        try:
            raw_response = resolved_chat_model(messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
            raise ChancellorGraphInvocationError(
                "Chancellor graph node failed to obtain a model response; "
                "see __cause__ for the original exception."
            ) from exc

        if not isinstance(raw_response, str) or not raw_response.strip():
            raise ChancellorGraphInvocationError(
                "Chancellor graph node returned an empty model response."
            )

        try:
            parsed = parse_strict_json_object(raw_response)
        except StructuredOutputError as exc:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response failed strict JSON parsing."
            ) from exc

        route_type = parsed.get("route_type")
        if route_type not in ("single", "multi"):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response has an invalid 'route_type'."
            )

        rationale = parsed.get("rationale")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response is missing a non-empty 'rationale'."
            )

        departments = parsed.get("departments")
        if not isinstance(departments, list) or not departments or not all(
            isinstance(department, str) for department in departments
        ):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response has an invalid 'departments' list."
            )
        if len(set(departments)) != len(departments):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response contains duplicate departments."
            )
        if not all(department in MINISTRIES for department in departments):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response contains an unknown department."
            )
        if route_type == "single" and len(departments) != 1:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response must select exactly 1 department "
                "for 'single' routing."
            )
        if route_type == "multi" and len(departments) < 2:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response must select at least 2 departments "
                "for 'multi' routing."
            )

        return {
            "chancellor_rationale": rationale.strip(),
            "route_type": route_type,
            "departments": departments,
            "processing_path": ["上书房", "丞相"],
        }

    def _route_condition(state: ChancellorGraphState) -> str:
        return state["route_type"]

    def _handle_single_ministry(state: ChancellorGraphState) -> dict:
        department = state["departments"][0]
        try:
            opinion = invoke_ministry_agent(
                department,
                state["decree_text"],
                state["chancellor_rationale"],
                resolved_chat_model,
            )
        except MinistryAgentInvocationError as exc:
            raise ChancellorGraphInvocationError(
                f"Chancellor graph node failed to obtain a {department} ministry "
                "response; see __cause__ for the original exception."
            ) from exc

        return {
            "processing_path": [*state["processing_path"], department],
            "ministry_opinions": [{"department": department, "opinion": opinion}],
            "final_verdict": opinion,
        }

    def _run_junjichu_council(state: ChancellorGraphState) -> dict:
        departments = state["departments"]
        try:
            ministry_opinions, verdict = run_junjichu_council(
                state["decree_text"],
                state["chancellor_rationale"],
                departments,
                resolved_chat_model,
            )
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model/validation error
            raise ChancellorGraphInvocationError(
                "Chancellor graph node failed to complete the 军机处 multi-department "
                "council review; see __cause__ for the original exception."
            ) from exc

        return {
            "processing_path": [*state["processing_path"], "军机处", *departments],
            "ministry_opinions": ministry_opinions,
            "final_verdict": verdict,
        }

    builder = StateGraph(ChancellorGraphState)
    builder.add_node("decide_route", _decide_route)
    builder.add_node("handle_single_ministry", _handle_single_ministry)
    builder.add_node("run_junjichu_council", _run_junjichu_council)
    builder.add_edge(START, "decide_route")
    builder.add_conditional_edges(
        "decide_route",
        _route_condition,
        {
            "single": "handle_single_ministry",
            "multi": "run_junjichu_council",
        },
    )
    builder.add_edge("handle_single_ministry", END)
    builder.add_edge("run_junjichu_council", END)
    return builder.compile()
