"""Safe domain errors for local authentication and session persistence."""

from __future__ import annotations


class AuthenticationError(Exception):
    """Base class for all errors raised by :mod:`app.auth`."""


class UserValidationError(AuthenticationError):
    """Raised when a new user's identity or password is invalid."""


class DuplicateIdentityError(AuthenticationError):
    """Raised when a username or normalized email already exists."""


class UnknownUserError(AuthenticationError):
    """Raised when a session cannot be created for a missing user."""


class AuthenticationStorageError(AuthenticationError):
    """Raised for a database failure without exposing SQLite internals."""
