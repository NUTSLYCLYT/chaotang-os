"""Local-only FastAPI app wiring for the synthetic accounting acceptance run."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from fastapi import Response

import app.accounting_reports.session as report_session_module
import app.api.chancellor_drafts as chancellor_drafts_api
import app.api.decrees as decrees_api
import app.decree_jobs.executor as decree_job_executor
import app.main as main_module
from app.accounting_reports.session import AccountingReportSession
from app.agents.chancellor import build_chancellor_graph
from app.agents.chancellor_draft import build_chancellor_draft_graph
from app.api.decree_jobs import get_decree_job_store
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db
from app.decree_jobs import DecreeJobStore
from app.shiguan import db as shiguan_db
from tests.test_accounting_report_cross_layer import SYNTHETIC_ROWS

app = main_module.app
__all__ = ["app"]

_fail_next_execution = False
_execution_hold_lock = threading.Lock()
_execution_hold_armed = False
_execution_hold_started = threading.Event()
_execution_hold_release = threading.Event()
_execution_hold_release.set()

_tmp_root = Path(os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"]).resolve()
_artifact_db = _tmp_root / "artifacts.sqlite3"
ACCOUNTING_DECREE = "我想用本地数据分析出2025年的财务数据分析一下"
CANONICAL_DECREE = (
    "请户部会计司根据系统内既有财务数据，生成2025年管理层综合财务报表，"
    "并交付可下载的 Excel 文件。报告需包括管理摘要、核心财务报表、科目趋势、"
    "异常分析、科目明细、校验结果和数据来源；核对金额、同比变化及勾稽关系，"
    "列明数据缺口，不修改原始数据。"
)
ORDINARY_REQUEST = "请礼部品牌司制定一页对外品牌表达检查清单"
ORDINARY_DECREE = "请礼部品牌司统一品牌表达并设置发布门禁，形成一页检查清单。"

configure_auth_db(_tmp_root / "auth.sqlite3")
configure_report_artifact_db(_artifact_db)
shiguan_db._DEFAULT_DB_PATH = _tmp_root / "shiguan.sqlite3"
_job_store = DecreeJobStore(_tmp_root / "decree_jobs.sqlite3")


def _get_synthetic_job_store() -> DecreeJobStore:
    return _job_store


app.dependency_overrides[get_decree_job_store] = _get_synthetic_job_store
main_module.get_decree_job_store = _get_synthetic_job_store


def _build_session(
    *, owner_user_id: str, run_id: str, accounting_context
) -> AccountingReportSession:
    return AccountingReportSession(
        owner_user_id=owner_user_id,
        run_id=run_id,
        source_dir=_tmp_root / "synthetic-source",
        artifact_dir=_tmp_root / "report_artifacts",
        db_path=_artifact_db,
        request_kind=accounting_context.request_kind if accounting_context else None,
        period=accounting_context.period if accounting_context else None,
        dataset=(SimpleNamespace(ledger_rows=SYNTHETIC_ROWS) if accounting_context else None),
    )


decrees_api.build_accounting_report_session = _build_session
decree_job_executor.build_accounting_report_session = _build_session


def _build_draft_graph():
    accounting_payload = {
        "status": "DRAFT_READY",
        "understanding": "生成管理层综合财务报表并交付 Excel。",
        "expert_example": CANONICAL_DECREE,
        "recommendation_reason": "由户部会计司按现有财务数据生成并校验。",
        "assumptions": [],
        "revision_prompt": "如需调整报表期间或格式，请直接说明。",
        "draft": {
            "objective": "生成2025年管理层综合财务报表。",
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
    ordinary_payload = {
        "status": "DRAFT_READY",
        "understanding": "制定一页对外品牌表达检查清单。",
        "expert_example": ORDINARY_DECREE,
        "recommendation_reason": "由礼部品牌司统一口径并设置发布门禁。",
        "assumptions": [],
        "revision_prompt": "如需调整品牌范围或检查项，请直接说明。",
        "draft": {
            "objective": "统一对外品牌表达并设置发布门禁。",
            "scope": ["品牌口径", "视觉资产", "发布门禁"],
            "exclusions": ["不修改既有财务数据"],
            "input_materials": ["现有品牌规范"],
            "material_gaps": [],
            "key_questions": ["检查清单是否覆盖所有发布渠道"],
            "departments": [{
                "department": "礼部",
                "bureaus": ["品牌司"],
                "role": "主管",
                "reason": "统一对外品牌表达",
                "responsibility": "制定发布前检查清单",
                "expected_output": "一页品牌表达检查清单",
            }],
            "execution_steps": ["核对品牌口径", "检查视觉资产", "设置发布门禁"],
            "deliverables": ["一页品牌表达检查清单"],
            "completion_criteria": ["三类检查项均有明确结论"],
            "permissions_and_limits": ["只读现有品牌规范"],
            "current_status": "DRAFT_READY",
        },
    }

    def synthetic_model(messages):
        source_text = next(
            (
                str(message.get("content", "")).strip()
                for message in reversed(messages)
                if message.get("role") == "user"
            ),
            "",
        )
        if source_text == ACCOUNTING_DECREE:
            payload = accounting_payload
        elif source_text == ORDINARY_REQUEST:
            payload = ordinary_payload
        else:
            raise RuntimeError("unsupported synthetic draft prompt")
        return json.dumps(payload, ensure_ascii=False)

    return build_chancellor_draft_graph(
        chat_model=synthetic_model,
        today_provider=lambda: date(2026, 8, 5),
        accounting_source_dir=_tmp_root / "synthetic-source",
        accounting_source_loader=lambda _source, period: SimpleNamespace(
            ledger_rows=SYNTHETIC_ROWS,
            manifest=SimpleNamespace(period=period, fingerprint="a" * 64),
            subject_identity="synthetic-entity-2025",
        ),
    )


chancellor_drafts_api.get_chancellor_draft_graph = _build_draft_graph


@app.post("/__synthetic__/fail-next", status_code=204)
def _fail_next() -> Response:
    global _fail_next_execution
    _fail_next_execution = True
    return Response(status_code=204)


def _arm_execution_hold() -> None:
    global _execution_hold_armed
    with _execution_hold_lock:
        _execution_hold_started.clear()
        _execution_hold_release.clear()
        _execution_hold_armed = True


def _release_execution_hold() -> None:
    _execution_hold_release.set()


def _execution_hold_status() -> dict[str, bool]:
    with _execution_hold_lock:
        armed = _execution_hold_armed
    return {
        "armed": armed,
        "started": _execution_hold_started.is_set(),
        "released": _execution_hold_release.is_set(),
    }


def _await_execution_release(execution_boundary) -> None:
    global _execution_hold_armed
    with _execution_hold_lock:
        if not _execution_hold_armed:
            return
        _execution_hold_armed = False
        _execution_hold_started.set()
    deadline = time.monotonic() + 120
    try:
        while True:
            execution_boundary()
            if _execution_hold_release.wait(timeout=0.1):
                return
            if time.monotonic() >= deadline:
                raise RuntimeError("synthetic execution hold timed out")
    finally:
        _execution_hold_started.clear()


@app.post("/__synthetic__/hold-next", status_code=204)
def _hold_next_execution() -> Response:
    _arm_execution_hold()
    return Response(status_code=204)


@app.get("/__synthetic__/hold-status")
def _get_execution_hold_status() -> dict[str, bool]:
    return _execution_hold_status()


@app.post("/__synthetic__/release", status_code=204)
def _release_held_execution() -> Response:
    _release_execution_hold()
    return Response(status_code=204)


def _build_graph(
    *,
    report_session: AccountingReportSession,
    execution_boundary=None,
):
    global _fail_next_execution
    _await_execution_release(execution_boundary or (lambda: None))
    fail_after_generation = _fail_next_execution
    _fail_next_execution = False
    if report_session.request_kind is None:
        responses = iter([
            json.dumps({"rationale": "交由品牌司办理", "bureaus": ["品牌司"]}, ensure_ascii=False),
            json.dumps({
                "status": "READY",
                "result": {
                    "opinion": "建议统一品牌表达与视觉资产",
                    "factual_claims": [{
                        "claim": "建议统一品牌表达与视觉资产",
                        "basis": "NORMATIVE",
                        "evidence_ids": [],
                        "fact_key": None,
                        "category": None,
                        "subject": None,
                    }],
                },
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            }, ensure_ascii=False),
            json.dumps({"opinion": "礼部补充：对外口径须统一并完成发布门禁。"}, ensure_ascii=False),
            json.dumps({
                "summary": "丞相汇总：统一品牌表达并设置发布门禁。",
                "recommendations": ["统一对外口径", "校验视觉资产", "设置发布门禁"],
            }, ensure_ascii=False),
        ])
    else:
        responses = iter(
            [
            '{"rationale":"批准会计司办理","bureaus":["会计司"]}',
            "not-json",
            "not-json",
            "not-json",
            ] if fail_after_generation else [
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
        owner_user_id=report_session.owner_user_id,
        execution_boundary=execution_boundary,
    )


decrees_api.get_chancellor_graph = _build_graph
report_session_module.load_ledger_rows = lambda _source, _period: SYNTHETIC_ROWS
