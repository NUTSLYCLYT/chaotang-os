"""Concrete restart-safe adapter for the persisted decree job worker."""

from __future__ import annotations

import json
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
from app.api.decrees import (
    ChancellorDecreeRequest,
    DeliveryKind,
    PreparedDecreeExecution,
    ReportArtifactResponse,
    _model_failure_metadata,
    build_accounting_report_session,
    execute_decree_now,
)
from app.langgraph_runtime.provider_budget import (
    ProviderBudgetExceeded,
    use_provider_attempt_budget,
)
from app.shiguan.archive_decree import archive_chancellor_decree

from .models import DecreeJob
from .storage import ProviderRequestLimitExceeded
from .worker import DecreeJobControl, PermanentJobError, TransientJobError

_TRANSIENT_PROVIDER_FAILURES = frozenset(
    {"timeout", "connection", "rate_limit", "provider_server"}
)
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
    archived = archive_chancellor_decree(
        job.decree_text,
        prepared.response,
        _archive_internal_result(prepared),
        owner_user_id=job.owner_user_id,
        reply_id=job.job_id,
    )
    if not archived.archived or archived.reply_id != job.job_id:
        raise PermanentJobError("reply_archive_failed")
    return archived.reply_id


def publish_prepared_decree(job: DecreeJob) -> str:
    prepared = _prepared(job)
    authority = _decode_authority(job.approved_route_json)
    accounting = authority.accounting_context
    response = prepared.response
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
    stage, category, _provider_status, _retry_count = _model_failure_metadata(error)
    if stage != "provider_request":
        raise PermanentJobError("execution_failed") from error
    if category == "budget_exhausted":
        raise PermanentJobError("provider_budget_exceeded") from error
    if category == "timeout":
        raise TransientJobError("provider_timeout") from error
    if category in _TRANSIENT_PROVIDER_FAILURES:
        raise TransientJobError("provider_failed") from error
    if category == "provider_client":
        raise PermanentJobError("provider_failed") from error
    raise PermanentJobError("execution_failed") from error


class PersistentDecreeJobExecutor:
    """Rebuild the accepted snapshot and execute with deterministic IDs."""

    def execute(self, job: DecreeJob, control: DecreeJobControl) -> str:
        authority = _decode_authority(job.approved_route_json)
        if authority.accounting_context is not None:
            build_accounting_report_session(
                owner_user_id=job.owner_user_id,
                run_id=job.job_id,
                accounting_context=authority.accounting_context,
            ).abort()
        budget = _PersistentBudget(job, control)
        payload = ChancellorDecreeRequest(
            decree_text=job.decree_text,
            draft_version=1,
            draft_fingerprint=job.draft_fingerprint,
        )
        with use_provider_attempt_budget(budget):
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
            except (ProviderBudgetExceeded, ProviderRequestLimitExceeded) as exc:
                raise PermanentJobError("provider_budget_exceeded") from exc
        return response.model_dump_json()

    def archive(self, job: DecreeJob) -> str:
        return archive_prepared_decree(job)

    def publish(self, job: DecreeJob) -> str:
        return publish_prepared_decree(job)
