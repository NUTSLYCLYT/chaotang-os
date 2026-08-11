from __future__ import annotations

import hashlib
import sqlite3
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

import app.accounting_reports.session as session_module
from app.accounting_reports.models import (
    AccountingReportSummary,
    AccountingRequestKind,
    NormalizedLedgerRow,
    ReportCheck,
    ReportPeriod,
    SourceRef,
)
from app.accounting_reports.session import AccountingReportSession


def _summary() -> AccountingReportSummary:
    return AccountingReportSummary(
        period=ReportPeriod(2024, 2024),
        metrics_by_year={
            2024: {
                "assets": Decimal("100"),
                "liabilities": Decimal("40"),
                "equity": Decimal("60"),
                "revenue": Decimal("80"),
                "cost": Decimal("20"),
                "expense": Decimal("10"),
                "profit": Decimal("50"),
                "profit_yoy_amount": None,
                "profit_yoy_rate": None,
            }
        },
        exceptions=(),
        checks=(ReportCheck("coverage", "PASS", "no exceptions"),),
        source_ids=("src_bounded",),
    )


def _rows():
    return (
        NormalizedLedgerRow(
            year=2024,
            category="asset",
            account_code="1001",
            account_name="cash",
            opening_debit=Decimal("0"),
            opening_credit=Decimal("0"),
            movement_debit=Decimal("100"),
            movement_credit=Decimal("0"),
            closing_debit=Decimal("100"),
            closing_credit=Decimal("0"),
            source=SourceRef(
                file_name="synthetic.xlsx",
                sheet_name="ledger",
                row_number=2,
                file_sha256="a" * 64,
            ),
        ),
    )


def _bypass_work_product(session, monkeypatch) -> None:
    monkeypatch.setattr(session, "_build_work_product", lambda **_kwargs: object())
    monkeypatch.setattr(
        session.storage,
        "create_work_product",
        lambda *_args, **_kwargs: None,
    )


