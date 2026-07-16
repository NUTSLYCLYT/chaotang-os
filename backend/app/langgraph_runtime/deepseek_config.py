"""Read-only DeepSeek provider configuration loading and validation.

This module is deliberately split into two independent, separately testable
concerns:

- ``load_deepseek_provider_config``: parses and validates
  ``backend/config/providers.yaml`` (or a caller-supplied override path, used
  by tests) into an immutable :class:`DeepSeekProviderConfig`. This never
  touches environment variables.
- ``resolve_deepseek_api_key``: reads the actual secret value out of the
  process environment variable named by ``config.api_key_env``. This never
  touches the filesystem or YAML.

Every exception raised here must be raisable *before* any outbound network
request is attempted, and every exception message may only reference field
names, environment variable names, or file paths -- never a secret value
that has already been read from the environment. See
``backend/tests/test_deepseek_config.py`` for a regression test asserting
this property directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

_DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "providers.yaml"

_REQUIRED_FIELDS = ("base_url", "api_key_env", "default_model", "models")


class DeepSeekConfigError(Exception):
    """Base class for all DeepSeek provider configuration errors.

    Instances of this class (and its subclasses) must never include a secret
    value in their message -- only field names, environment variable names,
    or file paths.
    """


class DeepSeekConfigFileNotFoundError(DeepSeekConfigError):
    """Raised when the providers configuration file does not exist."""


class DeepSeekConfigParseError(DeepSeekConfigError):
    """Raised when the providers configuration file is not valid YAML."""


class DeepSeekConfigSchemaError(DeepSeekConfigError):
    """Raised when the parsed configuration is missing required structure."""


class DeepSeekApiKeyError(DeepSeekConfigError):
    """Raised when ``DEEPSEEK_API_KEY`` (or the configured env var) is unusable."""


@dataclass(frozen=True)
class DeepSeekProviderConfig:
    """Immutable, validated DeepSeek provider configuration.

    Attributes:
        base_url: DeepSeek's OpenAI-compatible API base URL.
        api_key_env: Name of the environment variable holding the API key
            (never the key value itself).
        default_model: Original ``openai/``-prefixed model name to use by
            default; prefix normalization happens only in the client
            adapter layer, not here.
        models: Original ``openai/``-prefixed model names available for this
            provider.
    """

    base_url: str
    api_key_env: str
    default_model: str
    models: tuple[str, ...]


def load_deepseek_provider_config(path: Path | None = None) -> DeepSeekProviderConfig:
    """Load and validate the DeepSeek provider configuration.

    Args:
        path: Optional override path to a providers YAML file. Defaults to
            ``backend/config/providers.yaml``, resolved relative to this
            module's location (not the process working directory).

    Returns:
        A validated, immutable :class:`DeepSeekProviderConfig`.

    Raises:
        DeepSeekConfigFileNotFoundError: The configuration file does not exist.
        DeepSeekConfigParseError: The configuration file is not valid YAML.
        DeepSeekConfigSchemaError: The configuration is missing required
            top-level keys, does not activate ``deepseek``, is missing required
            fields, or has an invalid ``models``/``default_model``.
    """
    config_path = path if path is not None else _DEFAULT_CONFIG_PATH

    if not config_path.is_file():
        raise DeepSeekConfigFileNotFoundError(
            f"DeepSeek provider configuration file not found: {config_path}"
        )

    try:
        raw_text = config_path.read_text(encoding="utf-8")
        document = yaml.safe_load(raw_text)
    except yaml.YAMLError as exc:
        raise DeepSeekConfigParseError(
            f"Failed to parse DeepSeek provider configuration as YAML: {config_path}"
        ) from exc

    if not isinstance(document, dict) or "active" not in document:
        raise DeepSeekConfigSchemaError(
            f"DeepSeek provider configuration is missing top-level key 'active': {config_path}"
        )

    active = document["active"]
    if not isinstance(active, str):
        raise DeepSeekConfigSchemaError(
            f"Top-level 'active' must be the string 'deepseek': {config_path}"
        )
    if active != "deepseek":
        raise DeepSeekConfigSchemaError(
            f"Top-level 'active' must select 'deepseek': {config_path}"
        )

    if "providers" not in document:
        raise DeepSeekConfigSchemaError(
            f"DeepSeek provider configuration is missing top-level key 'providers': {config_path}"
        )

    providers = document["providers"]
    if not isinstance(providers, dict) or "deepseek" not in providers:
        raise DeepSeekConfigSchemaError(
            "DeepSeek provider configuration is missing top-level key "
            f"'providers.deepseek': {config_path}"
        )

    deepseek_section = providers["deepseek"]
    if not isinstance(deepseek_section, dict):
        raise DeepSeekConfigSchemaError(
            f"'providers.deepseek' must be a mapping in: {config_path}"
        )

    missing_fields = [
        field for field in _REQUIRED_FIELDS if field not in deepseek_section
    ]
    if missing_fields:
        raise DeepSeekConfigSchemaError(
            "DeepSeek provider configuration is missing required field(s) "
            f"{missing_fields} under 'providers.deepseek': {config_path}"
        )

    base_url = deepseek_section["base_url"]
    api_key_env = deepseek_section["api_key_env"]
    default_model = deepseek_section["default_model"]
    models_raw: Any = deepseek_section["models"]

    if not isinstance(base_url, str) or not base_url:
        raise DeepSeekConfigSchemaError(
            f"'providers.deepseek.base_url' must be a non-empty string: {config_path}"
        )
    if not isinstance(api_key_env, str) or not api_key_env:
        raise DeepSeekConfigSchemaError(
            f"'providers.deepseek.api_key_env' must be a non-empty string: {config_path}"
        )
    if not isinstance(default_model, str) or not default_model:
        raise DeepSeekConfigSchemaError(
            f"'providers.deepseek.default_model' must be a non-empty string: {config_path}"
        )
    if (
        not isinstance(models_raw, list)
        or not models_raw
        or not all(isinstance(item, str) and item for item in models_raw)
    ):
        raise DeepSeekConfigSchemaError(
            "'providers.deepseek.models' must be a non-empty list of non-empty strings: "
            f"{config_path}"
        )

    models = tuple(models_raw)
    if default_model not in models:
        raise DeepSeekConfigSchemaError(
            f"'providers.deepseek.default_model' ({default_model!r}) must be one of "
            f"'providers.deepseek.models' {models}: {config_path}"
        )

    return DeepSeekProviderConfig(
        base_url=base_url,
        api_key_env=api_key_env,
        default_model=default_model,
        models=models,
    )


def resolve_deepseek_api_key(config: DeepSeekProviderConfig) -> str:
    """Resolve the DeepSeek API key from the process environment.

    Only reads ``os.environ[config.api_key_env]``; never touches the
    filesystem or YAML. Kept separate from
    :func:`load_deepseek_provider_config` so the two classes of failure
    (bad/missing config file vs. missing/empty secret) can be tested and
    reasoned about independently.

    Args:
        config: A validated :class:`DeepSeekProviderConfig`.

    Returns:
        The resolved, non-empty API key value.

    Raises:
        DeepSeekApiKeyError: The environment variable named by
            ``config.api_key_env`` is unset or set to an empty string. The
            error message only ever references ``config.api_key_env`` (the
            variable *name*), never the value.
    """
    value = os.environ.get(config.api_key_env)
    if not value:
        raise DeepSeekApiKeyError(
            f"Environment variable '{config.api_key_env}' is not set or is empty; "
            "set it (e.g. in backend/.env, see backend/.env.example) before using "
            "the DeepSeek production client."
        )
    return value
