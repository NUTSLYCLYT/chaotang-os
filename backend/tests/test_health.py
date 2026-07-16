"""Tests for GET /health: path, status code, and response contract."""

from __future__ import annotations

import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _expected_version() -> str:
    pyproject_path = Path(__file__).resolve().parent.parent / "pyproject.toml"
    with pyproject_path.open("rb") as pyproject_file:
        data = tomllib.load(pyproject_file)
    return str(data["project"]["version"])


def test_health_returns_200_ok():
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_json_content_type():
    response = client.get("/health")
    assert response.headers["content-type"].startswith("application/json")


def test_health_response_body_matches_contract():
    response = client.get("/health")
    body = response.json()
    assert body == {
        "status": "ok",
        "service": "chaotang-os-backend",
        "version": _expected_version(),
    }


def test_health_version_matches_pinned_pyproject_literal():
    """Guard against ``_expected_version()`` and ``get_service_version()``
    silently agreeing on a *wrong* parse of ``pyproject.toml``.

    ``_expected_version()`` above re-derives its expectation by re-reading
    ``pyproject.toml`` the same way ``app.health.get_service_version()`` does,
    so a bug shared by both implementations (e.g. reading the wrong TOML key)
    would still make ``test_health_response_body_matches_contract`` pass. This
    test instead hard-codes the current contract literal so a real drift
    between the response and the actual ``pyproject.toml`` version is caught
    even if both readers are wrong the same way. Update this literal in the
    same change that bumps ``[project].version`` in ``pyproject.toml``.
    """
    response = client.get("/health")
    assert response.json()["version"] == "0.1.0"


def test_health_response_has_only_expected_fields():
    response = client.get("/health")
    body = response.json()
    assert set(body.keys()) == {"status", "service", "version"}
