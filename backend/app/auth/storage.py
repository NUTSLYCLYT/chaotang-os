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
from app.auth.models import AuthenticatedPrincipal, AuthenticatedUser
from app.auth.passwords import hash_password, verify_password
from app.auth.sessions import new_session_id, session_expiry
from app.shiguan import db
from app.shiguan.errors import ShiguanStorageError

_configured_db_path: Path | None = None

# A valid, fixed-cost scrypt encoding used only to equalize unknown-account
# authentication. It is not a credential and never grants access.
_DUMMY_PASSWORD_HASH = (
    "v1$scrypt$16384$8$1$gLnHRVOtS-hZwrpyk1jrTA=="
    "$ONSAk0aYVRtqLrebVvSwmYRojPpnaHWq2taHXocBrOk2LnYcmLtMTSfmyMFx1czRQmy8U5JCa6HO4apKiMmi1w=="
)


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


def _principal_from_row(row: sqlite3.Row) -> AuthenticatedPrincipal:
    return AuthenticatedPrincipal(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        tenant_id=row["tenant_id"],
        membership_id=row["membership_id"],
        tenant_role="OWNER",
    )


def _identity_collision(conn: sqlite3.Connection, user: AuthenticatedUser) -> bool:
    proposed_identifier_keys = {user.username.casefold(), user.email.casefold()}
    existing_identities = conn.execute("SELECT username, email FROM users").fetchall()
    return any(
        proposed_identifier_keys
        & {row["username"].casefold(), row["email"].casefold()}
        for row in existing_identities
    )


def _insert_user_and_personal_membership(
    conn: sqlite3.Connection, *, username: str, email: str, password_hash: str
) -> AuthenticatedPrincipal:
    user = AuthenticatedUser(id=str(uuid.uuid4()), username=username, email=email)
    if _identity_collision(conn, user):
        raise DuplicateIdentityError("username or email already exists")
    tenant_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    created_at = _iso(_now())
    conn.execute(
        "INSERT INTO users (id, username, email, password_hash, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (user.id, user.username, user.email, password_hash, created_at),
    )
    conn.execute(
        "INSERT INTO tenants (id, kind, created_at) VALUES (?, 'PERSONAL', ?)",
        (tenant_id, created_at),
    )
    conn.execute(
        "INSERT INTO tenant_memberships "
        "(id, user_id, tenant_id, role, created_at, revoked_at) "
        "VALUES (?, ?, ?, 'OWNER', ?, NULL)",
        (membership_id, user.id, tenant_id, created_at),
    )
    return AuthenticatedPrincipal(
        id=user.id,
        username=user.username,
        email=user.email,
        tenant_id=tenant_id,
        membership_id=membership_id,
        tenant_role="OWNER",
    )


def _active_principal_for_user(
    conn: sqlite3.Connection, user_id: str
) -> AuthenticatedPrincipal | None:
    rows = conn.execute(
        "SELECT users.id, users.username, users.email, "
        "tenant_memberships.id AS membership_id, "
        "tenant_memberships.tenant_id AS tenant_id "
        "FROM users JOIN tenant_memberships "
        "ON tenant_memberships.user_id = users.id "
        "JOIN tenants ON tenants.id = tenant_memberships.tenant_id "
        "WHERE users.id = ? AND tenant_memberships.revoked_at IS NULL "
        "AND tenant_memberships.role = 'OWNER' AND tenants.kind = 'PERSONAL'",
        (user_id,),
    ).fetchall()
    if len(rows) != 1:
        return None
    return _principal_from_row(rows[0])


def _insert_session(
    conn: sqlite3.Connection, principal: AuthenticatedPrincipal
) -> str:
    session_id = new_session_id()
    now = _now()
    conn.execute(
        "INSERT INTO auth_sessions "
        "(id, user_id, membership_id, created_at, expires_at, revoked_at) "
        "VALUES (?, ?, ?, ?, ?, NULL)",
        (
            session_id,
            principal.id,
            principal.membership_id,
            _iso(now),
            _iso(session_expiry(now)),
        ),
    )
    return session_id


def create_user(username: str, email: str, password: str) -> AuthenticatedUser:
    """Create a user and its server-owned personal membership atomically."""

    username, email = _validated_new_user(username, email, password)
    password_hash = hash_password(password)
    conn = _connection()
    try:
        try:
            # SQLite's individual UNIQUE constraints cannot prevent a username
            # from matching another row's email. Serialize registration and
            # reserve both identifiers together before inserting the user.
            conn.execute("BEGIN IMMEDIATE")
            principal = _insert_user_and_personal_membership(
                conn, username=username, email=email, password_hash=password_hash
            )
            conn.commit()
        except DuplicateIdentityError:
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
        return AuthenticatedUser(
            id=principal.id, username=principal.username, email=principal.email
        )
    finally:
        conn.close()


