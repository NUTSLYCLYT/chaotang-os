"""Immutable authentication domain value objects."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True)
class AuthenticatedUser:
    """The public identity of an authenticated local user."""

    id: str
    username: str
    email: str


@dataclass(frozen=True)
class AuthenticatedPrincipal(AuthenticatedUser):
    """Server-derived personal-tenant authority for an authenticated user."""

    tenant_id: str
    membership_id: str
    tenant_role: Literal["OWNER"]

    def __post_init__(self) -> None:
        if self.tenant_role != "OWNER":
            raise ValueError("unsupported tenant role")


@dataclass(frozen=True)
class Session:
    """A persisted, server-revocable opaque browser session."""

    id: str
    user_id: str
    expires_at: datetime
    revoked_at: datetime | None
