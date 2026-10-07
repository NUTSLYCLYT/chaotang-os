from __future__ import annotations

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


class GraphRunStatus(StrEnum):
    RUNNING = "RUNNING"
    WAITING_HUMAN = "WAITING_HUMAN"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class NodeFailureClass(StrEnum):
    RETRYABLE = "RETRYABLE"
    BLOCKED = "BLOCKED"
    TERMINAL = "TERMINAL"


class NodeAttemptStatus(StrEnum):
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class LoopStopReason(StrEnum):
    READY = "READY"
    MAX_ITERATIONS = "MAX_ITERATIONS"
    PROVIDER_BUDGET_EXCEEDED = "PROVIDER_BUDGET_EXCEEDED"
    TOKEN_BUDGET_EXCEEDED = "TOKEN_BUDGET_EXCEEDED"
    DEADLINE_EXCEEDED = "DEADLINE_EXCEEDED"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class LoopPolicy:
    max_iterations: int
    max_provider_requests: int
    max_tokens: int
    deadline_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.max_iterations < 1 or self.max_provider_requests < 0 or self.max_tokens < 0:
            raise ValueError(
                "loop policy limits must be non-negative and iterations must be positive"
            )
        if self.deadline_at is not None and self.deadline_at.tzinfo is None:
            raise ValueError("deadline_at must be timezone-aware")


@dataclass(frozen=True)
class GraphRunSnapshot:
    run_id: str
    owner_user_id: str
    graph_version: str
    status: GraphRunStatus
    state: dict[str, Any]
    current_node: str
    revision: int
    terminal_reason: str | None = None
    resume_token: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True)
class NodeAttempt:
    run_id: str
    node_name: str
    attempt: int
    status: NodeAttemptStatus
    idempotency_key: str
    failure_class: NodeFailureClass | None = None

    def __post_init__(self) -> None:
        if (
            not self.run_id.strip()
            or not self.node_name.strip()
            or not self.idempotency_key.strip()
        ):
            raise ValueError("node attempt identifiers are required")
        if self.attempt < 1:
            raise ValueError("node attempt must be positive")


@dataclass(frozen=True)
class GraphEvent:
    run_id: str
    sequence: int
    event_type: str
    payload: dict[str, Any]
    created_at: datetime


def state_digest(state: Mapping[str, Any]) -> str:
    import json

    encoded = json.dumps(
        state, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    )
    return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()
