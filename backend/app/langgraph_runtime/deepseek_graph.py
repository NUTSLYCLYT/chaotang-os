"""LangGraph graph factory that calls a real (or injected) DeepSeek chat model.

This graph is independent of the deterministic example in ``graph.py``/
``state.py`` (neither is modified or reused here). It has its own explicit
state type (:class:`DeepSeekGraphState`) with no ``error`` placeholder field:
failures must propagate as exceptions out of ``.invoke()``, never be
silently captured into the returned state.

:func:`build_deepseek_graph` supports dependency injection: callers may pass
a fake ``chat_model`` for fully offline tests. When no ``chat_model`` is
supplied, the factory eagerly loads configuration, validates the
``DEEPSEEK_API_KEY`` environment variable, and constructs the real
``openai`` client *before* returning the compiled graph -- so a missing/
invalid configuration or API key fails fast at graph-build time, before any
outbound request could be attempted from ``.invoke()``.
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config


class DeepSeekGraphState(TypedDict):
    """State for the DeepSeek-backed graph.

    Attributes:
        input_text: Raw text message supplied by the caller.
        response_text: The DeepSeek model's text response, written back by
            the graph's single node. There is intentionally no ``error``
            field: model-call failures propagate as exceptions instead of
            being captured into state.
    """

    input_text: str
    response_text: str


class DeepSeekGraphInvocationError(Exception):
    """Raised by the graph's node when the underlying chat model call fails.

    The original exception is always available via ``__cause__``.
    """


def build_deepseek_graph(chat_model: DeepSeekChatModel | None = None) -> CompiledStateGraph:
    """Build and compile a single-node graph that calls a DeepSeek chat model.

    Args:
        chat_model: Optional fake/compatible chat model callable for offline
            tests. When supplied, this factory never touches environment
            variables, configuration files, or network clients -- only the
            injected callable is used. When omitted, the real DeepSeek
            configuration and environment variable are loaded/validated and
            a real ``openai.OpenAI``-backed client is constructed here, so
            any configuration or missing-key error is raised before this
            function returns (i.e. before ``.invoke()`` could ever be
            called).

    Returns:
        A compiled, callable graph object (``.invoke({"input_text": ...})``).
    """
    resolved_chat_model: DeepSeekChatModel
    if chat_model is not None:
        resolved_chat_model = chat_model
    else:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(config)

    def _call_deepseek_model(state: DeepSeekGraphState) -> dict:
        messages = [{"role": "user", "content": state["input_text"]}]
        try:
            response_text = resolved_chat_model(messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
            raise DeepSeekGraphInvocationError(
                "DeepSeek graph node failed to obtain a model response; "
                "see __cause__ for the original exception."
            ) from exc
        return {"response_text": response_text}

    builder = StateGraph(DeepSeekGraphState)
    builder.add_node("call_deepseek_model", _call_deepseek_model)
    builder.add_edge(START, "call_deepseek_model")
    builder.add_edge("call_deepseek_model", END)
    return builder.compile()
