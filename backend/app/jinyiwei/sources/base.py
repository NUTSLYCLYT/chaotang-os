"""Synchronous source ports for collecting untrusted evidence candidates."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from types import MappingProxyType
from typing import Annotated, Any, Protocol, runtime_checkable
from urllib.parse import urlsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    ValidationInfo,
    field_validator,
    model_validator,
)

from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceItem,
    EvidenceQuality,
    FactCategory,
    SourceAttempt,
    SourceType,
)

MaxSourceItems = Annotated[StrictInt, Field(ge=1, le=100)]


def _text(value: str, field_name: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError(f"{field_name} must not be blank")
    return normalized


def _timestamp(value: str, field_name: str) -> str:
    normalized = _text(value, field_name)
    candidate = normalized[:-1] + "+00:00" if normalized.endswith("Z") else normalized
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone offset")
    return normalized


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list | tuple):
        return tuple(_freeze(item) for item in value)
    return value


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, arbitrary_types_allowed=True)


class SourceQuery(_FrozenContract):
    """One bounded source lookup for the still-unresolved requested facts."""

    request: DataGapRequest
    unresolved_fact_keys: tuple[StrictStr, ...] = Field(min_length=1)
    department: StrictStr | None = None
    matter_type: StrictStr | None = None
    max_items: MaxSourceItems
    deadline_at: StrictStr

    @field_validator("unresolved_fact_keys")
    @classmethod
    def _facts_are_unique_and_nonempty(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_text(item, "unresolved_fact_keys") for item in value)
        if len(normalized) != len(set(normalized)):
            raise ValueError("unresolved_fact_keys must contain unique values")
        return normalized

    @field_validator("department", "matter_type")
    @classmethod
    def _optional_context(cls, value: str | None, info: ValidationInfo) -> str | None:
        return None if value is None else _text(value, info.field_name)

    @field_validator("deadline_at")
    @classmethod
    def _deadline_is_timestamp(cls, value: str) -> str:
        return _timestamp(value, "deadline_at")

    @model_validator(mode="after")
    def _facts_are_requested(self) -> SourceQuery:
        requested = {fact.key for fact in self.request.required_facts}
        if not set(self.unresolved_fact_keys) <= requested:
            raise ValueError("unresolved_fact_keys must be requested fact keys")
        return self


class SourceDocument(_FrozenContract):
    """Untrusted transient source text; never validated evidence by itself."""

    source_type: SourceType
    source_name: StrictStr
    source_url: StrictStr
    publisher: StrictStr
    title: StrictStr
    retrieved_at: StrictStr
    as_of: StrictStr
    published_at: StrictStr | None = None
    coverage: tuple[StrictStr, ...] | None = None
    license_note: StrictStr | None = None
    text: StrictStr
    quality_ceiling: EvidenceQuality
    metadata: Mapping[StrictStr, Any] = Field(default_factory=dict)
    locked_fact_key: StrictStr | None = None
    locked_fact_category: FactCategory | None = None
    locked_subject: StrictStr | None = None
    adopted_evidence: EvidenceItem | None = None

    @field_validator("source_name", "publisher", "title", "text")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _text(value, info.field_name)

    @field_validator("source_url")
    @classmethod
    def _safe_url(cls, value: str) -> str:
        normalized = _text(value, "source_url")
        if any(character.isspace() for character in normalized):
            raise ValueError("source_url must not contain whitespace")
        parsed = urlsplit(normalized)
        if parsed.scheme not in {"https", "internal"} or not parsed.netloc:
            raise ValueError("source_url must use https:// or internal://")
        return normalized

    @field_validator("retrieved_at", "as_of")
    @classmethod
    def _times_are_timestamps(cls, value: str, info: ValidationInfo) -> str:
        return _timestamp(value, info.field_name)

    @field_validator("published_at")
    @classmethod
    def _published_at_is_timestamp(cls, value: str | None) -> str | None:
        return None if value is None else _timestamp(value, "published_at")

    @field_validator("coverage")
    @classmethod
    def _coverage_is_nonempty_and_unique(
        cls, value: tuple[str, ...] | None
    ) -> tuple[str, ...] | None:
        if value is None:
            return None
        normalized = tuple(_text(item, "coverage") for item in value)
        if len(normalized) != len(set(normalized)):
            raise ValueError("coverage must contain unique values")
        return normalized

    @field_validator("license_note")
    @classmethod
    def _license_note_is_text(cls, value: str | None) -> str | None:
        return None if value is None else _text(value, "license_note")

    @field_validator("metadata")
    @classmethod
    def _metadata_is_immutable(cls, value: Mapping[str, Any]) -> Mapping[str, Any]:
        return _freeze(value)

    @field_validator("locked_fact_key", "locked_subject")
    @classmethod
    def _locked_text(cls, value: str | None, info: ValidationInfo) -> str | None:
        return None if value is None else _text(value, info.field_name)

    @model_validator(mode="after")
    def _adopted_evidence_is_fully_locked(self) -> SourceDocument:
        locks = (
            self.locked_fact_key,
            self.locked_fact_category,
            self.locked_subject,
        )
        if self.adopted_evidence is None:
            if any(value is not None for value in locks):
                raise ValueError("fact locks require adopted_evidence")
            return self
        if self.source_type is not SourceType.SHIGUAN or any(
            value is None for value in locks
        ):
            raise ValueError("adopted evidence requires complete Shiguan fact locks")
        if (
            self.adopted_evidence.fact_key != self.locked_fact_key
            or self.adopted_evidence.quality is not self.quality_ceiling
            or self.adopted_evidence.as_of != self.as_of
            or self.adopted_evidence.excerpt != self.text
        ):
            raise ValueError("adopted evidence does not match its locked document")
        return self


class SourceResult(_FrozenContract):
    documents: tuple[SourceDocument, ...]
    attempt: SourceAttempt


@runtime_checkable
class EvidenceSource(Protocol):
    def fetch(self, query: SourceQuery) -> SourceResult: ...


@runtime_checkable
class EvidenceExtractor(Protocol):
    """Convert bounded candidates using only the facts and budgets in query."""

    def extract(
        self, query: SourceQuery, documents: tuple[SourceDocument, ...]
    ) -> tuple[EvidenceItem, ...]: ...
