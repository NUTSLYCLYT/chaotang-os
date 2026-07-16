"""Tests for ``app.langgraph_runtime.deepseek_client``.

Fully offline: the real ``openai.OpenAI`` class is patched out via
``unittest.mock.patch`` so no network request is ever attempted. No real
API key is required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    DeepSeekModelNameError,
    build_deepseek_chat_model,
    normalize_deepseek_model_name,
)
from app.langgraph_runtime.deepseek_config import DeepSeekProviderConfig

_CONFIG = DeepSeekProviderConfig(
    base_url="https://api.deepseek.com/v1",
    api_key_env="DEEPSEEK_API_KEY",
    default_model="openai/deepseek-chat",
    models=("openai/deepseek-chat", "openai/deepseek-reasoner"),
)


def test_normalize_deepseek_model_name_strips_expected_prefix():
    assert normalize_deepseek_model_name("openai/deepseek-chat") == "deepseek-chat"
    assert normalize_deepseek_model_name("openai/deepseek-reasoner") == "deepseek-reasoner"


def test_normalize_deepseek_model_name_without_prefix_raises():
    with pytest.raises(DeepSeekModelNameError):
        normalize_deepseek_model_name("deepseek-chat")


def _make_fake_openai_response(content: str) -> MagicMock:
    fake_response = MagicMock()
    fake_response.choices = [MagicMock()]
    fake_response.choices[0].message.content = content
    return fake_response


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_constructs_client_with_expected_arguments(
    mock_openai_class, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    mock_client_instance.chat.completions.create.return_value = _make_fake_openai_response(
        "hello from deepseek"
    )

    call_model = build_deepseek_chat_model(_CONFIG)

    mock_openai_class.assert_called_once_with(
        base_url="https://api.deepseek.com/v1", api_key="sk-fake-value-for-tests"
    )

    result = call_model([{"role": "user", "content": "hi"}])

    assert result == "hello from deepseek"
    mock_client_instance.chat.completions.create.assert_called_once_with(
        model="deepseek-chat", messages=[{"role": "user", "content": "hi"}]
    )


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_wraps_underlying_exceptions(mock_openai_class, monkeypatch):
    leaking_marker = "sk-client-adversarial-should-not-leak-24680"
    monkeypatch.setenv("DEEPSEEK_API_KEY", leaking_marker)
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    # The simulated SDK error text itself embeds the key, to prove the
    # wrapper does not blindly concatenate str(exc) into its own message.
    original_error = RuntimeError(f"simulated SDK failure, key={leaking_marker}")
    mock_client_instance.chat.completions.create.side_effect = original_error

    call_model = build_deepseek_chat_model(_CONFIG)

    with pytest.raises(DeepSeekModelInvocationError) as exc_info:
        call_model([{"role": "user", "content": "hi"}])

    assert exc_info.value.__cause__ is original_error
    assert "deepseek-chat" in str(exc_info.value)
    assert leaking_marker not in str(exc_info.value)
    # Sanity check the marker really was present in the underlying cause,
    # so the assertion above is testing something real.
    assert leaking_marker in str(exc_info.value.__cause__)
