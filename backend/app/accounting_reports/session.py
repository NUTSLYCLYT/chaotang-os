from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from app.work_products import (
    ArtifactGateStatus,
    ArtifactManifestItem,
    ArtifactState,
    ConfirmationStatus,
    WorkProductEnvelope,
    semantic_digest,
)

from .analysis import _family, _oriented_amount, analyze_ledger, signed_closing
from .contract import (
    _ledger_fact_id,
    evaluate_accounting_artifact_gate,
    evaluate_accounting_report,
    mapping_publication_reason_codes,
)
from .intent import detect_accounting_report_intent
from .models import (
    AccountingReportNumber,
    AccountingReportSummary,
    AccountingRequestKind,
    AccountingSourceReceipt,
    NormalizedLedgerRow,
    PublishedReportArtifact,
    ReportAnalysis,
    ReportIntentKind,
    ReportPeriod,
)
from .sources import load_ledger_rows
from .storage import ArtifactStorage, ArtifactStorageError
from .workbook import SHEET_NAMES, write_management_report

_ACCOUNTING_RULES_VERSION = "accounting-rules-v1"
_RENDERER_VERSION = "accounting-workbook-v1"
_CAPABILITY_ID = "accounting-report"


class AccountingReportIntentError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True, repr=False)
class AccountingReportGeneration:
    artifact_id: str
    model_prompt: str
    request_kind: AccountingRequestKind
    period: ReportPeriod
    owner_user_id: str
    run_id: str
    report_type: str = "management"
    publication_readiness: str = "verified"

    def __post_init__(self) -> None:
        if not self.artifact_id.strip() or not self.model_prompt.strip():
            raise ValueError("artifact_id and model_prompt are required")
        if self.request_kind is AccountingRequestKind.NOT_REQUESTED:
            raise ValueError("generation requires an accounting request kind")
        if not self.owner_user_id.strip() or not self.run_id.strip():
            raise ValueError("generation owner and run are required")
        if self.publication_readiness not in {
            "verified", "disclosed", "inferred_draft"
        }:
            raise ValueError("publication_readiness_invalid")

    @property
    def formally_publishable(self) -> bool:
        return self.publication_readiness == "verified"

    def __repr__(self) -> str:
        return (
            "AccountingReportGeneration("
            f"request_kind={self.request_kind.value!r}, period={self.period!r}, "
            "<redacted>)"
        )


