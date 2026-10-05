"""Concrete restart-safe adapter for the persisted decree job worker."""

from __future__ import annotations

import json
import sqlite3
from contextlib import nullcontext
from types import SimpleNamespace

from pydantic import TypeAdapter

from app.accounting_reports.models import AccountingRequestKind, ReportPeriod
from app.agents.chancellor.graph import ChancellorGraphInvocationError
from app.agents.chancellor_draft.authority import (
    AccountingAuthorityContext,
    ConsumedDraftAuthority,
)
from app.agents.chancellor_draft.routing import ApprovedRouteSnapshot
from app.agents.evidence_protocol import AgentEvidenceSnapshot
from app.agents.runtime_skills.evidence_spine import route_snapshot_digest
from app.agents.synthesis_failures import classify_synthesis_failure
from app.api.decrees import (
    AccountingReportPublicationError,
    ChancellorDecreeRequest,
    DeliveryKind,
    PreparedDecreeExecution,
    ReportArtifactResponse,
    _model_failure_metadata,
    build_accounting_report_session,
    execute_decree_now,
)
from app.fusion.task_token_budget import TaskTokenBudget
from app.junjichu_cases import (
    JunjichuCaseNotFoundError,
    JunjichuRuntimeReportError,
    archive_case,
    get_case,
    get_runtime_report_snapshot,
    validate_case_archive_preconditions,
)
from app.langgraph_runtime.provider_budget import (
    ProviderBudgetExceeded,
    use_provider_attempt_budget,
    use_task_token_budget,
)
from app.shiguan.archive_decree import archive_chancellor_decree

from .models import DecreeJob
from .storage import ProviderRequestLimitExceeded
from .worker import DecreeJobControl, PermanentJobError, TransientJobError

_TRANSIENT_PROVIDER_FAILURES = frozenset(
    {"timeout", "connection", "rate_limit", "provider_server"}
)
# One real customer task must stay within the product-level execution budget.
# The fusion ledger supports a larger schema-wide ceiling for other workflows,
# but decree jobs use this smaller governed cap.
_MAX_REAL_TASK_TOKENS = 20_000
_EVIDENCE_SNAPSHOT_ADAPTER = TypeAdapter(AgentEvidenceSnapshot)


def _decode_authority(value: str) -> ConsumedDraftAuthority:
    try:
        raw = json.loads(value)
        if not isinstance(raw, dict) or set(raw) != {
            "approved_route",
            "accounting_context",
        }:
            raise ValueError
        route = ApprovedRouteSnapshot.model_validate(raw["approved_route"])
        accounting_raw = raw["accounting_context"]
        accounting = None
        if accounting_raw is not None:
            if not isinstance(accounting_raw, dict) or set(accounting_raw) != {
                "request_kind",
                "period",
                "source_fingerprint",
            }:
                raise ValueError
            period = accounting_raw["period"]
            if not isinstance(period, dict):
                raise ValueError
            accounting = AccountingAuthorityContext(
                AccountingRequestKind(accounting_raw["request_kind"]),
                ReportPeriod(
                    start_year=period["start_year"],
                    end_year=period["end_year"],
                ),
                accounting_raw["source_fingerprint"],
            )
        return ConsumedDraftAuthority(route, accounting)
    except Exception as exc:
        raise PermanentJobError("job_snapshot_invalid") from exc


class _PersistentBudget:
    """Job-local persistent cap composed with the existing process cap."""

    def __init__(self, job: DecreeJob, control: DecreeJobControl) -> None:
        self._used = job.provider_request_count
        self._control = control
        self._max = job.provider_request_limit

    def reserve(self) -> None:
        self._control.raise_if_cancelled()
        if self._used >= self._max:
            raise ProviderBudgetExceeded(
                attempts_used=self._used,
                max_attempts=self._max,
            )
        self._control.record_provider_request()
        self._used += 1


def _prepared(job: DecreeJob) -> PreparedDecreeExecution:
    if job.result_json is None:
        raise PermanentJobError("result_checkpoint_missing")
    try:
        return PreparedDecreeExecution.model_validate_json(job.result_json)
    except Exception as exc:
        raise PermanentJobError("result_checkpoint_invalid") from exc


def _archive_internal_result(
    prepared: PreparedDecreeExecution,
) -> dict[str, object]:
    internal = dict(prepared.internal_result)
    try:
        internal["approved_route"] = ApprovedRouteSnapshot.model_validate(
            internal["approved_route"]
        )
        if internal.get("evidence_snapshot") is not None:
            internal["evidence_snapshot"] = _EVIDENCE_SNAPSHOT_ADAPTER.validate_python(
                internal["evidence_snapshot"]
            )
    except Exception as exc:
        raise PermanentJobError("result_checkpoint_invalid") from exc
    return internal


