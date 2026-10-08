"""Immutable, validated read contracts for the Jinyiwei audit desk."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    field_serializer,
    field_validator,
    model_validator,
)

from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    EvidenceConflict,
    EvidenceItem,
    EvidencePackStatus,
    InvestigationEvent,
    InvestigationPlan,
    ReplayArtifact,
    ReplayDiff,
    SourceAttempt,
    TrustAssessment,
    TrustEvidenceState,
)


def _time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() is None:
        raise ValueError("timestamp must include a timezone")
    return parsed


class AdoptionStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"


class _ReadModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class InvestigationSummary(_ReadModel):
    total_investigations: StrictInt = Field(ge=0)
    resolved_count: StrictInt = Field(ge=0)
    partial_count: StrictInt = Field(ge=0)
    blocked_count: StrictInt = Field(ge=0)
    unavailable_count: StrictInt = Field(ge=0)
    distinct_evidence_count: StrictInt = Field(ge=0)
    pending_adoption_count: StrictInt = Field(ge=0)
    confirmed_adoption_count: StrictInt = Field(ge=0)

    @model_validator(mode="after")
    def _status_counts_match_total(self) -> InvestigationSummary:
        if (
            self.resolved_count + self.partial_count + self.blocked_count + self.unavailable_count
            != self.total_investigations
        ):
            raise ValueError("investigation status counts do not match total")
        return self


class InvestigationListItem(_ReadModel):
    investigation_id: StrictStr
    request_id: StrictStr
    requesting_agent: StrictStr
    question: StrictStr
    status: EvidencePackStatus
    started_at: StrictStr
    completed_at: StrictStr
    source_attempt_count: StrictInt = Field(ge=0)
    evidence_count: StrictInt = Field(ge=0)
    linked_reply_count: StrictInt = Field(ge=0)

    @field_validator("investigation_id", "request_id", "requesting_agent", "question")
    @classmethod
    def _text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("started_at", "completed_at")
    @classmethod
    def _timestamp(cls, value: str) -> str:
        _time(value)
        return value

    @model_validator(mode="after")
    def _ordered_times(self) -> InvestigationListItem:
        if _time(self.completed_at) < _time(self.started_at):
            raise ValueError("completion precedes start")
        return self


class InvestigationPage(_ReadModel):
    items: tuple[InvestigationListItem, ...]
    total: StrictInt = Field(ge=0)
    limit: StrictInt = Field(ge=1, le=100)
    offset: StrictInt = Field(ge=0)


class EvidenceAdoptionRead(_ReadModel):
    evidence_id: StrictStr
    reply_id: StrictStr
    status: AdoptionStatus
    created_at: StrictStr
    updated_at: StrictStr
    confirmed_at: StrictStr | None

    @field_validator("evidence_id", "reply_id")
    @classmethod
    def _text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("created_at", "updated_at")
    @classmethod
    def _timestamp(cls, value: str) -> str:
        _time(value)
        return value

    @field_validator("confirmed_at")
    @classmethod
    def _optional_timestamp(cls, value: str | None) -> str | None:
        if value is not None:
            _time(value)
        return value

    @model_validator(mode="after")
    def _valid_transition_times(self) -> EvidenceAdoptionRead:
        created = _time(self.created_at)
        updated = _time(self.updated_at)
        if updated < created:
            raise ValueError("adoption update precedes creation")
        if self.status is AdoptionStatus.PENDING and self.confirmed_at is not None:
            raise ValueError("pending adoption cannot have confirmation time")
        if self.status is AdoptionStatus.CONFIRMED:
            if self.confirmed_at is None:
                raise ValueError("confirmed adoption requires confirmation time")
            confirmed = _time(self.confirmed_at)
            if confirmed < created or confirmed > updated:
                raise ValueError("invalid confirmation time")
        return self


class InvestigationDetail(_ReadModel):
    pack_id: StrictStr
    investigation_id: StrictStr
    status: EvidencePackStatus
    request: DataGapRequest
    investigation_plan: InvestigationPlan
    evidence_by_fact: Mapping[str, tuple[EvidenceItem, ...]]
    historical_evidence_by_fact: Mapping[str, tuple[EvidenceItem, ...]]
    resolved_facts: tuple[StrictStr, ...]
    unresolved_facts: tuple[StrictStr, ...]
    conflicts: tuple[EvidenceConflict, ...]
    source_attempts: tuple[SourceAttempt, ...]
    investigation_started_at: StrictStr
    investigation_completed_at: StrictStr
    cache: CacheMetadata
    do_not_infer: tuple[StrictStr, ...]
    adoptions: tuple[EvidenceAdoptionRead, ...]

    @field_validator("evidence_by_fact", "historical_evidence_by_fact")
    @classmethod
    def _freeze_evidence(
        cls, value: Mapping[str, tuple[EvidenceItem, ...]]
    ) -> Mapping[str, tuple[EvidenceItem, ...]]:
        return MappingProxyType({key: tuple(items) for key, items in value.items()})

    @field_serializer("evidence_by_fact", "historical_evidence_by_fact")
    def _serialize_evidence(
        self, value: Mapping[str, tuple[EvidenceItem, ...]]
    ) -> dict[str, tuple[EvidenceItem, ...]]:
        """Return only typed evidence fields; never expose source-document metadata."""
        return {key: tuple(items) for key, items in value.items()}


class ReplayTimelineRead(_ReadModel):
    """Read-only projection that keeps replay evidence and its audit trail together."""

    events: tuple[InvestigationEvent, ...]
    replay: ReplayArtifact | None
    diff: ReplayDiff | None


class InvestigationTrustRead(_ReadModel):
    assessments: Mapping[str, TrustAssessment]
    generated_at: StrictStr


class EvidenceCoveragePoint(_ReadModel):
    """Area-level evidence projection; it intentionally carries no coordinates."""

    region: StrictStr
    evidence_count: StrictInt = Field(ge=1)
    investigation_ids: tuple[StrictStr, ...] = Field(min_length=1)
    evidence_ids: tuple[StrictStr, ...] = Field(min_length=1)
    event_types: tuple[StrictStr, ...] = ()
    trust_state: TrustEvidenceState
    confidence_lower: StrictFloat = Field(ge=0, le=1)
    confidence_upper: StrictFloat = Field(ge=0, le=1)
    latest_as_of: StrictStr
    conflict_count: StrictInt = Field(ge=0)
    references: tuple["EvidenceCoverageReference", ...]

    @field_validator("region", "latest_as_of")
    @classmethod
    def _coverage_text(cls, value: str, info) -> str:
        if not value.strip():
            raise ValueError(f"{info.field_name} must not be blank")
        if info.field_name == "latest_as_of":
            _time(value)
        return value

    @model_validator(mode="after")
    def _confidence_ordered(self) -> EvidenceCoveragePoint:
        if self.confidence_lower > self.confidence_upper:
            raise ValueError("coverage confidence interval is inverted")
        if len(set(self.investigation_ids)) != len(self.investigation_ids):
            raise ValueError("coverage investigation IDs must be unique")
        if len(set(self.evidence_ids)) != len(self.evidence_ids):
            raise ValueError("coverage evidence IDs must be unique")
        return self


class EvidenceCoverageRead(_ReadModel):
    points: tuple[EvidenceCoveragePoint, ...]
    generated_at: StrictStr
    scanned_investigations: StrictInt = Field(ge=0)
    total_investigations: StrictInt = Field(ge=0)
    truncated: StrictBool

    @field_validator("generated_at")
    @classmethod
    def _generated_at_timestamp(cls, value: str) -> str:
        _time(value)
        return value

    @model_validator(mode="after")
    def _scan_window_is_consistent(self) -> EvidenceCoverageRead:
        if self.scanned_investigations > self.total_investigations:
            raise ValueError("scanned investigations cannot exceed total")
        if self.truncated != (self.scanned_investigations < self.total_investigations):
            raise ValueError("truncated flag must match scan window")
        return self


class EvidenceCoverageReference(_ReadModel):
    investigation_id: StrictStr
    fact_key: StrictStr
    event_type: StrictStr
    evidence: tuple[EvidenceItem, ...]
    assessment: TrustAssessment


EvidenceCoveragePoint.model_rebuild()


class ApprovedFeedSourceRead(_ReadModel):
    source_id: StrictStr
    url: StrictStr
    publisher: StrictStr
    format: StrictStr
    license_note: StrictStr
    robots_policy: StrictStr
    rate_limit_per_minute: StrictInt = Field(ge=1)
    allowed_redirect_hosts: tuple[StrictStr, ...]
    fingerprint: StrictStr


class ApprovedFeedRegistryRead(_ReadModel):
    sources: tuple[ApprovedFeedSourceRead, ...]
    generated_at: StrictStr

    @field_validator("generated_at")
    @classmethod
    def _feed_generated_at_timestamp(cls, value: str) -> str:
        _time(value)
        return value
