from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from .analysis import analyze_ledger
from .intent import detect_accounting_report_intent
from .models import AccountingReportSummary, PublishedReportArtifact
from .sources import load_ledger_rows
from .storage import ArtifactStorage
from .workbook import write_management_report


class AccountingReportSession:
    def __init__(
        self,
        owner_user_id: str,
        run_id: str,
        source_dir: Path,
        artifact_dir: Path,
        db_path: Path,
    ) -> None:
        if not owner_user_id.strip() or not run_id.strip():
            raise ValueError("owner_user_id and run_id are required")
        self.owner_user_id = owner_user_id
        self.run_id = run_id
        self.source_dir = Path(source_dir)
        self.storage = ArtifactStorage(
            artifact_dir=Path(artifact_dir),
            db_path=Path(db_path),
        )
        self._summary: AccountingReportSummary | None = None

    def maybe_generate(
        self, department: str, bureau: str, decree_text: str
    ) -> str | None:
        if (department, bureau) != ("户部", "会计司"):
            return None
        intent = detect_accounting_report_intent(decree_text)
        if not intent.requested:
            return None
        if self._summary is not None:
            return self._summary.to_model_prompt()
        assert intent.period is not None
        rows = load_ledger_rows(self.source_dir, intent.period)
        summary = analyze_ledger(rows, intent.period)
        temporary_path = self.storage.artifact_dir / f".{uuid4().hex}.xlsx"
        try:
            file_hash = write_management_report(rows, summary, temporary_path)
            source_hashes = tuple(sorted({row.source.file_sha256 for row in rows}))
            self.storage.create_pending(
                owner_user_id=self.owner_user_id,
                run_id=self.run_id,
                report_type="management",
                display_name=(
                    f"{intent.period.start_year}-{intent.period.end_year}"
                    "会计管理报告.xlsx"
                ),
                period=intent.period,
                source_hashes=source_hashes,
                file_sha256=file_hash,
                pending_path=temporary_path,
            )
        finally:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass
        self._summary = summary
        return summary.to_model_prompt()

    def publish(self, reply_id: str) -> tuple[PublishedReportArtifact, ...]:
        return self.storage.publish_run(self.owner_user_id, self.run_id, reply_id)

    def abort(self) -> None:
        self.storage.abort_run(self.owner_user_id, self.run_id)
