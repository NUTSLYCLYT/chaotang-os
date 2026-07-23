"""Bounded OAuth metadata discovery and public-client registration."""

from __future__ import annotations

import json
import math
import re
from collections.abc import Mapping
from typing import Protocol
from urllib.parse import urlsplit, urlunsplit

from app.jinyiwei.mcp.contracts import McpServerConfig
from app.jinyiwei.mcp.oauth.models import (
    OAuthEndpoints,
    OAuthError,
    require_object_fields,
)
from app.jinyiwei.mcp.oauth.policy import OAuthEndpointPolicy
from app.jinyiwei.network import PinnedHTTPSClient, PinnedHTTPSResponse

_PROTECTED_FIELDS = frozenset({"resource", "authorization_servers"})
_AUTHORIZATION_FIELDS = frozenset(
    {
        "issuer",
        "authorization_endpoint",
        "token_endpoint",
        "registration_endpoint",
        "code_challenge_methods_supported",
    }
)
_REGISTRATION_FIELDS = frozenset({"client_id"})
_CLIENT_NAME = "chaotang-os administrator MCP OAuth"
_NOT_FOUND = object()
_RESOURCE_METADATA_PARAMETER = re.compile(
    r'(?:^|,)\s*resource_metadata\s*=\s*"([^"\\\r\n]+)"',
    re.IGNORECASE,
)
_RESOURCE_METADATA_ASSIGNMENT = re.compile(
    r"(?:^|,)\s*resource_metadata\s*=",
    re.IGNORECASE,
)


class OAuthTransport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        **options: object,
    ) -> PinnedHTTPSResponse: ...


def _well_known(url: str, suffix: str) -> str:
    parsed = urlsplit(url)
    path = parsed.path
    if path == "/":
        path = ""
    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            f"/.well-known/{suffix}{path}",
            "",
            "",
        )
    )


