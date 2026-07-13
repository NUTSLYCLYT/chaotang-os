from __future__ import annotations

from web.routers import health


def test_health_exposes_auth_key_id_without_secret(monkeypatch):
    monkeypatch.setattr(health, "_check_model_gateway", lambda: ("up", {}))
    monkeypatch.setenv("FENGQUN_AUTH", "true")
    monkeypatch.setenv("FENGQUN_JWT_KEY_ID", "jwt-prod-2026-07")
    monkeypatch.setenv("FENGQUN_JWT_SECRET", "must-never-appear-in-health")

    payload = health._health_payload().model_dump()

    assert payload["details"]["auth"] == {
        "enabled": True,
        "jwt_key_id": "jwt-prod-2026-07",
    }
    assert "must-never-appear-in-health" not in str(payload)


def test_health_rejects_invalid_auth_key_id(monkeypatch):
    monkeypatch.setattr(health, "_check_model_gateway", lambda: ("up", {}))
    monkeypatch.setenv("FENGQUN_AUTH", "true")
    monkeypatch.setenv("FENGQUN_JWT_KEY_ID", "invalid key id with spaces")

    payload = health._health_payload().model_dump()

    assert payload["details"]["auth"] == {
        "enabled": True,
        "jwt_key_id": None,
    }

