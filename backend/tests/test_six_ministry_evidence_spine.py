from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agents.runtime_skills.evidence_spine import (
    EvidenceSpineError,
    EvidenceSpineErrorCode,
    RunLocatorV1,
    load_bound_decree_authority,
)
from app.decree_jobs.models import AcceptDecreeJob
from app.decree_jobs.storage import DecreeJobStore

NOW = datetime(2026, 8, 14, 8, 0, tzinfo=UTC)


def _command(*, owner: str = "owner-a") -> AcceptDecreeJob:
    return AcceptDecreeJob(
        owner_user_id=owner,
        idempotency_key=f"submission:{owner}",
        request_hash=f"request:{owner}",
        draft_fingerprint=hashlib.sha256(f"draft:{owner}".encode()).hexdigest(),
        decree_text="请礼部内容司只读核验已批准材料",
        approved_route_json=json.dumps(
            {
                "approved_route": {
                    "departments": [
                        {"department": "礼部", "required_bureaus": ["内容司"]}
                    ]
                },
                "accounting_context": None,
            },
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ),
        deadline_at=NOW + timedelta(minutes=30),
    )


def test_run_locator_is_closed_and_cannot_carry_identity() -> None:
    with pytest.raises(ValidationError):
        RunLocatorV1.model_validate(
            {"job_id": "job-a", "owner_user_id": "attacker"}
        )


def test_load_bound_decree_authority_reloads_committed_owner_scope(
    tmp_path: Path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(_command(), now=NOW)

    bound = load_bound_decree_authority(
        store,
        authenticated_owner_user_id="owner-a",
        run_locator=RunLocatorV1(job_id=accepted.job.job_id),
    )

    assert bound.scope.owner_user_id == "owner-a"
    assert bound.scope.run_id == accepted.job.job_id
    assert bound.scope.decree_id == accepted.job.job_id
    assert bound.scope.tenant_id is None
    assert bound.route.departments[0].department == "礼部"
    assert bound.route.departments[0].required_bureaus == ("内容司",)


def test_load_bound_decree_authority_is_non_enumerating_across_owner(
    tmp_path: Path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(_command(owner="owner-b"), now=NOW)

    with pytest.raises(EvidenceSpineError) as caught:
        load_bound_decree_authority(
            store,
            authenticated_owner_user_id="owner-a",
            run_locator=RunLocatorV1(job_id=accepted.job.job_id),
        )

    assert caught.value.code is EvidenceSpineErrorCode.NOT_FOUND_OR_NOT_AUTHORIZED


def test_load_bound_decree_authority_rejects_uncommitted_acceptance(
    tmp_path: Path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(
        replace(_command(), acceptance_committed=False),
        now=NOW,
    )

    with pytest.raises(EvidenceSpineError) as caught:
        load_bound_decree_authority(
            store,
            authenticated_owner_user_id="owner-a",
            run_locator=RunLocatorV1(job_id=accepted.job.job_id),
        )

    assert caught.value.code is EvidenceSpineErrorCode.NOT_FOUND_OR_NOT_AUTHORIZED


def test_case_locator_cannot_be_promoted_without_owner_scoped_case_reader(
    tmp_path: Path,
) -> None:
    store = DecreeJobStore(tmp_path / "jobs.sqlite3")
    accepted = store.accept(_command(), now=NOW)

    with pytest.raises(EvidenceSpineError) as caught:
        load_bound_decree_authority(
            store,
            authenticated_owner_user_id="owner-a",
            run_locator=RunLocatorV1(job_id=accepted.job.job_id, case_id="case-a"),
        )

    assert caught.value.code is EvidenceSpineErrorCode.CASE_BINDING_UNAVAILABLE
