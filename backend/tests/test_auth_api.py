"""HTTP contract tests for local user authentication."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth import configure_auth_db
from app.main import app
from app.shiguan import db

TEST_LOGIN_VALUE = "six-or-more"


@pytest.fixture
def auth_db_path(tmp_path):
    return tmp_path / "auth.sqlite3"


@pytest.fixture
def client(auth_db_path):
    """Use one isolated authentication database for each HTTP test."""

    configure_auth_db(auth_db_path)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        configure_auth_db(None)


def test_register_login_me_and_logout(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={"username": "court", "email": "Court@Example.com", "password": "six-or-more"},
    )

    assert registration.status_code == 201
    assert set(registration.json()) == {"user", "session_id"}
    assert set(registration.json()["user"]) == {"id", "username", "email"}
    assert registration.json()["user"] == {
        "id": registration.json()["user"]["id"],
        "username": "court",
        "email": "court@example.com",
    }
    session_id = registration.json()["session_id"]
    headers = {"Authorization": f"Bearer {session_id}"}

    username_login = client.post(
        "/api/v1/auth/login", json={"identifier": "court", "password": "six-or-more"}
    )
    assert username_login.status_code == 200
    email_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "COURT@EXAMPLE.COM", "password": "six-or-more"},
    )
    assert email_login.status_code == 200
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert set(me.json()) == {"id", "username", "email"}
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_login_does_not_distinguish_unknown_account_from_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "court", "email": "court@example.com", "password": "six-or-more"},
    )

    unknown = client.post(
        "/api/v1/auth/login", json={"identifier": "missing", "password": "six-or-more"}
    )
    wrong = client.post(
        "/api/v1/auth/login", json={"identifier": "court", "password": "wrong-pass"}
    )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json() == {"message": "invalid credentials"}


def test_rejects_unrecognized_fields_and_malformed_bearer_credentials(client):
    invalid_request = client.post(
        "/api/v1/auth/register",
        json={
            "username": "court",
            "email": "court@example.com",
            "password": "six-or-more",
            "session_id": "not-accepted",
        },
    )

    assert invalid_request.status_code == 422
    missing = client.get("/api/v1/auth/me")
    malformed = client.get("/api/v1/auth/me", headers={"Authorization": "Basic session"})
    assert missing.status_code == malformed.status_code == 401
    assert missing.json() == malformed.json() == {"message": "invalid credentials"}


@pytest.mark.parametrize(
    "payload,route",
    (
        (
            {"username": "u" * 255, "email": "u@example.com", "password": TEST_LOGIN_VALUE},
            "register",
        ),
        (
            {"username": "u", "email": f"{'e' * 243}@example.com", "password": TEST_LOGIN_VALUE},
            "register",
        ),
        ({"username": "u", "email": "u@example.com", "password": "p" * 1025}, "register"),
        ({"identifier": "u" * 255, "password": "password"}, "login"),
        ({"identifier": "u", "password": "p" * 1025}, "login"),
    ),
)
def test_authentication_inputs_have_explicit_size_limits(client, payload, route):
    response = client.post(f"/api/v1/auth/{route}", json=payload)

    assert response.status_code == 422


def test_authentication_accepts_values_at_the_documented_size_limits(client):
    username = "u" * 254
    email = f"{'e' * 242}@example.com"
    password = "p" * 1024

    registration = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert registration.status_code == 201

    login = client.post("/api/v1/auth/login", json={"identifier": username, "password": password})
    assert login.status_code == 200


@pytest.mark.parametrize(
    "field,value",
    (
        ("tenant_id", "client-tenant"),
        ("owner_id", "client-owner"),
        ("membership_id", "client-membership"),
        ("tenant_role", "OWNER"),
        ("role", "OWNER"),
    ),
)
def test_register_and_login_reject_tenant_principal_field_smuggling(client, field, value):
    register_payload = {
        "username": "court",
        "email": "court@example.test",
        "password": TEST_LOGIN_VALUE,
        field: value,
    }
    login_payload = {
        "identifier": "court",
        "password": TEST_LOGIN_VALUE,
        field: value,
    }

    assert client.post("/api/v1/auth/register", json=register_payload).status_code == 422
    assert client.post("/api/v1/auth/login", json=login_payload).status_code == 422


def test_correct_password_with_revoked_membership_is_generic_401_and_adds_no_session(
    client, auth_db_path
):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "username": "court",
            "email": "court@example.test",
            "password": TEST_LOGIN_VALUE,
        },
    )
    assert registration.status_code == 201
    conn = db.get_connection(auth_db_path)
    try:
        user_id = registration.json()["user"]["id"]
        conn.execute(
            "UPDATE tenant_memberships SET revoked_at = ? WHERE user_id = ?",
            ("2026-08-28T00:00:00+00:00", user_id),
        )
        conn.commit()
        before = conn.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0]
    finally:
        conn.close()

    invalid_principal = client.post(
        "/api/v1/auth/login",
        json={"identifier": "court", "password": TEST_LOGIN_VALUE},
    )
    unknown = client.post(
        "/api/v1/auth/login",
        json={"identifier": "unknown", "password": TEST_LOGIN_VALUE},
    )

    assert invalid_principal.status_code == unknown.status_code == 401
    assert invalid_principal.json() == unknown.json() == {
        "message": "invalid credentials"
    }
    conn = db.get_connection(auth_db_path)
    try:
        after = conn.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0]
    finally:
        conn.close()
    assert after == before


def test_public_health_and_protected_route_source_contract():
    """Keep the public health exception and every current owner boundary explicit."""

    backend_root = Path(__file__).resolve().parents[1]
    main_source = (backend_root / "app" / "main.py").read_text(encoding="utf-8")
    decrees_source = (backend_root / "app" / "api" / "decrees.py").read_text(encoding="utf-8")
    shiguan_source = (backend_root / "app" / "api" / "shiguan.py").read_text(encoding="utf-8")

    assert '@app.get("/health", response_model=HealthResponse)' in main_source
    health_block = main_source.split("def health", 1)[1].split("app.include_router", 1)[0]
    assert "CurrentUser" not in health_block
    assert "from app.api.auth import CurrentUser" in decrees_source
    assert "from app.api.auth import CurrentUser" in shiguan_source
    assert "current_user: CurrentUser" in decrees_source
    for handler in (
        "create_archive",
        "get_archive",
        "list_archives",
        "update_review_status",
        "update_archive_decision",
        "get_statistics",
        "recall",
    ):
        handler_block = shiguan_source.split(f"def {handler}", 1)[1].split("\n\ndef ", 1)[0]
        assert "current_user: CurrentUser" in handler_block


@pytest.mark.parametrize(
    "route,payload,storage_function",
    (
        (
            "register",
            {"username": "u" * 255, "email": "u@example.com", "password": TEST_LOGIN_VALUE},
            "register_user",
        ),
        (
            "login",
            {"identifier": "u" * 255, "password": TEST_LOGIN_VALUE},
            "authenticate_and_create_session",
        ),
    ),
)
def test_oversized_authentication_input_never_reaches_storage(
    client, monkeypatch, route, payload, storage_function
):
    from app.api import auth as auth_api

    def storage_must_not_run(*_args, **_kwargs):
        pytest.fail("invalid input reached authentication storage")

    monkeypatch.setattr(auth_api, storage_function, storage_must_not_run)
    assert client.post(f"/api/v1/auth/{route}", json=payload).status_code == 422


@pytest.mark.parametrize("operation", ("register", "login", "me", "logout"))
def test_authentication_storage_failure_has_fixed_public_response(client, monkeypatch, operation):
    from app.api import auth as auth_api
    from app.auth.errors import AuthenticationStorageError

    session_id = None
    if operation in ("me", "logout"):
        registration = client.post(
            "/api/v1/auth/register",
            json={"username": "court", "email": "court@example.com", "password": TEST_LOGIN_VALUE},
        )
        assert registration.status_code == 201
        session_id = registration.json()["session_id"]

    def storage_failure(*_args, **_kwargs):
        raise AuthenticationStorageError("private /data/auth.sqlite3 account-secret")

    storage_function = {
        "register": "register_user",
        "login": "authenticate_and_create_session",
        "me": "get_session_user",
        "logout": "revoke_session",
    }[operation]
    monkeypatch.setattr(auth_api, storage_function, storage_failure)
    if operation == "register":
        response = client.post(
            "/api/v1/auth/register",
            json={"username": "court", "email": "court@example.com", "password": TEST_LOGIN_VALUE},
        )
    elif operation == "login":
        response = client.post(
            "/api/v1/auth/login", json={"identifier": "court", "password": TEST_LOGIN_VALUE}
        )
    else:
        headers = {"Authorization": f"Bearer {session_id}"}
        response = (
            client.get("/api/v1/auth/me", headers=headers)
            if operation == "me"
            else client.post("/api/v1/auth/logout", headers=headers)
        )
    assert response.status_code == 503
    assert response.json() == {
        "code": "AUTH_STORAGE_UNAVAILABLE",
        "message": "account service temporarily unavailable",
    }
