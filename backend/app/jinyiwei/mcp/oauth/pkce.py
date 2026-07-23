"""Authorization Code PKCE transaction generation."""

from __future__ import annotations

import base64
import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass

from app.jinyiwei.mcp.oauth.models import OAuthError


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


@dataclass(frozen=True, slots=True, repr=False)
class PkceTransaction:
    state: str
    verifier: str
    challenge: str
    challenge_method: str = "S256"

    def __post_init__(self) -> None:
        if (
            not isinstance(self.state, str)
            or len(self.state) < 43
            or not isinstance(self.verifier, str)
            or not 43 <= len(self.verifier) <= 128
            or not isinstance(self.challenge, str)
            or not self.challenge
            or self.challenge_method != "S256"
        ):
            raise OAuthError("oauth_pkce_invalid")

    def __repr__(self) -> str:
        return "PkceTransaction(challenge_method='S256', values=<redacted>)"

    @classmethod
    def create(
        cls,
        random_bytes: Callable[[int], bytes] = secrets.token_bytes,
    ) -> PkceTransaction:
        try:
            state_bytes = random_bytes(32)
            verifier_bytes = random_bytes(64)
        except Exception:
            raise OAuthError("oauth_random_failed") from None
        if (
            not isinstance(state_bytes, bytes)
            or len(state_bytes) != 32
            or not isinstance(verifier_bytes, bytes)
            or len(verifier_bytes) != 64
        ):
            raise OAuthError("oauth_random_failed")
        state = _base64url(state_bytes)
        verifier = _base64url(verifier_bytes)
        challenge = _base64url(hashlib.sha256(verifier.encode("ascii")).digest())
        return cls(state=state, verifier=verifier, challenge=challenge)
