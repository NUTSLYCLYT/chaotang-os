"""SQLite-backed local users and revocable opaque sessions."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.auth.errors import (
    AuthenticationStorageError,
    DuplicateIdentityError,
    UnknownUserError,
    UserValidationError,
)
from app.auth.models import AuthenticatedUser
from app.auth.passwords import hash_password, verify_password
from app.auth.sessions import new_session_id, session_expiry
from app.shiguan import db
from app.shiguan.errors import ShiguanStorageError

_configured_db_path: Path | None = None


def configure_auth_db(path: Path | None) -> None:
    """Configure the SQLite path used by authentication storage.

    Passing ``None`` restores the shared Shiguan database default. This
    small explicit seam keeps authentication tests isolated without making
    connection objects global or long-lived.
    """

    global _configured_db_path
    _configured_db_path = path


def _connection() -> sqlite3.Connection:
    try:
        return db.get_connection(_configured_db_path)
    except ShiguanStorageError as exc:
        raise AuthenticationStorageError("authentication storage is unavailable") from exc


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _normalized_email(email: str) -> str:
    return email.strip().lower()


def _validated_new_user(username: str, email: str, password: str) -> tuple[str, str]:
    if not isinstance(username, str) or not (normalized_username := username.strip()):
        raise UserValidationError("username must not be blank")
    if not isinstance(email, str) or not (normalized_email := _normalized_email(email)):
        raise UserValidationError("email must not be blank")
    if not isinstance(password, str) or len(password) < 6:
        raise UserValidationError("password must be at least six characters")
    return normalized_username, normalized_email


def _user_from_row(row: sqlite3.Row) -> AuthenticatedUser:
    return AuthenticatedUser(id=row["id"], username=row["username"], email=row["email"])


def create_user(username: str, email: str, password: str) -> AuthenticatedUser:
    """Create a user with unambiguous username and normalized-email login IDs."""

    username, email = _validated_new_user(username, email, password)
    user = AuthenticatedUser(id=str(uuid.uuid4()), username=username, email=email)
    conn = _connection()
    try:
        try:
            # SQLite's individual UNIQUE constraints cannot prevent a username
            # from matching another row's email. Serialize registration and
            # reserve both identifiers together before inserting the user.
            conn.execute("BEGIN IMMEDIATE")
            proposed_identifier_keys = {user.username.casefold(), user.email.casefold()}
            existing_identities = conn.execute("SELECT username, email FROM users").fetchall()
            collision = any(
                proposed_identifier_keys
                & {row["username"].casefold(), row["email"].casefold()}
                for row in existing_identities
            )
            if collision:
                conn.rollback()
                raise DuplicateIdentityError("username or email already exists")
            conn.execute(
                "INSERT INTO users (id, username, email, password_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (user.id, user.username, user.email, hash_password(password), _iso(_now())),
            )
            conn.commit()
        except sqlite3.IntegrityError as exc:
            conn.rollback()
            raise DuplicateIdentityError("username or email already exists") from exc
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
        return user
    finally:
        conn.close()


def authenticate(identifier: str, password: str) -> AuthenticatedUser | None:
    """Authenticate by username or normalized email without leaking which matched."""

    if not isinstance(identifier, str) or not isinstance(password, str):
        return None
    normalized_identifier = identifier.strip()
    if not normalized_identifier:
        return None
    conn = _connection()
    try:
        try:
            row = conn.execute(
                "SELECT id, username, email, password_hash FROM users "
                "WHERE username = ? OR email = ?",
                (normalized_identifier, _normalized_email(normalized_identifier)),
            ).fetchone()
        except sqlite3.Error as exc:
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
        if row is None or not verify_password(password, row["password_hash"]):
            return None
        return _user_from_row(row)
    finally:
        conn.close()


def create_session(user_id: str) -> str:
    """Persist and return a random opaque session ID for an existing user."""

    conn = _connection()
    try:
        try:
            exists = conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
            if exists is None:
                raise UnknownUserError("user does not exist")
            session_id = new_session_id()
            now = _now()
            conn.execute(
                "INSERT INTO auth_sessions (id, user_id, created_at, expires_at, revoked_at) "
                "VALUES (?, ?, ?, ?, NULL)",
                (session_id, user_id, _iso(now), _iso(session_expiry(now))),
            )
            conn.commit()
            return session_id
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
    finally:
        conn.close()


def get_session_user(session_id: str) -> AuthenticatedUser | None:
    """Resolve only an active, unexpired, unrevoked session to its user."""

    if not isinstance(session_id, str) or not session_id:
        return None
    conn = _connection()
    try:
        try:
            row = conn.execute(
                "SELECT users.id, users.username, users.email, auth_sessions.expires_at, "
                "auth_sessions.revoked_at FROM auth_sessions JOIN users "
                "ON users.id = auth_sessions.user_id WHERE auth_sessions.id = ?",
                (session_id,),
            ).fetchone()
        except sqlite3.Error as exc:
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
        if row is None or row["revoked_at"] is not None:
            return None
        expires_at = _parse_datetime(row["expires_at"])
        if expires_at is None or expires_at <= _now():
            return None
        return _user_from_row(row)
    finally:
        conn.close()


def revoke_session(session_id: str) -> None:
    """Revoke a session idempotently, so it cannot resolve again."""

    if not isinstance(session_id, str) or not session_id:
        return
    conn = _connection()
    try:
        try:
            conn.execute(
                "UPDATE auth_sessions SET revoked_at = ? "
                "WHERE id = ? AND revoked_at IS NULL",
                (_iso(_now()), session_id),
            )
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
    finally:
        conn.close()


def list_user_ids_for_scheduled_jobs(
    *, db_path: Path | None = None
) -> tuple[str, ...]:
    """Return stable server-side scheduler targets without exposing an API."""

    try:
        conn = db.get_connection(db_path)
    except ShiguanStorageError as exc:
        raise AuthenticationStorageError("authentication storage is unavailable") from exc
    try:
        try:
            rows = conn.execute("SELECT id FROM users ORDER BY id").fetchall()
            return tuple(row["id"] for row in rows)
        except sqlite3.Error as exc:
            raise AuthenticationStorageError(
                "authentication storage is unavailable"
            ) from exc
    finally:
        conn.close()
