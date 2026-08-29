"""Tests for persistent tenant principals and revocable sessions."""

import sqlite3
import threading
from datetime import UTC, datetime, timedelta

import pytest

from app.auth import storage
from app.auth.errors import (
    AuthenticationStorageError,
    DuplicateIdentityError,
    UserValidationError,
)
from app.auth.models import AuthenticatedPrincipal, AuthenticatedUser
from app.auth.storage import (
    authenticate,
    authenticate_and_create_session,
    configure_auth_db,
    create_session,
    create_user,
    get_session_user,
    register_user,
    revoke_session,
)
from app.shiguan import db


def test_login_accepts_username_or_normalized_email_and_revocation_wins(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("court", "Court@Example.com", "six-or-more")

    assert authenticate("court", "six-or-more") == user
    assert authenticate("court@example.com", "six-or-more") == user

    session_id = create_session(user.id)
    principal = get_session_user(session_id)
    assert principal is not None
    assert AuthenticatedUser(principal.id, principal.username, principal.email) == user
    assert principal.tenant_role == "OWNER"

    revoke_session(session_id)
    assert get_session_user(session_id) is None


def test_authenticated_principal_keeps_user_compatible_but_requires_internal_identity():
    user = AuthenticatedUser("user-1", "court", "court@example.test")

    assert (user.id, user.username, user.email) == (
        "user-1",
        "court",
        "court@example.test",
    )
    with pytest.raises(TypeError):
        AuthenticatedPrincipal("user-1", "court", "court@example.test")

    principal = AuthenticatedPrincipal(
        "user-1",
        "court",
        "court@example.test",
        tenant_id="tenant-1",
        membership_id="membership-1",
        tenant_role="OWNER",
    )
    assert isinstance(principal, AuthenticatedUser)
    with pytest.raises(ValueError):
        AuthenticatedPrincipal(
            "user-1",
            "court",
            "court@example.test",
            tenant_id="tenant-1",
            membership_id="membership-1",
            tenant_role="ADMIN",  # type: ignore[arg-type]
        )


def test_registration_atomically_creates_user_tenant_membership_and_bound_session(tmp_path):
    path = tmp_path / "auth.sqlite3"
    configure_auth_db(path)

    principal, session_id = register_user(
        "court", "Court@Example.com", "six-or-more"
    )

    conn = db.get_connection(path)
    try:
        tenant = conn.execute(
            "SELECT id, kind FROM tenants WHERE id = ?", (principal.tenant_id,)
        ).fetchone()
        membership = conn.execute(
            "SELECT id, user_id, tenant_id, role, revoked_at "
            "FROM tenant_memberships WHERE id = ?",
            (principal.membership_id,),
        ).fetchone()
        session = conn.execute(
            "SELECT user_id, membership_id FROM auth_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    finally:
        conn.close()

    assert tenant is not None and dict(tenant) == {
        "id": principal.tenant_id,
        "kind": "PERSONAL",
    }
    assert membership is not None and dict(membership) == {
        "id": principal.membership_id,
        "user_id": principal.id,
        "tenant_id": principal.tenant_id,
        "role": "OWNER",
        "revoked_at": None,
    }
    assert session is not None and dict(session) == {
        "user_id": principal.id,
        "membership_id": principal.membership_id,
    }
    assert get_session_user(session_id) == principal


def test_registration_rolls_back_all_four_entities_when_session_insert_fails(
    tmp_path, monkeypatch
):
    path = tmp_path / "auth.sqlite3"
    configure_auth_db(path)
    _, existing_session_id = register_user(
        "existing", "existing@example.test", "six-or-more"
    )
    conn = db.get_connection(path)
    try:
        before = tuple(
            conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("users", "tenants", "tenant_memberships", "auth_sessions")
        )
    finally:
        conn.close()
    monkeypatch.setattr(storage, "new_session_id", lambda: existing_session_id)

    with pytest.raises(AuthenticationStorageError):
        register_user("new", "new@example.test", "six-or-more")

    conn = db.get_connection(path)
    try:
        after = tuple(
            conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("users", "tenants", "tenant_memberships", "auth_sessions")
        )
    finally:
        conn.close()
    assert after == before


def test_session_is_bound_to_issuance_membership_and_revocation_fails_closed(tmp_path):
    path = tmp_path / "auth.sqlite3"
    configure_auth_db(path)
    user = create_user("court", "court@example.test", "six-or-more")
    session_id = create_session(user.id)
    principal = get_session_user(session_id)
    assert principal is not None

    conn = db.get_connection(path)
    try:
        conn.execute(
            "UPDATE tenant_memberships SET revoked_at = ? WHERE id = ?",
            ("2026-08-28T00:00:00+00:00", principal.membership_id),
        )
        conn.commit()
    finally:
        conn.close()

    assert get_session_user(session_id) is None


def test_correct_password_with_invalid_principal_creates_no_login_session(tmp_path):
    path = tmp_path / "auth.sqlite3"
    configure_auth_db(path)
    user = create_user("court", "court@example.test", "six-or-more")
    conn = db.get_connection(path)
    try:
        conn.execute(
            "UPDATE tenant_memberships SET revoked_at = ? WHERE user_id = ?",
            ("2026-08-28T00:00:00+00:00", user.id),
        )
        conn.commit()
        before = conn.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0]
    finally:
        conn.close()

    assert authenticate_and_create_session("court", "six-or-more") is None

    conn = db.get_connection(path)
    try:
        after = conn.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0]
    finally:
        conn.close()
    assert after == before


