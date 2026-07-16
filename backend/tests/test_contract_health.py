"""Contract tests for ``GET /health`` against the shared cross-stack contract.

These tests read ``docs/contracts/health.schema.json`` directly (rather than
hard-coding a Python-literal copy of its fields) so the backend and frontend
cannot silently drift from a single source of truth. The response body is
validated with a real ``jsonschema`` validation call against the
``responseBody`` fragment of that file, not a string/dict equality check.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import jsonschema
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# ``backend/tests`` -> ``backend`` -> repo root, then into ``docs/contracts``.
# pytest's working directory may be ``backend/`` (per ``tool.pytest.ini_options``
# in pyproject.toml), so the path is built relative to this file, not to cwd.
_CONTRACT_PATH = (
    Path(__file__).resolve().parent.parent.parent / "docs" / "contracts" / "health.schema.json"
)


def _load_contract() -> dict[str, Any]:
    with _CONTRACT_PATH.open("r", encoding="utf-8") as contract_file:
        return json.load(contract_file)


def test_contract_file_describes_the_health_endpoint():
    contract = _load_contract()
    assert contract["path"] == "/health"
    assert contract["method"] == "GET"
    assert contract["successStatus"] == 200
    assert "responseBody" in contract


def test_openapi_declares_health_get_with_contract_status_code():
    contract = _load_contract()
    openapi = app.openapi()

    path_item = openapi["paths"][contract["path"]]
    operation = path_item[contract["method"].lower()]

    assert str(contract["successStatus"]) in operation["responses"]


def test_health_response_body_matches_contract_schema():
    """Validate the *actual* runtime response against the shared JSON Schema.

    Uses ``jsonschema.validate`` so the check exercises real schema semantics
    (required fields, types, enum values, ``additionalProperties: false``)
    instead of re-implementing the contract as a hard-coded Python literal.
    """
    contract = _load_contract()

    response = client.get(contract["path"])
    assert response.status_code == contract["successStatus"]

    jsonschema.validate(instance=response.json(), schema=contract["responseBody"])


def test_health_response_violating_contract_would_be_rejected():
    """Sanity-check that the schema is not vacuously permissive.

    Confirms the same schema fragment actually rejects an invalid payload,
    so a schema with e.g. an accidental ``{}`` body would not silently pass
    the previous test.
    """
    contract = _load_contract()

    invalid_payloads = [
        {"status": "not-ok", "service": "chaotang-os-backend", "version": "0.1.0"},
        {"status": "ok", "service": "chaotang-os-backend"},
        {"status": "ok", "service": "chaotang-os-backend", "version": "0.1.0", "extra": "field"},
    ]

    for payload in invalid_payloads:
        try:
            jsonschema.validate(instance=payload, schema=contract["responseBody"])
        except jsonschema.ValidationError:
            continue
        raise AssertionError(f"expected contract violation to be rejected: {payload!r}")