def archive_prepared_decree(job: DecreeJob) -> str:
    prepared = _prepared(job)
    authority = _decode_authority(job.approved_route_json)
    internal_result = _archive_internal_result(prepared)
    internal_route = internal_result.get("approved_route")
    route = authority.route_snapshot
    departments = tuple(item.department for item in route.departments)
    if (
        internal_route != route
        or internal_result.get("draft_fingerprint") != job.draft_fingerprint
        or tuple(prepared.response.departments) != departments
        or prepared.response.route_type != ("multi" if len(departments) > 1 else "single")
    ):
        raise PermanentJobError("result_checkpoint_invalid")
    case_id = prepared.junjichu_case_id
    if prepared.response.route_type == "multi":
        if case_id is None:
            raise PermanentJobError("result_checkpoint_invalid")
        try:
            case = get_case(case_id, owner_user_id=job.owner_user_id)
        except (sqlite3.Error, OSError) as exc:
            raise TransientJobError("junjichu_archive_failed") from exc
        if case is None or case.owner_user_id != job.owner_user_id:
            raise PermanentJobError("junjichu_archive_failed")
        try:
            validate_case_archive_preconditions(
                case,
                reply_id=job.job_id,
                expected_run_id=job.job_id,
                expected_decree_id=job.job_id,
                expected_draft_fingerprint=job.draft_fingerprint,
                expected_route_digest=route_snapshot_digest(route),
                expected_departments=departments,
                expected_council_verdict=prepared.response.council_verdict,
            )
        except ValueError as exc:
            raise PermanentJobError("junjichu_archive_failed") from exc
        try:
            report_snapshot = get_runtime_report_snapshot(
                case_id,
                owner_user_id=job.owner_user_id,
                run_id=job.job_id,
            )
        except JunjichuRuntimeReportError as exc:
            raise PermanentJobError("junjichu_archive_failed") from exc
        if (
            tuple(
                record.content_digest
                for record in report_snapshot.ministry_records
            )
            != prepared.junjichu_ministry_report_digests
            or report_snapshot.council_record is None
            or report_snapshot.council_record.content_digest
            != prepared.junjichu_council_report_digest
        ):
            raise PermanentJobError("junjichu_archive_failed")
    archived = archive_chancellor_decree(
        job.decree_text,
        prepared.response,
        internal_result,
        owner_user_id=job.owner_user_id,
        reply_id=job.job_id,
    )
    if archived.reply_id != job.job_id:
        raise PermanentJobError("reply_archive_failed")
    if not archived.archived:
        raise TransientJobError("reply_archive_failed")
    if prepared.response.route_type == "multi":
        assert case_id is not None
        try:
            archived_case = archive_case(
                case_id,
                owner_user_id=job.owner_user_id,
                reply_id=archived.reply_id,
                expected_run_id=job.job_id,
                expected_decree_id=job.job_id,
                expected_draft_fingerprint=job.draft_fingerprint,
                expected_route_digest=route_snapshot_digest(route),
                expected_departments=departments,
                expected_council_verdict=prepared.response.council_verdict,
            )
        except (sqlite3.Error, OSError) as exc:
            raise TransientJobError("junjichu_archive_failed") from exc
        except (JunjichuCaseNotFoundError, ValueError) as exc:
            raise PermanentJobError("junjichu_archive_failed") from exc
        if (
            archived_case.status != "ARCHIVED"
            or archived_case.reply_id != archived.reply_id
            or archived_case.owner_user_id != job.owner_user_id
            or archived_case.run_id != job.job_id
            or archived_case.decree_id != job.job_id
        ):
            raise PermanentJobError("junjichu_archive_failed")
    return archived.reply_id


def publish_prepared_decree(job: DecreeJob) -> str:
    prepared = _prepared(job)
    authority = _decode_authority(job.approved_route_json)
    accounting = authority.accounting_context
    response = prepared.response
    if response.status == "blocked":
        if prepared.generated_artifact_id is not None or response.artifacts:
            raise PermanentJobError("result_checkpoint_invalid")
        return response.model_dump_json()
    if accounting is None:
        return response.model_dump_json()
    if job.reply_id != job.job_id:
        raise PermanentJobError("reply_archive_required")
    session = build_accounting_report_session(
        owner_user_id=job.owner_user_id,
        run_id=job.job_id,
        accounting_context=accounting,
    )
    artifact_id = prepared.generated_artifact_id
    if artifact_id is None:
        raise PermanentJobError("report_generation_invalid")
    try:
        published = session.publish(job.reply_id)
    except Exception as exc:
        raise PermanentJobError("publication_failed") from exc
    if (
        len(published) != 1
        or published[0].artifact_id != artifact_id
        or published[0].owner_user_id != job.owner_user_id
        or published[0].run_id != job.job_id
        or published[0].reply_id != job.reply_id
        or published[0].report_type != "management"
        or published[0].period != accounting.period
    ):
        raise PermanentJobError("publication_identity_invalid")
    response = response.model_copy(
        update={
            "artifacts": [
                ReportArtifactResponse.from_domain(item) for item in published
            ],
            "delivery_kind": (
                DeliveryKind.ACCOUNTING_ANALYSIS
                if accounting.request_kind
                is AccountingRequestKind.ACCOUNTING_ANALYSIS
                else DeliveryKind.ACCOUNTING_REPORT
            ),
            "delivery_period": accounting.period,
        }
    )
    return response.model_dump_json()


