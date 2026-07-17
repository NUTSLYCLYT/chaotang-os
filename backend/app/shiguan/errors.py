"""Sanitized exception types for the 史馆 (Shiguan) domain.

Every message on these exceptions is meant to be safe to surface to an HTTP
caller (module 2's ``app/api/shiguan.py`` maps them to 404/422/503
respectively): human-readable, field/ID-level detail only, never a raw
``str()`` of an underlying ``sqlite3`` exception, a stack trace, or a
filesystem path.
"""

from __future__ import annotations


class ShiguanError(Exception):
    """Base class for every error raised by ``app.shiguan``."""


class ArchiveNotFoundError(ShiguanError):
    """Raised when a requested archive id does not exist. Maps to HTTP 404."""


class ArchiveValidationError(ShiguanError):
    """Raised when an archive/review-status payload fails validation.

    Maps to HTTP 422. The message may reference field names and the
    offending values a caller already submitted, but never internal
    tracebacks or file paths.
    """


class ShiguanStorageError(ShiguanError):
    """Raised when the sqlite storage layer itself fails (I/O, disk, etc.).

    Maps to HTTP 503. The message is a fixed, generic Chinese sentence and
    never includes the underlying exception's ``str()`` or a filesystem
    path, so a local disk layout or driver error string can never leak.
    """
