"""Response model and version resolution for GET /health."""

from __future__ import annotations

import tomllib
from pathlib import Path

from pydantic import BaseModel

_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"
_FALLBACK_VERSION = "0.0.0"


def get_service_version() -> str:
    """Read the backend service version straight from ``pyproject.toml``.

    Reading the file directly (instead of relying on installed package
    metadata via ``importlib.metadata``) keeps the value correct whether the
    project is running from an editable install, a plain ``PYTHONPATH``
    checkout, or a container without full package metadata. Falls back to
    ``0.0.0`` if the file is missing or malformed so the health endpoint
    never fails purely because of a metadata read issue.
    """
    try:
        with _PYPROJECT_PATH.open("rb") as pyproject_file:
            data = tomllib.load(pyproject_file)
        return str(data["project"]["version"])
    except (OSError, KeyError, tomllib.TOMLDecodeError):
        return _FALLBACK_VERSION


class HealthResponse(BaseModel):
    """Response body for ``GET /health``."""

    status: str
    service: str
    version: str
