"""Local-only FastAPI app wiring for the synthetic accounting acceptance run."""

from __future__ import annotations

import faulthandler
import hashlib
import json
import os
import sqlite3
import threading
import time
import traceback
import uuid
from collections import deque
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from fastapi import Response

import app.accounting_reports.session as report_session_module
import app.agents.structured_invocation as structured_invocation_module
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
from tests.synthetic_accounting_dynamic_layout import (
    _alternate_tool_recovery_audits,
    _generate_dynamic_layout_fixtures,
    _run_dynamic_layout_matrix,
)
from tests.test_accounting_report_cross_layer import SYNTHETIC_ROWS
from tests.test_bureau_tool_handlers import _accounting_payload

app = main_module.app
__all__ = [
    "app",
    "_alternate_tool_recovery_audits",
    "_generate_dynamic_layout_fixtures",
    "_run_dynamic_layout_matrix",
]

_fail_next_execution = False
_execution_hold_lock = threading.Lock()
_execution_hold_armed = False
_execution_hold_started = threading.Event()
_execution_hold_release = threading.Event()
_execution_hold_release.set()
_chat_trace_lock = threading.Lock()
_chat_trace_sequence = 0
_start_nonce = uuid.uuid4().hex
_stage_ring: deque[dict[str, object]] = deque(maxlen=32)
_latest_accounting_provider = None

_tmp_root = Path(os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"]).resolve()
_artifact_db = _tmp_root / "artifacts.sqlite3"
ACCOUNTING_DECREE = "我想用本地数据分析出2025年的财务数据分析一下"
ACCEPTANCE_DECREE = os.environ.get("CHAOTANG_SYNTHETIC_ACCEPTANCE_DECREE", ACCOUNTING_DECREE)
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


class _DiagnosticPersistentExecutor(decree_job_executor.PersistentDecreeJobExecutor):
    def execute(self, job, control):
        try:
            return super().execute(job, control)
        except BaseException:
            traceback.print_exc()
            raise


main_module.PersistentDecreeJobExecutor = _DiagnosticPersistentExecutor

if os.environ.get("CHAOTANG_SYNTHETIC_DIAGNOSTICS") == "1":
    faulthandler.enable()
    faulthandler.dump_traceback_later(20, repeat=True)


@app.get("/__synthetic__/worker-diagnostics/{job_id}")
def _worker_diagnostics(job_id: str, owner_user_id: str | None = None) -> dict[str, object]:
    with sqlite3.connect(_tmp_root / "decree_jobs.sqlite3") as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            """
            SELECT owner_user_id, state, attempt_count, provider_request_count,
                   lease_owner, lease_expires_at, updated_at
            FROM decree_jobs WHERE job_id = ?
            """,
            (job_id,),
        ).fetchone()
    worker = getattr(app.state, "decree_job_worker", None)
    thread = getattr(worker, "_thread", None)
    dependency_job = None
    resolved_owner = owner_user_id or (row["owner_user_id"] if row is not None else None)
    if resolved_owner is not None:
        try:
            job = _get_synthetic_job_store().get_for_owner(job_id, resolved_owner)
            dependency_job = {
                "state": job.state.value,
                "updated_at": job.updated_at.isoformat(),
            }
        except Exception as error:
            dependency_job = {"error": type(error).__name__}
    return {
        "job": dict(row) if row is not None else None,
        "dependency_job": dependency_job,
        "worker_alive": bool(worker is not None and worker.is_alive()),
        "worker_thread_ident": getattr(thread, "ident", None),
        "worker_thread_name": getattr(thread, "name", None),
    }




def _get_synthetic_job_store() -> DecreeJobStore:
    return _job_store