class AccountingReportSession:
    def __init__(
        self,
        owner_user_id: str,
        run_id: str,
        source_dir: Path,
        artifact_dir: Path,
        db_path: Path,
        *,
        request_kind: AccountingRequestKind | None = None,
        period: ReportPeriod | None = None,
        dataset: object | None = None,
    ) -> None:
        if not owner_user_id.strip() or not run_id.strip():
            raise ValueError("owner_user_id and run_id are required")
        self.owner_user_id = owner_user_id
        self.run_id = run_id
        self.source_dir = Path(source_dir)
        if (request_kind is None) != (period is None) or (period is None) != (dataset is None):
            raise ValueError("request_kind, period and dataset must be bound together")
        if request_kind is AccountingRequestKind.NOT_REQUESTED:
            raise ValueError("bound session requires an accounting request kind")
        self.request_kind = request_kind
        self.period = period
        self.dataset = dataset
        self.accounting_department = "户部"
        self.accounting_bureau = "会计司"
        self.storage = ArtifactStorage(
            artifact_dir=Path(artifact_dir),
            db_path=Path(db_path),
        )
        self._generation: AccountingReportGeneration | None = None

    def __repr__(self) -> str:
        return (
            "AccountingReportSession("
            f"request_kind={getattr(self.request_kind, 'value', None)!r}, "
            f"period={self.period!r}, generation_count={len(self.generations)}, "
            "<redacted>)"
        )

    @property
    def generations(self) -> tuple[AccountingReportGeneration, ...]:
        return (() if self._generation is None else (self._generation,))

    def maybe_generate(
        self, department: str, bureau: str, decree_text: str
    ) -> AccountingReportGeneration | None:
        if (department, bureau) != (self.accounting_department, self.accounting_bureau):
            return None
        if self._generation is not None:
            return self._generation
        publication_readiness = "inferred_draft"
        if self.request_kind is None:
            intent = detect_accounting_report_intent(decree_text)
            if intent.kind is ReportIntentKind.NOT_REQUESTED:
                return None
            if intent.kind is not ReportIntentKind.EXPLICIT_PERIOD or intent.period is None:
                raise AccountingReportIntentError("report_period_unresolved")
            request_kind = intent.request_kind
            period = intent.period
            rows = load_ledger_rows(self.source_dir, period)
        else:
            request_kind = self.request_kind
            period = self.period
            rows = getattr(self.dataset, "ledger_rows", None)
            if period is None or not isinstance(rows, tuple) or not rows:
                raise AccountingReportIntentError("report_dataset_invalid")
            mapping_decisions = getattr(self.dataset, "mapping_decisions", ())
            mapping_reasons = mapping_publication_reason_codes(mapping_decisions)
            if "MAPPING_DRAFT_ONLY" in mapping_reasons or "MAPPING_MISSING" in mapping_reasons:
                publication_readiness = "inferred_draft"
            elif "MAPPING_CONFIDENCE_DISCLOSURE" in mapping_reasons:
                publication_readiness = "disclosed"
            elif mapping_decisions:
                publication_readiness = "verified"
        if not isinstance(rows, tuple) or not all(
            isinstance(row, NormalizedLedgerRow) for row in rows
        ):
            raise TypeError("rows must contain only NormalizedLedgerRow")
        summary = analyze_ledger(rows, period)
        temporary_path = self.storage.artifact_dir / f".{uuid4().hex}.xlsx"
        try:
            file_hash = write_management_report(rows, summary, temporary_path)
            source_hashes = tuple(sorted({row.source.file_sha256 for row in rows}))
            pending = self.storage.create_pending(
                owner_user_id=self.owner_user_id,
                run_id=self.run_id,
                report_type="management",
                display_name=(
                    f"{period.start_year}-{period.end_year}"
                    "会计管理报告.xlsx"
                ),
                period=period,
                source_hashes=source_hashes,
                file_sha256=file_hash,
                pending_path=temporary_path,
            )
        finally:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass
        if request_kind is AccountingRequestKind.ACCOUNTING_REPORT:
            try:
                envelope = self._build_work_product(
                    rows=rows,
                    summary=summary,
                    workbook_path=pending.file_path,
                    file_sha256=file_hash,
                )
                self.storage.create_work_product(
                    self.owner_user_id,
                    pending.artifact_id,
                    envelope,
                )
            except Exception:
                try:
                    self.abort()
                except Exception as abort_error:
                    raise ArtifactStorageError("artifact_unavailable") from abort_error
                raise
        self._generation = AccountingReportGeneration(
            artifact_id=pending.artifact_id,
            model_prompt=summary.to_model_prompt(),
            request_kind=request_kind,
            period=period,
            owner_user_id=self.owner_user_id,
            run_id=self.run_id,
            publication_readiness=publication_readiness,
        )
        return self._generation

    @staticmethod
    def _source_ref(row: NormalizedLedgerRow) -> str:
        return (
            f"{row.source.file_sha256}:{row.source.sheet_name}:"
            f"{row.source.row_number}"
        )

    @staticmethod
    def _row_amount(row: NormalizedLedgerRow) -> Decimal:
        family = _family(row)
        return signed_closing(row) if family is None else _oriented_amount(row, family)

    def _build_work_product(
        self,
        *,
        rows: tuple[NormalizedLedgerRow, ...],
        summary: AccountingReportSummary,
        workbook_path: Path,
        file_sha256: str,
    ) -> WorkProductEnvelope:
        report_period = summary.period
        receipts_by_ref: dict[str, AccountingSourceReceipt] = {}
        numbers: list[AccountingReportNumber] = []
        for row in rows:
            source_ref = self._source_ref(row)
            receipts_by_ref.setdefault(
                source_ref,
                AccountingSourceReceipt(
                    source_ref=source_ref,
                    source_digest=row.source.file_sha256,
                    source_label=Path(row.source.file_name).name,
                    adopted=True,
                    period=report_period,
                    currency="CNY",
                ),
            )
            amount = self._row_amount(row)
            fact_id = _ledger_fact_id(
                source_ref=source_ref,
                account_code=row.account_code,
                amount=amount,
            )
            numbers.append(
                AccountingReportNumber(
                    name=row.account_code,
                    amount=amount,
                    fact_id=fact_id,
                    source_ref=source_ref,
                    rule_id=f"{_ACCOUNTING_RULES_VERSION}:ledger-closing",
                )
            )
        source_receipts = tuple(receipts_by_ref.values())
        evaluation = evaluate_accounting_report(
            task_id="accounting-management-report",
            period=report_period,
            rows=rows,
            analysis=ReportAnalysis(numbers=tuple(numbers)),
            source_receipts=source_receipts,
            accounting_rules_version=_ACCOUNTING_RULES_VERSION,
            prohibited_actions=frozenset(),
            renderer_version=_RENDERER_VERSION,
        )
        quality_payload = {
            "overall_status": summary.overall_status,
            "checks": tuple(
                {
                    "name": check.name,
                    "status": check.status,
                    "actual": check.actual,
                    "expected": check.expected,
                    "difference": check.difference,
                }
                for check in summary.checks
            ),
            "sheet_names": SHEET_NAMES,
        }
        facts = tuple(
            {
                "fact_id": fact.fact_id,
                "name": fact.name,
                "amount": fact.amount,
                "source_ref": fact.source_ref,
                "source_digest": fact.source_digest,
                "rule_id": fact.rule_id,
                "source_human_confirmed": fact.source_human_confirmed,
            }
            for fact in evaluation.facts
        )
        semantic_payload = {
            "work_status": evaluation.work_status,
            "reason_codes": evaluation.reason_codes,
            "facts": facts,
            "fact_pack_digest": evaluation.fact_pack_digest,
            "source_digests": evaluation.source_digests,
            "accounting_rules_version": evaluation.accounting_rules_version,
            "renderer_version": evaluation.renderer_version,
        }
        manifests = (
            ArtifactManifestItem(
                kind="management_report_xlsx",
                ref="management-report.xlsx",
                content_digest=file_sha256,
                traceable=True,
            ),
            ArtifactManifestItem(
                kind="work_product_envelope",
                ref="work-product-envelope.json",
                content_digest=semantic_digest(semantic_payload),
                traceable=True,
            ),
            ArtifactManifestItem(
                kind="quality_report",
                ref="quality-report.json",
                content_digest=semantic_digest(quality_payload),
                traceable=True,
            ),
            ArtifactManifestItem(
                kind="confirmation_request",
                ref="confirmation-request.json",
                content_digest=semantic_digest(
                    {"confirmation_status": ConfirmationStatus.PENDING}
                ),
                traceable=True,
            ),
            ArtifactManifestItem(
                kind="content_digest",
                ref="content-digest.sha256",
                content_digest=evaluation.fact_pack_digest,
                traceable=True,
            ),
        )
        gate = evaluate_accounting_artifact_gate(
            artifacts=manifests,
            workbook_path=workbook_path,
            expected_file_sha256=file_sha256,
            expected_fact_pack_digest=evaluation.fact_pack_digest,
            facts=evaluation.facts,
            rows=rows,
            source_receipts=source_receipts,
            accounting_rules_version=_ACCOUNTING_RULES_VERSION,
            quality_checks=summary.checks,
        )
        if gate.status is not ArtifactGateStatus.PASSED:
            raise ArtifactStorageError("artifact_gate_failed")
        envelope = WorkProductEnvelope(
            work_product_id=uuid4().hex,
            version=1,
            owner_user_id=self.owner_user_id,
            run_id=self.run_id,
            reply_id=None,
            capability_id=_CAPABILITY_ID,
            work_status=evaluation.work_status,
            confirmation_status=ConfirmationStatus.PENDING,
            artifact_state=ArtifactState.PENDING,
            decision=(
                "Accounting report is ready for human confirmation."
                if not evaluation.reason_codes
                else "Accounting report requires review: "
                + ",".join(evaluation.reason_codes)
            ),
            facts=facts,
            assumptions=(),
            recommendations=("Review the deterministic accounting workbook.",),
            evidence_used=evaluation.source_digests,
            missing_evidence=(),
            conflicts=(),
            risk_register=("Human confirmation remains pending.",),
            artifact_manifest=manifests,
            artifact_gate=gate,
            content_digest="0" * 64,
            created_at=datetime.now(UTC),
        )
        return envelope.model_copy(
            update={"content_digest": semantic_digest(envelope.model_dump(mode="python"))}
        )

    def publish(self, reply_id: str) -> tuple[PublishedReportArtifact, ...]:
        return self.storage.publish_run(self.owner_user_id, self.run_id, reply_id)

    def is_publishable_generation(self, generation: AccountingReportGeneration) -> bool:
        return self.storage.is_publishable_pending_run(
            artifact_id=generation.artifact_id,
            owner_user_id=generation.owner_user_id,
            run_id=generation.run_id,
            report_type=generation.report_type,
            period=generation.period,
        )

    def abort(self) -> None:
        self.storage.abort_run(self.owner_user_id, self.run_id)
