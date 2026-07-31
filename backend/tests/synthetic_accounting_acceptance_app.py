"""Local-only FastAPI app wiring for the synthetic accounting acceptance run."""

from __future__ import annotations

import json
import os
from pathlib import Path

import app.accounting_reports.session as report_session_module
import app.api.chancellor_drafts as chancellor_drafts_api
import app.api.decrees as decrees_api
from app.accounting_reports.session import AccountingReportSession
from app.agents.chancellor import build_chancellor_graph
from app.agents.chancellor_draft import build_chancellor_draft_graph
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.main import app as _app
from app.shiguan import db as shiguan_db
from tests.test_accounting_report_cross_layer import SYNTHETIC_ROWS

app = _app
__all__ = ["app"]

_tmp_root = Path(os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"]).resolve()
_artifact_db = _tmp_root / "artifacts.sqlite3"
ACCOUNTING_DECREE = (
    "请户部会计司根据现有财务数据，生成2024年至2025年管理层综合财务报表，"
    "并交付可下载的 Excel 文件。报告需包括管理摘要、核心财务报表、科目趋势、"
    "异常分析、科目明细、校验结果和数据来源；核对金额、同比变化及勾稽关系，"
    "列明数据缺口，不修改原始数据。"
)

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


def _build_draft_graph():
    payload = {
        "status": "DRAFT_READY",
        "understanding": "生成管理层综合财务报表并交付 Excel。",
        "expert_example": ACCOUNTING_DECREE,
        "recommendation_reason": "由户部会计司按现有财务数据生成并校验。",
        "assumptions": [],
        "revision_prompt": "如需调整报表期间或格式，请直接说明。",
        "draft": {
            "objective": "生成2024年至2025年管理层综合财务报表。",
            "scope": ["管理摘要", "核心财务报表", "趋势、异常、明细和校验"],
            "exclusions": ["不修改原始数据"],
            "input_materials": ["现有财务数据"],
            "material_gaps": [],
            "key_questions": ["现有数据是否覆盖全部期间"],
            "departments": [
                {
                    "department": "户部",
                    "bureaus": ["会计司"],
                    "role": "主审",
                    "reason": "负责财务报表。",
                    "responsibility": "生成并校验报表。",
                    "expected_output": "可下载的 Excel 文件。",
                }
            ],
            "execution_steps": ["读取数据", "生成报表", "执行校验", "交付文件"],
            "deliverables": ["管理层综合财务报表 Excel"],
            "completion_criteria": ["Excel 可下载且校验结果明确"],
            "permissions_and_limits": ["只读原始财务数据"],
            "current_status": "DRAFT_READY",
        },
    }
    return build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    )


chancellor_drafts_api.get_chancellor_draft_graph = _build_draft_graph


def _build_graph(*, report_session: AccountingReportSession):
    responses = iter(
        [
            '{"rationale":"批准会计司办理","bureaus":["会计司"]}',
            '{"opinion":"会计司已生成并核验管理报告"}',
            '{"opinion":"户部确认会计管理报告"}',
            (
                '{"summary":"准予交付会计管理报告",'
                '"recommendations":["核验来源","复核勾稽","审阅报告"]}'
            ),
        ]
    )
    return build_chancellor_graph(
        chat_model=lambda _messages: next(responses),
        lifecycle_observer=decrees_api._lifecycle_observer_context.get(),
        report_session=report_session,
    )


decrees_api.get_chancellor_graph = _build_graph
report_session_module.load_ledger_rows = lambda _source, _period: SYNTHETIC_ROWS
