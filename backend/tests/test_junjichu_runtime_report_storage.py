from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

import pytest

import app.agents.runtime_skills.executor as runtime_executor
from app.agents.runtime_skills.models import (
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    SkillInvocation,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry
from app.api import decrees as decrees_module
from app.junjichu_cases import models, storage


def _bound_case_input() -> models.JunjichuCaseOpenInput:
    return models.JunjichuCaseOpenInput(
        decree_text="请户部、刑部会审已批准证据",
        route_type="multi",
        departments=["户部", "刑部"],
        processing_path=["上书房", "丞相（首次分流）", "军机处（召集）"],
        run_id="job-1",
        decree_id="job-1",
        draft_fingerprint="a" * 64,
        route_digest="b" * 64,
    )


def _ministry_report(department: str) -> MinistryReport:
    values = {
        "户部": ("hubu", "synthesize-finance-governance"),
        "刑部": ("xingbu", "synthesize-risk-governance"),
    }
    slug, skill_id = values[department]
    return MinistryReport(
        report_id=f"ministry-report:{slug}",
        request_id="request:job-1",
        agent_id=f"ministry-{slug}",
        skill_id=skill_id,
        skill_version="1.0.0",
        subject=department,
        executive_summary=f"{department}已完成受控复核",
        input_refs=(f"bureau-report:{slug}",),
        evidence_refs=(f"evidence:{slug}",),
        audit_refs=(f"audit:{slug}",),
        data_gaps=(),
        evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
        status=ReportStatus.COMPLETED,
        selected_bureaus=("测试司",),
        selection_reasons=("approved route",),
        bureau_report_refs=(f"bureau-report:{slug}",),
        shared_findings=(f"{department} finding",),
        conflicts=(),
        cross_bureau_impacts=(),
        ministry_position=(f"{department} position",),
        unresolved_items=(),
        created_at=datetime(2026, 8, 14, tzinfo=UTC),
    )


def _council_report(reports: tuple[MinistryReport, ...]) -> CouncilReport:
    return CouncilReport(
        report_id="council-report:job-1",
        request_id="request:job-1",
        agent_id="junjichu",
        skill_id="conduct-joint-ministry-review",
        skill_version="1.0.0",
        subject="跨部会审",
        executive_summary="军机处完成确定性合议",
        input_refs=tuple(report.report_id for report in reports),
        evidence_refs=tuple(
            ref for report in reports for ref in report.evidence_refs
        ),
        audit_refs=tuple(ref for report in reports for ref in report.audit_refs),
        data_gaps=(),
        evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
        status=ReportStatus.COMPLETED,
        participating_ministries=("户部", "刑部"),
        review_order=("户部", "刑部"),
        ministry_report_refs=tuple(report.report_id for report in reports),
        consensus=("两部证据链一致",),
        disagreements=(),
        cross_ministry_dependencies=("户部成本结论受刑部合规边界约束",),
        joint_options=("保持只读预览",),
        matters_for_chancellor_decision=(),
        created_at=datetime(2026, 8, 14, tzinfo=UTC),
    )


def test_owner_scoped_case_persists_exact_typed_runtime_reports(tmp_path: Path) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    reports = (_ministry_report("户部"), _ministry_report("刑部"))
    records = tuple(
        storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=report,
            db_path=db_path,
        )
        for report in reports
    )
    council_record = storage.append_runtime_council_report(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        report=_council_report(reports),
        db_path=db_path,
    )

    snapshot = storage.get_runtime_report_snapshot(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        db_path=db_path,
    )

    assert snapshot.case_id == case.id
    assert snapshot.owner_user_id == "owner-a"
    assert snapshot.run_id == "job-1"
    assert snapshot.route_digest == "b" * 64
    assert snapshot.case_status == "MINISTRY_REVIEWING"
    assert snapshot.receipt_ref is None
    assert snapshot.ministry_records == records
    assert snapshot.council_record == council_record
    assert tuple(record.report for record in snapshot.ministry_records) == reports


