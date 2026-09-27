"""HTTP contract for local user authentication and opaque sessions."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Header
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.auth.errors import AuthenticationStorageError, DuplicateIdentityError, UserValidationError
from app.auth.models import AuthenticatedPrincipal, AuthenticatedUser
from app.auth.storage import (
    authenticate_and_create_session,
    get_session_user,
    register_user,
    revoke_session,
)

_INVALID_CREDENTIALS_MESSAGE = "invalid credentials"

router = APIRouter(prefix="/api/v1/auth")


class RegisterRequest(BaseModel):
    """Strict registration payload; session IDs are never client input."""

    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=254)
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=6, max_length=1024)

    @field_validator("username", "email")
    @classmethod
    def _require_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value.strip()


class LoginRequest(BaseModel):
    """Strict credential payload, accepting a username or email identifier."""

    model_config = ConfigDict(extra="forbid")

    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(max_length=1024)

    @field_validator("identifier")
    @classmethod
    def _require_identifier(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value.strip()


class PublicUserResponse(BaseModel):
    """Public user fields only; password hashes are never serialized."""

    id: str
    username: str
    email: str


class SessionResponse(BaseModel):
    """Authentication success response."""

    user: PublicUserResponse
    session_id: str


class InvalidCredentialsError(Exception):
    """A deliberately opaque authentication failure for all bearer problems."""


def _public_user(user: AuthenticatedUser) -> PublicUserResponse:
    return PublicUserResponse(id=user.id, username=user.username, email=user.email)


def _bearer_session_id(authorization: str | None) -> str:
    if authorization is None:
        raise InvalidCredentialsError
    scheme, separator, session_id = authorization.partition(" ")
    if scheme != "Bearer" or separator != " " or not session_id or " " in session_id:
        raise InvalidCredentialsError
    return session_id


def require_current_user(
    authorization: str | None = Header(default=None),
) -> AuthenticatedPrincipal:
    """Resolve an active bearer session or fail closed with a generic 401."""

    user = get_session_user(_bearer_session_id(authorization))
    if user is None:
        raise InvalidCredentialsError
    return user


CurrentUser = Annotated[AuthenticatedPrincipal, Depends(require_current_user)]


@router.post("/register", response_model=SessionResponse, status_code=201)
def register(payload: RegisterRequest) -> SessionResponse:
    """Register a local user and issue a server-revocable opaque session."""

    principal, session_id = register_user(
        payload.username, payload.email, payload.password
    )
    return SessionResponse(user=_public_user(principal), session_id=session_id)


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest) -> SessionResponse:
    """Issue a new session for a valid username/email and password pair."""

    authenticated = authenticate_and_create_session(payload.identifier, payload.password)
    if authenticated is None:
        raise InvalidCredentialsError
    principal, session_id = authenticated
    return SessionResponse(user=_public_user(principal), session_id=session_id)


@router.post("/logout", status_code=204)
def logout(
    current_user: CurrentUser,
    authorization: str | None = Header(default=None),
) -> Response:
    """Revoke the presented active session."""

    del current_user
    revoke_session(_bearer_session_id(authorization))
    return Response(status_code=204)


@router.get("/me", response_model=PublicUserResponse)
def me(current_user: CurrentUser) -> PublicUserResponse:
    """Return the public identity bound to the active bearer session."""

    return _public_user(current_user)


def register_auth_exception_handlers(app: FastAPI) -> None:
    """Install sanitized authentication error mappings on the application."""

    @app.exception_handler(AuthenticationStorageError)
    async def _handle_storage_unavailable(
        _request, _exc: AuthenticationStorageError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "code": "AUTH_STORAGE_UNAVAILABLE",
                "message": "account service temporarily unavailable",
            },
        )

    @app.exception_handler(InvalidCredentialsError)
    async def _handle_invalid_credentials(_request, _exc: InvalidCredentialsError) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"message": _INVALID_CREDENTIALS_MESSAGE},
        )

    @app.exception_handler(DuplicateIdentityError)
    async def _handle_duplicate_identity(_request, _exc: DuplicateIdentityError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"message": "identity already exists"})

    @app.exception_handler(UserValidationError)
    async def _handle_invalid_registration(_request, _exc: UserValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"message": "invalid registration"})
