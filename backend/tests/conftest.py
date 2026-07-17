"""Shared pytest fixtures for the backend test suite.

The ``isolate_deepseek_dotenv_fallback`` fixture below is ``autouse=True`` so
every test in this suite is, by default, fully isolated from whatever a
developer happens to have in their real, private ``backend/.env.example``
file. Individual tests that need to exercise the dotenv fallback path
explicitly pass their own ``tmp_path``-backed dotenv file instead.
"""

from __future__ import annotations

import pytest

from app.langgraph_runtime import deepseek_env
from app.shiguan import db as shiguan_db


@pytest.fixture(autouse=True)
def isolate_deepseek_dotenv_fallback(tmp_path, monkeypatch):
    """Point the DeepSeek dotenv fallback default path at a nonexistent file.

    Without this, any test that (directly or indirectly) exercises the
    "no DEEPSEEK_API_KEY in the process environment" path could silently
    read the developer's real, private ``backend/.env.example`` and either
    leak its presence into test behavior or produce nondeterministic
    results depending on the local machine. This fixture removes that
    possibility for every test by construction.
    """
    guaranteed_missing_path = tmp_path / "does-not-exist" / ".env.example"
    monkeypatch.setattr(deepseek_env, "_DEFAULT_DOTENV_PATH", guaranteed_missing_path)


@pytest.fixture(autouse=True)
def isolate_shiguan_default_db_path(tmp_path, monkeypatch):
    """Point the 史馆 default sqlite path at a per-test ``tmp_path`` file.

    Without this, any test (now or in the future) that calls
    ``app.shiguan`` storage functions without an explicit ``db_path``
    would read/write the shared runtime database file
    (``backend/data/shiguan.sqlite3``), leaking state across test runs and
    risking corruption of real local development data. This fixture
    removes that possibility for every test by construction; tests that
    want to exercise "reconnect to the same file" behavior still pass
    their own explicit ``tmp_path``-backed path.
    """
    isolated_db_path = tmp_path / "shiguan-default" / "shiguan.sqlite3"
    monkeypatch.setattr(shiguan_db, "_DEFAULT_DB_PATH", isolated_db_path)