def test_advanced_case_reuses_first_timestamp_for_real_runtime_report_retry(
    tmp_path: Path, monkeypatch
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    skill = build_default_downstream_skill_registry().get_by_agent("ministry-hubu")
    refs = tuple(
        f"material-{index}"
        for index, _requirement in enumerate(skill.data_requirements, start=1)
    )
    invocation = SkillInvocation(
        request_id="request:job-1",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=refs,
        requirement_data_refs={
            requirement: (refs[index],)
            for index, requirement in enumerate(skill.data_requirements)
        },
    )
    raw = json.dumps(
        {
            "subject": "户部复核",
            "executive_summary": "证据链一致",
            "evidence_sufficiency": "sufficient",
            "status": "completed",
            "selected_bureaus": ["测试司"],
            "selection_reasons": ["approved route"],
            "bureau_report_refs": ["bureau-report:hubu"],
            "shared_findings": ["户部 finding"],
            "conflicts": [],
            "cross_bureau_impacts": [],
            "ministry_position": ["户部 position"],
            "unresolved_items": [],
        }
    )
    generated_times = iter(
        (
            datetime(2026, 8, 14, 8, 0, 0, 1, tzinfo=UTC),
            datetime(2026, 8, 14, 8, 0, 0, 2, tzinfo=UTC),
        )
    )

    class AdvancingClock:
        @classmethod
        def now(cls, timezone):
            assert timezone is UTC
            return next(generated_times)

    monkeypatch.setattr(runtime_executor, "datetime", AdvancingClock)
    first_report = runtime_executor.execute_runtime_skill(
        invocation, skill, {}, lambda _messages: raw
    ).report
    second_report = runtime_executor.execute_runtime_skill(
        invocation, skill, {}, lambda _messages: raw
    ).report
    assert isinstance(first_report, MinistryReport)
    assert isinstance(second_report, MinistryReport)
    assert first_report.created_at != second_report.created_at

    first_record = storage.append_runtime_ministry_report(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        report=first_report,
        db_path=db_path,
    )
    storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        council_verdict="已完成会审",
        db_path=db_path,
    )
    replayed = storage.append_runtime_ministry_report(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        report=second_report,
        db_path=db_path,
    )

    assert replayed == first_record
    with pytest.raises(storage.JunjichuRuntimeReportError, match="conflict"):
        storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=second_report.model_copy(
                update={"executive_summary": "替换后的业务内容"}
            ),
            db_path=db_path,
        )


def test_runtime_report_store_is_owner_scoped_and_non_enumerating(tmp_path: Path) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )

    with pytest.raises(
        storage.JunjichuRuntimeReportError,
        match="record_not_found_or_not_authorized",
    ):
        storage.get_runtime_report_snapshot(
            case.id,
            owner_user_id="owner-b",
            run_id="job-1",
            db_path=db_path,
        )
    with pytest.raises(
        storage.JunjichuRuntimeReportError,
        match="record_not_found_or_not_authorized",
    ):
        storage.get_runtime_report_snapshot(
            "missing-case",
            owner_user_id="owner-a",
            run_id="job-1",
            db_path=db_path,
        )


def test_runtime_reports_require_bound_case_exact_order_and_registry_identity(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    legacy = storage.open_case(
        models.JunjichuCaseOpenInput(
            decree_text="legacy",
            route_type="multi",
            departments=["户部", "刑部"],
            processing_path=["上书房", "军机处（召集）"],
        ),
        owner_user_id="owner-a",
        db_path=db_path,
    )
    with pytest.raises(
        storage.JunjichuRuntimeReportError, match="case_execution_binding_unavailable"
    ):
        storage.append_runtime_ministry_report(
            legacy.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=_ministry_report("户部"),
            db_path=db_path,
        )

    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    with pytest.raises(
        storage.JunjichuRuntimeReportError, match="ministry_report_order_mismatch"
    ):
        storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=_ministry_report("刑部"),
            db_path=db_path,
        )
    wrong = _ministry_report("户部").model_copy(
        update={"skill_id": "synthesize-risk-governance"}
    )
    with pytest.raises(
        storage.JunjichuRuntimeReportError,
        match="ministry_report_skill_binding_mismatch",
    ):
        storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=wrong,
            db_path=db_path,
        )


