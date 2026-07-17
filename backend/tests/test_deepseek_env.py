"""Tests for ``app.langgraph_runtime.deepseek_env``.

Fully offline and fully isolated from any real, private
``backend/.env.example`` (see the autouse fixture in ``conftest.py``). All
dotenv fallback scenarios use ``tmp_path``-backed temporary files;
environment-variable scenarios use ``monkeypatch``.
"""

from __future__ import annotations

import os

import pytest

from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError, DeepSeekProviderConfig
from app.langgraph_runtime.deepseek_env import resolve_deepseek_api_key_with_dotenv_fallback

_CONFIG = DeepSeekProviderConfig(
    base_url="https://api.deepseek.com/v1",
    api_key_env="DEEPSEEK_API_KEY",
    default_model="openai/deepseek-chat",
    models=("openai/deepseek-chat",),
)

_FAKE_KEY_MARKER = "sk-env-fallback-adversarial-should-not-leak-13579"


def test_process_env_takes_priority_even_with_nonexistent_dotenv_path(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake-value-for-tests")
    nonexistent_path = tmp_path / "does-not-exist" / ".env.example"

    result = resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, nonexistent_path)

    assert result == "sk-fake-value-for-tests"


def test_falls_back_to_dotenv_file_when_process_env_missing(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("DEEPSEEK_API_KEY=sk-from-dotenv-file\n", encoding="utf-8")

    result = resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)

    assert result == "sk-from-dotenv-file"


def test_falls_back_to_dotenv_file_when_process_env_empty(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("DEEPSEEK_API_KEY=sk-from-dotenv-file\n", encoding="utf-8")

    result = resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)

    assert result == "sk-from-dotenv-file"


def test_missing_dotenv_file_raises(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    missing_path = tmp_path / "does-not-exist" / ".env.example"

    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, missing_path)


def test_dotenv_file_missing_key_raises(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("SOME_OTHER_VAR=whatever\n", encoding="utf-8")

    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)


def test_dotenv_file_empty_key_value_raises(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("DEEPSEEK_API_KEY=\n", encoding="utf-8")

    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)


def test_dotenv_file_unparseable_content_raises(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    # Invalid UTF-8 byte sequence: triggers a decode failure when dotenv_values()
    # tries to read the file, which must be treated as a parse failure.
    dotenv_path.write_bytes(b"DEEPSEEK_API_KEY=\xff\xfe\x00invalid-utf8")

    with pytest.raises(DeepSeekApiKeyError):
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)


def test_missing_dotenv_file_error_does_not_leak_fake_key(monkeypatch, tmp_path):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    missing_path = tmp_path / "does-not-exist" / ".env.example"

    with pytest.raises(DeepSeekApiKeyError) as exc_info:
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, missing_path)
    assert _FAKE_KEY_MARKER not in str(exc_info.value)


def test_dotenv_file_missing_key_error_does_not_leak_fake_key(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text(f"SOME_OTHER_VAR={_FAKE_KEY_MARKER}\n", encoding="utf-8")

    with pytest.raises(DeepSeekApiKeyError) as exc_info:
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)
    assert _FAKE_KEY_MARKER not in str(exc_info.value)


def test_dotenv_file_empty_key_value_error_does_not_leak_fake_key(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    # The fake marker sits in an unrelated variable in the same file, while
    # the actual DEEPSEEK_API_KEY value is empty -- the error must not leak
    # either the empty value or this unrelated marker.
    dotenv_path.write_text(
        f"DEEPSEEK_API_KEY=\nSOME_OTHER_VAR={_FAKE_KEY_MARKER}\n", encoding="utf-8"
    )

    with pytest.raises(DeepSeekApiKeyError) as exc_info:
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)
    assert _FAKE_KEY_MARKER not in str(exc_info.value)


def test_dotenv_file_unparseable_content_error_does_not_leak_fake_key(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_bytes(f"DEEPSEEK_API_KEY={_FAKE_KEY_MARKER}".encode("utf-16"))

    with pytest.raises(DeepSeekApiKeyError) as exc_info:
        resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)
    assert _FAKE_KEY_MARKER not in str(exc_info.value)


def test_does_not_pollute_global_environment(monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.example"
    dotenv_path.write_text("DEEPSEEK_API_KEY=sk-from-dotenv-file\n", encoding="utf-8")

    before = dict(os.environ)
    result = resolve_deepseek_api_key_with_dotenv_fallback(_CONFIG, dotenv_path)
    after = dict(os.environ)

    assert result == "sk-from-dotenv-file"
    assert before == after
    assert "DEEPSEEK_API_KEY" not in os.environ