def _raise_provider_failure(
    error: ChancellorGraphInvocationError,
) -> None:
    from app.agents.runtime_skills.tool_failures import AccountingToolChainError

    current: BaseException | None = error
    seen: set[int] = set()
    for _ in range(8):
        if current is None or id(current) in seen:
            break
        seen.add(id(current))
        if isinstance(current, AccountingToolChainError):
            categories = {
                "format_unrecognized": "format",
                "tool_unavailable": "tool",
                "source_not_found": "data",
            }
            raise PermanentJobError(
                current.code,
                stage="bureau_tool",
                category=categories[current.code],
            ) from error
        current = current.__cause__
    stage, category, _provider_status, _retry_count = _model_failure_metadata(error)
    if stage != "provider_request":
        if classify_synthesis_failure(error) in {
            "schema_invalid",
            "content_unsupported",
        }:
            # Structured stages already perform their governed, bounded local
            # correction attempts.  Re-running the whole decree would repeat
            # completed upstream nodes and consume the same frozen transport
            # budget without a safe checkpoint to resume from.
            raise PermanentJobError(
                "validation_failed", stage="validation", category="validation"
            ) from error
        raise PermanentJobError("execution_failed") from error
    if category == "budget_exhausted":
        raise PermanentJobError("provider_budget_exceeded") from error
    if category == "timeout":
        raise TransientJobError("provider_timeout") from error
    if category in _TRANSIENT_PROVIDER_FAILURES:
        raise TransientJobError("provider_failed") from error
    if category == "provider_client":
        raise PermanentJobError("provider_failed") from error
    raise PermanentJobError(
        "model_failed", stage="model", category="model"
    ) from error


def _raise_accounting_failure(error: AccountingReportPublicationError) -> None:
    code = str(error).split(maxsplit=1)[0]
    if code in {
        "publication_failed",
        "publication_identity_invalid",
        "reply_archive_failed",
        "reply_archive_required",
    }:
        raise PermanentJobError(
            "artifact_failed", stage="artifact", category="artifact"
        ) from error
    raise PermanentJobError(
        "validation_failed", stage="validation", category="validation"
    ) from error


class PersistentDecreeJobExecutor:
    """Rebuild the accepted snapshot and execute with deterministic IDs."""

    def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
        authority = _decode_authority(job.approved_route_json)
        budget = _PersistentBudget(job, control)
        payload = ChancellorDecreeRequest(
            decree_text=job.decree_text,
            draft_version=1,
            draft_fingerprint=job.draft_fingerprint,
        )
        # Production controls expose the durable store; lightweight unit-test
        # controls intentionally do not. Keep the old in-memory execution seam
        # for those callers while real workers receive the governed 20k ledger.
        store = getattr(control, "store", None)
        task_budget_context = nullcontext()
        if store is not None:
            token_budget = TaskTokenBudget(
                store.db_path,
                owner_id=job.owner_user_id,
                task_id=store.resolve_budget_root(job.job_id, job.owner_user_id),
                max_tokens=_MAX_REAL_TASK_TOKENS,
            )
            task_budget_context = use_task_token_budget(token_budget)
        with task_budget_context, use_provider_attempt_budget(budget):
            try:
                response = execute_decree_now(
                    payload,
                    SimpleNamespace(id=job.owner_user_id),
                    consumed_authority=authority,
                    execution_id=job.job_id,
                    defer_business_side_effects=True,
                    execution_control=control.raise_if_cancelled,
                )
            except ChancellorGraphInvocationError as exc:
                _raise_provider_failure(exc)
            except AccountingReportPublicationError as exc:
                _raise_accounting_failure(exc)
            except (ProviderBudgetExceeded, ProviderRequestLimitExceeded) as exc:
                raise PermanentJobError("provider_budget_exceeded") from exc
        result_json = response.model_dump_json()
        checkpoint_result = getattr(control, "checkpoint_result", None)
        if checkpoint_result is not None:
            checkpoint_result(result_json)
        return result_json

    def archive(self, job: DecreeJob) -> str:
        return archive_prepared_decree(job)

    def publish(self, job: DecreeJob) -> str:
        return publish_prepared_decree(job)
