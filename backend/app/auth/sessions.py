"""Opaque session primitives independent of SQLite persistence."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

SESSION_LIFETIME = timedelta(days=30)


def new_session_id() -> str:
    """Create an opaque ID from 32 random bytes suitable for a URL/cookie."""

    return secrets.token_urlsafe(32)


def session_expiry(now: datetime | None = None) -> datetime:
    """Return the standard expiry timestamp for a newly created session."""

    return (now or datetime.now(UTC)) + SESSION_LIFETIME
