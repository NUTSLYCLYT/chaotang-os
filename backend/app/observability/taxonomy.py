"""HV-44 - observability, cost and resource-control taxonomy.

Adapted, not migrated, from the frozen ``b20e2c78b`` modules
``backend/src/{observability,production_events,token_monitor,direct_rate_limit,
resource_router,provider_preflight}.py``.

Four things are carried across, and each one is bound to a *current* audit
surface rather than to the historical one:

===================================  ==========================================
carried over                         bound to
===================================  ==========================================
event taxonomy                       ``decree_jobs.models.DecreeJobState`` and
                                     the provider-attempt lifecycle in
                                     ``langgraph_runtime.provider_budget``
budget fields (attempts/tokens/cost) ``DecreeJob.provider_request_count`` /
                                     ``provider_request_limit`` and
                                     ``ProviderBudgetExceeded.safe_metadata``
failure reasons                      the codes actually raised by
                                     ``app.decree_jobs`` and
                                     ``app.langgraph_runtime``
observable metric *names*            the decay-job / provider audit surfaces
===================================  ==========================================

Deliberately **not** carried over, and guarded by
:func:`assert_no_forbidden_migration`: model-tier routing, provider fallback,
response caching and implicit retry.  Cost accounting is never allowed to
change a safety gate or a fact source.

Honesty rules enforced by this module (they are the reason it exists):

* No number is ever synthesized.  Every budget field is ``None`` unless a real
  observation supplied it; :meth:`BudgetSnapshot.total_tokens` returns ``None``
  rather than inventing ``0`` when one of its inputs is missing.
* :func:`summarize_audit_events` never reports a green light when nothing was
  observed - absence of evidence is reported as ``yellow`` plus an explicit
  ``no_audit_events`` blocker.
* Free-text payloads (decree text, prompts, messages) are reduced to a
  fingerprint; secrets are replaced by ``[redacted]``.

Only metric *names* are declared here.  Nothing in this module emits a metric
value; an emitter must be wired to a real observation before any of these names
can be trusted, and this adaptation deliberately stops short of that.
"""

from __future__ import annotations

import hashlib
import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Final, Literal, get_args

AUDIT_TAXONOMY_VERSION: Final = "hv44-audit-taxonomy.v1"


# ---------------------------------------------------------------------------
# 1. Event taxonomy
# ---------------------------------------------------------------------------


class AuditEventType(StrEnum):
    """Closed set of facts that must be recordable for job/provider audit.

    The nine job-lifecycle members are in 1:1 correspondence with
    ``decree_jobs.models.DecreeJobState``; the three provider members describe
    the provider-attempt lifecycle owned by
    ``langgraph_runtime.provider_budget``.
    """

    JOB_ACCEPTED = "job_accepted"
    JOB_STARTED = "job_started"
    JOB_RETRY_SCHEDULED = "job_retry_scheduled"
    JOB_RESULT_READY = "job_result_ready"
    JOB_ARCHIVING = "job_archiving"
    JOB_PUBLISHING = "job_publishing"
    JOB_SUCCEEDED = "job_succeeded"
    JOB_FAILED = "job_failed"
    JOB_CANCELLED = "job_cancelled"
    PROVIDER_ATTEMPT_RESERVED = "provider_attempt_reserved"
    PROVIDER_ATTEMPT_FAILED = "provider_attempt_failed"
    PROVIDER_BUDGET_EXHAUSTED = "provider_budget_exhausted"


