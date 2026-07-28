"""LangGraph graph factory for the dedicated Chancellor consultation
(丞相非业务咨询) agent.

This module is completely independent from the decree/evidence business flow
described by ADR 0028 and implemented in ``app.agents.chancellor``,
``app.agents.ministries``, ``app.agents.junjichu``, ``app.agents.bureaus``,
``app.agents.evidence_protocol``, ``app.jinyiwei``, ``app.shiguan`` and
``app.junjichu_cases``: it never imports any of those modules, directly or
indirectly. It only reuses the lowest-level, read-only DeepSeek configuration/
client construction helpers
(:func:`app.langgraph_runtime.deepseek_config.load_deepseek_provider_config`,
:func:`app.langgraph_runtime.deepseek_client.build_deepseek_chat_model`), the
same helpers ``app.agents.chancellor.graph`` reuses, so this module never has
to re-implement provider config parsing, API key resolution, or
``openai.OpenAI`` client construction.

Topology
--------
``START -> consult -> END``. Every ``.invoke()`` call performs *exactly one*
DeepSeek chat completion call: the ``consult`` node prepends
:data:`app.agents.chancellor_consult.prompts.CHANCELLOR_CONSULT_SYSTEM_PROMPT`
to the caller-supplied, already-validated message history and calls the
resolved chat model once. There is no routing to a ministry, a bureau, 军机处
or 锦衣卫, and nothing is persisted anywhere in this module -- the graph is
stateless across ``.invoke()`` calls and the caller (the HTTP layer) owns the
entire message history for the current request.

:func:`build_chancellor_consult_graph` supports the same dependency-injection
contract as ``build_chancellor_graph``/``build_deepseek_graph``: callers may
pass a fake ``chat_model`` for fully offline tests. When no ``chat_model`` is
supplied, the factory eagerly loads configuration and validates/resolves the
DeepSeek API key (raising a ``DeepSeekConfigError``/``DeepSeekModelNameError``
immediately if that fails) and constructs the real ``openai``-backed client
*before* returning the compiled graph -- so a missing/invalid configuration or
API key fails fast at graph-build time, before any outbound request could be
attempted from ``.invoke()``.
"""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor_consult.prompts import CHANCELLOR_CONSULT_SYSTEM_PROMPT
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config


class ChancellorConsultGraphState(TypedDict, total=False):
    """State for the dedicated Chancellor consultation graph.

    Attributes:
        messages: The caller-supplied, already-validated ordered chat
            history (role strictly alternating, starting and ending with
            ``"user"``), each item shaped ``{"role": "user" | "assistant",
            "content": str}``. The system prompt is *not* part of this list
            -- it is prepended internally by the ``consult`` node.
        reply: The Chancellor consultant's non-empty reply text, written by
            the ``consult`` node.

    There is intentionally no ``error`` field: model-call failures propagate
    as exceptions (:class:`ChancellorConsultGraphInvocationError`) instead of
    being captured into state, mirroring
    ``app.agents.chancellor.graph.ChancellorGraphState``.
    """

    messages: list[dict[str, str]]
    reply: str


class ChancellorConsultGraphInvocationError(Exception):
    """Raised when the consultation graph's single model call fails, or
    returns no usable text.

    This exception's own message never concatenates ``str(exc)`` from the
    original failure, nor echoes raw model output, so it cannot leak a
    secret or arbitrary model output that may appear in a third-party SDK
    error message or a malformed model response. The original exception
    (when applicable) is always available via ``__cause__``.
    """


def build_chancellor_consult_graph(
    chat_model: DeepSeekChatModel | None = None,
    dotenv_path: Path | None = None,
) -> CompiledStateGraph:
    """Build and compile the single-turn Chancellor consultation graph.

    Args:
        chat_model: Optional fake/compatible chat model callable for offline
            tests. When supplied, this factory never touches environment
            variables, configuration files, or network clients.
        dotenv_path: Optional override path to a dotenv file, forwarded
            unchanged to :func:`build_deepseek_chat_model` and used only as
            a fallback when the process environment variable is unset/empty.
            Ignored when ``chat_model`` is supplied.

    Returns:
        A compiled, callable graph object
        (``.invoke({"messages": [...]})``).

    Raises:
        DeepSeekConfigError: (or a subclass) propagated from configuration
            loading/key resolution when ``chat_model`` is not supplied.
        DeepSeekModelNameError: propagated from model name normalization
            when ``chat_model`` is not supplied.
    """
    resolved_chat_model: DeepSeekChatModel
    if chat_model is not None:
        resolved_chat_model = chat_model
    else:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(config, dotenv_path)

    def _consult(state: ChancellorConsultGraphState) -> dict:
        messages = [
            {"role": "system", "content": CHANCELLOR_CONSULT_SYSTEM_PROMPT},
            *state["messages"],
        ]
        try:
            raw_response = resolved_chat_model(messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
            raise ChancellorConsultGraphInvocationError(
                "Chancellor consultation graph failed to obtain a model "
                "response; see __cause__ for the original exception."
            ) from exc

        if not isinstance(raw_response, str) or not raw_response.strip():
            raise ChancellorConsultGraphInvocationError(
                "Chancellor consultation graph returned an empty model response."
            )

        return {"reply": raw_response.strip()}

    builder = StateGraph(ChancellorConsultGraphState)
    builder.add_node("consult", _consult)
    builder.add_edge(START, "consult")
    builder.add_edge("consult", END)
    return builder.compile()