def test_bound_accounting_analysis_reuses_preflight_dataset_without_reloading(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    period = ReportPeriod(2025, 2025)
    rows = _rows()
    dataset = SimpleNamespace(ledger_rows=rows, manifest=SimpleNamespace(fingerprint="b" * 64))
    monkeypatch.setattr(
        "app.accounting_reports.session.load_ledger_rows",
        lambda *_args: pytest.fail("bound execution must not reload source files"),
    )
    monkeypatch.setattr(
        "app.accounting_reports.session.detect_accounting_report_intent",
        lambda *_args: pytest.fail("bound execution must not re-infer intent"),
    )
    monkeypatch.setattr(
        "app.accounting_reports.session.analyze_ledger",
        lambda actual_rows, actual_period: (
            _summary()
            if actual_rows == rows and actual_period == period
            else pytest.fail("session did not reuse the bound dataset and period")
        ),
    )

    def fake_write(_rows, _summary, destination):
        payload = b"synthetic analysis workbook"
        Path(destination).write_bytes(payload)
        return hashlib.sha256(payload).hexdigest()

    monkeypatch.setattr("app.accounting_reports.session.write_management_report", fake_write)
    session = AccountingReportSession(
        owner_user_id="owner-a",
        run_id="run-a",
        source_dir=tmp_path / "unused",
        artifact_dir=tmp_path / "artifacts",
        db_path=tmp_path / "artifacts.sqlite3",
        request_kind=AccountingRequestKind.ACCOUNTING_ANALYSIS,
        period=period,
        dataset=dataset,
    )

    generation = session.maybe_generate(
        session.accounting_department,
        session.accounting_bureau,
        "untrusted wording",
    )

    assert generation is not None
    assert generation.request_kind is AccountingRequestKind.ACCOUNTING_ANALYSIS
    assert generation.period == period
    assert generation.owner_user_id == "owner-a"
    assert generation.run_id == "run-a"


def test_maybe_generate_is_strictly_gated_and_generates_once(
    tmp_path: Path, monkeypatch
) -> None:
    calls = {"load": 0, "analyze": 0, "write": 0}

    def fake_load(_source_dir, period):
        calls["load"] += 1
        assert period == ReportPeriod(2024, 2024)
        return _rows()

    def fake_analyze(rows, period):
        calls["analyze"] += 1
        assert rows == _rows()
        assert period == ReportPeriod(2024, 2024)
        return _summary()

    def fake_write(rows, summary, destination):
        calls["write"] += 1
        assert rows == _rows()
        assert summary == _summary()
        payload = b"synthetic workbook"
        Path(destination).write_bytes(payload)
        return hashlib.sha256(payload).hexdigest()

    monkeypatch.setattr("app.accounting_reports.session.load_ledger_rows", fake_load)
    monkeypatch.setattr("app.accounting_reports.session.analyze_ledger", fake_analyze)
    monkeypatch.setattr("app.accounting_reports.session.write_management_report", fake_write)
    session = AccountingReportSession(
        owner_user_id="owner-a",
        run_id="run-a",
        source_dir=tmp_path / "sources",
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    _bypass_work_product(session, monkeypatch)

    assert session.maybe_generate("兵部", "会计司", "生成2024年财务报告") is None
    assert session.maybe_generate("户部", "会计司", "分析2024年财务状况") is None
    assert calls == {"load": 0, "analyze": 0, "write": 0}

    first = session.maybe_generate("户部", "会计司", "生成2024年财务报告")
    second = session.maybe_generate("户部", "会计司", "生成2024年财务报告")

    assert first is second
    assert first.artifact_id
    assert first.model_prompt == _summary().to_model_prompt()
    assert len(first.model_prompt) <= 4000
    assert "synthetic-row" not in first.model_prompt
    assert session.generations == (first,)
    assert calls == {"load": 1, "analyze": 1, "write": 1}
    assert session.storage.get_state(first.artifact_id) == "PENDING"

    published = session.publish("reply-a")
    assert len(published) == 1
    assert published[0].artifact_id == first.artifact_id
    assert published[0].owner_user_id == "owner-a"
    assert published[0].reply_id == "reply-a"
    assert session.storage.get_state(first.artifact_id) == "PUBLISHED"
    assert session.publish("reply-a") == published


@pytest.mark.parametrize(
    "decree_text",
    [
        "读取系统内既有财务数据并生成可下载财务报表",
        "生成2025-2024年财务报表",
    ],
)
def test_unresolved_report_intent_raises_before_creating_pending_artifact(
    decree_text: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    load_calls = 0

    def unexpected_load(_source_dir, _period):
        nonlocal load_calls
        load_calls += 1
        pytest.fail("unresolved report intent must not load source data")

    monkeypatch.setattr(
        "app.accounting_reports.session.load_ledger_rows", unexpected_load
    )
    db_path = tmp_path / "report_artifacts.sqlite3"
    artifact_dir = tmp_path / "report_artifacts"
    session = AccountingReportSession(
        "owner-a",
        "run-a",
        tmp_path / "sources",
        artifact_dir,
        db_path,
    )

    with pytest.raises(
        session_module.AccountingReportIntentError,
        match="^report_period_unresolved$",
    ):
        session.maybe_generate("户部", "会计司", decree_text)

    with sqlite3.connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM report_artifacts").fetchone() == (
            0,
        )
    assert load_calls == 0
    assert session.generations == ()
    assert tuple(artifact_dir.glob("*.xlsx")) == ()


def test_abort_cleans_pending_but_does_not_remove_published(tmp_path: Path, monkeypatch) -> None:
    summary = _summary()
    monkeypatch.setattr(
        "app.accounting_reports.session.load_ledger_rows",
        lambda _source_dir, _period: _rows(),
    )
    monkeypatch.setattr(
        "app.accounting_reports.session.analyze_ledger",
        lambda _rows, _period: summary,
    )

    def fake_write(_rows, _summary, destination):
        payload = b"synthetic workbook"
        Path(destination).write_bytes(payload)
        return hashlib.sha256(payload).hexdigest()

    monkeypatch.setattr("app.accounting_reports.session.write_management_report", fake_write)
    session = AccountingReportSession(
        "owner-a",
        "run-a",
        tmp_path / "sources",
        tmp_path / "report_artifacts",
        tmp_path / "report_artifacts.sqlite3",
    )
    _bypass_work_product(session, monkeypatch)
    session.maybe_generate("户部", "会计司", "生成2024年财务报告")
    published = session.publish("reply-a")[0]

    session.abort()

    assert published.file_path.exists()


def test_registration_failure_removes_untracked_workbook(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.accounting_reports.session.load_ledger_rows",
        lambda _source_dir, _period: _rows(),
    )
    monkeypatch.setattr(
        "app.accounting_reports.session.analyze_ledger",
        lambda _rows, _period: _summary(),
    )

    def fake_write(_rows, _summary, destination):
        payload = b"synthetic workbook"
        Path(destination).write_bytes(payload)
        return hashlib.sha256(payload).hexdigest()

    monkeypatch.setattr("app.accounting_reports.session.write_management_report", fake_write)
    session = AccountingReportSession(
        "owner-a",
        "run-a",
        tmp_path / "sources",
        tmp_path / "report_artifacts",
        tmp_path / "report_artifacts.sqlite3",
    )
    monkeypatch.setattr(
        session.storage,
        "create_pending",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("synthetic failure")),
    )

    with pytest.raises(RuntimeError, match="synthetic failure"):
        session.maybe_generate("户部", "会计司", "生成2024年财务报告")

    assert tuple((tmp_path / "report_artifacts").glob("*.xlsx")) == ()
