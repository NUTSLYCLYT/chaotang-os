"""Tests for persistent users and revocable authentication sessions."""

import pytest

from app.auth.errors import DuplicateIdentityError, UserValidationError
from app.auth.storage import (
    authenticate,
    configure_auth_db,
    create_session,
    create_user,
    get_session_user,
    revoke_session,
)
from app.shiguan import db


def test_login_accepts_username_or_normalized_email_and_revocation_wins(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("court", "Court@Example.com", "six-or-more")

    assert authenticate("court", "six-or-more") == user
    assert authenticate("court@example.com", "six-or-more") == user

    session_id = create_session(user.id)
    assert get_session_user(session_id) == user

    revoke_session(session_id)
    assert get_session_user(session_id) is None


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


def test_expired_session_does_not_resolve_a_user(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("court", "court@example.com", "six-or-more")
    session_id = create_session(user.id)

    conn = db.get_connection(tmp_path / "auth.sqlite3")
    try:
        conn.execute(
            "UPDATE auth_sessions SET expires_at = ? WHERE id = ?",
            ("2000-01-01T00:00:00+00:00", session_id),
        )
        conn.commit()
    finally:
        conn.close()

    assert get_session_user(session_id) is None
