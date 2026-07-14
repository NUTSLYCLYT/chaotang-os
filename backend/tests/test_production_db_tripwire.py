from __future__ import annotations

import importlib
from pathlib import Path

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


def test_tenant_db_is_bound_to_ephemeral_database():
    tenant = importlib.import_module("src.tenant")
    production_path = tenant.PROJECT_ROOT / "data" / "fengqun.db"

    assert tenant.DB_PATH.resolve() != production_path.resolve()


def test_tenant_db_guard_rejects_production_path_before_connect(monkeypatch):
    tenant = importlib.import_module("src.tenant")
    production_path = tenant.PROJECT_ROOT / "data" / "fengqun.db"
    connect_reached = False

    def forbidden_connect(*_args, **_kwargs):
        nonlocal connect_reached
        connect_reached = True
        pytest.fail("sqlite3.connect reached the production path")

    monkeypatch.setattr(tenant, "DB_PATH", Path(production_path))
    monkeypatch.setattr(tenant.sqlite3, "connect", forbidden_connect)

    with pytest.raises(RuntimeError, match="tenant production DB tripwire"):
        tenant.get_db()

    assert connect_reached is False