def test_login_verifies_once_for_known_and_unknown_identifiers(tmp_path, monkeypatch):
    configure_auth_db(tmp_path / "auth.sqlite3")
    create_user("court", "court@example.test", "six-or-more")
    observed_hashes: list[str] = []

    def reject_password(_password: str, encoded_hash: str) -> bool:
        observed_hashes.append(encoded_hash)
        return False

    monkeypatch.setattr(storage, "verify_password", reject_password)

    assert authenticate_and_create_session("court", "wrong-password") is None
    assert len(observed_hashes) == 1
    known_hash = observed_hashes.pop()

    assert authenticate_and_create_session("unknown", "wrong-password") is None
    assert len(observed_hashes) == 1
    assert observed_hashes[0] != known_hash


def test_login_password_derivation_does_not_hold_database_write_lock(
    tmp_path, monkeypatch
):
    path = tmp_path / "auth.sqlite3"
    configure_auth_db(path)
    create_user("court", "court@example.test", "six-or-more")
    verification_started = threading.Event()
    release_verification = threading.Event()
    original_verify = storage.verify_password

    def paused_verify(password: str, encoded_hash: str) -> bool:
        verification_started.set()
        assert release_verification.wait(timeout=5)
        return original_verify(password, encoded_hash)

    monkeypatch.setattr(storage, "verify_password", paused_verify)
    result: list[object] = []
    login = threading.Thread(
        target=lambda: result.append(
            authenticate_and_create_session("court", "six-or-more")
        )
    )
    login.start()
    assert verification_started.wait(timeout=5)

    contender = sqlite3.connect(path, timeout=0)
    try:
        contender.execute("BEGIN IMMEDIATE")
        contender.rollback()
    finally:
        contender.close()
        release_verification.set()
        login.join(timeout=5)

    assert not login.is_alive()
    assert result and result[0] is not None


def test_registration_rejects_invalid_or_duplicate_identities(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    create_user("court", "court@example.com", "six-or-more")

    with pytest.raises(UserValidationError):
        create_user(" ", "valid@example.com", "six-or-more")
    with pytest.raises(UserValidationError):
        create_user("valid", " ", "six-or-more")
    with pytest.raises(UserValidationError):
        create_user("valid", "valid@example.com", "short")
    with pytest.raises(DuplicateIdentityError):
        create_user("court", "other@example.com", "six-or-more")
    with pytest.raises(DuplicateIdentityError):
        create_user("other", "COURT@example.com", "six-or-more")


def test_registration_rejects_cross_field_identity_collisions(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    create_user("court", "court@example.com", "six-or-more")

    with pytest.raises(DuplicateIdentityError):
        create_user("court@example.com", "other@example.com", "six-or-more")
    with pytest.raises(DuplicateIdentityError):
        create_user("other", "COURT", "six-or-more")


def test_registration_rejects_casefolded_username_as_an_email(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    create_user("Court", "other@example.com", "six-or-more")

    with pytest.raises(DuplicateIdentityError):
        create_user("other", "court", "six-or-more")


def test_registration_rejects_casefolded_email_as_a_username(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    create_user("other", "court@example.com", "six-or-more")

    with pytest.raises(DuplicateIdentityError):
        create_user("Court@Example.com", "different@example.com", "six-or-more")


def test_expired_session_does_not_resolve_a_user(tmp_path, monkeypatch):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("court", "court@example.com", "six-or-more")
    now = datetime(2026, 8, 28, tzinfo=UTC)
    monkeypatch.setattr(storage, "_now", lambda: now - timedelta(days=31))
    session_id = create_session(user.id)
    monkeypatch.setattr(storage, "_now", lambda: now)

    assert get_session_user(session_id) is None
