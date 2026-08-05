"""Tests for ``app.langgraph_runtime.deepseek_client``.

Fully offline: the real ``openai.OpenAI`` class is patched out via
``unittest.mock.patch`` so no network request is ever attempted. No real
API key is required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import openai
import pytest

from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    DeepSeekModelNameError,
    build_deepseek_chat_model,
    normalize_deepseek_model_name,
)
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError, DeepSeekProviderConfig

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
def test_build_deepseek_chat_model_defaults_to_text_output(
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
        base_url="https://api.deepseek.com/v1",
        api_key="sk-fake-value-for-tests",
        max_retries=0,
        timeout=60.0,
    )

    result = call_model([{"role": "user", "content": "hi"}])

    assert result == "hello from deepseek"
    mock_client_instance.chat.completions.create.assert_called_once_with(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=2500,
        temperature=0,
    )


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_can_request_json_output(mock_openai_class, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    mock_client_instance.chat.completions.create.return_value = _make_fake_openai_response(
        '{"status":"ok"}'
    )

    call_model = build_deepseek_chat_model(_CONFIG, json_output=True)
    result = call_model([{"role": "user", "content": "return json"}])

    assert result == '{"status":"ok"}'
    mock_client_instance.chat.completions.create.assert_called_once_with(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "return json"}],
        extra_body={"thinking": {"type": "disabled"}},
        max_tokens=2500,
        response_format={"type": "json_object"},
        temperature=0,
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


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_retries_two_transient_timeouts(
    mock_openai_class, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    timeout = openai.APITimeoutError(
        request=httpx.Request("POST", "https://api.deepseek.com/v1/chat/completions")
    )
    mock_client_instance.chat.completions.create.side_effect = [
        timeout,
        timeout,
        _make_fake_openai_response("recovered"),
    ]

    call_model = build_deepseek_chat_model(_CONFIG)

    assert call_model([{"role": "user", "content": "hi"}]) == "recovered"
    assert mock_client_instance.chat.completions.create.call_count == 3


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_falls_back_to_injected_dotenv_path(
    mock_openai_class, monkeypatch, tmp_path
):
    """When the process env var is missing, an injected ``dotenv_path``
    pointing at a temporary file containing the key must be used to
    construct the real (mocked) ``openai.OpenAI`` client.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("DEEPSEEK_API_KEY=sk-from-dotenv-file\n", encoding="utf-8")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance

    build_deepseek_chat_model(_CONFIG, dotenv_path=dotenv_path)

    mock_openai_class.assert_called_once_with(
        base_url="https://api.deepseek.com/v1",
        api_key="sk-from-dotenv-file",
        max_retries=0,
        timeout=60.0,
    )


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_build_deepseek_chat_model_raises_and_never_constructs_client_when_dotenv_path_missing(
    mock_openai_class, monkeypatch, tmp_path
):
    """When the process env var is missing and the injected ``dotenv_path``
    does not exist, resolution must fail before any client is constructed.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    missing_dotenv_path = tmp_path / "does-not-exist" / ".env.example"

    with pytest.raises(DeepSeekApiKeyError):
        build_deepseek_chat_model(_CONFIG, dotenv_path=missing_dotenv_path)

    mock_openai_class.assert_not_called()
