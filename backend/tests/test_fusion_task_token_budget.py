"""Durable pre-request reservations, not proof of provider tokenization."""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.fusion.budget import PersistentProviderBudget

DIGEST = "a" * 64


def task(tmp_path, *, owner="owner-1", job="task-1", limit=20000):
    budget = PersistentProviderBudget(tmp_path / "budget.sqlite3", max_attempts=10)
    return budget.for_task(owner_id=owner, task_id=job, max_tokens=limit)


def reserve(budget, request, *, attempt="attempt-1", input_tokens=1000, output_tokens=1000):
    return budget.reserve_tokens(
        attempt_id=attempt,
        request_id=request,
        request_sha256=DIGEST,
        input_tokens=input_tokens,
        max_output_tokens=output_tokens,
    )


def test_task_cap_survives_restart_and_new_attempt(tmp_path):
    first = task(tmp_path)
    reserve(first, "request-1", input_tokens=12000, output_tokens=8000)
    resumed = task(tmp_path)
    assert resumed.snapshot().reserved_tokens == 20000
    with pytest.raises(RuntimeError, match="task_token_budget_exhausted"):
        reserve(resumed, "request-2", attempt="attempt-2")
    with pytest.raises(ValueError, match="immutable"):
        task(tmp_path, limit=10000)
    with pytest.raises(ValueError):
        task(tmp_path, limit=20001)


def test_concurrent_reservations_never_overbook_one_task(tmp_path):
    ledgers = [task(tmp_path) for _ in range(2)]

    def attempt(index):
        try:
            reserve(ledgers[index % 2], f"request-{index}")
            return True
        except RuntimeError:
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(30))) == 10
    state = ledgers[0].snapshot()
    assert state.reserved_tokens == 20000
    assert state.available_tokens == 0


def test_settlement_is_idempotent_and_refunds_only_verified_unused_reservation(tmp_path):
    budget = task(tmp_path)
    grant = reserve(budget, "request-1")
    assert (grant.owner_id, grant.task_id) == ("owner-1", "task-1")
    assert grant.max_output_tokens == 1000
    assert grant.input_tokens == 1000
    with pytest.raises(RuntimeError, match="reservation_already_exists"):
        reserve(budget, "request-1")
    settled = budget.settle_tokens(
        request_id="request-1", request_sha256=DIGEST, input_tokens=900, output_tokens=100
    )
    assert settled.charged_tokens == 1000
    assert settled.reserved_tokens == 0
    assert settled.available_tokens == 19000
    assert (
        budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=900, output_tokens=100
        )
        == settled
    )
    with pytest.raises(RuntimeError, match="usage_receipt_conflict"):
        budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=900, output_tokens=99
        )
    assert budget.snapshot() == settled


def test_failure_unknown_usage_and_retry_hold_the_full_reservation(tmp_path):
    budget = task(tmp_path)
    reserve(budget, "request-1", input_tokens=10000, output_tokens=5000)
    budget.mark_usage_unknown(request_id="request-1", request_sha256=DIGEST)
    assert task(tmp_path).snapshot().reserved_tokens == 15000
    with pytest.raises(RuntimeError, match="task_token_budget_exhausted"):
        reserve(budget, "retry", input_tokens=10000, output_tokens=5000)
    budget.settle_tokens(
        request_id="request-1", request_sha256=DIGEST, input_tokens=10000, output_tokens=100
    )
    reserve(budget, "retry", input_tokens=5000, output_tokens=1000)
    assert budget.snapshot().charged_tokens == 10100
    assert budget.snapshot().reserved_tokens == 6000