def _accounting_stage_response(stage: str) -> str:
    """Return a deterministic response for an explicit accounting graph stage."""
    if stage == "ministry_route":
        return json.dumps(
            {
                "rationale": "synthetic accounting route",
                "bureaus": ["\u4f1a\u8ba1\u53f8"],
            },
            ensure_ascii=False,
        )
    if stage == "ministry_synthesis":
        return json.dumps(
            {
                "opinion": "synthetic accounting ministry approval",
                "shared_findings": ["accounting workbook generated"],
                "conflicts": [],
                "cross_bureau_impacts": ["management review ready"],
                "ministry_position": ["approve synthetic delivery"],
            },
            ensure_ascii=False,
        )
    if stage == "chancellor_finalize":
        return json.dumps(
            {
                "summary": "synthetic accounting delivery",
                "recommendations": ["review source", "review checks", "review workbook"],
            },
            ensure_ascii=False,
        )
    raise RuntimeError(f"unsupported synthetic structured stage: {stage}")


def _record_chat_trace(rendered: str, label: str, response: object) -> None:
    trace_path = os.environ.get("CHAOTANG_SYNTHETIC_CHAT_TRACE")
    if trace_path is None:
        return
    global _chat_trace_sequence
    with _chat_trace_lock:
        _chat_trace_sequence += 1
        serialized = response if isinstance(response, str) else json.dumps(response, sort_keys=True)
        entry = {
            "sequence": _chat_trace_sequence,
            "prompt_sha256": hashlib.sha256(rendered.encode()).hexdigest(),
            "prompt_length": len(rendered),
            "semantic_label": label,
            "response_kind": "object" if isinstance(response, dict) else "string",
            "response_sha256": hashlib.sha256(serialized.encode()).hexdigest(),
        }
        with Path(trace_path).open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(entry, sort_keys=True) + "\n")


class _SyntheticAccountingChatProvider:
    """Synthetic-only provider routed by governed structured stage metadata."""

    def __init__(self) -> None:
        self._accounting_tool_round = False

    def invoke_structured(self, messages, *, stage: str) -> str:
        rendered = "\n".join(str(message.get("content", "")) for message in messages)
        try:
            response = _accounting_stage_response(stage)
        except Exception:
            _stage_ring.append(
                {"stage": stage, "provider": type(self).__name__, "outcome": "raised"}
            )
            raise
        _stage_ring.append(
            {"stage": stage, "provider": type(self).__name__, "outcome": "returned"}
        )
        _record_chat_trace(rendered, stage, response)
        return response

    def __call__(self, messages):
        rendered = "\n".join(str(message.get("content", "")) for message in messages)
        if "approved_data_refs=" not in rendered:
            raise RuntimeError("unsupported synthetic unstructured invocation")
        if self._accounting_tool_round:
            self._accounting_tool_round = False
            response = {"status": "FINAL", "report": {"opinion": "accounting workbook generated"}}
            _record_chat_trace(rendered, "bureau_tool_final", response)
            return response
        self._accounting_tool_round = True
        refs = rendered.split("approved_data_refs=", 1)[1].splitlines()[0].split(",")
        source_ref = next(item for item in refs if item.endswith("accounting-source-root"))
        content_ref = next(item for item in refs if ":accounting-content-" in item)

        def call(call_id, tool, operation, schema, ref):
            return {
                "tool_call_id": call_id,
                "tool_name": tool,
                "purpose": "authorized accounting acceptance",
                "arguments": {
                    "operation": operation,
                    "domain": "finance.accounting",
                    "data_ref": ref,
                    "fields": ["finance.accounting.ledger_ref"],
                    "estimated_rows": 10,
                    "estimated_bytes": 4096,
                },
                "required_for": ["management workbook"],
                "expected_result_schema": schema,
            }

        response = {
            "status": "TOOL_CALLS",
            "calls": [
                call(
                    "inspect-acceptance",
                    "inspect_accounting_content",
                    "inspect_content",
                    "accounting_content_result.v1",
                    source_ref,
                ),
                call(
                    "generate-acceptance",
                    "generate_accounting_workbook",
                    "generate_workbook",
                    "accounting_workbook_result.v1",
                    content_ref,
                ),
            ],
        }
        _record_chat_trace(rendered, "bureau_tool_calls", response)
        return response


def _is_accounting_ministry_route(rendered: str) -> bool:
    """Legacy helper retained only for the ordinary callable's unreachable branch."""
    return "bureaus" in rendered


