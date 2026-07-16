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

import openai

from app.langgraph_runtime.deepseek_config import (
    DeepSeekProviderConfig,
    resolve_deepseek_api_key,
)

_MODEL_NAME_PREFIX = "openai/"

# A DeepSeek chat model is any callable that takes an OpenAI-style list of
# ``{"role": ..., "content": ...}`` messages and returns the assistant's
# response text.
DeepSeekChatModel = Callable[[list[dict[str, str]]], str]


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


def build_deepseek_chat_model(config: DeepSeekProviderConfig) -> DeepSeekChatModel:
    """Build a callable DeepSeek chat model backed by the real ``openai`` SDK.

    Resolves the API key from the environment (see
    :func:`app.langgraph_runtime.deepseek_config.resolve_deepseek_api_key`)
    and constructs a real ``openai.OpenAI`` client pointed at DeepSeek's
    OpenAI-compatible endpoint. The returned callable always uses
    ``config.default_model`` (normalized) as the model.

    Args:
        config: A validated :class:`DeepSeekProviderConfig`.

    Returns:
        A callable accepting an OpenAI-style message list and returning the
        assistant's response text.

    Raises:
        DeepSeekApiKeyError: propagated from key resolution if the
            configured environment variable is unset/empty.
    """
    api_key = resolve_deepseek_api_key(config)
    client = openai.OpenAI(base_url=config.base_url, api_key=api_key)
    model_name = normalize_deepseek_model_name(config.default_model)

    def call_deepseek_chat_model(messages: list[dict[str, str]]) -> str:
        try:
            response = client.chat.completions.create(model=model_name, messages=messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any SDK error
            raise DeepSeekModelInvocationError(
                "DeepSeek chat completion request failed "
                f"(model={model_name!r}); see __cause__ for the original exception."
            ) from exc
        return response.choices[0].message.content

    return call_deepseek_chat_model
