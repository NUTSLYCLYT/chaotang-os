"""Typed errors for the Jinyiwei data-gap domain."""

from __future__ import annotations


class JinyiweiError(Exception):
    """Base class for errors raised by the Jinyiwei domain."""


class InvalidDataGapError(JinyiweiError):
    """Raised when a data-gap contract cannot be accepted."""


class DataGapTimedOutError(JinyiweiError):
    """Raised when synchronous evidence collection exceeds its timeout."""


class SourceUnavailableError(JinyiweiError):
    """Raised when an allowed evidence source cannot be queried."""
