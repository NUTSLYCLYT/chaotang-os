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

from app.decree_jobs.worker import JobCancelled
from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    DeepSeekModelNameError,
    build_deepseek_chat_model,
    normalize_deepseek_model_name,
)
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError, DeepSeekProviderConfig
from app.langgraph_runtime.provider_budget import ProviderAttemptBudget, ProviderBudgetExceeded

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


def _make_status_error(status_code: int) -> openai.APIStatusError:
    request = httpx.Request("POST", "https://api.deepseek.invalid/v1/chat/completions")
    return openai.APIStatusError(
        "unsafe provider response body marker",
        response=httpx.Response(status_code, request=request),
        body={"unsafe": "provider response body"},
    )


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
def test_build_deepseek_chat_model_retries_one_transient_timeout(
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
        _make_fake_openai_response("recovered"),
    ]

    call_model = build_deepseek_chat_model(_CONFIG)

    assert call_model([{"role": "user", "content": "hi"}]) == "recovered"
    assert mock_client_instance.chat.completions.create.call_count == 2


@pytest.mark.parametrize(
    ("failure", "expected_category", "expected_status"),
    [
        pytest.param("timeout", "timeout", None, id="timeout"),
        pytest.param("connection", "connection", None, id="connection"),
        pytest.param(408, "provider_client", 408, id="http-408"),
        pytest.param(409, "provider_client", 409, id="http-409"),
        pytest.param(429, "rate_limit", 429, id="http-429"),
        pytest.param(500, "provider_server", 500, id="http-500"),
        pytest.param(503, "provider_server", 503, id="http-503"),
    ],
)
@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_transient_failures_retry_once_then_raise_typed_safe_error(
    mock_openai_class, monkeypatch, failure, expected_category, expected_status
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    request = httpx.Request("POST", "https://api.deepseek.invalid/v1/chat/completions")

    def make_failure():
        if failure == "timeout":
            return openai.APITimeoutError(request=request)
        if failure == "connection":
            return openai.APIConnectionError(request=request)
        return _make_status_error(failure)

    first_error = make_failure()
    final_error = make_failure()
    mock_client_instance.chat.completions.create.side_effect = [first_error, final_error]
    call_model = build_deepseek_chat_model(_CONFIG)

    with pytest.raises(DeepSeekModelInvocationError) as exc_info:
        call_model([{"role": "user", "content": "prompt-marker-must-not-leak"}])

    assert exc_info.value.__cause__ is final_error
    assert exc_info.value.failure_stage == "provider_request"
    assert exc_info.value.failure_category == expected_category
    assert exc_info.value.provider_http_status == expected_status
    assert exc_info.value.retry_count == 1
    assert "prompt-marker" not in str(exc_info.value)
    assert "provider response body" not in str(exc_info.value)
    assert mock_client_instance.chat.completions.create.call_count == 2


@pytest.mark.parametrize(
    ("failure", "expected_category", "expected_status"),
    [
        pytest.param(400, "provider_client", 400, id="http-400"),
        pytest.param(401, "provider_client", 401, id="http-401"),
        pytest.param(403, "provider_client", 403, id="http-403"),
        pytest.param(404, "provider_client", 404, id="http-404"),
        pytest.param("unexpected", "unexpected", None, id="unexpected"),
    ],
)
@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_non_transient_failures_do_not_retry(
    mock_openai_class, monkeypatch, failure, expected_category, expected_status
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    provider_error = (
        RuntimeError("unsafe exception marker")
        if failure == "unexpected"
        else _make_status_error(failure)
    )
    mock_client_instance.chat.completions.create.side_effect = provider_error
    call_model = build_deepseek_chat_model(_CONFIG)

    with pytest.raises(DeepSeekModelInvocationError) as exc_info:
        call_model([{"role": "user", "content": "prompt-marker-must-not-leak"}])

    assert exc_info.value.failure_category == expected_category
    assert exc_info.value.provider_http_status == expected_status
    assert exc_info.value.retry_count == 0
    assert mock_client_instance.chat.completions.create.call_count == 1


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_shared_budget_caps_two_clients_before_ninth_network_call(
    mock_openai_class, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    draft_client = MagicMock()
    decree_client = MagicMock()
    draft_client.chat.completions.create.return_value = _make_fake_openai_response("ok")
    decree_client.chat.completions.create.return_value = _make_fake_openai_response("ok")
    mock_openai_class.side_effect = [draft_client, decree_client]
    budget = ProviderAttemptBudget(max_attempts=8)
    draft_model = build_deepseek_chat_model(_CONFIG, attempt_budget=budget)
    decree_model = build_deepseek_chat_model(_CONFIG, attempt_budget=budget)

    for index in range(8):
        model = draft_model if index % 2 == 0 else decree_model
        assert model([{"role": "user", "content": "synthetic"}]) == "ok"

    with pytest.raises(DeepSeekModelInvocationError) as exc_info:
        decree_model([{"role": "user", "content": "synthetic"}])

    assert isinstance(exc_info.value.__cause__, ProviderBudgetExceeded)
    assert exc_info.value.failure_category == "budget_exhausted"
    assert draft_client.chat.completions.create.call_count == 4
    assert decree_client.chat.completions.create.call_count == 4
    assert budget.attempts_used == 8


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_retry_reserves_both_provider_attempts(mock_openai_class, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance
    request = httpx.Request("POST", "https://api.deepseek.invalid/v1/chat/completions")
    mock_client_instance.chat.completions.create.side_effect = [
        openai.APITimeoutError(request=request),
        _make_fake_openai_response("recovered"),
    ]
    budget = ProviderAttemptBudget(max_attempts=2)
    model = build_deepseek_chat_model(_CONFIG, attempt_budget=budget)

    assert model([{"role": "user", "content": "synthetic"}]) == "recovered"
    assert budget.attempts_used == 2
    assert mock_client_instance.chat.completions.create.call_count == 2


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_cooperative_job_abort_crosses_provider_wrapper_unchanged(
    mock_openai_class, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")

    class CancelledBudget:
        def reserve(self) -> None:
            raise JobCancelled

    model = build_deepseek_chat_model(_CONFIG, attempt_budget=CancelledBudget())

    with pytest.raises(JobCancelled):
        model([{"role": "user", "content": "synthetic"}])
    mock_openai_class.return_value.chat.completions.create.assert_not_called()


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
