"""FastAPI application entrypoint for the chaotang-os backend foundation.

This module intentionally only exposes ``GET /health``. It does not carry
business APIs, an agent runtime, task orchestration, or persistence; see
docs/product/tasks/2026-07-16-bootstrap-frontend-backend-foundations.md for
the current scope and non-goals.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.health import HealthResponse, get_service_version

SERVICE_NAME = "chaotang-os-backend"

app = FastAPI(title=SERVICE_NAME)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report basic service liveness for automated and manual checks."""
    return HealthResponse(status="ok", service=SERVICE_NAME, version=get_service_version())