class OAuthMetadataResolver:
    """Resolve OAuth endpoints from one registered MCP server."""

    def __init__(self, *, transport: OAuthTransport | None = None) -> None:
        self._transport = transport or PinnedHTTPSClient()

    def resolve(
        self,
        server: McpServerConfig,
        redirect_uri: str,
    ) -> OAuthEndpoints:
        policy = OAuthEndpointPolicy(server.oauth_allowed_origins)
        policy.validate_loopback(redirect_uri)
        resource_metadata_url = policy.validate_remote(
            _well_known(server.endpoint_url, "oauth-protected-resource")
        )
        protected_payload = self._get_json(
            resource_metadata_url,
            server,
            policy,
            allow_not_found=True,
        )
        if protected_payload is _NOT_FOUND:
            resource_metadata_url = self._resource_metadata_from_challenge(
                server,
                policy,
            )
            protected_payload = self._get_json(resource_metadata_url, server, policy)
        protected = require_object_fields(
            protected_payload,
            _PROTECTED_FIELDS,
            error="oauth_metadata_invalid",
        )
        if protected["resource"] != server.endpoint_url:
            raise OAuthError("oauth_metadata_invalid")
        authorization_servers = protected["authorization_servers"]
        if (
            not isinstance(authorization_servers, list)
            or len(authorization_servers) != 1
            or not isinstance(authorization_servers[0], str)
        ):
            raise OAuthError("oauth_metadata_invalid")
        authorization_server = policy.validate_remote(authorization_servers[0])
        metadata_url = policy.validate_remote(
            _well_known(authorization_server, "oauth-authorization-server")
        )
        metadata = require_object_fields(
            self._get_json(metadata_url, server, policy),
            _AUTHORIZATION_FIELDS,
            error="oauth_metadata_invalid",
        )
        if metadata["issuer"] != authorization_server:
            raise OAuthError("oauth_metadata_invalid")
        methods = metadata["code_challenge_methods_supported"]
        if (
            not isinstance(methods, list)
            or any(not isinstance(item, str) for item in methods)
            or "S256" not in methods
        ):
            raise OAuthError("oauth_pkce_not_supported")
        endpoints = OAuthEndpoints(
            authorization_server=authorization_server,
            authorization_endpoint=policy.validate_remote(
                self._metadata_url(metadata, "authorization_endpoint")
            ),
            token_endpoint=policy.validate_remote(
                self._metadata_url(metadata, "token_endpoint")
            ),
            registration_endpoint=policy.validate_remote(
                self._metadata_url(metadata, "registration_endpoint")
            ),
        )
        return endpoints

    def register_client(
        self,
        server: McpServerConfig,
        endpoints: OAuthEndpoints,
        redirect_uri: str,
    ) -> str:
        policy = OAuthEndpointPolicy(server.oauth_allowed_origins)
        policy.validate_loopback(redirect_uri)
        endpoint = policy.validate_remote(endpoints.registration_endpoint)
        payload = {
            "redirect_uris": [redirect_uri],
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "client_name": _CLIENT_NAME,
        }
        try:
            body = json.dumps(
                payload,
                allow_nan=False,
                separators=(",", ":"),
            ).encode("utf-8")
            response = self._transport.request(
                "POST",
                endpoint,
                headers={"accept": "application/json"},
                json_body=body,
                total_timeout=10.0,
                connect_timeout=3.0,
                read_timeout=5.0,
                max_bytes=65_536,
                redirect_validator=lambda _current, _candidate: False,
            )
            policy.validate_remote(response.final_url)
            result = require_object_fields(
                parse_oauth_json_response(
                    response,
                    expected_status=201,
                    failure="oauth_registration_failed",
                ),
                _REGISTRATION_FIELDS,
                error="oauth_registration_invalid",
            )
            client_id = result["client_id"]
            if not isinstance(client_id, str) or not client_id or client_id != client_id.strip():
                raise OAuthError("oauth_registration_invalid")
            return client_id
        except OAuthError:
            raise
        except Exception:
            raise OAuthError("oauth_registration_failed") from None

    def _get_json(
        self,
        url: str,
        server: McpServerConfig,
        policy: OAuthEndpointPolicy,
        *,
        allow_not_found: bool = False,
    ) -> object:
        try:
            response = self._transport.request(
                "GET",
                url,
                headers={"accept": "application/json"},
                total_timeout=float(server.timeout_seconds),
                connect_timeout=min(3.0, float(server.timeout_seconds)),
                read_timeout=min(5.0, float(server.timeout_seconds)),
                max_bytes=server.max_response_bytes,
                redirect_validator=lambda _current, candidate: (
                    policy.validate_remote(candidate) == candidate
                ),
            )
            policy.validate_remote(response.final_url)
            if allow_not_found and response.status == 404:
                return _NOT_FOUND
            return parse_oauth_json_response(response)
        except OAuthError:
            raise
        except Exception:
            raise OAuthError("oauth_metadata_failed") from None

    def _resource_metadata_from_challenge(
        self,
        server: McpServerConfig,
        policy: OAuthEndpointPolicy,
    ) -> str:
        try:
            response = self._transport.request(
                "GET",
                server.endpoint_url,
                headers={"accept": "application/json"},
                total_timeout=float(server.timeout_seconds),
                connect_timeout=min(3.0, float(server.timeout_seconds)),
                read_timeout=min(5.0, float(server.timeout_seconds)),
                max_bytes=server.max_response_bytes,
                redirect_validator=lambda _current, _candidate: False,
            )
            policy.validate_remote(response.final_url)
            if response.status != 401:
                raise OAuthError("oauth_metadata_failed")
            challenge = response.headers.get("www-authenticate", "")
            scheme, separator, parameters = challenge.partition(" ")
            assignments = _RESOURCE_METADATA_ASSIGNMENT.findall(parameters)
            matches = _RESOURCE_METADATA_PARAMETER.findall(parameters)
            if (
                separator != " "
                or scheme.casefold() != "bearer"
                or len(assignments) != 1
                or len(matches) != 1
            ):
                raise OAuthError("oauth_metadata_failed")
            return policy.validate_remote(matches[0])
        except OAuthError:
            raise
        except Exception:
            raise OAuthError("oauth_metadata_failed") from None

    @staticmethod
    def _metadata_url(metadata: Mapping[str, object], name: str) -> str:
        value = metadata[name]
        if not isinstance(value, str):
            raise OAuthError("oauth_metadata_invalid")
        return value


def parse_oauth_json_response(
    response: PinnedHTTPSResponse,
    *,
    expected_status: int = 200,
    failure: str = "oauth_metadata_failed",
) -> object:
    """Decode one strict JSON response without exposing remote response material."""

    if response.status != expected_status:
        raise OAuthError(failure)
    media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().casefold()
    if media_type != "application/json":
        raise OAuthError(failure)
    try:
        return _strict_json_loads(response.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        raise OAuthError(failure) from None


def _strict_json_loads(value: str) -> object:
    def object_from_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, item in pairs:
            if key in result:
                raise ValueError("duplicate_json_key")
            result[key] = item
        return result

    def reject_constant(_value: str) -> object:
        raise ValueError("non_finite_json_number")

    def parse_float(raw: str) -> float:
        parsed = float(raw)
        if not math.isfinite(parsed):
            raise ValueError("non_finite_json_number")
        return parsed

    def parse_int(raw: str) -> int:
        parsed = int(raw)
        if not -(2**63) <= parsed <= 2**63 - 1:
            raise ValueError("integer_out_of_range")
        return parsed

    return json.loads(
        value,
        object_pairs_hook=object_from_pairs,
        parse_constant=reject_constant,
        parse_float=parse_float,
        parse_int=parse_int,
    )
