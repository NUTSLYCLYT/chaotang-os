from __future__ import annotations

import hashlib
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.accounting_reports.models import (
    AccountingReportSummary,
    ReportCheck,
    ReportPeriod,
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
    return (SimpleNamespace(source=SimpleNamespace(file_sha256="a" * 64)),)


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

    assert session.maybe_generate("兵部", "会计司", "生成2024年财务报告") is None
    assert session.maybe_generate("户部", "会计司", "分析2024年财务状况") is None
    assert calls == {"load": 0, "analyze": 0, "write": 0}

    first = session.maybe_generate("户部", "会计司", "生成2024年财务报告")
    second = session.maybe_generate("户部", "会计司", "生成2024年财务报告")

    assert first == second
    assert first == _summary().to_model_prompt()
    assert len(first) <= 4000
    assert "synthetic-row" not in first
    assert calls == {"load": 1, "analyze": 1, "write": 1}

    published = session.publish("reply-a")
    assert len(published) == 1
    assert published[0].owner_user_id == "owner-a"
    assert published[0].reply_id == "reply-a"
    assert session.publish("reply-a") == published


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
