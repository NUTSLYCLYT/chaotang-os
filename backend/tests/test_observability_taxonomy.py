"""HV-44 conformance guards for the observability taxonomy.

Each block below binds the taxonomy to the live value it claims to describe.
The point is to stop ``app.observability.taxonomy`` from decaying into a second,
decorative source of truth: if the worker, the store, the provider client or the
executor moves, one of these tests must fail.

Where a guard can be expressed without importing a heavy module it is written
against the source text, so it keeps working in a minimal environment; the
import-based guard is kept alongside it for the full test run.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import get_args

import pytest

from app.observability.taxonomy import (
    AUDIT_TAXONOMY_VERSION,
    FORBIDDEN_AUDIT_FIELDS,
    FORBIDDEN_MIGRATIONS,
    JOB_FAILURE_CODES,
    METRIC_NAMES,
    METRIC_SPECS,
    PROVIDER_FAILURE_CATEGORIES,
    REDACTED,
    TRANSIENT_PROVIDER_FAILURES,
    AuditEvent,
    AuditEventType,
    AuditSeverity,
    BudgetSnapshot,
    ForbiddenMigration,
    JobFailureCategory,
    UnknownJobFailureCode,
    UnknownJobState,
    UnknownProviderFailureCategory,
    assert_cost_does_not_override_gate,
    assert_known_job_failure_code,
    assert_known_provider_failure_category,
    assert_no_forbidden_migration,
    build_budget_exhausted_event,
    build_job_audit_event,
    build_provider_attempt_event,
    classify_job_failure_category,
    event_type_for_job_state,
    sanitize_fields,
    sanitize_value,
    severity_for,
    summarize_audit_events,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_APP = _BACKEND_ROOT / "app"

# The mapping owned by ``worker._failure_category`` before HV-44.  Pinned here so
# a refactor cannot quietly change which bucket a code lands in.
_EXPECTED_CATEGORY = {
    "provider_budget_exceeded": "budget",
    "deadline_exceeded": "deadline",
    "retry_exhausted": "retry",
    "model_output_invalid": "retry",
    "provider_timeout": "provider",
    "provider_failed": "provider",
    "job_snapshot_invalid": "internal",
    "result_checkpoint_invalid": "internal",
    "execution_failed": "internal",
    "side_effect_failed": "internal",
    "publication_failed": "internal",
}

_TRANSIENT_BLOCK = re.compile(
    r"_TRANSIENT_PROVIDER_FAILURES\s*=\s*frozenset\(\s*\{(?P<body>[^}]*)\}", re.S
)
_FAILURE_CATEGORY_BLOCK = re.compile(
    r"FailureCategory\s*=\s*Literal\[(?P<body>[^\]]*)\]", re.S
)


def _quoted_literals(body: str) -> set[str]:
    return set(re.findall(r'"([^"]+)"', body))


# ---------------------------------------------------------------------------
# Event taxonomy <-> DecreeJobState
# ---------------------------------------------------------------------------


def test_taxonomy_version_is_declared():
    assert AUDIT_TAXONOMY_VERSION.startswith("hv44-audit-taxonomy.")


def test_every_decree_job_state_maps_onto_exactly_one_job_event_type():
    from app.decree_jobs.models import DecreeJobState

    states = [state.value for state in DecreeJobState]
    mapped = [event_type_for_job_state(state) for state in states]

    assert len(set(mapped)) == len(states), "job states must map 1:1 onto events"
    job_event_types = {item for item in AuditEventType if item.value.startswith("job_")}
    assert job_event_types == set(mapped), "declared job events must match job states"


def test_unknown_job_state_is_rejected_rather_than_defaulted():
    with pytest.raises(UnknownJobState):
        event_type_for_job_state("TELEPORTED")


def test_every_event_type_has_a_severity():
    for event_type in AuditEventType:
        assert isinstance(severity_for(event_type), AuditSeverity)


# ---------------------------------------------------------------------------
# Failure vocabulary <-> live consumers
# ---------------------------------------------------------------------------


def test_provider_failure_categories_mirror_the_client_source():
    source = (_APP / "langgraph_runtime" / "deepseek_client.py").read_text("utf-8")
    match = _FAILURE_CATEGORY_BLOCK.search(source)
    assert match is not None, "deepseek_client.FailureCategory literal not found"
    assert _quoted_literals(match.group("body")) == set(PROVIDER_FAILURE_CATEGORIES)


def test_transient_provider_failures_mirror_the_executor_source():
    source = (_APP / "decree_jobs" / "executor.py").read_text("utf-8")
    match = _TRANSIENT_BLOCK.search(source)
    assert match is not None, "executor._TRANSIENT_PROVIDER_FAILURES literal not found"
    assert _quoted_literals(match.group("body")) == set(TRANSIENT_PROVIDER_FAILURES)


def test_provider_failure_categories_mirror_the_live_client_module():
    deepseek_client = pytest.importorskip("app.langgraph_runtime.deepseek_client")
    assert _quoted_literals(
        " ".join(f'"{item}"' for item in get_args(deepseek_client.FailureCategory))
    ) == set(PROVIDER_FAILURE_CATEGORIES)


def test_worker_delegates_its_failure_category_to_the_taxonomy():
    source = (_APP / "decree_jobs" / "worker.py").read_text("utf-8")
    assert "classify_job_failure_category(code).value" in source, (
        "worker._failure_category must delegate to the taxonomy instead of "
        "owning a private copy of the mapping"
    )


def test_storage_sql_case_still_mirrors_the_taxonomy():
    source = (_APP / "decree_jobs" / "storage.py").read_text("utf-8")
    for fragment in (
        "WHEN error_code = 'provider_budget_exceeded' THEN 'budget'",
        "WHEN error_code = 'deadline_exceeded' THEN 'deadline'",
        "WHEN error_code = 'retry_exhausted' THEN 'retry'",
        "WHEN error_code LIKE 'provider_%' THEN 'provider'",
        "WHEN state = 'FAILED' THEN 'internal' ELSE NULL END",
    ):
        assert fragment in source, f"storage CASE lost its mapping: {fragment}"


def test_worker_failure_category_is_value_equivalent_for_every_known_code():
    worker = pytest.importorskip("app.decree_jobs.worker")

    codes = sorted(JOB_FAILURE_CODES) + ["provider_anything_new", "totally_unknown"]
    for code in codes:
        assert worker._failure_category(code) == classify_job_failure_category(code).value


@pytest.mark.parametrize("code,expected", sorted(_EXPECTED_CATEGORY.items()))
def test_failure_category_semantics_are_locked(code, expected):
    assert classify_job_failure_category(code).value == expected
    assert worker_equivalent(code) == expected


def worker_equivalent(code: str) -> str:
    """The derivation ``worker._failure_category`` used before HV-44."""
    if code == "provider_budget_exceeded":
        return "budget"
    if code == "deadline_exceeded":
        return "deadline"
    if code.startswith("provider_"):
        return "provider"
    if code in {"retry_exhausted", "model_output_invalid"}:
        return "retry"
    return "internal"


def test_every_declared_failure_code_classifies_into_the_closed_set():
    allowed = {item.value for item in JobFailureCategory}
    for code in JOB_FAILURE_CODES:
        assert_known_job_failure_code(code)
        assert classify_job_failure_category(code).value in allowed


def test_unknown_failure_code_is_rejected_loudly():
    with pytest.raises(UnknownJobFailureCode):
        assert_known_job_failure_code("totally_new_code")
    with pytest.raises(UnknownJobFailureCode):
        build_job_audit_event(state="FAILED", job_id="job-1", error_code="totally_new_code")


def test_unknown_provider_category_is_rejected_loudly():
    with pytest.raises(UnknownProviderFailureCategory):
        assert_known_provider_failure_category("meltdown")


def test_transient_membership_matches_the_declared_set():
    from app.observability.taxonomy import is_transient_provider_failure

    for category in PROVIDER_FAILURE_CATEGORIES:
        assert is_transient_provider_failure(category) == (
            category in TRANSIENT_PROVIDER_FAILURES
        )


# ---------------------------------------------------------------------------
# Budget fields - never synthesize a number
# ---------------------------------------------------------------------------


def test_budget_snapshot_never_synthesizes_a_number():
    empty = BudgetSnapshot()
    assert empty.total_tokens is None
    assert empty.attempts_remaining is None

    partial = BudgetSnapshot(prompt_tokens=10)
    assert partial.total_tokens is None, "half an observation is not an observation"

    assert BudgetSnapshot(prompt_tokens=10, completion_tokens=5).total_tokens == 15
    assert BudgetSnapshot(attempts_used=3, max_attempts=8).attempts_remaining == 5
    assert BudgetSnapshot(attempts_used=9, max_attempts=8).attempts_remaining == 0


def test_budget_snapshot_omits_unobserved_fields():
    fields = BudgetSnapshot(attempts_used=2, max_attempts=8).to_audit_fields()
    assert fields["attempts_used"] == 2
    assert fields["attempts_remaining"] == 6
    assert "prompt_tokens" not in fields
    assert "cost_usd" not in fields


def test_budget_snapshot_reads_safe_metadata_without_guessing():
    from app.langgraph_runtime.provider_budget import ProviderBudgetExceeded

    snapshot = BudgetSnapshot.from_safe_metadata(
        ProviderBudgetExceeded(attempts_used=8, max_attempts=8).safe_metadata
    )
    assert (snapshot.attempts_used, snapshot.max_attempts) == (8, 8)
    assert snapshot.prompt_tokens is None
    assert snapshot.cost_usd is None

    assert BudgetSnapshot.from_safe_metadata({"attempts_used": "8"}).attempts_used is None
    assert BudgetSnapshot.from_safe_metadata({}).attempts_used is None


def test_budget_exhausted_exposes_a_canonical_audit_event():
    from app.langgraph_runtime.provider_budget import ProviderBudgetExceeded

    exc = ProviderBudgetExceeded(attempts_used=8, max_attempts=8)
    record = exc.to_audit_event(job_id="job-1").to_audit_record()

    assert record["event_type"] == "provider_budget_exhausted"
    assert record["severity"] == "red"
    assert record["error_category"] == "budget"
    assert record["attempts_used"] == 8
    assert record["attempts_remaining"] == 0
    assert exc.safe_metadata == {"attempts_used": 8, "max_attempts": 8}


def test_budget_exhausted_event_helper_agrees_with_the_exception_path():
    from_exception = build_budget_exhausted_event(
        attempts_used=3, max_attempts=8
    ).to_audit_record()
    assert from_exception["error_code"] == "provider_budget_exceeded"
    assert from_exception["severity"] == "red"


# ---------------------------------------------------------------------------
# Sanitisation
# ---------------------------------------------------------------------------


def test_secrets_are_redacted_but_budget_counters_survive():
    # The placeholder values are deliberately short and obviously fake.
    # ``frontend/scripts/guard-credential-leak.sh`` rejects credential-shaped
    # literals in staged diffs, and redaction here is driven by the *key*, not
    # the value, so nothing is lost by keeping the fixtures small - and the
    # shared credential guard is not weakened for the sake of a test.
    fields = sanitize_fields(
        {
            "api_key": "x1",
            "authorization": "y2",
            "access_token": "z3",
            "password": "pw4",
            "prompt_tokens": 12,
            "completion_tokens": 3,
            "token_budget": 1000,
        }
    )
    assert fields["api_key"] == REDACTED
    assert fields["authorization"] == REDACTED
    assert fields["access_token"] == REDACTED
    assert fields["password"] == REDACTED
    # ``prompt_tokens`` / ``token_budget`` are budget counters, not credentials.
    assert fields["prompt_tokens"] == 12
    assert fields["completion_tokens"] == 3
    assert fields["token_budget"] == 1000


def test_a_numeric_secret_is_still_redacted():
    assert sanitize_value("api_key", 1234567890) == REDACTED


def test_nested_secrets_are_redacted_too():
    fields = sanitize_fields({"context": {"api_key": "sk-1", "note": "ok"}})
    assert fields["context"]["api_key"] == REDACTED
    assert fields["context"]["note"] == "ok"


def test_free_text_is_fingerprinted_not_emitted():
    decree_text = "密旨：收购XX公司，报价 1.2 亿"
    fields = sanitize_fields({"decree_text": decree_text, "job_id": "job-1"})

    assert fields["decree_text"]["length"] == len(decree_text)
    assert len(fields["decree_text"]["sha256_16"]) == 16
    assert decree_text not in json.dumps(fields, ensure_ascii=False)
    assert fields["job_id"] == "job-1"


def test_long_strings_are_truncated():
    fields = sanitize_fields({"note": "x" * 5000})
    assert len(fields["note"]) == 200


def test_non_finite_cost_is_not_emitted_as_a_number():
    assert sanitize_value("cost_usd", float("inf")) == "inf"


# ---------------------------------------------------------------------------
# Forbidden migrations
# ---------------------------------------------------------------------------


def test_forbidden_migrations_match_the_ledger():
    assert FORBIDDEN_MIGRATIONS == {
        "model_tier_routing",
        "provider_fallback",
        "response_cache",
        "implicit_retry",
    }


@pytest.mark.parametrize(
    "field_name",
    ["model_tier", "fallback_provider", "cache_hit", "auto_retry"],
)
def test_forbidden_audit_fields_are_rejected(field_name):
    with pytest.raises(ForbiddenMigration):
        assert_no_forbidden_migration({field_name: True})
    assert field_name in FORBIDDEN_AUDIT_FIELDS


def test_retry_count_is_observation_not_implicit_retry():
    # ``retry_count`` reports bounded attempts already consumed; it must stay
    # legal or the honest provider audit record could not be written at all.
    assert_no_forbidden_migration({"retry_count": 1})


def test_an_event_carrying_a_forbidden_field_cannot_be_serialized():
    event = AuditEvent(
        event_type=AuditEventType.JOB_STARTED,
        severity=AuditSeverity.GREEN,
        fields={"model_tier": "lite"},
    )
    with pytest.raises(ForbiddenMigration):
        event.to_audit_record()


def test_cost_signal_must_never_relax_a_blocking_gate():
    assert_cost_does_not_override_gate(gate_decision="clear", cost_signal=0.01)
    assert_cost_does_not_override_gate(gate_decision="blocked", cost_signal=None)
    with pytest.raises(ForbiddenMigration):
        assert_cost_does_not_override_gate(gate_decision="blocked", cost_signal=0.01)


# ---------------------------------------------------------------------------
# Job / provider audit builders and summary
# ---------------------------------------------------------------------------


def test_job_audit_event_derives_its_category_from_the_error_code():
    record = build_job_audit_event(
        state="FAILED", job_id="job-1", error_code="provider_budget_exceeded"
    ).to_audit_record()

    assert record["event_type"] == "job_failed"
    assert record["severity"] == "red"
    assert record["error_category"] == "budget"
    assert record["job_state"] == "FAILED"


def test_an_explicit_error_category_wins_over_the_derived_one():
    record = build_job_audit_event(
        state="CANCELLED",
        job_id="job-1",
        error_code="cancelled",
        error_category="cancelled",
    ).to_audit_record()
    assert record["error_category"] == "cancelled"


def test_provider_attempt_event_marks_transience_without_authorising_fallback():
    record = build_provider_attempt_event(
        outcome="failed",
        job_id="job-1",
        failure_category="rate_limit",
        provider_http_status=429,
        retry_count=1,
    ).to_audit_record()

    assert record["event_type"] == "provider_attempt_failed"
    assert record["severity"] == "yellow"
    assert record["transient"] is True
    assert record["provider_http_status"] == 429
    assert record["retry_count"] == 1
    assert "fallback_provider" not in record


def test_summary_never_reports_green_without_observations():
    summary = summarize_audit_events([])
    assert summary["light"] == "yellow"
    assert summary["total"] == 0
    assert summary["blockers"] == ["no_audit_events"]


def test_summary_traffic_light_follows_observed_severity():
    green = build_job_audit_event(state="SUCCEEDED", job_id="job-1")
    yellow = build_job_audit_event(state="RETRY_WAIT", job_id="job-2")
    red = build_job_audit_event(
        state="FAILED", job_id="job-3", error_code="deadline_exceeded"
    )

    assert summarize_audit_events([green])["light"] == "green"
    assert summarize_audit_events([green, yellow])["light"] == "yellow"
    assert summarize_audit_events([green, yellow, red])["light"] == "red"


def test_metric_names_are_unique_and_namespaced():
    assert len(METRIC_NAMES) == len(METRIC_SPECS)
    assert all(name.startswith("chaotang_") for name in METRIC_NAMES)
