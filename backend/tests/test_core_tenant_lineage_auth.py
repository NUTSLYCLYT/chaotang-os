"""Ingress contract: numeric tenant lineage comes only from a verified slug."""

from __future__ import annotations

from starlette.requests import Request

import web.deps as deps


def _request(path: str = "/api/shangshufang/draft-edict") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("testclient", 123),
        }
    )


def test_verified_slug_is_strictly_resolved_and_independent_payload_id_is_ignored(
    monkeypatch,
):
    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    monkeypatch.setattr(
        deps,
        "verify_token",
        lambda _token: {
            "user_id": 4,
            "tenant_slug": "tenant-a",
            "tenant_id": 999,
        },
    )
    monkeypatch.setattr(deps, "resolve_tenant_slug_id", lambda slug: 41 if slug == "tenant-a" else None)

    user = deps.get_current_user(_request(), authorization="Bearer signed-token")

    assert user.tenant_slug == "tenant-a"
    assert user.tenant_id == 41


def test_verified_payload_without_slug_does_not_fall_back_to_default_owner(monkeypatch):
    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    monkeypatch.setattr(
        deps,
        "verify_token",
        lambda _token: {"user_id": 4, "tenant_id": 999},
    )
    monkeypatch.setattr(deps, "resolve_tenant_slug_id", lambda slug: None)

    user = deps.get_current_user(_request(), authorization="Bearer signed-token")

    assert user.tenant_slug == "default"
    assert user.tenant_id is None


def test_whitelisted_request_stays_unowned_without_opening_tenant_storage(monkeypatch):
    monkeypatch.setattr(deps, "AUTH_ENABLED", True)

    def unexpected_resolution(_slug):
        raise AssertionError("whitelisted request must not resolve a tenant id")

    monkeypatch.setattr(deps, "resolve_tenant_slug_id", unexpected_resolution)

    user = deps.get_current_user(_request("/api/health"))

    assert user.tenant_slug == "default"
    assert user.tenant_id is None
