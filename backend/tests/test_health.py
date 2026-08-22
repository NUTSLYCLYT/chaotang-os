"""Tests for the installed-package health version contract."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError

import pytest

from app.health import get_service_version
from app.main import app, health


def test_health_uses_installed_distribution_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def installed_version(distribution_name: str) -> str:
        calls.append(distribution_name)
        return "9.8.7+candidate"

    monkeypatch.setattr("app.health.metadata.version", installed_version)
    response = health()

    assert response.model_dump() == {
        "status": "ok",
        "service": "chaotang-os-backend",
        "version": "9.8.7+candidate",
    }
    assert calls == ["chaotang-os-backend"]


def test_health_version_does_not_fall_back_when_distribution_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def missing_distribution(_distribution_name: str) -> str:
        raise PackageNotFoundError("chaotang-os-backend")

    monkeypatch.setattr("app.health.metadata.version", missing_distribution)
    with pytest.raises(PackageNotFoundError):
        get_service_version()


def test_health_response_has_only_expected_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.health.metadata.version", lambda _name: "0.1.0")
    assert set(health().model_dump()) == {"status", "service", "version"}


def test_health_route_remains_public_get() -> None:
    route = next(route for route in app.routes if getattr(route, "path", None) == "/health")
    assert route.methods == {"GET"}
