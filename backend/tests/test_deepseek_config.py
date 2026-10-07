"""Tests for ``app.langgraph_runtime.deepseek_config``.

Fully offline: no network access, no real secrets. Config-file scenarios use
``tmp_path``-backed temporary YAML files; environment-variable scenarios use
``monkeypatch``.
"""

from __future__ import annotations

import pytest

from app.langgraph_runtime.deepseek_config import (
    DeepSeekApiKeyError,
    DeepSeekConfigFileNotFoundError,
    DeepSeekConfigParseError,
    DeepSeekConfigSchemaError,
    DeepSeekProviderConfig,
    load_deepseek_provider_config,
    resolve_deepseek_api_key,
)

_VALID_YAML = """\
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models:
      - openai/deepseek-chat
      - openai/deepseek-reasoner
"""


def _write(tmp_path, text: str):
    path = tmp_path / "providers.yaml"
    path.write_text(text, encoding="utf-8")
    return path


def test_load_real_providers_yaml_with_active_deepseek_succeeds():
    """The real config selects DeepSeek and parses through the default path."""
    config = load_deepseek_provider_config()

    assert config.base_url == "https://api.deepseek.com/v1"
    assert config.api_key_env == "DEEPSEEK_API_KEY"
    assert config.default_model == "openai/deepseek-flash"
    assert config.models == (
        "openai/deepseek-flash",
        "openai/deepseek-v4-pro",
    )


def test_load_from_explicit_tmp_path_succeeds(tmp_path):
    path = _write(tmp_path, _VALID_YAML)
    config = load_deepseek_provider_config(path)
    assert config.default_model == "openai/deepseek-chat"


def test_load_missing_file_raises(tmp_path):
    missing_path = tmp_path / "does-not-exist.yaml"
    with pytest.raises(DeepSeekConfigFileNotFoundError):
        load_deepseek_provider_config(missing_path)


def test_load_invalid_yaml_raises(tmp_path):
    path = _write(tmp_path, "providers: [this is not: valid: yaml::")
    with pytest.raises(DeepSeekConfigParseError):
        load_deepseek_provider_config(path)


def test_load_missing_active_raises(tmp_path):
    path = _write(
        tmp_path,
        _VALID_YAML.removeprefix("active: deepseek\n"),
    )
    with pytest.raises(DeepSeekConfigSchemaError, match="active"):
        load_deepseek_provider_config(path)


def test_load_non_string_active_raises(tmp_path):
    path = _write(tmp_path, _VALID_YAML.replace("active: deepseek", "active: [deepseek]"))
    with pytest.raises(DeepSeekConfigSchemaError, match="active"):
        load_deepseek_provider_config(path)


def test_load_non_deepseek_active_raises(tmp_path):
    unexpected_active = "sk-test-active-must-not-leak"
    path = _write(
        tmp_path,
        _VALID_YAML.replace("active: deepseek", f"active: {unexpected_active}"),
    )
    with pytest.raises(DeepSeekConfigSchemaError, match="active") as exc_info:
        load_deepseek_provider_config(path)
    assert unexpected_active not in str(exc_info.value)


def test_load_missing_providers_key_raises(tmp_path):
    path = _write(tmp_path, "active: deepseek\nnot_providers:\n  deepseek: {}\n")
    with pytest.raises(DeepSeekConfigSchemaError):
        load_deepseek_provider_config(path)


def test_load_missing_deepseek_provider_raises(tmp_path):
    path = _write(tmp_path, "active: deepseek\nproviders:\n  other_provider: {}\n")
    with pytest.raises(DeepSeekConfigSchemaError):
        load_deepseek_provider_config(path)


def test_load_missing_required_field_reports_field_name(tmp_path):
    path = _write(
        tmp_path,
        """\
active: deepseek
providers:
  deepseek:
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models:
      - openai/deepseek-chat
""",
    )
    with pytest.raises(DeepSeekConfigSchemaError) as exc_info:
        load_deepseek_provider_config(path)
    assert "base_url" in str(exc_info.value)


def test_load_empty_models_list_raises(tmp_path):
    path = _write(
        tmp_path,
        """\
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models: []
""",
    )
    with pytest.raises(DeepSeekConfigSchemaError):
        load_deepseek_provider_config(path)


def test_load_non_string_models_list_raises(tmp_path):
    path = _write(
        tmp_path,
        """\
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models:
      - 1
      - 2
""",
    )
    with pytest.raises(DeepSeekConfigSchemaError):
        load_deepseek_provider_config(path)


def test_load_default_model_not_in_models_raises(tmp_path):
    path = _write(
        tmp_path,
        """\
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-not-in-list
    models:
      - openai/deepseek-chat
      - openai/deepseek-reasoner
""",
    )
    with pytest.raises(DeepSeekConfigSchemaError):
        load_deepseek_provider_config(path)


def test_resolve_api_key_missing_env_raises(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    config = DeepSeekProviderConfig(
        base_url="https://api.deepseek.com/v1",
        api_key_env="DEEPSEEK_API_KEY",
        default_model="openai/deepseek-chat",
        models=("openai/deepseek-chat",),
    )
    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key(config)


def test_resolve_api_key_empty_string_raises(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    config = DeepSeekProviderConfig(
        base_url="https://api.deepseek.com/v1",
        api_key_env="DEEPSEEK_API_KEY",
        default_model="openai/deepseek-chat",
        models=("openai/deepseek-chat",),
    )
    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key(config)


def test_resolve_api_key_success_returns_value(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    config = DeepSeekProviderConfig(
        base_url="https://api.deepseek.com/v1",
        api_key_env="DEEPSEEK_API_KEY",
        default_model="openai/deepseek-chat",
        models=("openai/deepseek-chat",),
    )
    assert resolve_deepseek_api_key(config) == "sk-fake-value-for-tests"


def test_error_messages_never_leak_the_api_key_value(monkeypatch, tmp_path):
    """Regression test: no exception's ``str()`` may ever contain a secret value.

    Sets an identifiable fake secret in the environment, then triggers two
    unrelated kinds of configuration errors while that secret is present,
    and asserts the secret string never leaks into either exception message.
    """
    leaking_marker = "sk-test-should-not-leak-12345"
    monkeypatch.setenv("DEEPSEEK_API_KEY", leaking_marker)

    # 1. A schema error from YAML parsing/validation, which never even reads
    #    environment variables, but is exercised here while the secret is
    #    present in the environment to guard against any future regression.
    bad_yaml_path = _write(
        tmp_path,
        """\
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models: []
""",
    )
    with pytest.raises(DeepSeekConfigSchemaError) as schema_exc_info:
        load_deepseek_provider_config(bad_yaml_path)
    assert leaking_marker not in str(schema_exc_info.value)

    # 2. An api-key resolution error for a *different*, unset environment
    #    variable, while the real-looking secret remains set under
    #    DEEPSEEK_API_KEY. The error message may reference the variable
    #    *name* it looked up, but never the unrelated secret value present
    #    elsewhere in the environment.
    monkeypatch.delenv("SOME_OTHER_UNSET_KEY", raising=False)
    other_config = DeepSeekProviderConfig(
        base_url="https://api.deepseek.com/v1",
        api_key_env="SOME_OTHER_UNSET_KEY",
        default_model="openai/deepseek-chat",
        models=("openai/deepseek-chat",),
    )
    with pytest.raises(DeepSeekApiKeyError) as key_exc_info:
        resolve_deepseek_api_key(other_config)
    assert leaking_marker not in str(key_exc_info.value)
