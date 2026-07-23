"""Fail-closed endpoint policy for administrator OAuth."""

from __future__ import annotations

from urllib.parse import urlsplit

from app.jinyiwei.mcp.oauth.models import OAuthError


def _canonical_origin(url: str) -> str:
    if not isinstance(url, str) or not url or any(character.isspace() for character in url):
        raise OAuthError("oauth_endpoint_not_allowed")
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
    ):
        raise OAuthError("oauth_endpoint_not_allowed")
    hostname = parsed.hostname.casefold()
    if ":" in hostname:
        hostname = f"[{hostname}]"
    if port is None or port == 443:
        return f"https://{hostname}"
    return f"https://{hostname}:{port}"


class OAuthEndpointPolicy:
    """Allow remote URLs only when their HTTPS origin was registered."""

    def __init__(self, allowed_origins: tuple[str, ...]) -> None:
        self._allowed = frozenset(_canonical_origin(item) for item in allowed_origins)

    def validate_remote(self, url: str) -> str:
        if not isinstance(url, str) or not url or any(character.isspace() for character in url):
            raise OAuthError("oauth_endpoint_not_allowed")
        try:
            parsed = urlsplit(url)
            port = parsed.port
            origin = _canonical_origin(url)
        except (OAuthError, ValueError):
            raise OAuthError("oauth_endpoint_not_allowed") from None
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
            or port is not None
            and not 1 <= port <= 65535
            or origin not in self._allowed
        ):
            raise OAuthError("oauth_endpoint_not_allowed")
        return url

    def validate_loopback(self, url: str) -> str:
        if not isinstance(url, str) or not url or any(character.isspace() for character in url):
            raise OAuthError("oauth_callback_invalid")
        try:
            parsed = urlsplit(url)
            port = parsed.port
        except ValueError:
            raise OAuthError("oauth_callback_invalid") from None
        if (
            parsed.scheme != "http"
            or parsed.hostname != "127.0.0.1"
            or parsed.username is not None
            or parsed.password is not None
            or port is None
            or not 1 <= port <= 65535
            or not parsed.path.startswith("/")
            or parsed.query
            or parsed.fragment
        ):
            raise OAuthError("oauth_callback_invalid")
        return url
