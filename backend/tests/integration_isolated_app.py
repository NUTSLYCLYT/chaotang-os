"""Temporary-storage FastAPI wiring used only by cross-process integration QA."""

from __future__ import annotations

import os
from pathlib import Path

from app.api.decree_jobs import get_decree_job_store
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.decree_jobs import DecreeJobStore
from app.main import app
from app.shiguan import db as shiguan_db

__all__ = ["app"]


def _temporary_root() -> Path:
    raw = os.environ.get("CHAOTANG_INTEGRATION_TMP", "").strip()
    if not raw:
        raise RuntimeError("CHAOTANG_INTEGRATION_TMP is required")
    return Path(raw).resolve()


_TMP_ROOT = _temporary_root()
_SHIGUAN_DB = _TMP_ROOT / "shiguan.sqlite3"
_JOB_DB = _TMP_ROOT / "decree_jobs.sqlite3"
_ARTIFACT_DB = _TMP_ROOT / "report_artifacts.sqlite3"

configure_auth_db(_SHIGUAN_DB)
shiguan_db._DEFAULT_DB_PATH = _SHIGUAN_DB
configure_report_artifact_db(_ARTIFACT_DB)

_job_store = DecreeJobStore(_JOB_DB)
app.dependency_overrides[get_decree_job_store] = lambda: _job_store
