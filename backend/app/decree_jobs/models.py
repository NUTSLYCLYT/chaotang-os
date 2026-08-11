from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


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


@dataclass(frozen=True)
class AcceptedDecreeJob:
    job: DecreeJob
    replayed: bool