def register_user(
    username: str, email: str, password: str
) -> tuple[AuthenticatedPrincipal, str]:
    """Atomically create a user, personal membership and first bound session."""

    username, email = _validated_new_user(username, email, password)
    password_hash = hash_password(password)
    conn = _connection()
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            principal = _insert_user_and_personal_membership(
                conn, username=username, email=email, password_hash=password_hash
            )
            session_id = _insert_session(conn, principal)
            conn.commit()
            return principal, session_id
        except DuplicateIdentityError:
            conn.rollback()
            raise
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
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


def authenticate_and_create_session(
    identifier: str, password: str
) -> tuple[AuthenticatedPrincipal, str] | None:
    """Verify credentials and atomically issue a membership-bound session."""

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
            password_hash = (
                _DUMMY_PASSWORD_HASH if row is None else row["password_hash"]
            )
            password_matches = verify_password(password, password_hash)
            if row is None or not password_matches:
                return None
            user_id = row["id"]
            conn.execute("BEGIN IMMEDIATE")
            confirmed = conn.execute(
                "SELECT 1 FROM users WHERE id = ? AND password_hash = ?",
                (user_id, password_hash),
            ).fetchone()
            if confirmed is None:
                conn.rollback()
                return None
            principal = _active_principal_for_user(conn, user_id)
            if principal is None:
                conn.rollback()
                return None
            session_id = _insert_session(conn, principal)
            conn.commit()
            return principal, session_id
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
    finally:
        conn.close()


def create_session(user_id: str) -> str:
    """Persist a session bound to the user's current personal membership."""

    conn = _connection()
    try:
        try:
            conn.execute("BEGIN IMMEDIATE")
            principal = _active_principal_for_user(conn, user_id)
            if principal is None:
                conn.rollback()
                raise UnknownUserError("user does not exist")
            session_id = _insert_session(conn, principal)
            conn.commit()
            return session_id
        except sqlite3.Error as exc:
            conn.rollback()
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
    finally:
        conn.close()


def get_session_user(session_id: str) -> AuthenticatedPrincipal | None:
    """Resolve only the exact active principal bound when the session was issued."""

    if not isinstance(session_id, str) or not session_id:
        return None
    conn = _connection()
    try:
        try:
            rows = conn.execute(
                "SELECT users.id, users.username, users.email, "
                "tenant_memberships.id AS membership_id, "
                "tenant_memberships.tenant_id AS tenant_id, "
                "auth_sessions.expires_at, auth_sessions.revoked_at "
                "FROM auth_sessions JOIN users "
                "ON users.id = auth_sessions.user_id "
                "JOIN tenant_memberships ON tenant_memberships.id = auth_sessions.membership_id "
                "AND tenant_memberships.user_id = auth_sessions.user_id "
                "JOIN tenants ON tenants.id = tenant_memberships.tenant_id "
                "WHERE auth_sessions.id = ? AND tenant_memberships.revoked_at IS NULL "
                "AND tenant_memberships.role = 'OWNER' AND tenants.kind = 'PERSONAL'",
                (session_id,),
            ).fetchall()
        except sqlite3.Error as exc:
            raise AuthenticationStorageError("authentication storage is unavailable") from exc
        if len(rows) != 1:
            return None
        row = rows[0]
        if row["revoked_at"] is not None:
            return None
        expires_at = _parse_datetime(row["expires_at"])
        if expires_at is None or expires_at <= _now():
            return None
        return _principal_from_row(row)
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
            rows = conn.execute(
                "SELECT users.id FROM users "
                "JOIN tenant_memberships ON tenant_memberships.user_id = users.id "
                "JOIN tenants ON tenants.id = tenant_memberships.tenant_id "
                "WHERE tenant_memberships.revoked_at IS NULL "
                "AND tenant_memberships.role = 'OWNER' "
                "AND tenants.kind = 'PERSONAL' ORDER BY users.id"
            ).fetchall()
            return tuple(row["id"] for row in rows)
        except sqlite3.Error as exc:
            raise AuthenticationStorageError(
                "authentication storage is unavailable"
            ) from exc
    finally:
        conn.close()
