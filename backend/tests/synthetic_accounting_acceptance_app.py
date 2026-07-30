"""Local-only FastAPI app wiring for the synthetic accounting acceptance run."""

from __future__ import annotations

import os
from pathlib import Path

import app.accounting_reports.session as report_session_module
import app.api.decrees as decrees_api
from app.accounting_reports.session import AccountingReportSession
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.main import app as _app
from app.shiguan import db as shiguan_db
from tests.test_accounting_report_cross_layer import SYNTHETIC_ROWS, _AccountingGraph

app = _app
__all__ = ["app"]

_tmp_root = Path(os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"]).resolve()
_artifact_db = _tmp_root / "artifacts.sqlite3"

configure_auth_db(_tmp_root / "auth.sqlite3")
configure_report_artifact_db(_artifact_db)
shiguan_db._DEFAULT_DB_PATH = _tmp_root / "shiguan.sqlite3"


def _build_session(*, owner_user_id: str, run_id: str) -> AccountingReportSession:
    return AccountingReportSession(
        owner_user_id=owner_user_id,
        run_id=run_id,
        source_dir=_tmp_root / "synthetic-source",
        artifact_dir=_tmp_root / "report_artifacts",
        db_path=_artifact_db,
    )


decrees_api.build_accounting_report_session = _build_session
decrees_api.get_chancellor_graph = (
    lambda *, report_session: _AccountingGraph(report_session, "single")
)
decrees_api.draft_authority_registry.consume = lambda **_kwargs: True
report_session_module.load_ledger_rows = lambda _source, _period: SYNTHETIC_ROWS
