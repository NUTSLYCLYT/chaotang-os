"""Offline contract checks for durable DeepSeek task-token accounting."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.fusion.task_token_budget import TaskTokenBudget
from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    build_deepseek_chat_model,
)
from app.langgraph_runtime.deepseek_config import DeepSeekProviderConfig
from app.langgraph_runtime.provider_budget import use_task_token_budget

CONFIG = DeepSeekProviderConfig(
    base_url="https://api.deepseek.com/v1",
    api_key_env="DEEPSEEK_API_KEY",
    default_model="openai/deepseek-chat",
    models=("openai/deepseek-chat",),
)


def _response(text: str, *, input_tokens: int | None, output_tokens: int | None):
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = text
    response.usage = (
        None
        if input_tokens is None or output_tokens is None
        else SimpleNamespace(prompt_tokens=input_tokens, completion_tokens=output_tokens)
    )
    return response


def _model(client, monkeypatch, *, attempts: int = 1):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-offline-test")
    return build_deepseek_chat_model(CONFIG, max_provider_attempts=attempts)


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_provider_usage_settles_the_same_durable_task_budget(mock_openai, monkeypatch, tmp_path):
    client = MagicMock()
    client.chat.completions.create.return_value = _response(
        "ok", input_tokens=12, output_tokens=7
    )
    mock_openai.return_value = client
    model = _model(client, monkeypatch)
    ledger = TaskTokenBudget(tmp_path / "budget.sqlite3", owner_id="owner", task_id="job")

    with use_task_token_budget(ledger):
        assert model([{"role": "user", "content": "short"}]) == "ok"

    snapshot = ledger.snapshot()
    assert snapshot.charged_tokens == 19
    assert snapshot.reserved_tokens == 0
    assert snapshot.blocked_reason is None
    client.chat.completions.create.assert_called_once()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_task_budget_adapts_output_cap_before_reserving(mock_openai, monkeypatch, tmp_path):
    client = MagicMock()
    client.chat.completions.create.return_value = _response(
        "ok", input_tokens=12, output_tokens=7
    )
    mock_openai.return_value = client
    model = _model(client, monkeypatch)
    ledger = TaskTokenBudget(
        tmp_path / "budget.sqlite3", owner_id="owner", task_id="job", max_tokens=1000
    )

    with use_task_token_budget(ledger):
        assert model([{"role": "user", "content": "short"}]) == "ok"

    request = client.chat.completions.create.call_args.kwargs
    assert 256 <= request["max_tokens"] < 2500
    assert ledger.snapshot().charged_tokens == 19


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_missing_usage_keeps_a_hold_and_blocks_a_second_send_when_cap_is_full(
    mock_openai, monkeypatch, tmp_path
):
    client = MagicMock()
    client.chat.completions.create.return_value = _response(
        "unknown", input_tokens=None, output_tokens=None
    )
    mock_openai.return_value = client
    model = _model(client, monkeypatch)
    ledger = TaskTokenBudget(
        # 43 conservative input tokens + the 2,500-token output reservation
        # leave no room for another send once the first usage receipt is
        # unknown and the hold is retained.
        tmp_path / "budget.sqlite3", owner_id="owner", task_id="job", max_tokens=2600
    )
    messages = [{"role": "user", "content": "short"}]

    with use_task_token_budget(ledger):
        assert model(messages) == "unknown"
        with pytest.raises(DeepSeekModelInvocationError) as error:
            model(messages)

    assert error.value.failure_category == "budget_exhausted"
    assert client.chat.completions.create.call_count == 1
    assert ledger.snapshot().reserved_tokens > 0


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_provider_failure_marks_usage_unknown_instead_of_refunding(
    mock_openai, monkeypatch, tmp_path
):
    client = MagicMock()
    client.chat.completions.create.side_effect = RuntimeError("offline transport")
    mock_openai.return_value = client
    model = _model(client, monkeypatch)
    ledger = TaskTokenBudget(tmp_path / "budget.sqlite3", owner_id="owner", task_id="job")

    with use_task_token_budget(ledger), pytest.raises(DeepSeekModelInvocationError):
        model([{"role": "user", "content": "short"}])

    snapshot = ledger.snapshot()
    assert snapshot.reserved_tokens > 0
    assert snapshot.charged_tokens == 0


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_provider_usage_overrun_blocks_budget_after_persisting_violation(
    mock_openai, monkeypatch, tmp_path
):
    client = MagicMock()
    client.chat.completions.create.return_value = _response(
        "too much", input_tokens=12, output_tokens=3000
    )
    mock_openai.return_value = client
    model = _model(client, monkeypatch)
    ledger = TaskTokenBudget(tmp_path / "budget.sqlite3", owner_id="owner", task_id="job")

    with use_task_token_budget(ledger), pytest.raises(DeepSeekModelInvocationError) as error:
        model([{"role": "user", "content": "short"}])

    assert error.value.failure_category == "budget_exhausted"
    snapshot = ledger.snapshot()
    assert snapshot.blocked_reason == "provider_usage_exceeded_reservation"
    assert snapshot.charged_tokens == 3012
