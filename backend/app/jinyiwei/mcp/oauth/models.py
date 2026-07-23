"""Immutable, secret-safe value objects for administrator OAuth."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit


class OAuthError(ValueError):
    """Stable OAuth failure that never contains remote or secret material."""


def _required_text(value: object, error: str = "oauth_credential_invalid") -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise OAuthError(error)
    return value


def _https_url(value: object) -> str:
    url = _required_text(value, "oauth_endpoint_not_allowed")
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise OAuthError("oauth_endpoint_not_allowed") from None
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or port is not None
        and not 1 <= port <= 65535
    ):
        raise OAuthError("oauth_endpoint_not_allowed")
    return url


@dataclass(frozen=True, slots=True, repr=False)
class OAuthCredential:
    """A persisted OAuth credential whose representation always redacts secrets."""

    access_token: str
    refresh_token: str
    expires_at: float
    client_id: str
    token_endpoint: str

    def __post_init__(self) -> None:
        _required_text(self.access_token)
        _required_text(self.refresh_token)
        _required_text(self.client_id)
        if (
            isinstance(self.expires_at, bool)
            or not isinstance(self.expires_at, int | float)
            or not math.isfinite(self.expires_at)
            or self.expires_at <= 0
        ):
            raise OAuthError("oauth_credential_invalid")
        _https_url(self.token_endpoint)

    def __repr__(self) -> str:
        return (
            "OAuthCredential("
            f"expires_at={self.expires_at!r}, "
            f"client_id={self.client_id!r}, "
            f"token_endpoint={self.token_endpoint!r}, values=<redacted>)"
        )

    def to_payload(self) -> dict[str, object]:
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at,
            "client_id": self.client_id,
            "token_endpoint": self.token_endpoint,
        }

    @classmethod
    def from_payload(cls, payload: object) -> OAuthCredential:
        if not isinstance(payload, dict) or set(payload) != {
            "access_token",
            "refresh_token",
            "expires_at",
            "client_id",
            "token_endpoint",
        }:
            raise OAuthError("oauth_credential_invalid")
        try:
            return cls(
                access_token=payload["access_token"],
                refresh_token=payload["refresh_token"],
                expires_at=payload["expires_at"],
                client_id=payload["client_id"],
                token_endpoint=payload["token_endpoint"],
            )
        except TypeError:
            raise OAuthError("oauth_credential_invalid") from None

    @classmethod
    def from_token_response(
        cls,
        payload: object,
        *,
        client_id: str,
        token_endpoint: str,
        now: float,
    ) -> OAuthCredential:
        required_fields = {
            "token_type",
            "access_token",
            "refresh_token",
            "expires_in",
        }
        if (
            not isinstance(payload, dict)
            or any(not isinstance(key, str) for key in payload)
            or not required_fields <= set(payload)
        ):
            raise OAuthError("oauth_token_invalid")
        expires_in = payload["expires_in"]
        if (
            payload["token_type"] != "Bearer"
            or isinstance(expires_in, bool)
            or not isinstance(expires_in, int | float)
            or not math.isfinite(expires_in)
            or expires_in <= 0
            or not isinstance(now, int | float)
            or isinstance(now, bool)
            or not math.isfinite(now)
        ):
            raise OAuthError("oauth_token_invalid")
        expires_at = now + float(expires_in)
        if not math.isfinite(expires_at) or expires_at <= now:
            raise OAuthError("oauth_token_invalid")
        try:
            return cls(
                access_token=payload["access_token"],
                refresh_token=payload["refresh_token"],
                expires_at=expires_at,
                client_id=client_id,
                token_endpoint=token_endpoint,
            )
        except (OAuthError, TypeError):
            raise OAuthError("oauth_token_invalid") from None


@dataclass(frozen=True, slots=True)
class OAuthEndpoints:
    """Approved endpoints discovered for one authorization server."""

    authorization_server: str
    authorization_endpoint: str
    token_endpoint: str
    registration_endpoint: str

    def __post_init__(self) -> None:
        for value in (
            self.authorization_server,
            self.authorization_endpoint,
            self.token_endpoint,
            self.registration_endpoint,
        ):
            _https_url(value)


def require_object_fields(
    payload: Any,
    required_fields: frozenset[str],
    *,
    error: str,
) -> dict[str, Any]:
    if (
        not isinstance(payload, dict)
        or any(not isinstance(key, str) for key in payload)
        or not required_fields <= set(payload)
    ):
        raise OAuthError(error)
    return payload
