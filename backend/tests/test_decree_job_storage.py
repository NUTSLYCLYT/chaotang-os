from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.decree_jobs import models as decree_job_models
from app.decree_jobs.models import AcceptDecreeJob, DecreeJobState
from app.decree_jobs.storage import (
    ClaimEvidenceCommitmentUnavailable,
    DecreeJobStore,
    DecreeJobStoreError,
    IdempotencyConflict,
    JobNotFound,
    LeaseConflict,
)

NOW = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)


def _commitment(
    state: str = "PENDING",
    *,
    digest: str | None = None,
) -> str:
    value = {
        "aggregate_digest": digest,
        "candidate_digest": digest,
        "control_ref": digest,
        "decision_digest": digest,
        "evidence_snapshot_digest": digest,
        "schema_version": "claim-evidence-job-commitment.v1",
        "state": state,
    }
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _spliced_commitment() -> str:
    value = {
        "aggregate_digest": "sha256:" + "1" * 64,
        "candidate_digest": "sha256:" + "2" * 64,
        "control_ref": "sha256:" + "3" * 64,
        "decision_digest": "sha256:" + "4" * 64,
        "evidence_snapshot_digest": "sha256:" + "5" * 64,
        "schema_version": "claim-evidence-job-commitment.v1",
        "state": "SIDECAR_EXPECTED",
    }
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


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


def _database_snapshot(path) -> tuple[object, ...]:
    with closing(sqlite3.connect(path)) as connection:
        return (
            connection.execute("PRAGMA journal_mode").fetchone()[0],
            connection.execute(
                "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name"
            ).fetchall(),
            connection.execute("PRAGMA table_info(decree_jobs)").fetchall(),
            connection.execute("PRAGMA foreign_key_list(decree_job_idempotency_keys)").fetchall(),
            connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall(),
            connection.execute(
                "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
            ).fetchall()
            if connection.execute(
                "SELECT 1 FROM sqlite_schema "
                "WHERE type = 'table' AND name = 'decree_job_idempotency_keys'"
            ).fetchone()
            else [],
        )


def _schema_snapshot(path) -> tuple[object, ...]:
    with closing(sqlite3.connect(path)) as connection:
        return (
            connection.execute("PRAGMA journal_mode").fetchone()[0],
            connection.execute("PRAGMA user_version").fetchone()[0],
            connection.execute(
                "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name"
            ).fetchall(),
        )


def _database_file_bytes(path) -> dict[str, tuple[int, str]]:
    candidates = [path, *(type(path)(f"{path}{suffix}") for suffix in ("-wal", "-shm", "-journal"))]
    return {
        candidate.name: (len(raw), hashlib.sha256(raw).hexdigest())
        for candidate in candidates
        if candidate.exists()
        for raw in (candidate.read_bytes(),)
    }


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
    pending = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job

    assert store.claim_next("worker-a", now=NOW) is None
    assert (
        store.lookup_replay(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
        )
        is None
    )

    store.mark_authority_committed(pending.job_id, "owner-a", now=NOW)
    store.activate_acceptance(pending.job_id, "owner-a", now=NOW)
    claimed = store.claim_next("worker-a", now=NOW)
    assert claimed is not None
    assert claimed.job_id == pending.job_id


