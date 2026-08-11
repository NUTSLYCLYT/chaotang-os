"""DeepSeek chat model adapter: model-name normalization + production client.

DeepSeek's OpenAI-compatible endpoint expects bare model names (e.g.
``"deepseek-chat"``), while ``backend/config/providers.yaml`` intentionally
keeps the original ``openai/``-prefixed names from ``dev`` (see
``deepseek_config.py``). Prefix normalization therefore happens only here,
at the very last step before calling the SDK, as a small, independently
testable pure function.

The resolved API key only ever lives in a local variable inside
:func:`build_deepseek_chat_model`; it is handed directly to
``openai.OpenAI(...)`` and is never stored on any object this module
constructs, returns, logs, or raises.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Literal

import openai

from app.langgraph_runtime.deepseek_config import DeepSeekProviderConfig
from app.langgraph_runtime.deepseek_env import resolve_deepseek_api_key_with_dotenv_fallback
from app.langgraph_runtime.provider_budget import (
    ProviderAttemptBudget,
    ProviderBudgetExceeded,
)

_MODEL_NAME_PREFIX = "openai/"
_REQUEST_TIMEOUT_SECONDS = 60.0

# A DeepSeek chat model is any callable that takes an OpenAI-style list of
# ``{"role": ..., "content": ...}`` messages and returns the assistant's
# response text.
DeepSeekChatModel = Callable[[list[dict[str, str]]], str]
FailureCategory = Literal[
    "timeout",
    "connection",
    "rate_limit",
    "provider_server",
    "provider_client",
    "budget_exhausted",
    "unexpected",
]


class DeepSeekModelNameError(Exception):
    """Raised when a configured model name does not have the expected prefix."""


class DeepSeekModelInvocationError(Exception):
    """Raised when a DeepSeek chat completion request fails.

    The original exception is always preserved via ``raise ... from exc``
    (available as ``__cause__``) for local debugging, but this exception's
    own message intentionally does not concatenate ``str(exc)`` verbatim:
    third-party SDK error text can echo request content, and we do not want
    to assume it is always safe to surface directly.
    """

    failure_stage: Literal["provider_request"]
    failure_category: FailureCategory
    provider_http_status: int | None
    retry_count: int

    def __init__(
        self,
        message: str,
        *,
        failure_category: FailureCategory = "unexpected",
        provider_http_status: int | None = None,
        retry_count: int = 0,
    ) -> None:
        super().__init__(message)
        self.failure_stage = "provider_request"
        self.failure_category = failure_category
        self.provider_http_status = provider_http_status
        self.retry_count = retry_count


def _classify_provider_failure(
    exc: Exception,
) -> tuple[FailureCategory, int | None, bool]:
    if isinstance(exc, ProviderBudgetExceeded):
        return "budget_exhausted", None, False
    if isinstance(exc, openai.APITimeoutError):
        return "timeout", None, True
    if isinstance(exc, openai.APIConnectionError):
        return "connection", None, True
    if isinstance(exc, openai.APIStatusError):
        status_code = exc.status_code
        if status_code == 429:
            category: FailureCategory = "rate_limit"
        elif 500 <= status_code < 600:
            category = "provider_server"
        elif 400 <= status_code < 500:
            category = "provider_client"
        else:
            category = "unexpected"
        transient = status_code in {408, 409, 429} or 500 <= status_code < 600
        return category, status_code, transient
    return "unexpected", None, False


def normalize_deepseek_model_name(model_name: str) -> str:
    """Strip the ``openai/`` prefix DeepSeek's config uses, for SDK calls.

    Args:
        model_name: The original, ``openai/``-prefixed model name as it
            appears in ``backend/config/providers.yaml`` (e.g.
            ``"openai/deepseek-chat"``).

    Returns:
        The bare model name DeepSeek's OpenAI-compatible endpoint expects
        (e.g. ``"deepseek-chat"``).

    Raises:
        DeepSeekModelNameError: ``model_name`` does not start with the
            expected ``openai/`` prefix. This is a loud failure rather than
            a silent passthrough, since a missing prefix likely indicates a
            configuration or caller mistake.
    """
    if not model_name.startswith(_MODEL_NAME_PREFIX):
        raise DeepSeekModelNameError(
            f"Expected model name to start with '{_MODEL_NAME_PREFIX}', got: {model_name!r}"
        )
    return model_name[len(_MODEL_NAME_PREFIX) :]


def build_deepseek_chat_model(
    config: DeepSeekProviderConfig,
    dotenv_path: Path | None = None,
    *,
    json_output: bool = False,
    attempt_budget: ProviderAttemptBudget | None = None,
    max_provider_attempts: int = 2,
) -> DeepSeekChatModel:
    """Build a callable DeepSeek chat model backed by the real ``openai`` SDK.

    Resolves the API key from the environment, falling back to a local
    dotenv file when the environment variable is unset/empty (see
    :func:`app.langgraph_runtime.deepseek_env.resolve_deepseek_api_key_with_dotenv_fallback`),
    and constructs a real ``openai.OpenAI`` client pointed at DeepSeek's
    OpenAI-compatible endpoint. The returned callable always uses
    ``config.default_model`` (normalized) as the model.

    Args:
        config: A validated :class:`DeepSeekProviderConfig`.
        dotenv_path: Optional override path to a dotenv file used only as a
            fallback when the process environment variable is unset/empty.
            Defaults to ``backend/.env.example`` when omitted; primarily
            useful for injecting a temporary path in offline tests.
        json_output: Whether to request DeepSeek JSON Output. Defaults to
            ``False`` so generic chat and consultation callers retain their
            free-text response contract.

    Returns:
        A callable accepting an OpenAI-style message list and returning the
        assistant's response text.

    Raises:
        DeepSeekApiKeyError: propagated from key resolution if the
            configured environment variable is unset/empty and the dotenv
            fallback also failed.
    """
    api_key = resolve_deepseek_api_key_with_dotenv_fallback(config, dotenv_path)
    client = openai.OpenAI(
        base_url=config.base_url,
        api_key=api_key,
        max_retries=0,
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    model_name = normalize_deepseek_model_name(config.default_model)

    def call_deepseek_chat_model(messages: list[dict[str, str]]) -> str:
        request_kwargs = {
            "model": model_name,
            "messages": messages,
            "max_tokens": 2500,
            "temperature": 0,
        }
        if json_output:
            request_kwargs["response_format"] = {"type": "json_object"}
            request_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
        for attempt in range(max_provider_attempts):
            try:
                if attempt_budget is not None:
                    attempt_budget.reserve()
                response = client.chat.completions.create(**request_kwargs)
                break
            except Exception as exc:  # noqa: BLE001 - intentionally wrap any SDK error
                category, status_code, transient = _classify_provider_failure(exc)
                if transient and attempt + 1 < max_provider_attempts:
                    continue
                raise DeepSeekModelInvocationError(
                    "DeepSeek chat completion request failed "
                    f"(model={model_name!r}); see __cause__ for details.",
                    failure_category=category,
                    provider_http_status=status_code,
                    retry_count=attempt,
                ) from exc
        return response.choices[0].message.content

    return call_deepseek_chat_model