class AuditSeverity(StrEnum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"


_RED_EVENT_TYPES: Final[frozenset[AuditEventType]] = frozenset(
    {AuditEventType.JOB_FAILED, AuditEventType.PROVIDER_BUDGET_EXHAUSTED}
)
_YELLOW_EVENT_TYPES: Final[frozenset[AuditEventType]] = frozenset(
    {
        AuditEventType.JOB_RETRY_SCHEDULED,
        AuditEventType.JOB_CANCELLED,
        AuditEventType.PROVIDER_ATTEMPT_FAILED,
    }
)


def severity_for(event_type: AuditEventType) -> AuditSeverity:
    """Map an event type onto the release-facing traffic light."""
    if event_type in _RED_EVENT_TYPES:
        return AuditSeverity.RED
    if event_type in _YELLOW_EVENT_TYPES:
        return AuditSeverity.YELLOW
    return AuditSeverity.GREEN


class UnknownJobState(ValueError):
    """Raised for a job state that the audit taxonomy does not cover."""


_JOB_STATE_EVENT_TYPES: Final[dict[str, AuditEventType]] = {
    "QUEUED": AuditEventType.JOB_ACCEPTED,
    "RUNNING": AuditEventType.JOB_STARTED,
    "RETRY_WAIT": AuditEventType.JOB_RETRY_SCHEDULED,
    "RESULT_READY": AuditEventType.JOB_RESULT_READY,
    "ARCHIVING": AuditEventType.JOB_ARCHIVING,
    "PUBLISHING": AuditEventType.JOB_PUBLISHING,
    "SUCCEEDED": AuditEventType.JOB_SUCCEEDED,
    "FAILED": AuditEventType.JOB_FAILED,
    "CANCELLED": AuditEventType.JOB_CANCELLED,
}


def event_type_for_job_state(state: str) -> AuditEventType:
    """Translate a ``DecreeJobState`` value into its audit event type.

    Raises :class:`UnknownJobState` for anything outside the closed set, so a
    newly added job state cannot silently fall through to a default event.
    """
    try:
        return _JOB_STATE_EVENT_TYPES[str(state)]
    except KeyError as exc:
        raise UnknownJobState(f"unmapped_job_state:{state}") from exc


# ---------------------------------------------------------------------------
# 2. Failure reasons
# ---------------------------------------------------------------------------


class FailureStage(StrEnum):
    """Where in a decree job the failure happened (``DecreeJob.error_stage``)."""

    QUEUE = "queue"
    EXECUTION = "execution"
    SIDE_EFFECT = "side_effect"


class JobFailureCategory(StrEnum):
    """Coarse bucket for a decree-job failure (``DecreeJob.error_category``)."""

    BUDGET = "budget"
    DEADLINE = "deadline"
    PROVIDER = "provider"
    RETRY = "retry"
    CANCELLED = "cancelled"
    INTERNAL = "internal"


ProviderFailureCategory = Literal[
    "timeout",
    "connection",
    "rate_limit",
    "provider_server",
    "provider_client",
    "budget_exhausted",
    "unexpected",
]

PROVIDER_FAILURE_CATEGORIES: Final[frozenset[str]] = frozenset(
    get_args(ProviderFailureCategory)
)
"""Must stay identical to ``deepseek_client.FailureCategory``."""

TRANSIENT_PROVIDER_FAILURES: Final[frozenset[str]] = frozenset(
    {"timeout", "connection", "rate_limit", "provider_server"}
)
"""Must stay identical to ``decree_jobs.executor._TRANSIENT_PROVIDER_FAILURES``.

Being *listed* here only means the current code may try the same provider once
more inside a single bounded call.  It never authorises provider fallback or an
unbounded implicit retry.
"""

_BUDGET_CODE: Final = "provider_budget_exceeded"
_DEADLINE_CODE: Final = "deadline_exceeded"
_PROVIDER_PREFIX: Final = "provider_"
_RETRY_CODES: Final[frozenset[str]] = frozenset(
    {"retry_exhausted", "model_output_invalid"}
)

JOB_FAILURE_CODES: Final[frozenset[str]] = frozenset(
    {
        # terminal job outcomes written by the store
        _BUDGET_CODE,
        _DEADLINE_CODE,
        "retry_exhausted",
        "cancelled",
        # generic execution side-effect outcomes
        "execution_failed",
        "side_effect_failed",
        # provider-facing codes raised by the executor
        "provider_timeout",
        "provider_failed",
        # model-output code raised by the worker
        "model_output_invalid",
        # checkpoint and snapshot integrity
        "job_snapshot_invalid",
        "result_checkpoint_missing",
        "result_checkpoint_invalid",
        "result_checkpoint_failed",
        # archive / publication contracts
        "junjichu_archive_failed",
        "reply_archive_failed",
        "reply_archive_required",
        "report_generation_invalid",
        "publication_failed",
        "publication_identity_invalid",
    }
)
"""Closed vocabulary of decree-job failure codes."""


class UnknownJobFailureCode(ValueError):
    """Raised when a decree-job failure code is outside the closed set."""


class UnknownProviderFailureCategory(ValueError):
    """Raised when a provider failure category is outside the closed set."""


def classify_job_failure_category(code: str) -> JobFailureCategory:
    """Derive ``DecreeJob.error_category`` from ``DecreeJob.error_code``.

    This is the single source of truth for the mapping that
    ``decree_jobs.worker._failure_category`` used to own privately and that
    ``decree_jobs.storage`` mirrors in SQL.  The function is total on purpose -
    an unrecognised code is bucketed as ``internal`` rather than raising - so it
    can never destabilise the worker.  Use
    :func:`assert_known_job_failure_code` where strictness is wanted.
    """
    if code == _BUDGET_CODE:
        return JobFailureCategory.BUDGET
    if code == _DEADLINE_CODE:
        return JobFailureCategory.DEADLINE
    if code.startswith(_PROVIDER_PREFIX):
        return JobFailureCategory.PROVIDER
    if code in _RETRY_CODES:
        return JobFailureCategory.RETRY
    return JobFailureCategory.INTERNAL


def is_known_job_failure_code(code: str) -> bool:
    return code in JOB_FAILURE_CODES


def assert_known_job_failure_code(code: str) -> None:
    """Fail loudly for a failure code that is not in the closed vocabulary."""
    if not is_known_job_failure_code(code):
        raise UnknownJobFailureCode(f"unknown_job_failure_code:{code}")


def is_transient_provider_failure(category: str) -> bool:
    """Whether the current code may retry the *same* provider once more."""
    return category in TRANSIENT_PROVIDER_FAILURES


def assert_known_provider_failure_category(category: str) -> None:
    if category not in PROVIDER_FAILURE_CATEGORIES:
        raise UnknownProviderFailureCategory(f"unknown_provider_failure:{category}")


# ---------------------------------------------------------------------------
# 3. Budget fields
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BudgetSnapshot:
    """Attempt / token / cost counters for one audit record.

    Every field is optional and defaults to ``None``.  ``None`` means *not
    observed*; it is never rewritten into ``0``, because a zero would be
    indistinguishable from a real zero and would let a hollow audit claim
    headroom it never had.
    """

    attempts_used: int | None = None
    max_attempts: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cost_usd: float | None = None
    token_budget: int | None = None
    cost_budget_usd: float | None = None

    @property
    def total_tokens(self) -> int | None:
        if self.prompt_tokens is None or self.completion_tokens is None:
            return None
        return self.prompt_tokens + self.completion_tokens

    @property
    def attempts_remaining(self) -> int | None:
        if self.attempts_used is None or self.max_attempts is None:
            return None
        return max(0, self.max_attempts - self.attempts_used)

    def to_audit_fields(self) -> dict[str, Any]:
        """Flatten to audit fields, omitting anything not observed."""
        fields: dict[str, Any] = {
            "attempts_used": self.attempts_used,
            "max_attempts": self.max_attempts,
        }
        for name, value in (
            ("prompt_tokens", self.prompt_tokens),
            ("completion_tokens", self.completion_tokens),
            ("cost_usd", self.cost_usd),
            ("token_budget", self.token_budget),
            ("cost_budget_usd", self.cost_budget_usd),
            ("total_tokens", self.total_tokens),
            ("attempts_remaining", self.attempts_remaining),
        ):
            if value is not None:
                fields[name] = value
        return fields

    @classmethod
    def from_safe_metadata(cls, metadata: Mapping[str, Any]) -> BudgetSnapshot:
        """Read back ``ProviderBudgetExceeded.safe_metadata``.

        ``safe_metadata`` is intentionally narrow (``attempts_used`` plus
        ``max_attempts``); anything else is ignored rather than guessed.
        """

        def _int(name: str) -> int | None:
            value = metadata.get(name)
            return value if type(value) is int else None

        return cls(attempts_used=_int("attempts_used"), max_attempts=_int("max_attempts"))


# ---------------------------------------------------------------------------
# 4. Observable metrics (names only - no emitter is provided)
# ---------------------------------------------------------------------------


class MetricKind(StrEnum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


@dataclass(frozen=True)
class MetricSpec:
    name: str
    kind: MetricKind
    description: str


METRIC_SPECS: Final[tuple[MetricSpec, ...]] = (
    MetricSpec(
        "chaotang_decree_job_events_total",
        MetricKind.COUNTER,
        "One increment per emitted decree-job audit event.",
    ),
    MetricSpec(
        "chaotang_decree_jobs_active",
        MetricKind.GAUGE,
        "Decree jobs currently leased by a worker.",
    ),
    MetricSpec(
        "chaotang_provider_attempts_total",
        MetricKind.COUNTER,
        "Provider attempts reserved through the fail-closed attempt budget.",
    ),
    MetricSpec(
        "chaotang_provider_budget_exhausted_total",
        MetricKind.COUNTER,
        "Provider attempts rejected because the attempt budget was spent.",
    ),
    MetricSpec(
        "chaotang_provider_attempt_latency_ms",
        MetricKind.HISTOGRAM,
        "Wall-clock latency of a single provider attempt.",
    ),
    MetricSpec(
        "chaotang_job_tokens_total",
        MetricKind.COUNTER,
        "Prompt plus completion tokens observed for a job.",
    ),
    MetricSpec(
        "chaotang_job_cost_usd_total",
        MetricKind.COUNTER,
        "Estimated provider cost in USD for a job.",
    ),
)

METRIC_NAMES: Final[frozenset[str]] = frozenset(spec.name for spec in METRIC_SPECS)


# ---------------------------------------------------------------------------
# 5. Forbidden migrations
# ---------------------------------------------------------------------------

FORBIDDEN_MIGRATIONS: Final[frozenset[str]] = frozenset(
    {
        "model_tier_routing",
        "provider_fallback",
        "response_cache",
        "implicit_retry",
    }
)
"""Capabilities the ledger forbids carrying over from the frozen sources."""

FORBIDDEN_AUDIT_FIELDS: Final[frozenset[str]] = frozenset(
    {
        "model_tier",
        "model_tiers",
        "fallback_provider",
        "fallback_model",
        "fallback_chain",
        "cache_key",
        "cache_hit",
        "cache_hits",
        "cached",
        "cache_ttl",
        "auto_retry",
        "implicit_retry",
        "retry_policy",
        "endless_retry",
    }
)
"""Audit field names that would smuggle a forbidden migration into the record."""


class ForbiddenMigration(ValueError):
    """Raised when an audit record tries to reintroduce a forbidden feature."""


def assert_no_forbidden_migration(fields: Mapping[str, Any]) -> None:
    """Reject audit fields that would reintroduce a forbidden capability.

    Note that ``retry_count`` is deliberately *allowed*: the current provider
    client reports how many bounded attempts a single call consumed, which is
    observation, not an implicit retry mechanism.
    """
    offending = sorted(
        str(key).strip().lower()
        for key in fields
        if str(key).strip().lower() in FORBIDDEN_AUDIT_FIELDS
    )
    if offending:
        raise ForbiddenMigration("forbidden_migration_field:" + ",".join(offending))


def assert_cost_does_not_override_gate(
    *, gate_decision: str, cost_signal: float | None
) -> None:
    """Encode the ledger's invariant that cost never overrides a safety gate.

    Raises :class:`ForbiddenMigration` when a cost signal is used to relax a
    blocking gate decision.
    """
    if cost_signal is None:
        return
    if str(gate_decision).strip().lower() in {"block", "blocked", "deny", "denied"}:
        raise ForbiddenMigration("cost_signal_must_not_relax_blocking_gate")


# ---------------------------------------------------------------------------
# 6. Sanitisation
# ---------------------------------------------------------------------------

REDACTED: Final = "[redacted]"
_MAX_STRING: Final = 200
_MAX_COLLECTION: Final = 20

_SENSITIVE_KEY_MARKERS: Final[tuple[str, ...]] = (
    "api_key",
    "apikey",
    "secret",
    "password",
    "passwd",
    "authorization",
    "bearer",
    "cookie",
    "credential",
    "private_key",
)
_SENSITIVE_KEY_SUFFIXES: Final[tuple[str, ...]] = ("_token", "_secret", "_password")

_NEVER_EMIT_FIELDS: Final[frozenset[str]] = frozenset(
    {
        "decree_text",
        "prompt",
        "prompts",
        "system_prompt",
        "messages",
        "response_text",
        "completion_text",
        "raw_response",
    }
)
"""Free text whose content is replaced by a fingerprint, never emitted."""


def _is_sensitive_key(key: str) -> bool:
    lowered = key.strip().lower()
    if any(marker in lowered for marker in _SENSITIVE_KEY_MARKERS):
        return True
    return lowered.endswith(_SENSITIVE_KEY_SUFFIXES)


def fingerprint_text(value: str) -> dict[str, Any]:
    """Reduce free text to a hash plus a length; the text itself never leaks."""
    if not value:
        return {"sha256_16": "", "length": 0}
    digest = hashlib.sha256(value.encode("utf-8", "replace")).hexdigest()[:16]
    return {"sha256_16": digest, "length": len(value)}


def sanitize_value(key: str, value: Any) -> Any:
    """Make one audit field safe to persist.

    Applied to keys *and* values, so a nested ``{"api_key": ...}`` cannot slip
    through inside a sub-mapping.
    """
    if value is None or isinstance(value, bool):
        return value
    # Credential keys are redacted before any type check, so a numeric or
    # nested secret can never survive by looking like an ordinary counter.
    if _is_sensitive_key(key):
        return REDACTED
    if type(value) is int:
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, str):
        if key.strip().lower() in _NEVER_EMIT_FIELDS:
            return fingerprint_text(value)
        return value[:_MAX_STRING]
    if isinstance(value, Mapping):
        items = list(value.items())[:_MAX_COLLECTION]
        return {str(k)[:_MAX_STRING]: sanitize_value(str(k), v) for k, v in items}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [sanitize_value("", item) for item in list(value)[:_MAX_COLLECTION]]
    return str(value)[:_MAX_STRING]


def sanitize_fields(fields: Mapping[str, Any]) -> dict[str, Any]:
    """Sanitise a whole record, dropping only the keys that are not strings."""
    return {str(key): sanitize_value(str(key), value) for key, value in fields.items()}


# ---------------------------------------------------------------------------
# 7. Audit events
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AuditEvent:
    """One sanitized, self-describing audit record."""

    event_type: AuditEventType
    severity: AuditSeverity
    fields: Mapping[str, Any] = field(default_factory=dict)

    def to_audit_record(self) -> dict[str, Any]:
        assert_no_forbidden_migration(self.fields)
        record: dict[str, Any] = {
            "taxonomy_version": AUDIT_TAXONOMY_VERSION,
            "event_type": self.event_type.value,
            "severity": self.severity.value,
        }
        record.update(sanitize_fields(self.fields))
        return record


def build_job_audit_event(
    *,
    state: str,
    job_id: str,
    attempt_count: int | None = None,
    provider_request_count: int | None = None,
    provider_request_limit: int | None = None,
    error_code: str | None = None,
    error_stage: str | None = None,
    error_category: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    cost_usd: float | None = None,
) -> AuditEvent:
    """Build a job audit event from the current ``DecreeJob`` fields."""
    event_type = event_type_for_job_state(state)
    if error_code is not None:
        assert_known_job_failure_code(error_code)
    category = error_category
    if category is None and error_code is not None:
        category = classify_job_failure_category(error_code).value
    budget = BudgetSnapshot(
        attempts_used=provider_request_count,
        max_attempts=provider_request_limit,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd=cost_usd,
    )
    fields: dict[str, Any] = {
        "job_id": job_id,
        "job_state": state,
        "attempt_count": attempt_count,
        "error_code": error_code,
        "error_stage": error_stage,
        "error_category": category,
    }
    fields.update(budget.to_audit_fields())
    return AuditEvent(event_type=event_type, severity=severity_for(event_type), fields=fields)


def build_provider_attempt_event(
    *,
    outcome: str,
    job_id: str | None = None,
    failure_category: str | None = None,
    provider_http_status: int | None = None,
    retry_count: int | None = None,
    budget: BudgetSnapshot | None = None,
) -> AuditEvent:
    """Build a provider-attempt audit event from the current client errors.

    ``failure_category`` must come from ``deepseek_client.FailureCategory``;
    ``retry_count`` reports bounded attempts already consumed inside one call
    and is explicitly not an implicit-retry signal.
    """
    event_type = (
        AuditEventType.PROVIDER_ATTEMPT_RESERVED
        if outcome == "reserved"
        else AuditEventType.PROVIDER_ATTEMPT_FAILED
    )
    if failure_category is not None:
        assert_known_provider_failure_category(failure_category)
    fields: dict[str, Any] = {
        "job_id": job_id,
        "failure_stage": "provider_request" if failure_category is not None else None,
        "failure_category": failure_category,
        "provider_http_status": provider_http_status,
        "retry_count": retry_count,
        "transient": (
            is_transient_provider_failure(failure_category)
            if failure_category is not None
            else None
        ),
    }
    if budget is not None:
        fields.update(budget.to_audit_fields())
    return AuditEvent(event_type=event_type, severity=severity_for(event_type), fields=fields)


def build_budget_exhausted_event(
    *,
    attempts_used: int,
    max_attempts: int,
    job_id: str | None = None,
) -> AuditEvent:
    """Build the canonical event for a fail-closed provider budget rejection."""
    budget = BudgetSnapshot(attempts_used=attempts_used, max_attempts=max_attempts)
    fields: dict[str, Any] = {
        "job_id": job_id,
        "error_code": _BUDGET_CODE,
        "error_category": JobFailureCategory.BUDGET.value,
    }
    fields.update(budget.to_audit_fields())
    return AuditEvent(
        event_type=AuditEventType.PROVIDER_BUDGET_EXHAUSTED,
        severity=AuditSeverity.RED,
        fields=fields,
    )


def summarize_audit_events(events: Iterable[AuditEvent]) -> dict[str, Any]:
    """Release-facing summary.

    With no observations the light is ``yellow`` and a ``no_audit_events``
    blocker is reported.  It is never ``green``: an empty log is missing
    evidence, not passing evidence.
    """
    records = list(events)
    if not records:
        return {
            "light": AuditSeverity.YELLOW.value,
            "total": 0,
            "red": 0,
            "yellow": 0,
            "green": 0,
            "by_event_type": {},
            "blockers": ["no_audit_events"],
            "next_action": "先产生真实审计事件，再据此判断发布。",
        }
    counts = {severity.value: 0 for severity in AuditSeverity}
    by_event_type: dict[str, int] = {}
    for record in records:
        counts[record.severity.value] += 1
        by_event_type[record.event_type.value] = (
            by_event_type.get(record.event_type.value, 0) + 1
        )
    light = (
        AuditSeverity.RED.value
        if counts[AuditSeverity.RED.value]
        else AuditSeverity.YELLOW.value
        if counts[AuditSeverity.YELLOW.value]
        else AuditSeverity.GREEN.value
    )
    return {
        "light": light,
        "total": len(records),
        "red": counts[AuditSeverity.RED.value],
        "yellow": counts[AuditSeverity.YELLOW.value],
        "green": counts[AuditSeverity.GREEN.value],
        "by_event_type": by_event_type,
        "blockers": [
            record.event_type.value
            for record in records
            if record.severity is AuditSeverity.RED
        ][:10],
        "next_action": (
            "可以进入发布候选。"
            if light == AuditSeverity.GREEN.value
            else "先处理阻断事件，再重新运行发布门禁。"
            if light == AuditSeverity.RED.value
            else "补齐降级项证据，再进入最终发布门禁。"
        ),
    }


def audit_event_types() -> Sequence[AuditEventType]:
    """The closed set of event types, in declaration order."""
    return tuple(AuditEventType)
