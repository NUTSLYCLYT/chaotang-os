"""Response model and installed-distribution version for ``GET /health``."""

from __future__ import annotations

from importlib import metadata

from pydantic import BaseModel

_DISTRIBUTION_NAME = "chaotang-os-backend"


def get_service_version() -> str:
    """Return the version embedded in the installed application wheel.

    A missing distribution is a broken image and deliberately fails closed;
    source files are not a second version fact source.
    """
    return metadata.version(_DISTRIBUTION_NAME)


class HealthResponse(BaseModel):
    """Response body for ``GET /health``."""

    status: str
    service: str
    version: str