def test_crash_recovery_commits_the_same_pending_acceptance_once(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job
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
    assert (
        store.activate_acceptance(pending.job_id, "owner-a", now=NOW + timedelta(seconds=2)).job_id
        == pending.job_id
    )
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
    pending = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job

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

    assert (
        store.recover_acceptance(
            owner_user_id="owner-b",
            idempotency_key="submission-1",
            request_hash="hash-a",
            now=NOW,
        )
        is None
    )
    assert store.count() == 1


def test_failed_authority_commit_abandons_hidden_acceptance(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    pending = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job

    store.abandon_acceptance(pending.job_id, "owner-a")

    assert store.count() == 0
    assert (
        store.lookup_replay(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
        )
        is None
    )


def test_reaccepted_authority_replaces_crash_orphan_before_activation(tmp_path) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    orphan = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job

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

    recovered = store.claim_next("worker-b", now=NOW + timedelta(seconds=31), lease_seconds=30)
    assert recovered is not None
    assert recovered.job_id == job_id
    assert recovered.attempt_count == 2

    assert store.claim_next("worker-c", now=NOW + timedelta(seconds=62), lease_seconds=30) is None
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
            store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)
    before = store.get_for_owner(job_id, "owner-a")

    with pytest.raises(LeaseConflict):
        if operation == "provider":
            store.add_provider_requests(job_id, "worker-a", count=1, now=expired_at)
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


def test_claim_evidence_commitment_column_is_nullable_and_new_jobs_use_sql_null(
    tmp_path,
) -> None:
    path = tmp_path / "claim-evidence-shadow.sqlite3"
    store = DecreeJobStore(path)
    accepted = store.accept(_command(), now=NOW)

    with closing(sqlite3.connect(path)) as connection:
        column = next(
            row
            for row in connection.execute("PRAGMA table_info(decree_jobs)")
            if row[1] == "claim_evidence_commitment_json"
        )
        commitment = connection.execute(
            "SELECT claim_evidence_commitment_json FROM decree_jobs WHERE job_id = ?",
            (accepted.job.job_id,),
        ).fetchone()

    assert column[2:] == ("TEXT", 0, None, 0)
    assert commitment == (None,)


def test_claim_evidence_commitment_decoder_is_closed_canonical_and_state_bound() -> None:
    digest = "sha256:" + "a" * 64
    pending = decree_job_models.parse_claim_evidence_commitment(_commitment())
    evaluated = decree_job_models.parse_claim_evidence_commitment(_commitment("EVALUATED_NONE"))
    sidecar = decree_job_models.parse_claim_evidence_commitment(
        _commitment("SIDECAR_EXPECTED", digest=digest)
    )

    assert pending.state == "PENDING"
    assert evaluated.state == "EVALUATED_NONE"
    assert sidecar.state == "SIDECAR_EXPECTED"
    assert sidecar.aggregate_digest == digest

    invalid = [
        _commitment() + " ",
        _commitment().replace('"state":"PENDING"', '"state":"PENDING","state":"PENDING"'),
        _commitment().replace('"state":"PENDING"', '"state":"UNKNOWN"'),
        _commitment().replace('"state":"PENDING"', '"state":[]'),
        _commitment().replace('"state":"PENDING"', '"state":{}'),
        _commitment().replace('"aggregate_digest":null', '"aggregate_digest":NaN'),
        _commitment().replace('"aggregate_digest":null', '"aggregate_digest":Infinity'),
        _commitment().replace('"aggregate_digest":null', f'"aggregate_digest":"{digest}"'),
        _commitment("SIDECAR_EXPECTED", digest=digest).replace(digest, "sha256:" + "A" * 64, 1),
        _commitment().replace('"state":"PENDING"', '"extra":null,"state":"PENDING"'),
        _commitment().replace('"aggregate_digest":null,', ""),
        "[]",
        "null",
        "{",
        _commitment() + (" " * 1025),
    ]
    for raw in invalid:
        with pytest.raises(ValueError):
            decree_job_models.parse_claim_evidence_commitment(raw)


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_future_commitment_blocks_storage_boundaries_without_writes(tmp_path, raw: str) -> None:
    store = DecreeJobStore(tmp_path / "future-commitment.sqlite3")
    accepted = store.accept(_command(), now=NOW)
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, accepted.job.job_id),
        )
        connection.commit()
        before_jobs = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
        before_keys = connection.execute(
            "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
        ).fetchall()

    unavailable = [
        lambda: store.lookup_replay(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
        ),
        lambda: store.recover_acceptance(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
            now=NOW,
        ),
        lambda: store.preflight_acceptance(
            owner_user_id="owner-a",
            idempotency_key="new-key",
            request_hash="hash-a",
            draft_fingerprint="a" * 64,
        ),
        lambda: store.accept(_command(), now=NOW),
        lambda: store.get_for_owner(accepted.job.job_id, "owner-a"),
        lambda: store.request_cancel(accepted.job.job_id, "owner-a", now=NOW),
        lambda: store.mark_authority_committed(accepted.job.job_id, "owner-a", now=NOW),
        lambda: store.activate_acceptance(accepted.job.job_id, "owner-a", now=NOW),
    ]
    for operation in unavailable:
        with pytest.raises(ClaimEvidenceCommitmentUnavailable):
            operation()
    assert store.claim_next("worker-a", now=NOW) is None

    with closing(sqlite3.connect(store.db_path)) as connection:
        after_jobs = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
        after_keys = connection.execute(
            "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
        ).fetchall()
    assert (before_jobs, before_keys) == (after_jobs, after_keys)


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_lookup_replay_detects_pending_future_commitment_instead_of_absence(
    tmp_path, raw: str
) -> None:
    store = DecreeJobStore(tmp_path / "pending-future-commitment.sqlite3")
    accepted = store.accept(replace(_command(), acceptance_committed=False), now=NOW)
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, accepted.job.job_id),
        )
        connection.commit()
        before = _database_snapshot(store.db_path)

    with pytest.raises(ClaimEvidenceCommitmentUnavailable):
        store.lookup_replay(
            owner_user_id="owner-a",
            idempotency_key="submission-1",
            request_hash="hash-a",
        )

    assert _database_snapshot(store.db_path) == before


