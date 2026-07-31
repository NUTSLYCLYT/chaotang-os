"""FastAPI application entrypoint for the chaotang-os local MVP.

The shared application preserves ``GET /health`` and additionally mounts the
versioned Chancellor decree router. Business graph logic remains in
``app.agents`` and HTTP contracts remain in ``app.api``; this module only
assembles them onto one FastAPI application.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.api.auth import register_auth_exception_handlers
from app.api.auth import router as auth_router
from app.api.chancellor_consult import register_chancellor_consult_exception_handlers
from app.api.chancellor_consult import router as chancellor_consult_router
from app.api.chancellor_drafts import register_chancellor_draft_exception_handlers
from app.api.chancellor_drafts import router as chancellor_drafts_router
from app.api.decrees import register_chancellor_exception_handlers
from app.api.decrees import router as decrees_router
from app.api.jinyiwei import register_jinyiwei_exception_handlers
from app.api.jinyiwei import router as jinyiwei_router
from app.api.junjichu_cases import router as junjichu_cases_router
from app.api.qintianjian import register_qintianjian_exception_handlers
from app.api.qintianjian import router as qintianjian_router
from app.api.report_artifacts import router as report_artifacts_router
from app.api.shiguan import register_shiguan_exception_handlers
from app.api.shiguan import router as shiguan_router
from app.health import HealthResponse, get_service_version

SERVICE_NAME = "chaotang-os-backend"

app = FastAPI(title=SERVICE_NAME)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report basic service liveness for automated and manual checks."""
    return HealthResponse(status="ok", service=SERVICE_NAME, version=get_service_version())


app.include_router(decrees_router)
register_chancellor_exception_handlers(app)

app.include_router(chancellor_consult_router)
register_chancellor_consult_exception_handlers(app)

app.include_router(chancellor_drafts_router)
register_chancellor_draft_exception_handlers(app)

app.include_router(shiguan_router)
register_shiguan_exception_handlers(app)

app.include_router(jinyiwei_router)
register_jinyiwei_exception_handlers(app)

app.include_router(junjichu_cases_router)

app.include_router(report_artifacts_router)

app.include_router(qintianjian_router)
register_qintianjian_exception_handlers(app)

app.include_router(auth_router)
register_auth_exception_handlers(app)
