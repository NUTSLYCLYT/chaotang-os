"""Frozen shared contracts for work products and human confirmation."""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from .digest import (
    _decode_semantic_wire,
    _encode_semantic_wire,
    _validate_semantic_value,
)


class _FrozenMapping(Mapping[str, object]):
    def __init__(self, values: Mapping[str, object]) -> None:
        self._values = MappingProxyType(
            {key: _freeze_value(value) for key, value in values.items()}
        )

    def __getitem__(self, key: str) -> object:
        return self._values[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)


def _freeze_value(value: object) -> object:
    if isinstance(value, Mapping):
        return _FrozenMapping(value)
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_value(item) for item in value)
    return value


class WorkProductStatus(StrEnum):
    NEEDS_DATA = "NEEDS_DATA"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    BLOCKED = "BLOCKED"
    READY_FOR_HUMAN_CONFIRMATION = "READY_FOR_HUMAN_CONFIRMATION"
    REVISION_REQUIRED = "REVISION_REQUIRED"


class ConfirmationStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    ESCALATED = "ESCALATED"


class ArtifactState(StrEnum):
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    ABORTED = "ABORTED"


class ArtifactGateStatus(StrEnum):
    PASSED = "PASSED"
    FAILED = "FAILED"


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ArtifactManifestItem(_FrozenContract):
    kind: str = Field(min_length=1)
    ref: str = Field(min_length=1)
    content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    traceable: bool


class ArtifactGateReceipt(_FrozenContract):
    status: ArtifactGateStatus
    reason_codes: tuple[str, ...]
    missing_kinds: tuple[str, ...]
    unexpected_kinds: tuple[str, ...]


class ConfirmationReceipt(_FrozenContract):
    work_product_id: str = Field(min_length=1)
    version: int = Field(gt=0)
    sequence: int = Field(gt=0)
    decision: ConfirmationStatus
    actor_ref: str = Field(min_length=1)
    structured_reason: str = Field(min_length=1)
    created_at: datetime

    @field_validator("decision")
    @classmethod
    def _reject_pending_decision(
        cls, value: ConfirmationStatus
    ) -> ConfirmationStatus:
        if value is ConfirmationStatus.PENDING:
            raise ValueError("confirmation receipt decision cannot be PENDING")
        return value


class WorkProductEnvelope(_FrozenContract):
    work_product_id: str = Field(min_length=1)
    version: int = Field(gt=0)
    owner_user_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    reply_id: str | None
    capability_id: str = Field(min_length=1)
    work_status: WorkProductStatus
    confirmation_status: ConfirmationStatus
    artifact_state: ArtifactState
    decision: str
    facts: tuple[Mapping[str, object], ...]
    assumptions: tuple[str, ...]
    recommendations: tuple[str, ...]
    evidence_used: tuple[str, ...]
    missing_evidence: tuple[str, ...]
    conflicts: tuple[str, ...]
    risk_register: tuple[str, ...]
    artifact_manifest: tuple[ArtifactManifestItem, ...]
    artifact_gate: ArtifactGateReceipt
    content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    created_at: datetime

    @field_validator("facts", mode="before")
    @classmethod
    def _decode_fact_wire(cls, value: object) -> object:
        try:
            return _decode_semantic_wire(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("facts", mode="after")
    @classmethod
    def _freeze_facts(
        cls, value: tuple[Mapping[str, object], ...]
    ) -> tuple[Mapping[str, object], ...]:
        try:
            for item in value:
                _validate_semantic_value(item)
        except (TypeError, ValueError) as exc:
            raise ValueError(str(exc)) from exc
        return tuple(_FrozenMapping(item) for item in value)

    @field_serializer("facts")
    def _serialize_facts(
        self, value: tuple[Mapping[str, object], ...]
    ) -> tuple[object, ...]:
        return tuple(_encode_semantic_wire(item) for item in value)
