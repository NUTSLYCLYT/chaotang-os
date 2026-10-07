"""FastAPI application entrypoint for the chaotang-os local MVP.

The shared application preserves ``GET /health`` and additionally mounts the
versioned Chancellor decree router. Business graph logic remains in
``app.agents`` and HTTP contracts remain in ``app.api``; this module only
assembles them onto one FastAPI application.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.auth import register_auth_exception_handlers
from app.api.auth import router as auth_router
from app.api.bingbu import register_bingbu_exception_handlers
from app.api.bingbu import router as bingbu_router
from app.api.capabilities import router as capabilities_router
from app.api.chancellor_consult import register_chancellor_consult_exception_handlers
from app.api.chancellor_consult import router as chancellor_consult_router
from app.api.chancellor_drafts import register_chancellor_draft_exception_handlers
from app.api.chancellor_drafts import router as chancellor_drafts_router
from app.api.daily_memorial_drafts import register_daily_memorial_exception_handlers
from app.api.daily_memorial_drafts import router as daily_memorial_router
from app.api.decree_jobs import get_decree_job_store
from app.api.decree_jobs import router as decree_jobs_router
from app.api.decrees import register_chancellor_exception_handlers
from app.api.decrees import router as decrees_router
from app.api.jinyiwei import register_jinyiwei_exception_handlers
from app.api.jinyiwei import router as jinyiwei_router
from app.api.junjichu_cases import router as junjichu_cases_router
from app.api.mingshuo import router as mingshuo_router
from app.api.qintianjian import register_qintianjian_exception_handlers
from app.api.qintianjian import router as qintianjian_router
from app.api.report_artifacts import router as report_artifacts_router
from app.api.scene_packs import router as scene_packs_router
from app.api.shiguan import register_shiguan_exception_handlers
from app.api.shiguan import router as shiguan_router
from app.decree_jobs import DecreeJobWorker
from app.decree_jobs.executor import PersistentDecreeJobExecutor
from app.health import HealthResponse, get_service_version
from app.langgraph_runtime.provider_budget import (
    configure_provider_attempt_budget_from_environment,
)
from app.readiness import run_readiness_preflight

SERVICE_NAME = "chaotang-os-backend"


configure_provider_attempt_budget_from_environment()


def _worker_enabled() -> bool:
    configured = os.environ.get("CHAOTANG_DECREE_JOB_WORKER_ENABLED")
    if configured is None:
        return True
    return configured.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker: DecreeJobWorker | None = None
    if _worker_enabled():
        worker = DecreeJobWorker(
            get_decree_job_store(),
            PersistentDecreeJobExecutor(),
            worker_id=uuid.uuid4().hex,
        )
        app.state.decree_job_worker = worker
        worker.start()
    try:
        yield
    finally:
        if worker is not None:
            worker.stop()


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report basic service liveness for automated and manual checks."""
    return HealthResponse(status="ok", service=SERVICE_NAME, version=get_service_version())


@app.get("/readyz")
def readiness() -> JSONResponse:
    try:
        result = run_readiness_preflight()
    except Exception:
        return JSONResponse(status_code=503, content={"codes": ["readiness_check_failed"]})
    if result.ready:
        worker = getattr(app.state, "decree_job_worker", None)
        if worker is None or not worker.is_alive():
            return JSONResponse(
                status_code=503, content={"codes": ["worker_not_running"]}
            )
        return JSONResponse(status_code=200, content={"codes": ["ready"]})
    return JSONResponse(status_code=503, content={"codes": list(result.codes)})


app.include_router(decrees_router)
register_chancellor_exception_handlers(app)

app.include_router(decree_jobs_router)

app.include_router(chancellor_consult_router)
register_chancellor_consult_exception_handlers(app)

app.include_router(chancellor_drafts_router)
register_chancellor_draft_exception_handlers(app)

app.include_router(shiguan_router)
register_shiguan_exception_handlers(app)

app.include_router(daily_memorial_router)
register_daily_memorial_exception_handlers(app)

app.include_router(jinyiwei_router)
register_jinyiwei_exception_handlers(app)

app.include_router(junjichu_cases_router)

app.include_router(capabilities_router)

app.include_router(report_artifacts_router)

app.include_router(qintianjian_router)
register_qintianjian_exception_handlers(app)

app.include_router(auth_router)
register_auth_exception_handlers(app)

app.include_router(scene_packs_router)

app.include_router(mingshuo_router)

app.include_router(bingbu_router)
register_bingbu_exception_handlers(app)