@pytest.mark.parametrize("raw", [_commitment(), "{", _spliced_commitment()])
def test_future_commitment_blocks_every_worker_mutation_without_writes(tmp_path, raw: str) -> None:
    store = DecreeJobStore(tmp_path / "future-running.sqlite3")
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW, lease_seconds=30)
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (raw, job_id),
        )
        connection.commit()
        before = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
        ).fetchone()

    operations = [
        lambda: store.add_provider_requests(job_id, "worker-a", count=1, now=NOW),
        lambda: store.renew_lease(job_id, "worker-a", now=NOW, lease_seconds=30),
        lambda: store.fail_attempt(
            job_id,
            "worker-a",
            error_code="provider_timeout",
            transient=False,
            retry_at=NOW,
            now=NOW,
        ),
        lambda: store.cancel_at_boundary(job_id, "worker-a", now=NOW),
        lambda: store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW),
    ]
    for operation in operations:
        with pytest.raises(ClaimEvidenceCommitmentUnavailable):
            operation()

    with closing(sqlite3.connect(store.db_path)) as connection:
        after = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
        ).fetchone()
    assert before == after


@pytest.mark.parametrize(
    "boundary",
    [
        "abandon",
        "begin_archiving",
        "begin_publishing",
        "complete",
        "release_checkpoint",
        "fail_checkpoint",
    ],
)
def test_future_commitment_blocks_remaining_mutation_boundaries_without_writes(
    tmp_path, boundary: str
) -> None:
    store = DecreeJobStore(tmp_path / f"future-{boundary}.sqlite3")
    if boundary == "abandon":
        job_id = store.accept(replace(_command(), acceptance_committed=False), now=NOW).job.job_id
    else:
        job_id = store.accept(_command(), now=NOW).job.job_id
        store.claim_next("worker-a", now=NOW, lease_seconds=30)
        store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
        if boundary in {"begin_publishing", "complete"}:
            store.begin_archiving(job_id, "worker-a", now=NOW)
        if boundary == "complete":
            store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)
    with closing(sqlite3.connect(store.db_path)) as connection:
        connection.execute(
            "UPDATE decree_jobs SET claim_evidence_commitment_json = ? WHERE job_id = ?",
            (_spliced_commitment(), job_id),
        )
        connection.commit()
        before = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
        ).fetchone()

    if boundary == "abandon":

        def operation() -> None:
            store.abandon_acceptance(job_id, "owner-a")
    elif boundary == "begin_archiving":

        def operation() -> None:
            store.begin_archiving(job_id, "worker-a", now=NOW)
    elif boundary == "begin_publishing":

        def operation() -> None:
            store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)
    elif boundary == "complete":

        def operation() -> None:
            store.complete(job_id, "worker-a", now=NOW)
    elif boundary == "release_checkpoint":

        def operation() -> None:
            store.release_checkpoint(
                job_id,
                "worker-a",
                error_code="archive_unavailable",
                now=NOW,
            )
    else:

        def operation() -> None:
            store.fail_checkpoint(
                job_id,
                "worker-a",
                error_code="archive_unavailable",
                transient=False,
                now=NOW,
            )

    with pytest.raises(ClaimEvidenceCommitmentUnavailable):
        operation()
    with closing(sqlite3.connect(store.db_path)) as connection:
        after = connection.execute(
            "SELECT * FROM decree_jobs WHERE job_id = ?", (job_id,)
        ).fetchone()
    assert after == before


def test_future_commitment_is_inert_during_expiry_and_deadline_sweeps(
    tmp_path,
) -> None:
    store = DecreeJobStore(tmp_path / "future-sweeps.sqlite3")
    running_id = store.accept(_command(), now=NOW).job.job_id
    queued_id = store.accept(_command(key="submission-2", fingerprint="b" * 64), now=NOW).job.job_id
    with closing(sqlite3.connect(store.db_path)) as connection:
        for job_id, state, attempts in (
            (running_id, "RUNNING", 2),
            (queued_id, "QUEUED", 0),
        ):
            connection.execute(
                "UPDATE decree_jobs SET state = ?, attempt_count = ?, "
                "deadline_at = ?, lease_expires_at = ?, "
                "claim_evidence_commitment_json = ? WHERE job_id = ?",
                (
                    state,
                    attempts,
                    (NOW - timedelta(seconds=2)).isoformat(),
                    (NOW - timedelta(seconds=1)).isoformat(),
                    _spliced_commitment(),
                    job_id,
                ),
            )
        connection.commit()
        before = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()

    assert store.claim_next("worker-a", now=NOW) is None

    with closing(sqlite3.connect(store.db_path)) as connection:
        after = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
    assert after == before


def test_supported_legacy_job_schema_migrates_to_canonical_new_shape(tmp_path) -> None:
    path = tmp_path / "legacy-jobs.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(DecreeJobStore._EARLIEST_SCHEMA_SQL)
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
        columns = [row[1] for row in connection.execute("PRAGMA table_xinfo(decree_jobs)")]
        markers = connection.execute(
            "SELECT authority_committed, acceptance_committed, "
            "claim_evidence_commitment_json FROM decree_jobs WHERE job_id = ?",
            ("legacy-job",),
        ).fetchone()
        mapping = connection.execute(
            "SELECT owner_user_id, idempotency_key, request_hash, job_id "
            "FROM decree_job_idempotency_keys"
        ).fetchall()

    assert columns[-1] == "claim_evidence_commitment_json"
    assert legacy.provider_request_limit == 8
    assert markers == (1, 1, None)
    assert mapping == [("owner-a", "legacy-key", "legacy-hash", "legacy-job")]
    migrated = _database_snapshot(path)
    DecreeJobStore(path)
    assert _database_snapshot(path) == migrated


