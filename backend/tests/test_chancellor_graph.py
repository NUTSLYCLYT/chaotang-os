"""Tests for ``app.agents.chancellor.graph``.

Fully offline. The fake-``chat_model`` injection path never touches
environment variables, config files, or a real ``openai`` client. The
"missing key fails fast" test only asserts that ``build_chancellor_graph()``
itself raises (using the real default config file, real installed
LangGraph, and a real ``deepseek_config``/``deepseek_client`` path) before a
compiled graph is even returned, with no injected chat model and no network
access involved. No test in this module reads ``backend/.env.example``: the
autouse ``isolate_deepseek_dotenv_fallback`` fixture in ``conftest.py``
points the dotenv fallback's default path at a guaranteed-nonexistent file
for the duration of every test in this suite.
"""

from __future__ import annotations

import pytest
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import CHANCELLOR_SYSTEM_PROMPT
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError


def _echo_chat_model(messages: list[dict[str, str]]) -> str:
    return f"memorial:{messages[-1]['content']}"


def _raising_chat_model(messages: list[dict[str, str]]) -> str:
    raise RuntimeError("simulated fake-model failure")


def test_build_chancellor_graph_with_injected_fake_model_returns_compiled_graph():
    graph = build_chancellor_graph(chat_model=_echo_chat_model)
    assert isinstance(graph, CompiledStateGraph)


def test_invoke_with_fake_model_sends_system_and_user_messages_and_writes_memorial():
    captured_messages: list[dict[str, str]] = []

    def _capturing_chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return "臣已知晓旨意，建议如下。"

    graph = build_chancellor_graph(chat_model=_capturing_chat_model)

    result = graph.invoke({"decree_text": "整顿吏治", "memorial_text": ""})

    assert captured_messages[0] == {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT}
    assert captured_messages[1] == {"role": "user", "content": "整顿吏治"}
    assert result["memorial_text"] == "臣已知晓旨意，建议如下。"
    assert result["memorial_text"]
    assert result["decree_text"] == "整顿吏治"


def test_node_exception_propagates_wrapped_with_cause_preserved():
    graph = build_chancellor_graph(chat_model=_raising_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意", "memorial_text": ""})

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert str(exc_info.value.__cause__) == "simulated fake-model failure"


@pytest.mark.parametrize("empty_response", ["", "   "])
def test_empty_model_response_is_rejected(empty_response):
    graph = build_chancellor_graph(chat_model=lambda _messages: empty_response)

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意", "memorial_text": ""})


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    """AC: a missing ``DEEPSEEK_API_KEY`` must fail before any outbound
    request could be attempted -- i.e. at ``build_chancellor_graph()`` time,
    not later at ``.invoke()`` time. No ``chat_model`` is injected here, so
    this exercises the real config-loading + key-resolution path (using the
    real ``backend/config/providers.yaml``) with no network access.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(DeepSeekApiKeyError):
        build_chancellor_graph()


def test_wrapped_invocation_error_does_not_leak_secret_from_original_exception():
    """Regression guard: even if the underlying model raises an exception
    whose message happens to contain a secret-looking string, the wrapper
    exception's own ``str()`` must never echo it verbatim.
    """
    leaking_marker = "sk-chancellor-adversarial-should-not-leak-13579"

    def _leaking_chat_model(messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    graph = build_chancellor_graph(chat_model=_leaking_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意", "memorial_text": ""})

    assert leaking_marker in str(exc_info.value.__cause__)
    assert leaking_marker not in str(exc_info.value)
