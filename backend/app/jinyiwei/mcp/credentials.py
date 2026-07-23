"""In-memory credential resolution for administrator-approved MCP servers."""

from __future__ import annotations

import hashlib
import json
import math
import os
import threading
import time
from collections.abc import Callable, Iterator, Mapping
from concurrent.futures import Future
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from types import MappingProxyType
from typing import Any, Protocol

from app.jinyiwei.mcp.contracts import McpAccessPolicy, McpServerConfig
from app.jinyiwei.network import PinnedHTTPSClient, PinnedHTTPSResponse


class McpCredentialError(ValueError):
    """A stable error that never includes credential material."""


class _SecretText(str):
    def __repr__(self) -> str:
        return "<redacted>"


class SensitiveHeaders(Mapping[str, str]):
    """Case-insensitive request headers whose representation is always redacted."""

    __slots__ = ("_values",)

    def __init__(self, values: Mapping[str, str] | None = None) -> None:
        normalized: dict[str, str] = {}
        for name, value in (values or {}).items():
            if not isinstance(name, str) or not isinstance(value, str):
                raise McpCredentialError("credential_invalid")
            normalized[name.casefold()] = _SecretText(value)
        self._values = MappingProxyType(normalized)

    def __getitem__(self, key: str) -> str:
        return str(self._values[key.casefold()])

    def __iter__(self) -> Iterator[str]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)

    def __repr__(self) -> str:
        return f"SensitiveHeaders(keys={tuple(sorted(self._values))!r}, values=<redacted>)"

    __str__ = __repr__


class _SensitiveValues(Mapping[str, str]):
    """Lazy case-sensitive mapping reference with a redacted representation."""

    __slots__ = ("_values",)

    def __init__(self, values: Mapping[str, str]) -> None:
        self._values = values

    def __getitem__(self, key: str) -> str:
        return str(self._values[key])

    def __iter__(self) -> Iterator[str]:
        raise TypeError("sensitive_environment_iteration_forbidden")

    def __len__(self) -> int:
        raise TypeError("sensitive_environment_iteration_forbidden")

    def get(self, key: str, default: str | None = None) -> str | None:
        value = self._values.get(key, default)
        return None if value is None else str(value)

    def __repr__(self) -> str:
        return "_SensitiveValues(values=<redacted>)"

    __str__ = __repr__


class CredentialProvider(Protocol):
    def headers_for(self, server: McpServerConfig) -> SensitiveHeaders: ...


OAuthRefresh = Callable[[str, dict[str, str]], Mapping[str, object]]


class _OAuthTransport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        json_body: bytes,
        **options: object,
    ) -> PinnedHTTPSResponse: ...


class PinnedOAuthRefresh:
    """Refresh OAuth credentials through the same pinned, bounded transport."""

    def __init__(
        self,
        *,
        transport: _OAuthTransport | None = None,
        timeout_seconds: float = 10.0,
        max_response_bytes: int = 65_536,
        private_network_cidrs: tuple[str, ...] = (),
    ) -> None:
        self._transport = transport or PinnedHTTPSClient()
        self._timeout = timeout_seconds
        self._max_bytes = max_response_bytes
        self._private_network_cidrs = private_network_cidrs

    def __repr__(self) -> str:
        return "PinnedOAuthRefresh(<redacted>)"

    def __call__(self, endpoint: str, payload: dict[str, str]) -> Mapping[str, object]:
        try:
            body = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode("utf-8")
            response = self._transport.request(
                "POST",
                endpoint,
                headers=SensitiveHeaders({"accept": "application/json"}),
                json_body=body,
                total_timeout=self._timeout,
                connect_timeout=min(3.0, self._timeout),
                read_timeout=min(5.0, self._timeout),
                max_bytes=self._max_bytes,
                redirect_validator=lambda _current, _candidate: False,
                private_network_cidrs=self._private_network_cidrs,
            )
            if response.status != 200:
                raise McpCredentialError("credential_refresh_failed")
            media_type = (
                response.headers.get("content-type", "").split(";", 1)[0].strip().casefold()
            )
            if media_type != "application/json":
                raise McpCredentialError("credential_refresh_failed")
            result = json.loads(response.body.decode("utf-8"))
            if not isinstance(result, dict):
                raise McpCredentialError("credential_refresh_failed")
            return result
        except McpCredentialError:
            raise
        except Exception:
            raise McpCredentialError("credential_refresh_failed") from None