def test_provider_overrun_is_saved_and_freezes_task_across_restart(tmp_path):
    budget = task(tmp_path)
    reserve(budget, "request-1", input_tokens=18000, output_tokens=2000)
    with pytest.raises(RuntimeError, match="provider_usage_exceeded_reservation"):
        budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=19000, output_tokens=7000
        )
    state = task(tmp_path).snapshot()
    assert state.charged_tokens == 26000
    assert state.reserved_tokens == 0
    assert state.available_tokens == 0
    assert state.blocked_reason == "provider_usage_exceeded_reservation"
    with pytest.raises(RuntimeError, match="task_token_budget_blocked"):
        reserve(task(tmp_path), "request-2")
    with pytest.raises(RuntimeError, match="provider_usage_exceeded_reservation"):
        budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=19000, output_tokens=7000
        )
    assert budget.snapshot() == state


def test_owner_task_digest_and_request_boundaries(tmp_path):
    budget = task(tmp_path)
    reserve(budget, "request-1")
    for other in [task(tmp_path, owner="owner-2"), task(tmp_path, job="task-2")]:
        assert other.snapshot().reserved_tokens == 0
        with pytest.raises(RuntimeError, match="reservation_not_found"):
            other.settle_tokens(
                request_id="request-1", request_sha256=DIGEST, input_tokens=1, output_tokens=1
            )
    with pytest.raises(RuntimeError, match="request_digest_mismatch"):
        budget.settle_tokens(
            request_id="request-1", request_sha256="b" * 64, input_tokens=1, output_tokens=1
        )
    assert budget.snapshot().reserved_tokens == 2000


def test_separate_process_recovery_keeps_unsettled_request_and_attempt_counter(tmp_path):
    budget = task(tmp_path)
    script = """
import sys
from pathlib import Path
from app.fusion.budget import PersistentProviderBudget
b = PersistentProviderBudget(Path(sys.argv[1]), max_attempts=10)
b.reserve()
t = b.for_task(owner_id='owner-1', task_id='task-1', max_tokens=20000)
t.reserve_tokens(attempt_id='crashed-attempt', request_id='process-request',
                 request_sha256='a'*64, input_tokens=15000, max_output_tokens=5000)
"""
    result = subprocess.run(
        [sys.executable, "-c", script, str(budget.path)], capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr
    restarted = task(tmp_path)
    assert restarted.snapshot().reserved_tokens == 20000
    assert PersistentProviderBudget(budget.path, max_attempts=10).attempts_used == 1
    with pytest.raises(RuntimeError, match="task_token_budget_exhausted"):
        reserve(restarted, "after-restart", attempt="new-attempt")


def test_racing_duplicate_settlements_charge_once(tmp_path):
    budget = task(tmp_path)
    reserve(budget, "request-1")

    def settle(_):
        return budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=900, output_tokens=100
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        snapshots = list(pool.map(settle, range(16)))
    assert all(s.charged_tokens == 1000 and s.reserved_tokens == 0 for s in snapshots)


def test_unsupported_grants_do_not_change_the_existing_budget(tmp_path):
    budget = task(tmp_path)
    for changes in [
        {"attempt_id": ""},
        {"request_id": "bad/id"},
        {"request_sha256": "not-a-hash"},
        {"max_output_tokens": 0},
        {"input_tokens": 20001},
    ]:
        args = dict(
            attempt_id="attempt-1",
            request_id="request-1",
            request_sha256=DIGEST,
            input_tokens=1000,
            max_output_tokens=1000,
        )
        with pytest.raises(ValueError):
            budget.reserve_tokens(**(args | changes))
    assert budget.snapshot().available_tokens == 20000


@pytest.mark.parametrize("bad", [True, -1, 0.5, "1000", None])
def test_invalid_counts_do_not_create_or_release_reservations(tmp_path, bad):
    budget = task(tmp_path)
    with pytest.raises(ValueError):
        reserve(budget, "bad-request", input_tokens=bad)
    assert budget.snapshot().reserved_tokens == 0
    reserve(budget, "request-1")
    with pytest.raises(ValueError):
        budget.settle_tokens(
            request_id="request-1", request_sha256=DIGEST, input_tokens=bad, output_tokens=1
        )
    assert budget.snapshot().reserved_tokens == 2000
