"""Local dotenv fallback for resolving the DeepSeek API key.

This module adds exactly one capability on top of
``deepseek_config.resolve_deepseek_api_key``: when the process environment
variable is unset/empty, fall back to reading a local, git-ignored dotenv
file (by default ``backend/.env.example``) *by value* -- never writing
anything into ``os.environ`` and never logging or raising any secret value
that was read.

Design notes (see ``docs/decisions/0009-deepseek-local-dotenv-fallback.md``
for the full rationale):

- Uses ``dotenv_values(path) -> dict`` from ``python-dotenv``, not
  ``load_dotenv()``. ``dotenv_values`` returns an in-memory ``dict`` and
  never touches ``os.environ``, which is exactly the "no global environment
  pollution" property this module must guarantee.
- Process environment variables always take priority: this function first
  delegates to the existing, unmodified
  :func:`app.langgraph_runtime.deepseek_config.resolve_deepseek_api_key`.
  Only when that raises :class:`DeepSeekApiKeyError` does this module
  attempt the dotenv fallback.
- Every failure mode (file missing, unparseable content, key missing/empty
  in the parsed dict) raises :class:`DeepSeekApiKeyError` with a message
  that only ever references ``config.api_key_env`` (the variable *name*) and
  the dotenv file path -- never a value read from the file.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import dotenv_values

from app.langgraph_runtime.deepseek_config import (
    DeepSeekApiKeyError,
    DeepSeekProviderConfig,
    resolve_deepseek_api_key,
)

# Fixed, repository-relative default path: backend/.env.example. Resolved
# from this module's own location, not the process working directory, so
# behavior is identical regardless of where the interpreter is launched
# from. Tests must monkeypatch this module attribute (not a captured default
# argument value) to a guaranteed-nonexistent path so they never read the
# developer's real, private backend/.env.example.
_DEFAULT_DOTENV_PATH = Path(__file__).resolve().parents[2] / ".env.example"


def resolve_deepseek_api_key_with_dotenv_fallback(
    config: DeepSeekProviderConfig, dotenv_path: Path | None = None
) -> str:
    """Resolve the DeepSeek API key, preferring the process environment.

    Args:
        config: A validated :class:`DeepSeekProviderConfig`.
        dotenv_path: Optional override path to a dotenv file to use as a
            fallback source. Defaults to the module-level
            ``_DEFAULT_DOTENV_PATH`` (``backend/.env.example``), read at
            call time so tests can monkeypatch it.

    Returns:
        The resolved, non-empty API key value.

    Raises:
        DeepSeekApiKeyError: The process environment variable named by
            ``config.api_key_env`` is unset/empty, *and* the dotenv fallback
            also failed -- because the file does not exist, could not be
            parsed (e.g. non-UTF-8 content), or does not define a non-empty
            value for ``config.api_key_env``. The error message only ever
            references the variable *name* and the dotenv file *path*, never
            any value read from the file.
    """
    try:
        return resolve_deepseek_api_key(config)
    except DeepSeekApiKeyError:
        pass

    path = dotenv_path if dotenv_path is not None else _DEFAULT_DOTENV_PATH

    if not path.is_file():
        raise DeepSeekApiKeyError(
            f"Environment variable '{config.api_key_env}' is not set or is empty, "
            f"and no local dotenv fallback file was found at: {path}"
        )

    try:
        values = dotenv_values(path)
    except Exception as exc:  # noqa: BLE001 - any parse failure must fail closed
        raise DeepSeekApiKeyError(
            f"Environment variable '{config.api_key_env}' is not set or is empty, "
            f"and the local dotenv fallback file could not be parsed: {path}"
        ) from exc

    value = values.get(config.api_key_env)
    if not value:
        raise DeepSeekApiKeyError(
            f"Environment variable '{config.api_key_env}' is not set or is empty, "
            f"and it is also missing or empty in the local dotenv fallback file: {path}"
        )
    return value
