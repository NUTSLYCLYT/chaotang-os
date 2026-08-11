from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from app.accounting_reports.models import (
    AccountingReportSummary,
    AccountingRequestKind,
    PendingReportArtifact,
    PublishedReportArtifact,
    ReportCheck,
    ReportPeriod,
)
from app.accounting_reports.session import AccountingReportGeneration, AccountingReportSession
from app.accounting_reports.source_manifest import (
    BALANCE_LEDGER_V1,
    AccountingSourceFile,
    AccountingSourceManifest,
    SourceRole,
)


def test_sensitive_accounting_domain_objects_have_closed_safe_repr(tmp_path: Path) -> None:
    marker = "sensitive-marker"
    source = AccountingSourceFile(
        year=2025,
        role=SourceRole.BALANCE_LEDGER,
        schema_id=BALANCE_LEDGER_V1,
        basename=f"{marker}.xlsx",
        sha256="a" * 64,
        path=(tmp_path / f"{marker}.xlsx").resolve(),
        content=marker.encode(),
    )
    manifest = AccountingSourceManifest(ReportPeriod(2025, 2025), (source,), "b" * 64)
    generation = AccountingReportGeneration(
        artifact_id="artifact",
        model_prompt=f"prompt-{marker}",
        request_kind=AccountingRequestKind.ACCOUNTING_ANALYSIS,
        period=ReportPeriod(2025, 2025),
        owner_user_id=f"owner-{marker}",
        run_id=f"run-{marker}",
    )
    session = AccountingReportSession(
        f"owner-{marker}",
        f"run-{marker}",
        tmp_path / marker,
        tmp_path / "artifacts",
        tmp_path / "artifacts.sqlite3",
    )
    check = ReportCheck(marker, "FAIL", marker)
    summary = AccountingReportSummary(
        period=ReportPeriod(2025, 2025),
        metrics_by_year={2025: {marker: Decimal("123.45")}},
        exceptions=(marker,),
        checks=(check,),
        source_ids=(marker,),
    )
    artifact_kwargs = {
        "artifact_id": "artifact",
        "owner_user_id": f"owner-{marker}",
        "run_id": f"run-{marker}",
        "report_type": "management",
        "period": ReportPeriod(2025, 2025),
        "source_sha256": "c" * 64,
        "file_sha256": "d" * 64,
        "display_name": f"{marker}.xlsx",
        "file_path": tmp_path / f"{marker}.xlsx",
    }
    pending = PendingReportArtifact(**artifact_kwargs)
    published = PublishedReportArtifact(
        **artifact_kwargs,
        reply_id=f"reply-{marker}",
        generated_at=datetime(2025, 1, 1, tzinfo=UTC),
    )

    rendered = " ".join(
        repr(value)
        for value in (
            source,
            manifest,
            generation,
            session,
            check,
            summary,
            pending,
            published,
        )
    )
    assert marker not in rendered
    assert "123.45" not in rendered
    assert "prompt-" not in rendered


def test_metadata_runner_has_no_basename_path_label_or_amount_fields() -> None:
    runner = Path(__file__).with_name("run_accounting_local_metadata_acceptance.py")
    source = runner.read_text(encoding="utf-8")
    forbidden = (
        '"basename"',
        '"sources"',
        '"statement_sheet_rows"',
        "sheet_name",
        "item_name",
        "account_name",
        "model_prompt",
    )
    assert not any(token in source for token in forbidden)
