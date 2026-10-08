"""Approved RSS/Atom/JSON Feed registry with default-deny URL policy."""

from __future__ import annotations

import hashlib
import ipaddress
import json
from dataclasses import dataclass
from types import MappingProxyType
from urllib.parse import urlsplit


class FeedFormat(str):
    RSS = "RSS"
    ATOM = "ATOM"
    JSON_FEED = "JSON_FEED"


def _validate_host(host: str) -> str:
    normalized = host.casefold().strip(".")
    if (
        not normalized
        or normalized in {"localhost", "localhost.localdomain"}
        or normalized.endswith(".local")
    ):
        raise ValueError("feed host is not public")
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return normalized
    if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
        raise ValueError("feed host must not be a private or local address")
    return normalized


@dataclass(frozen=True, slots=True)
class FeedSource:
    source_id: str
    url: str
    publisher: str
    format: str
    license_note: str
    robots_policy: str
    rate_limit_per_minute: int
    allowed_redirect_hosts: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        parsed = urlsplit(self.url)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.fragment:
            raise ValueError("feed URL must be HTTPS without credentials or fragments")
        host = _validate_host(parsed.hostname or "")
        if parsed.port not in (None, 443):
            raise ValueError("feed URL must use the default HTTPS port")
        if self.format not in {FeedFormat.RSS, FeedFormat.ATOM, FeedFormat.JSON_FEED}:
            raise ValueError("unsupported feed format")
        if (
            not self.source_id.strip()
            or not self.publisher.strip()
            or not self.license_note.strip()
        ):
            raise ValueError("feed identity, publisher, and license are required")
        if not self.robots_policy.strip() or self.rate_limit_per_minute < 1:
            raise ValueError("feed robots policy and rate limit are required")
        redirects = tuple(
            dict.fromkeys(
                _validate_host(value) for value in (self.allowed_redirect_hosts or (host,))
            )
        )
        if any(value != host for value in redirects):
            raise ValueError("redirects must remain on the registered host")
        object.__setattr__(self, "allowed_redirect_hosts", redirects)

    @property
    def fingerprint(self) -> str:
        payload = {
            "source_id": self.source_id,
            "url": self.url,
            "publisher": self.publisher,
            "format": self.format,
            "license_note": self.license_note,
            "robots_policy": self.robots_policy,
            "rate_limit_per_minute": self.rate_limit_per_minute,
            "allowed_redirect_hosts": self.allowed_redirect_hosts,
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    def owns_url(self, candidate: str) -> bool:
        parsed = urlsplit(candidate)
        return (
            parsed.scheme == "https"
            and _validate_host(parsed.hostname or "") in self.allowed_redirect_hosts
            and not parsed.username
            and not parsed.password
        )


class FeedRegistry:
    def __init__(self, sources: tuple[FeedSource, ...] = ()) -> None:
        values: dict[str, FeedSource] = {}
        for source in sources:
            if source.source_id in values:
                raise ValueError("duplicate feed source")
            values[source.source_id] = source
        self._sources = MappingProxyType(values)

    @property
    def sources(self):
        return self._sources

    def get(self, source_id: str) -> FeedSource:
        try:
            return self._sources[source_id]
        except KeyError as exc:
            raise KeyError("feed source is not registered") from exc

    def resolve_url(self, url: str) -> FeedSource:
        matches = tuple(source for source in self._sources.values() if source.owns_url(url))
        if len(matches) != 1:
            raise ValueError("feed URL is not registered")
        return matches[0]


def build_default_feed_registry() -> FeedRegistry:
    """Default-deny registry; production sources require an explicit approval commit."""

    return FeedRegistry()
