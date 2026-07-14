from __future__ import annotations

import importlib

import pytest


def test_sqlalchemy_engine_is_bound_to_ephemeral_database():
    engine_module = importlib.import_module("src.db.engine")

    assert engine_module.DB_URL == "sqlite:///:memory:"
    assert str(engine_module.engine.url) == "sqlite:///:memory:"


def test_default_sqlalchemy_session_is_blocked_during_pytest():
    engine_module = importlib.import_module("src.db.engine")

    with pytest.raises(RuntimeError, match="production DB tripwire"):
        engine_module.SessionLocal()


def test_explicit_isolated_session_remains_available(isolated_session_local):
    db = isolated_session_local()
    try:
        assert str(db.get_bind().url) == "sqlite:///:memory:"
    finally:
        db.close()
