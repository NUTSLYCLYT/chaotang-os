from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from app.orchestration import ProviderBudget

_DATASET_PATH = Path(__file__).parents[1] / "harness" / "orchestration_comparison" / "cases.v1.json"
_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
_DATASET_FIELDS = {
    "schema_version",
    "dataset_id",
    "resource_manifest_digest",
    "cases",
}
_CASE_FIELDS = {
    "case_id",
    "category",
    "synthetic",
    "decree_text",
    "owner_ref",
    "route",
    "resource_manifest_digest",
    "provider_budget",
    "expected_invariants",
    "failure_injection",
    "expected_terminal_state",
}
_INVARIANTS = {
    "ADR_0028_ROUTE",
    "EXACTLY_ONE_REPLY",
    "FAIL_CLOSED",
    "IDEMPOTENT_REPLAY",
    "NO_CROSS_OWNER",
    "NO_DUPLICATE_SIDE_EFFECT",
    "NO_REPLY_ON_FAILURE",
    "ORDERED_EVIDENCE_REFS",
    "RESUME_FROM_CHECKPOINT",
    "SERIAL_DEPARTMENT_ORDER",
    "THREE_UNIQUE_RECOMMENDATIONS",
}


def _load_dataset() -> dict[str, object]:
    return json.loads(_DATASET_PATH.read_text("utf-8"))


def test_dataset_is_closed_versioned_sorted_and_has_exact_category_counts() -> None:
    dataset = _load_dataset()

    assert set(dataset) == _DATASET_FIELDS
    assert dataset["schema_version"] == "orchestration-comparison.v1"
    assert dataset["dataset_id"] == "dual-orchestration-contract-v1-20260816"
    assert _DIGEST.fullmatch(dataset["resource_manifest_digest"])
    cases = dataset["cases"]
    assert isinstance(cases, list)
    assert len(cases) == 24
    case_ids = [case["case_id"] for case in cases]
    assert case_ids == sorted(case_ids)
    assert len(set(case_ids)) == 24
    assert Counter(case["category"] for case in cases) == {
        "single": 8,
        "multi": 8,
        "recovery": 4,
        "security": 4,
    }


def test_every_case_is_synthetic_resource_bound_and_route_valid() -> None:
    dataset = _load_dataset()
    manifest_digest = dataset["resource_manifest_digest"]

    for case in dataset["cases"]:
        assert set(case) == _CASE_FIELDS
        assert case["synthetic"] is True
        assert case["resource_manifest_digest"] == manifest_digest
        assert case["decree_text"].strip()
        assert case["owner_ref"].startswith("synthetic-owner-")
        route = case["route"]
        assert set(route) == {"route_type", "departments"}
        departments = route["departments"]
        assert departments and len(departments) == len(set(departments))
        if route["route_type"] == "single":
            assert len(departments) == 1
        else:
            assert route["route_type"] == "multi"
            assert len(departments) >= 2
            assert "SERIAL_DEPARTMENT_ORDER" in case["expected_invariants"]
        budget = case["provider_budget"]
        assert set(budget) == {"max_calls", "max_tokens", "timeout_ms"}
        assert ProviderBudget.model_validate(budget).model_dump() == budget


def test_cases_freeze_success_failure_and_recovery_invariants() -> None:
    dataset = _load_dataset()

    for case in dataset["cases"]:
        invariants = case["expected_invariants"]
        assert invariants == sorted(set(invariants))
        assert set(invariants) <= _INVARIANTS
        assert {"ADR_0028_ROUTE", "NO_CROSS_OWNER", "NO_DUPLICATE_SIDE_EFFECT"} <= set(invariants)
        if case["expected_terminal_state"] in {"SUCCEEDED", "DEGRADED"}:
            assert {
                "EXACTLY_ONE_REPLY",
                "ORDERED_EVIDENCE_REFS",
                "THREE_UNIQUE_RECOMMENDATIONS",
            } <= set(invariants)
        else:
            assert case["expected_terminal_state"] == "FAILED"
            assert {"FAIL_CLOSED", "NO_REPLY_ON_FAILURE"} <= set(invariants)
        injection = case["failure_injection"]
        if case["category"] in {"single", "multi"}:
            assert injection is None
        else:
            assert set(injection) == {"kind", "at_step", "retryable"}
            assert injection["kind"].strip() and injection["at_step"].strip()
            assert type(injection["retryable"]) is bool


def test_dataset_contains_no_live_endpoint_secret_or_business_outcome_claim() -> None:
    serialized = _DATASET_PATH.read_text("utf-8").lower()

    assert "http://" not in serialized
    assert "https://" not in serialized
    assert "sk-" not in serialized
    assert "bearer " not in serialized
    assert "真实业务成功" not in serialized


def test_recovery_and_security_case_semantics_are_exactly_frozen() -> None:
    dataset = _load_dataset()
    actual = {
        case["case_id"]: (
            case["failure_injection"]["kind"],
            case["expected_terminal_state"],
            tuple(case["expected_invariants"]),
        )
        for case in dataset["cases"]
        if case["category"] in {"recovery", "security"}
    }

    expected_kind_and_state = {
        "case-17-recovery-provider-timeout": ("PROVIDER_TIMEOUT_ONCE", "SUCCEEDED"),
        "case-18-recovery-checkpoint-resume": ("WORKER_INTERRUPTION", "SUCCEEDED"),
        "case-19-recovery-terminal-replay": ("TERMINAL_REPLAY", "SUCCEEDED"),
        "case-20-recovery-terminal-failure": (
            "NON_RETRYABLE_SCHEMA_ERROR",
            "FAILED",
        ),
        "case-21-security-cross-owner": ("CROSS_OWNER_RESUME", "FAILED"),
        "case-22-security-tampered-digest": ("RESOURCE_DIGEST_MISMATCH", "FAILED"),
        "case-23-security-missing-adopted-evidence": (
            "ADOPTED_EVIDENCE_MISSING",
            "FAILED",
        ),
        "case-24-security-duplicate-archive": (
            "DUPLICATE_ARCHIVE_ATTEMPT",
            "FAILED",
        ),
    }
    assert {case_id: values[:2] for case_id, values in actual.items()} == expected_kind_and_state
    assert "RESUME_FROM_CHECKPOINT" in actual["case-17-recovery-provider-timeout"][2]
    assert "RESUME_FROM_CHECKPOINT" in actual["case-18-recovery-checkpoint-resume"][2]
    assert "IDEMPOTENT_REPLAY" in actual["case-19-recovery-terminal-replay"][2]
    assert "FAIL_CLOSED" in actual["case-20-recovery-terminal-failure"][2]
    assert "NO_CROSS_OWNER" in actual["case-21-security-cross-owner"][2]
    assert "FAIL_CLOSED" in actual["case-22-security-tampered-digest"][2]
    assert "NO_REPLY_ON_FAILURE" in actual["case-23-security-missing-adopted-evidence"][2]
    assert "NO_DUPLICATE_SIDE_EFFECT" in actual["case-24-security-duplicate-archive"][2]
