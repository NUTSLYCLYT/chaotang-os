from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from web.main import app

BASELINE_PATH = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "shangshufang_contract_baseline_v1.json"
)


def _baseline() -> dict:
    return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))


def test_formal_shangshufang_openapi_matches_frozen_request_baseline():
    baseline = _baseline()
    openapi = app.openapi()

    for endpoint in baseline["endpoints"]:
        operation = openapi["paths"][endpoint["path"]][endpoint["method"]]
        request_schema = endpoint["request_schema"]
        if request_schema is not None:
            request_ref = operation["requestBody"]["content"]["application/json"][
                "schema"
            ]["$ref"]
            assert request_ref == f"#/components/schemas/{request_schema}"
            component = openapi["components"]["schemas"][request_schema]
            assert sorted(component.get("required", [])) == endpoint["required"]
            assert sorted(component.get("properties", {})) == endpoint["properties"]
            if "action_enum" in endpoint:
                assert sorted(component["properties"]["action"]["enum"]) == endpoint[
                    "action_enum"
                ]

        success_schema = operation["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        assert (success_schema.get("additionalProperties") is not True) == endpoint[
            "typed_response"
        ]


@pytest.mark.parametrize("case", _baseline()["golden_cases"], ids=lambda case: case["case_id"])
def test_formal_shangshufang_draft_golden_baseline(case, isolated_session_local):
    response = TestClient(app).post(
        "/api/shangshufang/draft-edict", json=case["request"]
    )
    expected = case["expected"]

    assert response.status_code == expected["http_status"]
    if response.status_code != 200:
        return

    payload = response.json()
    assert payload["success"] is expected["success"]
    data = payload["data"]
    assert data["route"]["mode"] == expected["route_mode"]
    assert data["draft_edict"]["source_label"] == expected["source_label"]


def test_baseline_records_current_source_and_response_contract_gaps():
    from src.swarm_execution_loop import SOURCE_LABELS

    source_contract = _baseline()["source_contract"]

    assert source_contract["engine_tier"]["status"] == "missing_from_formal_api"
    assert len(source_contract["known_gaps"]) == 7
    assert any(
        "frontend decision callsites omit the exact FinalMemorial content hash" in gap
        for gap in source_contract["known_gaps"]
    )
    assert {
        "DEMO",
        "FALLBACK",
        "LIVE",
        "LIVE_ENGINE",
        "LIVE_SWARM",
        "MIXED",
    } == set(source_contract["legacy_runtime_wire_source_labels"])
    assert set(source_contract["legacy_runtime_wire_source_labels"]) == SOURCE_LABELS
    assert "LIVE_ENGINE" not in source_contract["formal_frontend_source_labels"]
    assert "LIVE_SWARM" not in source_contract["chancellor_contract_source_labels"]
    assert "engineTier=real" in source_contract["wire_aliases"]["LIVE_ENGINE"]