@dataclass(frozen=True, slots=True)
class _CachedOAuth:
    access_value: str = dataclass_field(repr=False)
    expires_at: float
    refresh_value: str = dataclass_field(repr=False)

    def __repr__(self) -> str:
        return f"_CachedOAuth(expires_at={self.expires_at!r}, values=<redacted>)"


class EnvCredentialProvider:
    """Resolve only ``env://`` references; refreshed values remain process-local."""

    def __init__(
        self,
        *,
        environ: Mapping[str, str] | None = None,
        approved_token_endpoints: Mapping[str, str] = {},
        oauth_refresh: OAuthRefresh | None = None,
        now: Callable[[], float] = time.time,
        refresh_skew_seconds: float = 30.0,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        # Keep only the mapping reference. Disabled MCP construction must not
        # iterate, copy, or look up any process environment value.
        self._environ = _SensitiveValues(os.environ if environ is None else environ)
        self._approved_endpoints = dict(approved_token_endpoints)
        self._oauth_refresh = oauth_refresh or PinnedOAuthRefresh()
        self._now = now
        if not math.isfinite(refresh_skew_seconds) or refresh_skew_seconds < 0:
            raise ValueError("refresh_skew_seconds must be finite and non-negative")
        self._refresh_skew = refresh_skew_seconds
        self._monotonic = monotonic
        self._oauth_cache: dict[str, _CachedOAuth] = {}
        self._refresh_flights: dict[str, Future[_CachedOAuth]] = {}
        self._refresh_failures: dict[str, float] = {}
        self._state_lock = threading.Lock()

    def __repr__(self) -> str:
        return "EnvCredentialProvider(<redacted>)"

    def headers_for(self, server: McpServerConfig) -> SensitiveHeaders:
        if server.access_policy is McpAccessPolicy.ANONYMOUS_PUBLIC:
            return SensitiveHeaders()
        reference = server.credential_ref
        if reference is None or not reference.startswith("env://"):
            raise McpCredentialError("credential_unavailable")
        variable = reference.removeprefix("env://")
        raw = self._environ.get(variable)
        if raw is None or not raw.strip() or raw.strip().startswith("env://"):
            raise McpCredentialError("credential_unavailable")
        raw = raw.strip()
        if not raw.startswith("{"):
            return SensitiveHeaders({"authorization": f"Bearer {raw}"})
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            raise McpCredentialError("credential_invalid") from None
        if not isinstance(payload, dict):
            raise McpCredentialError("credential_invalid")
        kind = payload.get("type")
        if kind == "api_key":
            return self._api_key_headers(payload)
        if kind == "bearer":
            value = payload.get("access_value")
            if not isinstance(value, str) or not value:
                raise McpCredentialError("credential_invalid")
            return SensitiveHeaders({"authorization": f"Bearer {value}"})
        return self._oauth_headers(server, payload)

    @staticmethod
    def _api_key_headers(payload: Mapping[str, Any]) -> SensitiveHeaders:
        if set(payload) != {"type", "value"}:
            raise McpCredentialError("credential_invalid")
        value = payload.get("value")
        if not isinstance(value, str) or not value:
            raise McpCredentialError("credential_invalid")
        return SensitiveHeaders({"x-api-key": value})

    def _oauth_headers(
        self, server: McpServerConfig, payload: Mapping[str, Any]
    ) -> SensitiveHeaders:
        required = {
            "access_token",
            "expires_at",
            "refresh_token",
            "client_id",
            "token_endpoint",
        }
        if set(payload) != required:
            raise McpCredentialError("credential_invalid")
        access = payload["access_token"]
        expires_at = payload["expires_at"]
        refresh_value = payload["refresh_token"]
        client_id = payload["client_id"]
        endpoint = payload["token_endpoint"]
        if (
            not isinstance(access, str)
            or not access
            or isinstance(expires_at, bool)
            or not isinstance(expires_at, (int, float))
            or not math.isfinite(expires_at)
            or not isinstance(refresh_value, str)
            or not refresh_value
            or not isinstance(client_id, str)
            or not client_id
            or not isinstance(endpoint, str)
            or not endpoint
        ):
            raise McpCredentialError("credential_invalid")

        if self._approved_endpoints.get(server.server_id) != endpoint:
            raise McpCredentialError("credential_endpoint_unapproved")
        identity = hashlib.sha256(
            json.dumps(
                {
                    "server": server.fingerprint_payload(),
                    "credential": payload,
                },
                sort_keys=True,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        now = self._now()
        with self._state_lock:
            failed_until = self._refresh_failures.get(identity)
            if failed_until is not None:
                if failed_until > self._monotonic():
                    raise McpCredentialError("credential_refresh_failed")
                self._refresh_failures.pop(identity, None)
            cached = self._oauth_cache.get(identity)
            if cached is not None and cached.expires_at > now + self._refresh_skew:
                return SensitiveHeaders({"authorization": f"Bearer {cached.access_value}"})
            if cached is None and float(expires_at) > now + self._refresh_skew:
                cached = _CachedOAuth(access, float(expires_at), refresh_value)
                self._oauth_cache[identity] = cached
                return SensitiveHeaders({"authorization": f"Bearer {access}"})
            current_refresh = cached.refresh_value if cached is not None else refresh_value
            flight = self._refresh_flights.get(identity)
            leader = flight is None
            if flight is None:
                flight = Future()
                self._refresh_flights[identity] = flight

        if not leader:
            try:
                shared = flight.result()
            except Exception:
                raise McpCredentialError("credential_refresh_failed") from None
            return SensitiveHeaders({"authorization": f"Bearer {shared.access_value}"})

        try:
            refreshed = self._oauth_refresh(
                endpoint,
                {
                    "grant_type": "refresh_token",
                    "refresh_token": current_refresh,
                    "client_id": client_id,
                },
            )
        except Exception:
            failure = McpCredentialError("credential_refresh_failed")
            with self._state_lock:
                self._refresh_failures[identity] = self._monotonic() + 1.0
                flight.set_exception(failure)
                self._refresh_flights.pop(identity, None)
            raise McpCredentialError("credential_refresh_failed") from None
        new_access = refreshed.get("access_token")
        expires_in = refreshed.get("expires_in")
        rotated_refresh = refreshed.get("refresh_token", current_refresh)
        if (
            not isinstance(new_access, str)
            or not new_access
            or isinstance(expires_in, bool)
            or not isinstance(expires_in, (int, float))
            or not math.isfinite(expires_in)
            or expires_in <= self._refresh_skew
            or not isinstance(rotated_refresh, str)
            or not rotated_refresh
        ):
            failure = McpCredentialError("credential_refresh_failed")
            with self._state_lock:
                self._refresh_failures[identity] = self._monotonic() + 1.0
                flight.set_exception(failure)
                self._refresh_flights.pop(identity, None)
            raise McpCredentialError("credential_refresh_failed")
        cached = _CachedOAuth(
            new_access,
            self._now() + float(expires_in),
            rotated_refresh,
        )
        with self._state_lock:
            self._oauth_cache[identity] = cached
            self._refresh_failures.pop(identity, None)
            flight.set_result(cached)
            self._refresh_flights.pop(identity, None)
        return SensitiveHeaders({"authorization": f"Bearer {cached.access_value}"})
