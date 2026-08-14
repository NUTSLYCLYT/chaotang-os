from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.decree_jobs.models import AcceptDecreeJob, DecreeJobState
from app.decree_jobs.storage import (
    DecreeJobStore,
    DecreeJobStoreError,
    IdempotencyConflict,
    JobNotFound,
    LeaseConflict,
)

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)


def _command(
    *,
    owner: str = "owner-a",
    key: str = "submission-1",
    request_hash: str = "hash-a",
    fingerprint: str = "a" * 64,
) -> AcceptDecreeJob:
    return AcceptDecreeJob(
        owner_user_id=owner,
        idempotency_key=key,
        request_hash=request_hash,
        draft_fingerprint=fingerprint,
        decree_text="请户部核查国库",
        approved_route_json='{"route_type":"single"}',
        deadline_at=NOW + timedelta(minutes=30),
    )


def test_accept_replays_same_owner_key_and_draft_without_duplicate(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")

    first = store.accept(_command(), now=NOW)
    replay = store.accept(_command(), now=NOW + timedelta(seconds=1))

    assert first.replayed is False
    assert replay.replayed is True
    assert replay.job.job_id == first.job.job_id
    assert replay.job.state is DecreeJobState.QUEUED
    assert store.count() == 1


def test_uncommitted_authority_acceptance_is_not_claimable_until_activated(
    tmp_path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(
        replace(_command(), acceptance_committed=False), now=NOW
    ).job

    assert store.claim_next("worker-a", now=NOW) is None
    assert store.lookup_replay(
        owner_user_id="owner-a",
        idempotency_key="submission-1",
        request_hash="hash-a",
    ) is None

    store.mark_authority_committed(pending.job_id, "owner-a", now=NOW)
    store.activate_acceptance(pending.job_id, "owner-a", now=NOW)
    claimed = store.claim_next("worker-a", now=NOW)
    assert claimed is not None
    assert claimed.job_id == pending.job_id


def test_crash_recovery_commits_the_same_pending_acceptance_once(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(
        replace(_command(), acceptance_committed=False), now=NOW
    ).job
    store.mark_authority_committed(pending.job_id, "owner-a", now=NOW)

    recovered = store.recover_acceptance(
        owner_user_id="owner-a",
        idempotency_key="submission-1",
        request_hash="hash-a",
        now=NOW + timedelta(seconds=1),
    )

    assert recovered is not None
    assert recovered.replayed is True
    assert recovered.job.job_id == pending.job_id
    assert store.count() == 1

    replay = store.recover_acceptance(
        owner_user_id="owner-a",
        idempotency_key="submission-1",
        request_hash="hash-a",
        now=NOW + timedelta(seconds=2),
    )
    assert replay is not None
    assert replay.job.job_id == pending.job_id
    assert store.activate_acceptance(
        pending.job_id, "owner-a", now=NOW + timedelta(seconds=2)
    ).job_id == pending.job_id
    assert store.claim_next("worker-a", now=NOW + timedelta(seconds=2)) is not None


def test_accept_never_replaces_a_durable_authority_marker(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    command = replace(_command(), acceptance_committed=False)
    pending = store.accept(command, now=NOW).job
    store.mark_authority_committed(pending.job_id, "owner-a", now=NOW)

    replay = store.accept(command, now=NOW + timedelta(seconds=1))

    assert replay.replayed is True
    assert replay.job.job_id == pending.job_id
    assert store.count() == 1
    assert store.claim_next("worker-a", now=NOW + timedelta(seconds=1)) is not None


def test_recovery_never_promotes_acceptance_without_authority_commit_marker(
    tmp_path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(
        replace(_command(), acceptance_committed=False), now=NOW
    ).job

    assert (
        store.recover_acceptance(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
            now=NOW + timedelta(seconds=1),
        )
        is None
    )
    assert store.claim_next("worker-a", now=NOW + timedelta(seconds=1)) is None
    with pytest.raises(DecreeJobStoreError, match="acceptance_activation_failed"):
        store.activate_acceptance(
            pending.job_id,
            "owner-a",
            now=NOW + timedelta(seconds=1),
        )


def test_crash_recovery_rejects_changed_payload_and_cannot_cross_owner(
    tmp_path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    store.accept(replace(_command(), acceptance_committed=False), now=NOW)

    with pytest.raises(IdempotencyConflict, match="idempotency_key_reused"):
        store.recover_acceptance(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-b",
            now=NOW,
        )

    assert store.recover_acceptance(
        owner_user_id="owner-b",
        idempotency_key="submission-1",
        request_hash="hash-a",
        now=NOW,
    ) is None
    assert store.count() == 1


def test_failed_authority_commit_abandons_hidden_acceptance(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(
        replace(_command(), acceptance_committed=False), now=NOW
    ).job

    store.abandon_acceptance(pending.job_id, "owner-a")

    assert store.count() == 0
    assert store.lookup_replay(
        owner_user_id="owner-a",
        idempotency_key="submission-1",
        request_hash="hash-a",
    ) is None


def test_reaccepted_authority_replaces_crash_orphan_before_activation(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    orphan = store.accept(
        replace(_command(), acceptance_committed=False), now=NOW
    ).job

    replacement = store.accept(
        replace(_command(), acceptance_committed=False),
        now=NOW + timedelta(seconds=1),
    )

    assert replacement.replayed is False
    assert replacement.job.job_id != orphan.job_id
    assert store.count() == 1
    store.mark_authority_committed(replacement.job.job_id, "owner-a", now=NOW)
    store.activate_acceptance(replacement.job.job_id, "owner-a", now=NOW)
    assert store.claim_next("worker-a", now=NOW) is not None


def test_accept_rejects_reused_key_with_different_request(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    store.accept(_command(), now=NOW)

    with pytest.raises(IdempotencyConflict):
        store.accept(_command(request_hash="hash-b"), now=NOW)


def test_accept_replays_same_draft_even_if_transport_key_changes(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    first = store.accept(_command(), now=NOW)

    replay = store.accept(_command(key="submission-after-reload"), now=NOW)

    assert replay.replayed is True
    assert replay.job.job_id == first.job.job_id
    assert store.count() == 1

    with pytest.raises(IdempotencyConflict):
        store.accept(
            _command(
                key="submission-after-reload",
                request_hash="hash-b",
                fingerprint="b" * 64,
            ),
            now=NOW,
        )


def test_get_is_owner_scoped_and_cross_owner_is_not_found(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(_command(), now=NOW)

    assert store.get_for_owner(accepted.job.job_id, "owner-a") == accepted.job
    with pytest.raises(JobNotFound):
        store.get_for_owner(accepted.job.job_id, "owner-b")


def test_lease_prevents_second_worker_and_expiry_recovers_once(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id

    first = store.claim_next("worker-a", now=NOW, lease_seconds=30)
    assert first is not None
    assert first.job_id == job_id
    assert first.state is DecreeJobState.RUNNING
    assert first.attempt_count == 1
    assert store.claim_next("worker-b", now=NOW, lease_seconds=30) is None

    recovered = store.claim_next(
        "worker-b", now=NOW + timedelta(seconds=31), lease_seconds=30
    )
    assert recovered is not None
    assert recovered.job_id == job_id
    assert recovered.attempt_count == 2

    assert (
        store.claim_next(
            "worker-c", now=NOW + timedelta(seconds=62), lease_seconds=30
        )
        is None
    )
    assert store.get_for_owner(job_id, "owner-a").state is DecreeJobState.FAILED


def test_worker_can_renew_lease_before_long_model_call_expires(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=30)

    renewed = store.renew_lease(
        job_id,
        "worker-a",
        now=NOW + timedelta(seconds=20),
        lease_seconds=30,
    )

    assert renewed.lease_expires_at == NOW + timedelta(seconds=50)
    assert store.claim_next("worker-b", now=NOW + timedelta(seconds=31)) is None


@pytest.mark.parametrize(
    "operation",
    [
        "provider",
        "checkpoint",
        "fail_attempt",
        "cancel_boundary",
        "fail_checkpoint",
        "complete",
    ],
)
def test_expired_lease_immediately_revokes_worker_mutation_without_reclaim(
    tmp_path, operation: str
) -> None:
    store = DecreeJobStore(tmp_path / f"expired-{operation}.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=1)
    expired_at = NOW + timedelta(seconds=2)

    if operation == "cancel_boundary":
        store.request_cancel(job_id, "owner-a", now=NOW)
    elif operation in {"fail_checkpoint", "complete"}:
        store.checkpoint_result(
            job_id,
            "worker-a",
            result_json='{"status":"ok"}',
            now=NOW,
        )
        if operation == "complete":
            store.begin_archiving(job_id, "worker-a", now=NOW)
            store.begin_publishing(
                job_id, "worker-a", reply_id="reply-1", now=NOW
            )
    before = store.get_for_owner(job_id, "owner-a")

    with pytest.raises(LeaseConflict):
        if operation == "provider":
            store.add_provider_requests(
                job_id, "worker-a", count=1, now=expired_at
            )
        elif operation == "checkpoint":
            store.checkpoint_result(
                job_id,
                "worker-a",
                result_json='{"status":"ok"}',
                now=expired_at,
            )
        elif operation == "fail_attempt":
            store.fail_attempt(
                job_id,
                "worker-a",
                error_code="provider_timeout",
                transient=False,
                retry_at=expired_at,
                now=expired_at,
            )
        elif operation == "cancel_boundary":
            store.cancel_at_boundary(job_id, "worker-a", now=expired_at)
        elif operation == "fail_checkpoint":
            store.fail_checkpoint(
                job_id,
                "worker-a",
                error_code="archive_unavailable",
                transient=False,
                now=expired_at,
            )
        else:
            store.complete(job_id, "worker-a", now=expired_at)

    assert store.count() == 1
    assert store.get_for_owner(job_id, "owner-a") == before


def test_transient_failure_retries_once_without_resetting_budget(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW)
    store.add_provider_requests(job_id, "worker-a", count=5, now=NOW)

    retry = store.fail_attempt(
        job_id,
        "worker-a",
        error_code="provider_timeout",
        transient=True,
        retry_at=NOW + timedelta(seconds=5),
        now=NOW,
    )
    assert retry.state is DecreeJobState.RETRY_WAIT
    assert retry.provider_request_count == 5
    assert store.claim_next("worker-b", now=NOW + timedelta(seconds=4)) is None

    second = store.claim_next("worker-b", now=NOW + timedelta(seconds=5))
    assert second is not None
    assert second.attempt_count == 2
    assert second.provider_request_count == 5
    terminal = store.fail_attempt(
        job_id,
        "worker-b",
        error_code="provider_timeout",
        transient=True,
        retry_at=NOW + timedelta(seconds=10),
        now=NOW + timedelta(seconds=5),
    )
    assert terminal.state is DecreeJobState.FAILED


def test_provider_limit_is_frozen_and_atomically_enforced_across_reopen(tmp_path) -> None:
    path = tmp_path / "jobs.sqlite3"
    store = DecreeJobStore(path)
    accepted = store.accept(_command(), now=NOW)
    job_id = accepted.job.job_id
    assert accepted.job.provider_request_limit == 8
    store.claim_next("worker-a", now=NOW)
    saturated = store.add_provider_requests(job_id, "worker-a", count=8, now=NOW)
    assert saturated.provider_request_count == 8

    reopened = DecreeJobStore(path)
    with pytest.raises(DecreeJobStoreError, match="provider_request_limit_exceeded"):
        reopened.add_provider_requests(job_id, "worker-a", count=1, now=NOW)
    assert reopened.get_for_owner(job_id, "owner-a").provider_request_count == 8


def test_provider_limit_rejects_values_above_route_safety_ceiling(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")

    with pytest.raises(ValueError, match="between 1 and 256"):
        store.accept(
            replace(_command(), provider_request_limit=257),
            now=NOW,
        )


def test_existing_legacy_job_schema_is_altered_without_losing_rows(tmp_path) -> None:
    path = tmp_path / "legacy-jobs.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.executescript(
            """
            CREATE TABLE decree_jobs (
                job_id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                draft_fingerprint TEXT NOT NULL,
                decree_text TEXT NOT NULL,
                approved_route_json TEXT NOT NULL,
                state TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                provider_request_count INTEGER NOT NULL DEFAULT 0,
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                result_json TEXT,
                reply_id TEXT,
                error_code TEXT,
                deadline_at TEXT NOT NULL,
                retry_at TEXT,
                lease_owner TEXT,
                lease_expires_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(owner_user_id, idempotency_key),
                UNIQUE(owner_user_id, draft_fingerprint)
            );
            """
        )
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                deadline_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?)
            """,
            (
                "legacy-job",
                "owner-a",
                "legacy-key",
                "legacy-hash",
                "a" * 64,
                "legacy decree",
                '{"route_type":"single"}',
                (NOW + timedelta(minutes=30)).isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.commit()

    store = DecreeJobStore(path)
    legacy = store.get_for_owner("legacy-job", "owner-a")
    with closing(sqlite3.connect(path)) as connection:
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(decree_jobs)")
        }
        committed = connection.execute(
            "SELECT authority_committed, acceptance_committed "
            "FROM decree_jobs WHERE job_id = ?",
            ("legacy-job",),
        ).fetchone()

    assert {
        "provider_request_limit",
        "error_stage",
        "error_category",
        "authority_committed",
        "acceptance_committed",
    }.issubset(columns)
    assert legacy.provider_request_limit == 8
    assert committed == (1, 1)


def test_authority_marker_migration_preserves_precommit_rows_as_untrusted(
    tmp_path,
) -> None:
    path = tmp_path / "previous-jobs.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.executescript(
            """
            CREATE TABLE decree_jobs (
                job_id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                draft_fingerprint TEXT NOT NULL,
                decree_text TEXT NOT NULL,
                approved_route_json TEXT NOT NULL,
                state TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                provider_request_count INTEGER NOT NULL DEFAULT 0,
                provider_request_limit INTEGER NOT NULL DEFAULT 8,
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                result_json TEXT,
                reply_id TEXT,
                error_code TEXT,
                error_stage TEXT,
                error_category TEXT,
                acceptance_committed INTEGER NOT NULL DEFAULT 1,
                deadline_at TEXT NOT NULL,
                retry_at TEXT,
                lease_owner TEXT,
                lease_expires_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(owner_user_id, idempotency_key),
                UNIQUE(owner_user_id, draft_fingerprint)
            );
            """
        )
        values = (
            "owner-a",
            "hash-a",
            "legacy decree",
            '{"route_type":"single"}',
            "QUEUED",
            (NOW + timedelta(minutes=30)).isoformat(),
            NOW.isoformat(),
            NOW.isoformat(),
        )
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                acceptance_committed, deadline_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
            """,
            ("pending-job", values[0], "pending-key", values[1], "a" * 64, *values[2:]),
        )
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                acceptance_committed, deadline_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            """,
            (
                "committed-job",
                values[0],
                "committed-key",
                values[1],
                "b" * 64,
                *values[2:],
            ),
        )
        connection.commit()

    store = DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        markers = connection.execute(
            "SELECT job_id, authority_committed, acceptance_committed "
            "FROM decree_jobs ORDER BY job_id"
        ).fetchall()

    assert markers == [("committed-job", 1, 1), ("pending-job", 0, 0)]
    assert (
        store.recover_acceptance(
            owner_user_id="owner-a",
            idempotency_key="pending-key",
            request_hash="hash-a",
            now=NOW,
        )
        is None
    )
    claimed = store.claim_next("worker-a", now=NOW)
    assert claimed is not None
    assert claimed.job_id == "committed-job"


def test_cancellation_is_cooperative_before_archive_and_rejected_after(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    queued_id = store.accept(_command(), now=NOW).job.job_id
    queued = store.request_cancel(queued_id, "owner-a", now=NOW)
    assert queued.state is DecreeJobState.CANCELLED

    running_id = store.accept(
        _command(key="submission-2", fingerprint="b" * 64), now=NOW
    ).job.job_id
    store.claim_next("worker-a", now=NOW)
    running = store.request_cancel(running_id, "owner-a", now=NOW)
    assert running.cancel_requested is True
    cancelled = store.cancel_at_boundary(running_id, "worker-a", now=NOW)
    assert cancelled.state is DecreeJobState.CANCELLED

    archiving_id = store.accept(
        _command(key="submission-3", fingerprint="c" * 64), now=NOW
    ).job.job_id
    store.claim_next("worker-a", now=NOW)
    store.checkpoint_result(
        archiving_id, "worker-a", result_json='{"status":"ok"}', now=NOW
    )
    store.begin_archiving(archiving_id, "worker-a", now=NOW)
    archiving = store.request_cancel(archiving_id, "owner-a", now=NOW)
    assert archiving.state is DecreeJobState.ARCHIVING
    assert archiving.cancel_requested is False


def test_result_checkpoint_and_completion_survive_store_reopen(tmp_path) -> None:
    path = tmp_path / "jobs.sqlite3"
    store = DecreeJobStore(path)
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW)
    store.checkpoint_result(
        job_id, "worker-a", result_json='{"status":"ok"}', now=NOW
    )
    store.begin_archiving(job_id, "worker-a", now=NOW)
    store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)
    complete = store.complete(job_id, "worker-a", now=NOW)

    reopened = DecreeJobStore(path).get_for_owner(job_id, "owner-a")
    assert complete.state is DecreeJobState.SUCCEEDED
    assert reopened.state is DecreeJobState.SUCCEEDED
    assert reopened.result_json == '{"status":"ok"}'
    assert reopened.reply_id == "reply-1"


def test_checkpoint_transitions_cannot_regress_or_skip_stages(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW)

    with pytest.raises(LeaseConflict):
        store.begin_archiving(job_id, "worker-a", now=NOW)

    store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
    with pytest.raises(LeaseConflict):
        store.checkpoint_result(job_id, "worker-a", result_json='{"status":"new"}', now=NOW)


def test_result_checkpoint_atomically_honors_a_late_cancel_request(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "late-cancel.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=30)
    store.request_cancel(job_id, "owner-a", now=NOW)

    checkpointed = store.checkpoint_result(
        job_id,
        "worker-a",
        result_json='{"status":"ok"}',
        now=NOW,
    )

    assert checkpointed.state is DecreeJobState.CANCELLED
    assert checkpointed.result_json is None
    assert checkpointed.lease_owner is None


def test_transient_failure_atomically_finishes_a_late_cancel_request(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "late-cancel-failure.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=30)
    store.request_cancel(job_id, "owner-a", now=NOW)

    cancelled = store.fail_attempt(
        job_id,
        "worker-a",
        error_code="result_checkpoint_failed",
        transient=True,
        retry_at=NOW + timedelta(seconds=5),
        now=NOW,
    )

    assert cancelled.state is DecreeJobState.CANCELLED
    assert cancelled.retry_at is None
    assert cancelled.lease_owner is None


def test_side_effect_transient_failure_retries_once_then_fails_closed(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW)
    store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
    store.begin_archiving(job_id, "worker-a", now=NOW)

    retrying = store.fail_checkpoint(
        job_id,
        "worker-a",
        error_code="archive_unavailable",
        transient=True,
        now=NOW,
    )
    assert retrying.state is DecreeJobState.ARCHIVING
    recovered = store.claim_next("worker-b", now=NOW)
    assert recovered is not None
    terminal = store.fail_checkpoint(
        job_id,
        "worker-b",
        error_code="archive_unavailable",
        transient=True,
        now=NOW,
    )
    assert terminal.state is DecreeJobState.FAILED


@pytest.mark.parametrize(
    "checkpoint, expected_state",
    [
        ("result", DecreeJobState.RESULT_READY),
        ("archive", DecreeJobState.ARCHIVING),
        ("publish", DecreeJobState.PUBLISHING),
    ],
)
def test_expired_side_effect_checkpoint_is_reclaimed_without_model_retry(
    tmp_path, checkpoint: str, expected_state: DecreeJobState
) -> None:
    store = DecreeJobStore(tmp_path / f"{checkpoint}.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=30)
    store.checkpoint_result(
        job_id, "worker-a", result_json='{"status":"ok"}', now=NOW
    )
    if checkpoint in {"archive", "publish"}:
        store.begin_archiving(job_id, "worker-a", now=NOW)
    if checkpoint == "publish":
        store.begin_publishing(
            job_id, "worker-a", reply_id="reply-1", now=NOW
        )

    recovered = store.claim_next(
        "worker-b", now=NOW + timedelta(seconds=31), lease_seconds=30
    )

    assert recovered is not None
    assert recovered.state is expected_state
    assert recovered.attempt_count == 1
    assert recovered.lease_owner == "worker-b"
