"""Tests for the ``python -m app.langgraph_runtime.deepseek_check`` CLI entry.

Fully offline: ``openai.OpenAI`` is always patched out, so no network request
is ever attempted and the underlying ``chat.completions.create`` (or
equivalent) method is never called -- this check only constructs config,
resolves the key, normalizes the model name, and constructs the SDK client
object; it never invokes the model.

The missing-``--dotenv-path`` scenarios additionally assert that
``dotenv_values`` and ``openai.OpenAI`` are never called: argparse's own
required-argument validation must reject the invocation before any
dotenv-reading or client-construction code runs, regardless of whether the
process environment variable happens to be set.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.langgraph_runtime.deepseek_check import main

_FAKE_KEY_MARKER = "sk-check-cli-adversarial-should-not-leak-97531"


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
@patch("app.langgraph_runtime.deepseek_env.dotenv_values")
def test_missing_dotenv_path_rejected_with_env_var_set(
    mock_dotenv_values, mock_openai_class, monkeypatch
):
    monkeypatch.setenv("DEEPSEEK_API_KEY", _FAKE_KEY_MARKER)

    with pytest.raises(SystemExit) as exc_info:
        main([])

    assert exc_info.value.code == 2
    mock_dotenv_values.assert_not_called()
    mock_openai_class.assert_not_called()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
@patch("app.langgraph_runtime.deepseek_env.dotenv_values")
def test_missing_dotenv_path_rejected_with_env_var_unset(
    mock_dotenv_values, mock_openai_class, monkeypatch
):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(SystemExit) as exc_info:
        main([])

    assert exc_info.value.code == 2
    mock_dotenv_values.assert_not_called()
    mock_openai_class.assert_not_called()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_main_succeeds_and_prints_generic_status_when_dotenv_path_resolves(
    mock_openai_class, monkeypatch, tmp_path, capsys
):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    dotenv_path = tmp_path / ".env.fake"
    dotenv_path.write_text(f"DEEPSEEK_API_KEY={_FAKE_KEY_MARKER}\n", encoding="utf-8")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance

    exit_code = main(["--dotenv-path", str(dotenv_path)])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "passed" in captured.out.lower()
    assert _FAKE_KEY_MARKER not in captured.out
    assert _FAKE_KEY_MARKER not in captured.err
    mock_client_instance.chat.completions.create.assert_not_called()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_main_fails_when_dotenv_path_does_not_exist(mock_openai_class, monkeypatch, tmp_path):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    missing_dotenv_path = tmp_path / "does-not-exist.env"

    exit_code = main(["--dotenv-path", str(missing_dotenv_path)])

    assert exit_code == 1
    mock_openai_class.assert_not_called()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_main_fails_when_dotenv_path_is_a_directory(mock_openai_class, monkeypatch, tmp_path):
    """A ``--dotenv-path`` that exists but is a directory (not a file) must be
    treated as an unusable fallback source, not read as if it were a file.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    directory_dotenv_path = tmp_path / "not-a-file-dir"
    directory_dotenv_path.mkdir()

    exit_code = main(["--dotenv-path", str(directory_dotenv_path)])

    assert exit_code == 1
    mock_openai_class.assert_not_called()


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_main_succeeds_with_dotenv_path_containing_spaces(
    mock_openai_class, monkeypatch, tmp_path
):
    """The ``--dotenv-path`` argument must work when the path itself contains
    spaces (a plausible real-world path on Windows, e.g. under
    ``C:\\Users\\Jane Doe\\...``); argparse must not mangle it and the
    resulting :class:`pathlib.Path` must resolve correctly.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    directory_with_spaces = tmp_path / "dir with spaces"
    directory_with_spaces.mkdir()
    dotenv_path = directory_with_spaces / ".env fake file"
    dotenv_path.write_text(f"DEEPSEEK_API_KEY={_FAKE_KEY_MARKER}\n", encoding="utf-8")
    mock_client_instance = MagicMock()
    mock_openai_class.return_value = mock_client_instance

    exit_code = main(["--dotenv-path", str(dotenv_path)])

    assert exit_code == 0
    mock_client_instance.chat.completions.create.assert_not_called()