def _module_identity(module) -> dict[str, str]:
    path = Path(module.__file__).resolve()
    return {"file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def _synthetic_diagnostics(
    provider=None, *, source_manifest_path: Path | None = None
) -> dict[str, object]:
    resolved = provider or _latest_accounting_provider
    build_id = os.environ.get("CHAOTANG_SYNTHETIC_FRONTEND_BUILD_ID")
    source_manifest_fingerprint = os.environ.get(
        "CHAOTANG_SYNTHETIC_SOURCE_MANIFEST_FINGERPRINT"
    )
    if source_manifest_path is not None:
        manifest = json.loads(source_manifest_path.read_text(encoding="utf-8-sig"))
        source_manifest_fingerprint = manifest.get("fingerprint")
    return {
        "pid": os.getpid(),
        "start_nonce": _start_nonce,
        "provider": {
            "class": type(resolved).__name__ if resolved is not None else None,
            "module": type(resolved).__module__ if resolved is not None else None,
            "has_invoke_structured": bool(
                resolved is not None and hasattr(resolved, "invoke_structured")
            ),
        },
        "stage_ring": list(_stage_ring),
        "modules": {
            "synthetic_app": _module_identity(__import__(__name__, fromlist=["app"])),
            "structured_invocation": _module_identity(structured_invocation_module),
        },
        "build_id": build_id,
        "source_manifest_fingerprint": source_manifest_fingerprint,
    }


@app.get("/__synthetic__/diagnostics")
def _get_synthetic_diagnostics() -> dict[str, object]:
    return _synthetic_diagnostics()


app.dependency_overrides[get_decree_job_store] = _get_synthetic_job_store
main_module.get_decree_job_store = _get_synthetic_job_store


