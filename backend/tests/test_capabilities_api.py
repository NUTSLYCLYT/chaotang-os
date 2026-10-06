from __future__ import annotations

import json

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.api.capabilities import get_capability, list_capabilities, router
from app.capabilities.projection import CapabilitySnapshotError


def _request(query: bytes = b"") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/capabilities",
            "headers": [],
            "query_string": query,
        }
    )


def _json_response(response: Response) -> dict:
    return json.loads(response.body.decode("utf-8"))


def test_routes_require_current_user_dependency() -> None:
    list_route = next(
        route
        for route in router.routes
        if getattr(route, "path", "") == "/api/v1/capabilities"
    )
    detail_route = next(
        route
        for route in router.routes
        if getattr(route, "path", "") == "/api/v1/capabilities/{capability_id}"
    )

    assert any(
        dependency.name == "current_user"
        for dependency in list_route.dependant.dependencies
    )
    assert any(
        dependency.name == "current_user"
        for dependency in detail_route.dependant.dependencies
    )


def test_list_returns_safe_readonly_projection() -> None:
    result = list_capabilities(_request(), object())

    assert result["status"] == "ok"
    registry = result["registry"]
    assert registry["schema_version"] == "capability-registry.v2"
    assert registry["summary"]["total"] == len(registry["items"])
    assert registry["summary"]["catalog_hanlin_skills"] == 73
    assert registry["summary"]["catalog_provider_groups"] == 14
    assert registry["summary"]["catalog_mcp_tools"] == 83
    encoded = json.dumps(registry, ensure_ascii=False)
    assert "owner_user_id" not in encoded
    assert "courtos_session" not in encoded
    assert "WESTOCK_MCP_CREDENTIAL" not in encoded
    assert "C:\\Users\\" not in encoded


def test_filters_external_candidates_to_honglusi() -> None:
    result = list_capabilities(
        _request(), object(), source="honglusi", home="honglusi"
    )

    items = result["registry"]["items"]
    summary = result["registry"]["summary"]
    assert items
    assert all(item["card"]["source"] == "honglusi" for item in items)
    assert all(item["card"]["recommended_home"] == "honglusi" for item in items)
    assert summary["total"] == len(items)
    assert summary["catalog_provider_groups"] == 14
    assert summary["catalog_mcp_tools"] == 83
    assert summary["catalog_snapshot_provider_groups"] == 16
    assert summary["catalog_snapshot_mcp_tools"] == 92


def test_rejects_unknown_or_duplicate_query_fields() -> None:
    unknown = list_capabilities(_request(b"owner_user_id=x"), object())
    duplicate = list_capabilities(_request(b"type=skill&type=agent"), object())

    assert unknown.status_code == 400
    assert _json_response(unknown) == {"status": "error", "reason": "validation"}
    assert duplicate.status_code == 400
    assert _json_response(duplicate) == {"status": "error", "reason": "validation"}


def test_detail_returns_one_capability_or_404() -> None:
    listing = list_capabilities(_request(), object())["registry"]["items"]
    capability_id = listing[0]["card"]["id"]

    found = get_capability(capability_id, object())
    missing = get_capability("no-such-capability", object())

    assert found["status"] == "ok"
    assert found["capability"]["card"]["id"] == capability_id
    assert missing.status_code == 404
    assert _json_response(missing) == {"status": "error", "reason": "not_found"}


def test_snapshot_failure_returns_sanitized_storage_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*_args, **_kwargs):
        raise CapabilitySnapshotError("C:\\Users\\Private\\secret")

    monkeypatch.setattr(
        "app.api.capabilities.build_capability_registry_projection", fail
    )
    response = list_capabilities(_request(), object())

    assert response.status_code == 503
    assert _json_response(response) == {"status": "error", "reason": "storage"}
    assert "Private" not in response.body.decode("utf-8")


def test_detail_snapshot_failure_returns_sanitized_storage_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*_args, **_kwargs):
        raise CapabilitySnapshotError("raw-secret")

    monkeypatch.setattr("app.api.capabilities.get_capability_registry_item", fail)
    response = get_capability("skill:any", object())

    assert response.status_code == 503
    assert _json_response(response) == {"status": "error", "reason": "storage"}
    assert "raw-secret" not in response.body.decode("utf-8")
