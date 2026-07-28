"""Tests for ``app.langgraph_runtime.deepseek_graph``.

Fully offline. The fake-``chat_model`` injection path never touches
environment variables, config files, or a real ``openai`` client. The
"missing key fails fast" test only asserts that ``build_deepseek_graph()``
itself raises (using the real default config file, real installed
LangGraph, and a real ``deepseek_config``/``deepseek_client`` path) before a
compiled graph is even returned, with no injected chat model and no network
access involved.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from langgraph.graph.state import CompiledStateGraph

from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError
from app.langgraph_runtime.deepseek_graph import (
    DeepSeekGraphInvocationError,
    build_deepseek_graph,
)


def _echo_chat_model(messages: list[dict[str, str]]) -> str:
    return f"echo:{messages[0]['content']}"


def test_production_generic_graph_keeps_default_text_output(monkeypatch):
    calls = []
    fake_config = object()
    monkeypatch.setattr(
        "app.langgraph_runtime.deepseek_graph.load_deepseek_provider_config",
        lambda: fake_config,
    )

    def fake_builder(config, dotenv_path, *, json_output=False):
        calls.append((config, dotenv_path, json_output))
        return lambda _messages: "ok"

    monkeypatch.setattr(
        "app.langgraph_runtime.deepseek_graph.build_deepseek_chat_model",
        fake_builder,
    )

    build_deepseek_graph()

    assert calls == [(fake_config, None, False)]


def _raising_chat_model(messages: list[dict[str, str]]) -> str:
    raise RuntimeError("simulated fake-model failure")


def test_build_deepseek_graph_with_injected_fake_model_returns_compiled_graph():
    graph = build_deepseek_graph(chat_model=_echo_chat_model)
    assert isinstance(graph, CompiledStateGraph)


def test_invoke_with_fake_model_writes_response_text_back_to_state():
    graph = build_deepseek_graph(chat_model=_echo_chat_model)

    result = graph.invoke({"input_text": "hello", "response_text": ""})

    assert result["response_text"] == "echo:hello"
    assert result["input_text"] == "hello"


def test_node_exception_propagates_synchronously_out_of_invoke():
    """Confirms (against the real, installed LangGraph 1.x) that a node
    function's exception is not swallowed: it propagates synchronously to
    the caller of ``.invoke()``, wrapped in ``DeepSeekGraphInvocationError``
    with the original exception preserved as ``__cause__``.
    """
    graph = build_deepseek_graph(chat_model=_raising_chat_model)

    with pytest.raises(DeepSeekGraphInvocationError) as exc_info:
        graph.invoke({"input_text": "hello", "response_text": ""})

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert str(exc_info.value.__cause__) == "simulated fake-model failure"


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    """AC: a missing ``DEEPSEEK_API_KEY`` must fail before any outbound
    request could be attempted -- i.e. at ``build_deepseek_graph()`` time,
    not later at ``.invoke()`` time. No ``chat_model`` is injected here, so
    this exercises the real config-loading + key-resolution path (using the
    real ``backend/config/providers.yaml``) with no network access.

    The autouse ``isolate_deepseek_dotenv_fallback`` fixture in
    ``conftest.py`` points the dotenv fallback's default path at a
    guaranteed-nonexistent file for the duration of this test, so this
    assertion holds regardless of whether the developer's real, private
    ``backend/.env.example`` happens to contain a key.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(DeepSeekApiKeyError):
        build_deepseek_graph()


def test_repeated_invocations_on_same_compiled_graph_do_not_leak_state():
    graph = build_deepseek_graph(chat_model=_echo_chat_model)

    first_result = graph.invoke({"input_text": "first", "response_text": ""})
    second_result = graph.invoke({"input_text": "second", "response_text": ""})

    assert first_result["response_text"] == "echo:first"
    assert second_result["response_text"] == "echo:second"
    assert first_result["response_text"] == "echo:first"


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_full_real_construction_path_wraps_invocation_error_without_leaking_key(
    mock_openai_class, monkeypatch
):
    """Adversarial regression test for the *un-injected* (real) construction
    path: ``build_deepseek_graph()`` with no ``chat_model`` loads the real
    ``backend/config/providers.yaml`` and resolves a real-looking
    ``DEEPSEEK_API_KEY`` from the environment, builds a client (with
    ``openai.OpenAI`` itself patched out so no network call is made), and
    then the underlying SDK call fails.

    This exercises the full chain -- config load -> key resolution -> client
    construction -> graph node -> ``.invoke()`` -- that none of the other
    tests in this module cover in combination (the other error-path tests
    either use an injected fake chat model, or only assert that
    ``build_deepseek_graph()`` itself raises before returning). It asserts
    both that the exception is wrapped with the expected type/cause chain
    *and*, most importantly, that the identifiable fake secret value never
    appears anywhere in the string representation of any exception in the
    chain.
    """
    leaking_marker = "sk-graph-adversarial-should-not-leak-67890"
    monkeypatch.setenv("DEEPSEEK_API_KEY", leaking_marker)

    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    original_error = RuntimeError(f"simulated SDK failure, key={leaking_marker}")
    mock_client_instance.chat.completions.create.side_effect = original_error

    graph = build_deepseek_graph()

    with pytest.raises(DeepSeekGraphInvocationError) as exc_info:
        graph.invoke({"input_text": "hello", "response_text": ""})

    graph_error = exc_info.value
    client_error = graph_error.__cause__
    assert isinstance(client_error, DeepSeekModelInvocationError)
    assert client_error.__cause__ is original_error

    # The real SDK exception (preserved via __cause__) does legitimately
    # contain the leaking marker -- that is expected and is exactly why the
    # wrapper layers must never concatenate str(exc) into their own message.
    assert leaking_marker in str(original_error)

    # Neither wrapper exception's own message may ever contain the secret.
    assert leaking_marker not in str(graph_error)
    assert leaking_marker not in str(client_error)
    mock_openai_class.assert_called_once_with(
        base_url="https://api.deepseek.com/v1", api_key=leaking_marker
    )
