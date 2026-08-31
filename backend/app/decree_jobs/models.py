from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

_COMMITMENT_FIELDS = frozenset(
    {
        "aggregate_digest",
        "candidate_digest",
        "control_ref",
        "decision_digest",
        "evidence_snapshot_digest",
        "schema_version",
        "state",
    }
)
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


@dataclass(frozen=True)
class ClaimEvidenceCommitment:
    schema_version: str
    state: str
    control_ref: str | None
    aggregate_digest: str | None
    candidate_digest: str | None
    evidence_snapshot_digest: str | None
    decision_digest: str | None


def parse_claim_evidence_commitment(raw: str) -> ClaimEvidenceCommitment:
    """Decode the inert v1 sidecar without granting it truth or authority."""

    if not isinstance(raw, str):
        raise ValueError("claim_evidence_commitment_invalid")
    try:
        encoded = raw.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ValueError("claim_evidence_commitment_invalid") from exc
    if len(encoded) > 1024:
        raise ValueError("claim_evidence_commitment_invalid")

    def closed_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
        value: dict[str, object] = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("claim_evidence_commitment_invalid")
            value[key] = item
        return value

    try:
        value = json.loads(
            raw,
            object_pairs_hook=closed_object,
            parse_constant=lambda _value: (_ for _ in ()).throw(
                ValueError("claim_evidence_commitment_invalid")
            ),
        )
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise ValueError("claim_evidence_commitment_invalid") from exc
    if not isinstance(value, dict) or frozenset(value) != _COMMITMENT_FIELDS:
        raise ValueError("claim_evidence_commitment_invalid")
    canonical = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    if raw != canonical:
        raise ValueError("claim_evidence_commitment_invalid")
    if value["schema_version"] != "claim-evidence-job-commitment.v1":
        raise ValueError("claim_evidence_commitment_invalid")
    state = value["state"]
    if not isinstance(state, str) or state not in {
        "PENDING",
        "EVALUATED_NONE",
        "SIDECAR_EXPECTED",
    }:
        raise ValueError("claim_evidence_commitment_invalid")
    commitment_values = (
        value["control_ref"],
        value["aggregate_digest"],
        value["candidate_digest"],
        value["evidence_snapshot_digest"],
        value["decision_digest"],
    )
    if state in {"PENDING", "EVALUATED_NONE"}:
        if any(item is not None for item in commitment_values):
            raise ValueError("claim_evidence_commitment_invalid")
    elif any(
        not isinstance(item, str) or not _DIGEST.fullmatch(item)
        for item in commitment_values
    ):
        raise ValueError("claim_evidence_commitment_invalid")
    return ClaimEvidenceCommitment(
        schema_version=value["schema_version"],  # type: ignore[arg-type]
        state=state,  # type: ignore[arg-type]
        control_ref=value["control_ref"],  # type: ignore[arg-type]
        aggregate_digest=value["aggregate_digest"],  # type: ignore[arg-type]
        candidate_digest=value["candidate_digest"],  # type: ignore[arg-type]
        evidence_snapshot_digest=value["evidence_snapshot_digest"],  # type: ignore[arg-type]
        decision_digest=value["decision_digest"],  # type: ignore[arg-type]
    )


class DecreeJobState(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    RETRY_WAIT = "RETRY_WAIT"
    RESULT_READY = "RESULT_READY"
    ARCHIVING = "ARCHIVING"
    PUBLISHING = "PUBLISHING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


TERMINAL_STATES = frozenset(
    {DecreeJobState.SUCCEEDED, DecreeJobState.FAILED, DecreeJobState.CANCELLED}
)


@dataclass(frozen=True)
class AcceptDecreeJob:
    owner_user_id: str
    idempotency_key: str
    request_hash: str
    draft_fingerprint: str
    decree_text: str
    approved_route_json: str
    deadline_at: datetime
    provider_request_limit: int = 8
    acceptance_committed: bool = True


@dataclass(frozen=True)
class DecreeJob:
    job_id: str
    owner_user_id: str
    idempotency_key: str
    request_hash: str
    draft_fingerprint: str
    decree_text: str
    approved_route_json: str
    state: DecreeJobState
    attempt_count: int
    provider_request_count: int
    cancel_requested: bool
    result_json: str | None
    reply_id: str | None
    error_code: str | None
    deadline_at: datetime
    retry_at: datetime | None
    lease_owner: str | None
    lease_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime
    provider_request_limit: int = 8
    error_stage: str | None = None
    error_category: str | None = None
    claim_evidence_commitment_json: str | None = None


@dataclass(frozen=True)
class AcceptedDecreeJob:
    job: DecreeJob
    replayed: bool
