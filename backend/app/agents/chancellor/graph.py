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
"""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor.prompts import CHANCELLOR_SYSTEM_PROMPT
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config


class ChancellorGraphState(TypedDict):
    """State for the dedicated Chancellor (丞相) graph.

    Attributes:
        decree_text: The decree (旨意) text supplied by the caller.
        memorial_text: The Chancellor's memorial (回奏) response, written
            back by the graph's single node. There is intentionally no
            ``error`` field: model-call failures propagate as exceptions
            instead of being captured into state.
    """

    decree_text: str
    memorial_text: str


class ChancellorGraphInvocationError(Exception):
    """Raised by the graph's node when the underlying chat model call fails.

    The original exception is always available via ``__cause__``. This
    exception's own message never concatenates ``str(exc)`` from the
    original failure, so it cannot leak secrets that may appear in a
    third-party SDK error message.
    """


def build_chancellor_graph(
    chat_model: DeepSeekChatModel | None = None, dotenv_path: Path | None = None
) -> CompiledStateGraph:
    """Build and compile the single-node Chancellor (丞相) agent graph.

    Args:
        chat_model: Optional fake/compatible chat model callable for offline
            tests. When supplied, this factory never touches environment
            variables, configuration files, or network clients -- only the
            injected callable is used. When omitted, the real DeepSeek
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
        (``.invoke({"decree_text": ..., "memorial_text": ""})``).

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

    def _call_chancellor_model(state: ChancellorGraphState) -> dict:
        messages = [
            {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT},
            {"role": "user", "content": state["decree_text"]},
        ]
        try:
            memorial_text = resolved_chat_model(messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
            raise ChancellorGraphInvocationError(
                "Chancellor graph node failed to obtain a model response; "
                "see __cause__ for the original exception."
            ) from exc
        if not isinstance(memorial_text, str) or not memorial_text.strip():
            raise ChancellorGraphInvocationError(
                "Chancellor graph node returned an empty model response."
            )
        return {"memorial_text": memorial_text.strip()}

    builder = StateGraph(ChancellorGraphState)
    builder.add_node("call_chancellor_model", _call_chancellor_model)
    builder.add_edge(START, "call_chancellor_model")
    builder.add_edge("call_chancellor_model", END)
    return builder.compile()