def test_runtime_report_rows_and_case_execution_binding_are_immutable(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    storage.append_runtime_ministry_report(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        report=_ministry_report("户部"),
        db_path=db_path,
    )

    connection = sqlite3.connect(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute(
                "UPDATE junjichu_runtime_reports SET content_digest = ?",
                ("f" * 64,),
            )
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute(
                "UPDATE junjichu_cases SET route_digest = ? WHERE id = ?",
                ("c" * 64, case.id),
            )
    finally:
        connection.close()


@pytest.mark.parametrize(
    ("column", "value"),
    (
        ("owner_user_id", "owner-b"),
        ("run_id", "job-2"),
        ("position", 1),
        ("agent_id", "ministry-xingbu"),
        ("skill_id", "synthesize-risk-governance"),
        ("skill_version", "9.9.9"),
        ("content_digest", "f" * 64),
    ),
)
def test_runtime_report_reload_fails_closed_on_row_metadata_drift(
    tmp_path: Path, column: str, value: object
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    storage.append_runtime_ministry_report(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        report=_ministry_report("户部"),
        db_path=db_path,
    )

    connection = sqlite3.connect(db_path)
    try:
        connection.execute("DROP TRIGGER junjichu_runtime_reports_no_update")
        connection.execute(
            f"UPDATE junjichu_runtime_reports SET {column} = ? WHERE case_id = ?",
            (value, case.id),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(
        storage.JunjichuRuntimeReportError,
        match="runtime_report_store_unavailable",
    ):
        storage.get_runtime_report_snapshot(
            case.id,
            owner_user_id="owner-a",
            run_id="job-1",
            db_path=db_path,
        )


def test_failed_and_archived_cases_reject_reports_and_archive_receipt_is_immutable(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    failed = storage.open_case(
        _bound_case_input(), owner_user_id="owner-a", db_path=db_path
    )
    storage.fail_case(
        failed.id,
        owner_user_id="owner-a",
        db_path=db_path,
    )
    with pytest.raises(
        storage.JunjichuRuntimeReportError, match="case_lifecycle_mismatch"
    ):
        storage.append_runtime_ministry_report(
            failed.id,
            owner_user_id="owner-a",
            run_id="job-1",
            report=_ministry_report("户部"),
            db_path=db_path,
        )

    archived = storage.open_case(
        _bound_case_input().model_copy(update={"run_id": "job-2", "decree_id": "job-2"}),
        owner_user_id="owner-a",
        db_path=db_path,
    )
    storage.record_checkpoint(
        archived.id,
        owner_user_id="owner-a",
        status="COUNCIL_REVIEWING",
        council_verdict="军机处完成只读会审",
        db_path=db_path,
    )
    storage.record_checkpoint(
        archived.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        db_path=db_path,
    )
    storage.archive_case(
        archived.id,
        owner_user_id="owner-a",
        reply_id="reply-2",
        db_path=db_path,
    )
    snapshot = storage.get_runtime_report_snapshot(
        archived.id,
        owner_user_id="owner-a",
        run_id="job-2",
        db_path=db_path,
    )
    assert snapshot.case_status == "ARCHIVED"
    assert snapshot.receipt_ref == "reply-2"

    with pytest.raises(
        storage.JunjichuRuntimeReportError, match="case_lifecycle_mismatch"
    ):
        storage.append_runtime_ministry_report(
            archived.id,
            owner_user_id="owner-a",
            run_id="job-2",
            report=_ministry_report("户部"),
            db_path=db_path,
        )

    connection = sqlite3.connect(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError, match="terminal case is immutable"):
            connection.execute(
                "UPDATE junjichu_cases SET reply_id = ? WHERE id = ?",
                ("forged-reply", archived.id),
            )
    finally:
        connection.close()


def test_production_lifecycle_observer_persists_typed_reports_for_bound_run(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    observer = decrees_module._StorageCaseLifecycleObserver(
        "owner-a",
        run_id="job-1",
        draft_fingerprint="a" * 64,
        route_digest="b" * 64,
        approved_departments=("户部", "刑部"),
        db_path=db_path,
    )
    observer.open_case(
        decree_text="请户部、刑部会审已批准证据",
        departments=["户部", "刑部"],
        processing_path=["上书房", "军机处（召集）"],
    )
    reports = (_ministry_report("户部"), _ministry_report("刑部"))
    for report in reports:
        observer.record_ministry_report(report)
    observer.record_council_report(_council_report(reports))

    case = storage.list_cases(owner_user_id="owner-a", db_path=db_path)[0]
    snapshot = storage.get_runtime_report_snapshot(
        case.id,
        owner_user_id="owner-a",
        run_id="job-1",
        db_path=db_path,
    )

    assert tuple(item.report for item in snapshot.ministry_records) == reports
    assert observer.ministry_report_digests == tuple(
        item.content_digest for item in snapshot.ministry_records
    )
    assert snapshot.council_record is not None
    assert snapshot.council_record.report == _council_report(reports)
    assert observer.council_report_digest == snapshot.council_record.content_digest
