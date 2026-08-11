from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

import app.langgraph_runtime.provider_budget as provider_budget_module
from app.langgraph_runtime.provider_budget import (
    ProviderAttemptBudget,
    ProviderBudgetExceeded,
    configure_provider_attempt_budget,
    get_provider_attempt_budget,
)


@pytest.fixture(autouse=True)
def restore_unbounded_budget():
    configure_provider_attempt_budget(None)
    yield
    configure_provider_attempt_budget(None)


def test_eight_reservations_succeed_and_ninth_fails_closed():
    budget = ProviderAttemptBudget(max_attempts=8)

    for _ in range(8):
        budget.reserve()

    with pytest.raises(ProviderBudgetExceeded) as exc_info:
        budget.reserve()
    assert budget.attempts_used == 8
    assert exc_info.value.safe_metadata == {"attempts_used": 8, "max_attempts": 8}


def test_concurrent_reservations_never_exceed_limit():
    budget = ProviderAttemptBudget(max_attempts=8)

    def reserve_once() -> bool:
        try:
            budget.reserve()
        except ProviderBudgetExceeded:
            return False
        return True

    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(lambda _index: reserve_once(), range(32)))

    assert sum(results) == 8
    assert budget.attempts_used == 8


def test_configured_budget_is_one_process_shared_instance():
    configure_provider_attempt_budget(8)

    first = get_provider_attempt_budget()
    second = get_provider_attempt_budget()

    assert first is second
    assert first is not None
    assert first.max_attempts == 8


def test_reconfiguring_same_process_limit_preserves_instance_and_usage():
    first = configure_provider_attempt_budget(8)
    assert first is not None
    first.reserve()

    second = configure_provider_attempt_budget(8)

    assert second is first
    assert second.attempts_used == 1


def test_context_budget_combines_with_global_cap_without_crossing_jobs():
    process_budget = configure_provider_attempt_budget(4)
    assert process_budget is not None
    job_a = ProviderAttemptBudget(max_attempts=8)
    job_b = ProviderAttemptBudget(max_attempts=8)

    with provider_budget_module.use_provider_attempt_budget(job_a):
        provider_budget_module.get_provider_attempt_budget().reserve()  # type: ignore[union-attr]
        provider_budget_module.get_provider_attempt_budget().reserve()  # type: ignore[union-attr]
    with provider_budget_module.use_provider_attempt_budget(job_b):
        provider_budget_module.get_provider_attempt_budget().reserve()  # type: ignore[union-attr]
    with provider_budget_module.use_provider_attempt_budget(job_a):
        provider_budget_module.get_provider_attempt_budget().reserve()  # type: ignore[union-attr]
    with provider_budget_module.use_provider_attempt_budget(job_b):
        with pytest.raises(ProviderBudgetExceeded):
            provider_budget_module.get_provider_attempt_budget().reserve()  # type: ignore[union-attr]

    assert process_budget.attempts_used == 4
    assert job_a.attempts_used == 3
    assert job_b.attempts_used == 1
    assert get_provider_attempt_budget() is process_budget