def _build_session(
    *, owner_user_id: str, run_id: str, accounting_context
) -> AccountingReportSession:
    session = AccountingReportSession(
        owner_user_id=owner_user_id,
        run_id=run_id,
        source_dir=_tmp_root / "synthetic-source",
        artifact_dir=_tmp_root / "report_artifacts",
        db_path=_artifact_db,
        request_kind=accounting_context.request_kind if accounting_context else None,
        period=accounting_context.period if accounting_context else None,
        dataset=(SimpleNamespace(ledger_rows=SYNTHETIC_ROWS) if accounting_context else None),
    )
    if accounting_context:

        def inspect_accounting_content(**_kwargs):
            session.dataset = SimpleNamespace(
                ledger_rows=SYNTHETIC_ROWS,
                mapping_decisions=(),
                manifest=SimpleNamespace(fingerprint="synthetic"),
            )
            return _accounting_payload("closing balance")

        session.inspect_accounting_content = inspect_accounting_content
    return session


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
            "departments": [
                {
                    "department": "礼部",
                    "bureaus": ["品牌司"],
                    "role": "主管",
                    "reason": "统一对外品牌表达",
                    "responsibility": "制定发布前检查清单",
                    "expected_output": "一页品牌表达检查清单",
                }
            ],
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
        if source_text in {ACCOUNTING_DECREE, ACCEPTANCE_DECREE}:
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
    global _fail_next_execution, _latest_accounting_provider
    _await_execution_release(execution_boundary or (lambda: None))
    fail_after_generation = _fail_next_execution
    _fail_next_execution = False
    if report_session.request_kind is None:
        responses = iter(
            [
                json.dumps(
                    {"rationale": "交由品牌司办理", "bureaus": ["品牌司"]}, ensure_ascii=False
                ),
                json.dumps(
                    {
                        "status": "READY",
                        "result": {
                            "opinion": "建议统一品牌表达与视觉资产",
                            "factual_claims": [
                                {
                                    "claim": "建议统一品牌表达与视觉资产",
                                    "basis": "NORMATIVE",
                                    "evidence_ids": [],
                                    "fact_key": None,
                                    "category": None,
                                    "subject": None,
                                }
                            ],
                        },
                        "adopted_evidence_ids": [],
                        "fact_basis": "NOT_REQUIRED",
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {"opinion": "礼部补充：对外口径须统一并完成发布门禁。"}, ensure_ascii=False
                ),
                json.dumps(
                    {
                        "summary": "丞相汇总：统一品牌表达并设置发布门禁。",
                        "recommendations": ["统一对外口径", "校验视觉资产", "设置发布门禁"],
                    },
                    ensure_ascii=False,
                ),
            ]
        )
    else:
        responses = iter(
            [
                '{"rationale":"批准会计司办理","bureaus":["会计司"]}',
                "not-json",
                "not-json",
                "not-json",
            ]
            if fail_after_generation
            else [
                '{"rationale":"批准会计司办理","bureaus":["会计司"]}',
                '{"opinion":"会计司已生成并核验管理报告"}',
                '{"opinion":"户部确认会计管理报告"}',
                (
                    '{"summary":"准予交付会计管理报告",'
                    '"recommendations":["核验来源","复核勾稽","审阅报告"]}'
                ),
            ]
        )
    accounting_tool_round = False
    accounting_provider = _SyntheticAccountingChatProvider()
    _latest_accounting_provider = accounting_provider

    def synthetic_chat(messages):
        nonlocal accounting_tool_round
        rendered = "\n".join(str(message.get("content", "")) for message in messages)
        if report_session.request_kind is not None and _is_accounting_ministry_route(
            rendered
        ):
            response = _accounting_stage_response(
                rendered, fail_after_generation=fail_after_generation
            )
            _record_chat_trace(rendered, "ministry_route", response)
            return response
        if report_session.request_kind is not None and "approved_data_refs=" in rendered:
            if accounting_tool_round:
                accounting_tool_round = False
                response = {
                    "status": "FINAL",
                    "report": {"opinion": "accounting workbook generated"},
                }
                _record_chat_trace(rendered, "bureau_tool_final", response)
                return response
            accounting_tool_round = True
            refs = rendered.split("approved_data_refs=", 1)[1].splitlines()[0].split(",")
            source_ref = next(item for item in refs if item.endswith("accounting-source-root"))
            content_ref = next(item for item in refs if ":accounting-content-" in item)

            def call(call_id, tool, operation, schema, ref):
                return {
                    "tool_call_id": call_id,
                    "tool_name": tool,
                    "purpose": "authorized accounting acceptance",
                    "arguments": {
                        "operation": operation,
                        "domain": "finance.accounting",
                        "data_ref": ref,
                        "fields": ["finance.accounting.ledger_ref"],
                        "estimated_rows": 10,
                        "estimated_bytes": 4096,
                    },
                    "required_for": ["management workbook"],
                    "expected_result_schema": schema,
                }

            response = {
                "status": "TOOL_CALLS",
                "calls": [
                    call(
                        "inspect-acceptance",
                        "inspect_accounting_content",
                        "inspect_content",
                        "accounting_content_result.v1",
                        source_ref,
                    ),
                    call(
                        "generate-acceptance",
                        "generate_accounting_workbook",
                        "generate_workbook",
                        "accounting_workbook_result.v1",
                        content_ref,
                    ),
                ],
            }
            _record_chat_trace(rendered, "bureau_tool_calls", response)
            return response
        if report_session.request_kind is not None:
            response = _accounting_stage_response(
                rendered, fail_after_generation=fail_after_generation
            )
            label = "chancellor_finalize" if "recommendations" in rendered else "ministry_synthesis"
            _record_chat_trace(rendered, label, response)
            return response
        return next(responses)

    resolved_chat_model = (
        accounting_provider
        if report_session.request_kind is not None
        else synthetic_chat
    )

    graph = build_chancellor_graph(
        chat_model=resolved_chat_model,
        lifecycle_observer=decrees_api._lifecycle_observer_context.get(),
        report_session=report_session,
        owner_user_id=report_session.owner_user_id,
        execution_boundary=execution_boundary,
    )
    if not fail_after_generation:
        return graph

    class _PostToolFailureGraph:
        def invoke(self, payload):
            graph.invoke(payload)
            raise RuntimeError("synthetic_post_tool_execution_failure")

    return _PostToolFailureGraph()


decrees_api.get_chancellor_graph = _build_graph
report_session_module.load_ledger_rows = lambda _source, _period: SYNTHETIC_ROWS