@pytest.mark.parametrize(
    "job_id,state,attempt_count,error_code,expected_stage,expected_category",
    [
        ("cancel-queued", "CANCELLED", 0, "cancelled", "queue", "cancelled"),
        ("cancel-running", "CANCELLED", 1, "cancelled", "execution", "cancelled"),
        ("budget", "FAILED", 1, "provider_budget_exceeded", "execution", "budget"),
        ("deadline", "FAILED", 1, "deadline_exceeded", "execution", "deadline"),
        ("retry", "FAILED", 1, "retry_exhausted", "execution", "retry"),
        ("provider", "FAILED", 1, "provider_timeout", "execution", "provider"),
        ("internal", "FAILED", 1, "unexpected", "execution", "internal"),
    ],
)
def test_earliest_predecessor_terminal_truth_table_is_closed(
    tmp_path,
    job_id: str,
    state: str,
    attempt_count: int,
    error_code: str,
    expected_stage: str,
    expected_category: str,
) -> None:
    path = tmp_path / f"earliest-{job_id}.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(DecreeJobStore._EARLIEST_SCHEMA_SQL)
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                attempt_count, error_code, deadline_at, created_at, updated_at
            ) VALUES (?, 'owner-a', ?, 'hash-a', ?, 'legacy decree',
                      '{"route_type":"single"}', ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                f"key-{job_id}",
                hashlib.sha256(job_id.encode()).hexdigest(),
                state,
                attempt_count,
                error_code,
                (NOW + timedelta(minutes=30)).isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.commit()

    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        row = connection.execute(
            "SELECT error_stage, error_category, authority_committed, "
            "acceptance_committed, claim_evidence_commitment_json FROM decree_jobs"
        ).fetchone()
        mapping = connection.execute(
            "SELECT owner_user_id, idempotency_key, request_hash, job_id "
            "FROM decree_job_idempotency_keys"
        ).fetchone()

    assert row == (expected_stage, expected_category, 1, 1, None)
    assert mapping == ("owner-a", f"key-{job_id}", "hash-a", job_id)


@pytest.mark.parametrize("pre_authority", [False, True])
def test_parent_only_nonterminal_stale_error_code_does_not_create_typed_failure(
    tmp_path, pre_authority: bool
) -> None:
    path = tmp_path / f"nonterminal-{pre_authority}.sqlite3"
    schema_sql = (
        DecreeJobStore._PRE_AUTHORITY_SCHEMA_SQL
        if pre_authority
        else DecreeJobStore._EARLIEST_SCHEMA_SQL
    )
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(schema_sql)
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                error_code, deadline_at, created_at, updated_at
            ) VALUES (
                'nonterminal-job', 'owner-a', 'nonterminal-key', 'hash-a', ?,
                'legacy decree', '{"route_type":"single"}', 'QUEUED',
                'provider_budget_exceeded', ?, ?, ?
            )
            """,
            (
                "e" * 64,
                (NOW + timedelta(minutes=30)).isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.commit()

    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        typed = connection.execute(
            "SELECT error_stage, error_category FROM decree_jobs"
        ).fetchone()

    assert typed == (None, None)


def test_supported_pre_authority_schema_migrates_with_trusted_markers(
    tmp_path,
) -> None:
    path = tmp_path / "previous-jobs.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(DecreeJobStore._PRE_AUTHORITY_SCHEMA_SQL)
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
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                acceptance_committed, error_code, error_stage, error_category,
                deadline_at, created_at, updated_at
            ) VALUES (
                'typed-job', 'owner-a', 'typed-key', 'typed-hash', ?,
                'legacy decree', '{"route_type":"single"}', 'FAILED', 1,
                'provider_timeout', 'custom-stage', 'custom-category', ?, ?, ?
            )
            """,
            (
                "c" * 64,
                (NOW + timedelta(minutes=30)).isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO decree_jobs (
                job_id, owner_user_id, idempotency_key, request_hash,
                draft_fingerprint, decree_text, approved_route_json, state,
                acceptance_committed, error_code, deadline_at, created_at, updated_at
            ) VALUES (
                'deadline-job', 'owner-a', 'deadline-key', 'deadline-hash', ?,
                'legacy decree', '{"route_type":"single"}', 'FAILED', 1,
                'deadline_exceeded', ?, ?, ?
            )
            """,
            (
                "d" * 64,
                (NOW + timedelta(minutes=30)).isoformat(),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        connection.commit()

    store = DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        markers = connection.execute(
            "SELECT job_id, authority_committed, acceptance_committed, "
            "error_stage, error_category, claim_evidence_commitment_json "
            "FROM decree_jobs ORDER BY job_id"
        ).fetchall()
        mappings = connection.execute(
            "SELECT job_id FROM decree_job_idempotency_keys ORDER BY job_id"
        ).fetchall()

    assert markers == [
        ("committed-job", 1, 1, None, None, None),
        ("deadline-job", 1, 1, "execution", "deadline", None),
        ("pending-job", 0, 0, None, None, None),
        ("typed-job", 1, 1, "custom-stage", "custom-category", None),
    ]
    assert mappings == [
        ("committed-job",),
        ("deadline-job",),
        ("pending-job",),
        ("typed-job",),
    ]
    assert (
        store.recover_acceptance(
            owner_user_id="owner-a",
            idempotency_key="pending-key",
            request_hash="hash-a",
            now=NOW,
        )
        is None
    )


def test_exact_old_schema_rebuilds_to_the_only_canonical_new_shape(tmp_path) -> None:
    path = tmp_path / "exact-old.sqlite3"
    seed = DecreeJobStore(path)
    job_id = seed.accept(_command(), now=NOW).job.job_id
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()
        old_columns = [str(row[1]) for row in connection.execute("PRAGMA table_info(decree_jobs)")]
        before_jobs = connection.execute("SELECT * FROM decree_jobs ORDER BY job_id").fetchall()
        before_keys = connection.execute(
            "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
        ).fetchall()

    class TracedStore(DecreeJobStore):
        def __init__(self, db_path) -> None:
            self.statements: list[str] = []
            super().__init__(db_path)

        def _connect_for_initialization(self) -> sqlite3.Connection:
            connection = super()._connect_for_initialization()
            connection.set_trace_callback(self.statements.append)
            return connection

    reopened = TracedStore(path)
    mutations = [
        statement
        for statement in reopened.statements
        if statement.lstrip()
        .upper()
        .startswith(("ALTER ", "CREATE ", "DELETE ", "DROP ", "INSERT ", "REPLACE ", "UPDATE "))
    ]
    assert mutations[0:2] == [
        "ALTER TABLE main.decree_job_idempotency_keys "
        "RENAME TO __ct_p10b1_decree_job_idempotency_keys_old",
        "ALTER TABLE main.decree_jobs RENAME TO __ct_p10b1_decree_jobs_old",
    ]
    assert mutations[-2:] == [
        "DROP TABLE main.__ct_p10b1_decree_job_idempotency_keys_old",
        "DROP TABLE main.__ct_p10b1_decree_jobs_old",
    ]
    creates = [
        statement
        for statement in mutations
        if statement.lstrip().upper().startswith("CREATE")
    ]
    assert all("CREATE TABLE main." in statement for statement in creates)
    assert all("ADD COLUMN" not in statement.upper() for statement in mutations)
    with closing(sqlite3.connect(path)) as connection:
        assert reopened._schema_digest(connection) == reopened._EXACT_NEW_SCHEMA
        projection = ", ".join(f'"{column}"' for column in old_columns)
        assert (
            connection.execute(f"SELECT {projection} FROM decree_jobs ORDER BY job_id").fetchall()
            == before_jobs
        )
        assert (
            connection.execute(
                "SELECT * FROM decree_job_idempotency_keys ORDER BY owner_user_id, idempotency_key"
            ).fetchall()
            == before_keys
        )
    assert reopened.get_for_owner(job_id, "owner-a").job_id == job_id


def test_exact_new_schema_restart_performs_no_ddl_or_dml(tmp_path) -> None:
    path = tmp_path / "exact-new.sqlite3"
    seed = DecreeJobStore(path)
    seed.accept(_command(), now=NOW)
    before = _database_snapshot(path)
    before_mode = before[0]
    before_files = _database_file_bytes(path)

    class TracedStore(DecreeJobStore):
        def __init__(self, db_path) -> None:
            self.statements: list[str] = []
            super().__init__(db_path)

        def _connect_for_initialization(self) -> sqlite3.Connection:
            connection = super()._connect_for_initialization()
            connection.set_trace_callback(self.statements.append)
            return connection

    reopened = TracedStore(path)
    assert not [
        statement
        for statement in reopened.statements
        if statement.lstrip()
        .upper()
        .startswith(("ALTER ", "CREATE ", "DELETE ", "DROP ", "INSERT ", "REPLACE ", "UPDATE "))
    ]
    assert _database_snapshot(path) == before
    assert _database_file_bytes(path) == before_files
    with closing(sqlite3.connect(path)) as connection:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == before_mode


def test_exact_new_wal_restart_preserves_main_and_live_sidecar_bytes(tmp_path) -> None:
    path = tmp_path / "exact-new-wal.sqlite3"
    store = DecreeJobStore(path)
    job_id = store.accept(_command(), now=NOW).job.job_id
    writer = sqlite3.connect(path)
    try:
        assert writer.execute("PRAGMA journal_mode = WAL").fetchone()[0] == "wal"
        writer.execute(
            "UPDATE decree_jobs SET updated_at = updated_at WHERE job_id = ?",
            (job_id,),
        )
        writer.commit()
        assert type(path)(f"{path}-wal").exists()
        assert type(path)(f"{path}-shm").exists()
        before = _database_file_bytes(path)

        DecreeJobStore(path)

        assert _database_file_bytes(path) == before
    finally:
        writer.close()


def test_all_frozen_schema_identities_are_mechanically_reproducible(tmp_path) -> None:
    empty = tmp_path / "empty.sqlite3"
    sqlite3.connect(empty).close()
    with closing(sqlite3.connect(empty)) as connection:
        assert DecreeJobStore._schema_digest(connection) == DecreeJobStore._FRESH_SCHEMA

    new = tmp_path / "new.sqlite3"
    DecreeJobStore(new)
    with closing(sqlite3.connect(new)) as connection:
        assert DecreeJobStore._schema_digest(connection) == DecreeJobStore._EXACT_NEW_SCHEMA
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()
        assert DecreeJobStore._schema_digest(connection) == DecreeJobStore._EXACT_OLD_SCHEMA

    for name, sql, expected in (
        ("earliest", DecreeJobStore._EARLIEST_SCHEMA_SQL, DecreeJobStore._EARLIEST_SCHEMA),
        (
            "pre-authority",
            DecreeJobStore._PRE_AUTHORITY_SCHEMA_SQL,
            DecreeJobStore._PRE_AUTHORITY_SCHEMA,
        ),
    ):
        path = tmp_path / f"{name}.sqlite3"
        with closing(sqlite3.connect(path)) as connection:
            connection.execute(sql)
            connection.commit()
            assert DecreeJobStore._schema_digest(connection) == expected


@pytest.mark.parametrize("sidecars_present", [False, True])
def test_unknown_wal_schema_probe_does_not_touch_target_or_sidecars(
    tmp_path, sidecars_present: bool
) -> None:
    path = tmp_path / "unknown-wal.sqlite3"
    store = DecreeJobStore(path)
    connection = sqlite3.connect(path)
    assert connection.execute("PRAGMA journal_mode = WAL").fetchone()[0] == "wal"
    connection.execute("CREATE VIEW unexpected_view AS SELECT 1 AS value")
    connection.commit()
    if not sidecars_present:
        connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        connection.close()
        assert not type(path)(f"{path}-wal").exists()
        assert not type(path)(f"{path}-shm").exists()
    before = _database_file_bytes(path)
    before_mode = "wal"

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        store.__class__(path)

    assert _database_file_bytes(path) == before
    if sidecars_present:
        connection.close()
    with closing(sqlite3.connect(path)) as verification:
        assert verification.execute("PRAGMA journal_mode").fetchone()[0] == before_mode


def test_unknown_delete_schema_probe_preserves_database_and_sidecar_bytes(tmp_path) -> None:
    path = tmp_path / "unknown-delete.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        assert connection.execute("PRAGMA journal_mode = DELETE").fetchone()[0] == "delete"
        connection.execute("CREATE TABLE unexpected_delete_state (value TEXT CHECK(value <> ''))")
        connection.commit()
    before = _database_file_bytes(path)
    before_mode = "delete"

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(path)

    assert _database_file_bytes(path) == before
    with closing(sqlite3.connect(path)) as connection:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == before_mode


def test_probe_rejects_source_snapshot_drift_before_target_open(tmp_path) -> None:
    path = tmp_path / "snapshot-drift.sqlite3"
    DecreeJobStore(path)
    before = _database_file_bytes(path)

    class DriftingSnapshotStore(DecreeJobStore):
        def __init__(self, db_path) -> None:
            self.snapshot_calls = 0
            self.target_opened = False
            super().__init__(db_path)

        def _source_snapshot(self):
            snapshot = super()._source_snapshot()
            self.snapshot_calls += 1
            if self.snapshot_calls == 2:
                name = self.db_path.name
                size, mtime, inode, digest = snapshot[name]
                snapshot[name] = (size, mtime + 1, inode, digest)
            return snapshot

        def _connect_for_initialization(self):
            self.target_opened = True
            return super()._connect_for_initialization()

    instance = DriftingSnapshotStore.__new__(DriftingSnapshotStore)
    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DriftingSnapshotStore.__init__(instance, path)

    assert instance.snapshot_calls == 2
    assert instance.target_opened is False
    assert _database_file_bytes(path) == before


def test_temp_reserved_name_blocks_exact_old_migration_without_target_changes(tmp_path) -> None:
    path = tmp_path / "reserved-temp.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()
    before = _database_file_bytes(path)

    class ReservedTempStore(DecreeJobStore):
        def _connect_for_initialization(self) -> sqlite3.Connection:
            connection = super()._connect_for_initialization()
            connection.execute(
                f"CREATE TEMP TABLE {self._TEMP_PARENT} (unexpected TEXT)"
            )
            return connection

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        ReservedTempStore(path)

    assert _database_file_bytes(path) == before


def test_exact_old_migration_forces_legacy_alter_off_before_lock(tmp_path) -> None:
    path = tmp_path / "legacy-alter-off.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()

    class TracedPragmaStore(DecreeJobStore):
        def __init__(self, db_path) -> None:
            self.statements: list[str] = []
            super().__init__(db_path)

        def _connect_for_initialization(self) -> sqlite3.Connection:
            connection = super()._connect_for_initialization()
            connection.set_trace_callback(self.statements.append)
            return connection

    migrated = TracedPragmaStore(path)
    normalized = [" ".join(statement.lower().split()) for statement in migrated.statements]
    pragma_index = normalized.index("pragma legacy_alter_table = off")
    begin_index = normalized.index("begin immediate")
    assert pragma_index < begin_index
    assert "pragma legacy_alter_table = on" not in normalized


def test_exact_old_rebuild_failure_rolls_back_names_rows_and_identity(tmp_path) -> None:
    path = tmp_path / "rollback.sqlite3"
    seed = DecreeJobStore(path)
    seed.accept(_command(), now=NOW)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()
        before = _database_snapshot(path)
        assert DecreeJobStore._schema_digest(connection) == DecreeJobStore._EXACT_OLD_SCHEMA

    class FailingStore(DecreeJobStore):
        @staticmethod
        def _create_canonical_schema(connection: sqlite3.Connection) -> None:
            raise RuntimeError("injected_rebuild_failure")

    with pytest.raises(RuntimeError, match="injected_rebuild_failure"):
        FailingStore(path)

    with closing(sqlite3.connect(path)) as connection:
        assert DecreeJobStore._schema_digest(connection) == DecreeJobStore._EXACT_OLD_SCHEMA
        names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_schema WHERE type = 'table'"
            )
        }
    assert names == {"decree_jobs", "decree_job_idempotency_keys"}
    assert _database_snapshot(path) == before


@pytest.mark.parametrize("failure_stage", ["copy", "final_identity"])
def test_exact_old_rebuild_late_failure_rolls_back_everything(
    tmp_path, failure_stage: str
) -> None:
    path = tmp_path / f"rollback-{failure_stage}.sqlite3"
    seed = DecreeJobStore(path)
    seed.accept(_command(), now=NOW)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.commit()
        before = _database_snapshot(path)

    class FailingLateStore(DecreeJobStore):
        @staticmethod
        def _create_canonical_schema(connection: sqlite3.Connection) -> None:
            DecreeJobStore._create_canonical_schema(connection)
            if failure_stage == "copy":
                connection.execute(
                    "CREATE TRIGGER main.injected_copy_failure "
                    "BEFORE INSERT ON decree_jobs BEGIN "
                    "SELECT RAISE(ABORT, 'injected_copy_failure'); END"
                )

        @classmethod
        def _assert_canonical_new(cls, connection: sqlite3.Connection) -> None:
            if failure_stage == "final_identity":
                raise RuntimeError("injected_final_identity_failure")
            super()._assert_canonical_new(connection)

    expected = "injected_copy_failure|injected_final_identity_failure"
    with pytest.raises((sqlite3.IntegrityError, RuntimeError), match=expected):
        FailingLateStore(path)

    assert _database_snapshot(path) == before


def test_single_alter_intermediate_schema_is_explicitly_rejected_without_writes(
    tmp_path,
) -> None:
    path = tmp_path / "single-alter.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("ALTER TABLE decree_jobs DROP COLUMN claim_evidence_commitment_json")
        connection.execute("ALTER TABLE decree_jobs ADD COLUMN claim_evidence_commitment_json TEXT")
        connection.commit()
        assert DecreeJobStore._schema_digest(connection) == (
            "sha256:909b62c7a3138562a17531666e137e212a974fe06cdbadd6f1693ec925206973"
        )
    before = _database_file_bytes(path)

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(path)

    assert _database_file_bytes(path) == before


@pytest.mark.parametrize(
    "drift_sql",
    [
        "ALTER TABLE decree_jobs ADD COLUMN unexpected TEXT",
        "ALTER TABLE decree_jobs ADD COLUMN hidden_drift TEXT "
        "GENERATED ALWAYS AS (owner_user_id) VIRTUAL",
        "CREATE INDEX unexpected_decree_job_index ON decree_jobs(state)",
        "CREATE VIEW unexpected_decree_job_view AS SELECT 1",
        "CREATE TRIGGER unexpected_decree_job_trigger AFTER UPDATE ON decree_jobs "
        "BEGIN SELECT 1; END",
        "CREATE TABLE unexpected_collation (value TEXT COLLATE NOCASE)",
        "CREATE TABLE unexpected_check (value INTEGER CHECK(value > 0))",
        "CREATE TABLE unexpected_strict (value TEXT) STRICT",
    ],
)
def test_closed_schema_rejects_column_index_or_trigger_drift_without_writes(
    tmp_path, drift_sql: str
) -> None:
    path = tmp_path / "drift.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(drift_sql)
        connection.commit()
    before = _database_snapshot(path)

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(path)

    assert _database_snapshot(path) == before


def test_closed_schema_rejects_child_foreign_key_drift_without_writes(
    tmp_path,
) -> None:
    path = tmp_path / "foreign-key-drift.sqlite3"
    DecreeJobStore(path)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.executescript(
            """
            ALTER TABLE decree_job_idempotency_keys RENAME TO old_keys;
            CREATE TABLE decree_job_idempotency_keys (
                owner_user_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                job_id TEXT NOT NULL,
                PRIMARY KEY(owner_user_id, idempotency_key)
            );
            INSERT INTO decree_job_idempotency_keys
            SELECT * FROM old_keys;
            DROP TABLE old_keys;
            """
        )
        connection.commit()
    before = _database_snapshot(path)

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(path)

    assert _database_snapshot(path) == before


@pytest.mark.parametrize(
    "schema_sql",
    [
        "CREATE TABLE decree_job_idempotency_keys (value TEXT)",
        "CREATE TABLE unrelated_runtime_state (value TEXT)",
        "CREATE VIEW unrelated_runtime_view AS SELECT 1 AS value",
    ],
)
def test_nonempty_database_without_parent_is_never_treated_as_fresh(
    tmp_path, schema_sql: str
) -> None:
    path = tmp_path / "not-fresh.sqlite3"
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(schema_sql)
        connection.commit()
    before = _schema_snapshot(path)

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(path)

    assert _schema_snapshot(path) == before


@pytest.mark.parametrize(
    "replacement",
    [
        "UNIQUE(owner_user_id, request_hash)",
        "UNIQUE(idempotency_key, owner_user_id)",
    ],
)
def test_closed_schema_rejects_same_named_index_with_wrong_columns_or_order(
    tmp_path, replacement: str
) -> None:
    valid_path = tmp_path / "valid.sqlite3"
    wrong_path = tmp_path / "wrong-index.sqlite3"
    DecreeJobStore(valid_path)
    with closing(sqlite3.connect(valid_path)) as connection:
        parent_sql = connection.execute(
            "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'decree_jobs'"
        ).fetchone()[0]
        child_sql = connection.execute(
            "SELECT sql FROM sqlite_schema "
            "WHERE type = 'table' AND name = 'decree_job_idempotency_keys'"
        ).fetchone()[0]
    parent_sql = parent_sql.replace("UNIQUE(owner_user_id, idempotency_key)", replacement)
    with closing(sqlite3.connect(wrong_path)) as connection:
        connection.execute(parent_sql)
        connection.execute(child_sql)
        connection.commit()
        names = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_schema WHERE type = 'index'")
        }
    assert names == {
        "sqlite_autoindex_decree_job_idempotency_keys_1",
        "sqlite_autoindex_decree_jobs_1",
        "sqlite_autoindex_decree_jobs_2",
        "sqlite_autoindex_decree_jobs_3",
    }
    before = _database_snapshot(wrong_path)

    with pytest.raises(DecreeJobStoreError, match="decree_job_schema_unrecognized"):
        DecreeJobStore(wrong_path)

    assert _database_snapshot(wrong_path) == before


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
    store.checkpoint_result(archiving_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
    store.begin_archiving(archiving_id, "worker-a", now=NOW)
    archiving = store.request_cancel(archiving_id, "owner-a", now=NOW)
    assert archiving.state is DecreeJobState.ARCHIVING
    assert archiving.cancel_requested is False


def test_result_checkpoint_and_completion_survive_store_reopen(tmp_path) -> None:
    path = tmp_path / "jobs.sqlite3"
    store = DecreeJobStore(path)
    job_id = store.accept(_command(), now=NOW).job.job_id
    store.claim_next("worker-a", now=NOW)
    store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
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
    store.checkpoint_result(job_id, "worker-a", result_json='{"status":"ok"}', now=NOW)
    if checkpoint in {"archive", "publish"}:
        store.begin_archiving(job_id, "worker-a", now=NOW)
    if checkpoint == "publish":
        store.begin_publishing(job_id, "worker-a", reply_id="reply-1", now=NOW)

    recovered = store.claim_next("worker-b", now=NOW + timedelta(seconds=31), lease_seconds=30)

    assert recovered is not None
    assert recovered.state is expected_state
    assert recovered.attempt_count == 1
    assert recovered.lease_owner == "worker-b"
