"""Unified archive contracts for the 史馆 (Shiguan / Hall of Records) domain.

The public business contract contains only ``MEMORIAL`` (奏折) and ``REPLY``
(回奏). A reply carries its source snapshot, participating departments,
process, conclusion, time and respondent; a memorial must not carry those
reply-only fields.

This module only defines data contracts (Pydantic models). It performs
*structural* validation only (types, non-empty text, enum membership and
cross-field consistency for the ``REPLY`` type). It does not touch the
database -- storage-facing checks that need a live connection (e.g.
confirming ``related_archive_ids`` reference archives that actually exist)
live in ``app.shiguan.validation``.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from collections.abc import Mapping
from datetime import datetime
from types import MappingProxyType
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

ArchiveType = Literal["MEMORIAL", "REPLY"]
ReplySourceKind = Literal["DECREE", "MEMORIAL"]
RealityLabel = Literal["LIVE", "MIXED", "FALLBACK"]
ReviewStatusValue = Literal["ACHIEVED", "NOT_ACHIEVED", "PARTIAL", "OBSERVING"]
ArchiveFactCategory = Literal[
    "MARKET_QUOTE",
    "REGULATORY_FILING",
    "NEWS_EVENT",
    "PUBLIC_STATISTIC",
    "ENTITY_REFERENCE",
]
ArchiveDataScope = Literal["INTERNAL_BUSINESS", "EXTERNAL_PUBLIC", "HYBRID"]

_REPLY_ONLY_FIELDS = (
    "source_kind",
    "source_text",
    "participating_departments",
    "reply_process",
    "reply_conclusion",
    "reply_time",
    "respondent",
)


def _validate_iso8601_string(value: str, field_name: str) -> str:
    """Validate ``value`` is a non-empty, parseable ISO8601 string.

    Accepts the trailing ``Z`` (UTC) shorthand in addition to what
    ``datetime.fromisoformat`` natively supports. Raises ``ValueError`` (not
    a custom exception) so this can be used directly inside Pydantic
    validators, which wrap it into a standard ``pydantic.ValidationError``.
    """

    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} 不能为空")
    stripped = value.strip()
    normalized = stripped[:-1] + "+00:00" if stripped.endswith("Z") else stripped
    try:
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{field_name} 必须是可解析的 ISO8601 时间字符串") from exc
    return stripped


class Evidence(BaseModel):
    """A single piece of structured evidence attached to an archive."""

    model_config = ConfigDict(extra="forbid")

    source: str
    reality_label: RealityLabel
    note: str | None = None

    @field_validator("source")
    @classmethod
    def _validate_source(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("source 不能为空")
        return value.strip()

    @field_validator("note")
    @classmethod
    def _validate_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ReviewStatus(BaseModel):
    """A单条档案的 review/复盘 outcome: status + when it was reviewed + optional note."""

    model_config = ConfigDict(extra="forbid")

    status: ReviewStatusValue
    reviewed_at: str
    note: str | None = None

    @field_validator("reviewed_at")
    @classmethod
    def _validate_reviewed_at(cls, value: str) -> str:
        return _validate_iso8601_string(value, "reviewed_at")

    @field_validator("note")
    @classmethod
    def _validate_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class _FrozenJsonMapping(Mapping[str, Any]):
    """Recursively immutable JSON object used by trusted archive snapshots."""

    __slots__ = ("_data",)

    def __init__(self, values: Mapping[str, Any]) -> None:
        self._data = MappingProxyType(
            {key: values[key] for key in sorted(values)}
        )

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __iter__(self) -> Any:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def __or__(self, other: object) -> Any:
        raise TypeError("archive JSON value is immutable")

    def __ror__(self, other: object) -> Any:
        raise TypeError("archive JSON value is immutable")

    def __ior__(self, other: object) -> Any:
        raise TypeError("archive JSON value is immutable")


def _freeze_snapshot_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise ValueError("archive JSON object keys must be strings")
        return _FrozenJsonMapping(
            {key: _freeze_snapshot_json(item) for key, item in value.items()}
        )
    if isinstance(value, list | tuple):
        return tuple(_freeze_snapshot_json(item) for item in value)
    if value is None or type(value) in {bool, str, int}:
        return value
    if type(value) is float and math.isfinite(value):
        return value
    raise ValueError("archive snapshot values must be finite JSON")


def _thaw_snapshot_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _thaw_snapshot_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_snapshot_json(item) for item in value]
    return value


_SENSITIVE_ARCHIVE_METADATA_TOKENS = frozenset(
    {
        "authorization",
        "body",
        "cookie",
        "credential",
        "header",
        "password",
        "payload",
        "secret",
        "token",
    }
)
_SAFE_METADATA_DIGEST_TOKENS = frozenset({"digest", "fingerprint", "hash"})


def _metadata_key_tokens(key: object) -> tuple[str, ...]:
    normalized = unicodedata.normalize("NFKC", str(key))
    with_word_boundaries = re.sub(
        r"([a-z0-9])([A-Z])", r"\1_\2", normalized
    )
    with_acronym_boundaries = re.sub(
        r"([A-Z]+)([A-Z][a-z])", r"\1_\2", with_word_boundaries
    )
    return tuple(
        token.casefold()
        for token in re.findall(r"[A-Za-z0-9]+", with_acronym_boundaries)
    )


def _singular_metadata_token(token: str) -> str:
    if token.endswith("ies") and len(token) > 3:
        return f"{token[:-3]}y"
    if token.endswith("s") and len(token) > 1:
        return token[:-1]
    return token


def _metadata_key_is_sensitive(key: object) -> bool:
    tokens = _metadata_key_tokens(key)
    singular = tuple(_singular_metadata_token(token) for token in tokens)
    if any(token in _SENSITIVE_ARCHIVE_METADATA_TOKENS for token in singular):
        if (
            any(token in {"body", "payload"} for token in singular)
            and singular
            and singular[-1] in _SAFE_METADATA_DIGEST_TOKENS
        ):
            return False
        return True
    return "api" in singular and "key" in singular


def _reject_sensitive_metadata(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, item in value.items():
            if _metadata_key_is_sensitive(key):
                raise ValueError("sensitive access metadata must not be archived")
            _reject_sensitive_metadata(item)
    elif isinstance(value, list | tuple):
        for item in value:
            _reject_sensitive_metadata(item)


class ArchiveEvidenceSnapshot(BaseModel):
    """Shiguan-owned copy of every field in an adopted EvidenceItem."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    evidence_id: str
    fact_key: str
    category: ArchiveFactCategory
    data_scope: ArchiveDataScope
    subject: str
    jurisdiction: str | None = None
    value: Any
    unit: str | None = None
    as_of: str
    published_at: str | None = None
    retrieved_at: str
    source_url: str
    publisher: str
    source_type: Literal["SHIGUAN", "MCP", "PUBLIC_API", "PUBLIC_WEB"]
    coverage: tuple[str, ...] | None = None
    license_note: str | None = None
    quality: Literal["PRIMARY", "AUTHORITATIVE", "SECONDARY", "UNVERIFIED"]
    stance: Literal["SUPPORTS", "CONTRADICTS", "CONTEXT"]
    excerpt: str
    content_hash: str
    confidence: float
    access_url: str | None = None
    access_metadata: Mapping[str, Any] | None = None

    @field_validator("evidence_id", "fact_key", "subject")
    @classmethod
    def _required_snapshot_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("archive evidence identity must not be blank")
        return normalized

    @field_validator("jurisdiction")
    @classmethod
    def _normalize_jurisdiction(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if len(normalized) != 2 or not normalized.isalpha():
            raise ValueError("jurisdiction must be an ISO alpha-2 code")
        return normalized

    @field_validator("value")
    @classmethod
    def _freeze_value(cls, value: Any) -> Any:
        return _freeze_snapshot_json(value)

    @field_serializer("value")
    def _serialize_value(self, value: Any) -> Any:
        return _thaw_snapshot_json(value)

    @field_validator("access_metadata")
    @classmethod
    def _freeze_access_metadata(
        cls, value: Mapping[str, Any] | None
    ) -> Mapping[str, Any] | None:
        if value is None:
            return None
        _reject_sensitive_metadata(value)
        return _freeze_snapshot_json(value)

    @field_serializer("access_metadata")
    def _serialize_access_metadata(
        self, value: Mapping[str, Any] | None
    ) -> Any:
        return None if value is None else _thaw_snapshot_json(value)

    @model_validator(mode="after")
    def _matches_jinyiwei_contract(self) -> ArchiveEvidenceSnapshot:
        # Lazy import avoids a package cycle while still reusing the complete
        # EvidenceItem semantic validator on every trusted write/read.
        from app.jinyiwei.models import EvidenceItem

        EvidenceItem.model_validate(
            self.model_dump(
                mode="python",
                exclude={"category", "data_scope", "subject", "jurisdiction"},
            )
        )
        return self


def _snapshot_json(snapshot: ArchiveEvidenceSnapshot) -> str:
    return json.dumps(
        snapshot.model_dump(
            mode="json",
            exclude_none=True,
            warnings="none",
            fallback=lambda value: dict(value) if isinstance(value, Mapping) else value,
        ),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


class ArchiveEvidenceReferenceCreate(BaseModel):
    """Trusted internal input for one adopted Jinyiwei evidence snapshot."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    pack_id: str
    investigation_id: str
    snapshot: ArchiveEvidenceSnapshot

    @field_validator("pack_id", "investigation_id")
    @classmethod
    def _required_identifier(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("证据引用标识不能为空")
        return value.strip()


class ArchiveEvidenceReference(ArchiveEvidenceReferenceCreate):
    """Stored immutable citation returned with a Shiguan archive."""

    ordinal: int = Field(ge=0)
    evidence_id: str
    snapshot_hash: str

    @model_validator(mode="after")
    def _matches_snapshot(self) -> ArchiveEvidenceReference:
        if self.evidence_id != self.snapshot.evidence_id:
            raise ValueError("证据引用 ID 与快照不一致")
        expected = hashlib.sha256(_snapshot_json(self.snapshot).encode()).hexdigest()
        if self.snapshot_hash != expected:
            raise ValueError("证据快照哈希不一致")
        return self


class ArchiveCreate(BaseModel):
    """Input contract for creating an archive.

    Deliberately excludes ``id`` and ``created_at`` -- both are always
    server-generated. Because ``model_config`` forbids extra fields, a
    caller that attempts to pass either of those is rejected outright
    (surfaced as :class:`app.shiguan.errors.ArchiveValidationError` by
    ``app.shiguan.validation.validate_archive_create``), rather than being
    silently ignored or allowed to overwrite an existing record.
    """

    model_config = ConfigDict(extra="forbid")

    type: ArchiveType
    title: str
    content: str
    matter_type: str
    department: str
    related_archive_ids: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    lessons_learned: str | None = None
    pitfalls: str | None = None

    # REPLY-only fields. Required when type == "REPLY"; must not be
    # provided (non-None) for any other type. See `_validate_decision_fields`.
    source_kind: ReplySourceKind | None = None
    source_text: str | None = None
    participating_departments: list[str] | None = None
    reply_process: str | None = None
    reply_conclusion: str | None = None
    reply_time: str | None = None
    respondent: str | None = None

    @field_validator("title", "content", "matter_type", "department")
    @classmethod
    def _validate_required_text(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("字段不能为空")
        return value.strip()

    @field_validator("related_archive_ids")
    @classmethod
    def _validate_related_archive_ids(cls, value: list[str]) -> list[str]:
        for related_id in value:
            if not isinstance(related_id, str) or not related_id.strip():
                raise ValueError("related_archive_ids 不能包含空白 ID")
        return [related_id.strip() for related_id in value]

    @field_validator("lessons_learned", "pitfalls")
    @classmethod
    def _validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("source_text", "reply_process", "reply_conclusion", "respondent")
    @classmethod
    def _validate_optional_reply_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            raise ValueError("字段不能为空白字符串")
        return value.strip()

    @field_validator("reply_time")
    @classmethod
    def _validate_reply_time(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_iso8601_string(value, "reply_time")

    @model_validator(mode="after")
    def _validate_reply_fields(self) -> ArchiveCreate:
        if self.type == "REPLY":
            missing = [
                field_name
                for field_name in _REPLY_ONLY_FIELDS
                if getattr(self, field_name) is None
            ]
            if missing:
                raise ValueError(f"REPLY 档案缺少必填字段: {', '.join(missing)}")

            departments = self.participating_departments or []
            stripped_departments = [department.strip() for department in departments]
            if not stripped_departments or any(not d for d in stripped_departments):
                raise ValueError("participating_departments 不能为空或包含空白部门")
            if len(stripped_departments) != len(set(stripped_departments)):
                raise ValueError("participating_departments 不能包含重复部门")
            self.participating_departments = stripped_departments
        else:
            provided = [
                field_name
                for field_name in _REPLY_ONLY_FIELDS
                if getattr(self, field_name) is not None
            ]
            if provided:
                raise ValueError(f"MEMORIAL 档案不应携带回奏专属字段: {', '.join(provided)}")
        return self


class Archive(ArchiveCreate):
    """The full, stored representation of an archive returned by storage.py."""

    id: str
    created_at: str
    review_status: ReviewStatus | None = None
    evidence_references: list[ArchiveEvidenceReference] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def _validate_id(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("id 不能为空")
        return value

    @field_validator("created_at")
    @classmethod
    def _validate_created_at(cls, value: str) -> str:
        return _validate_iso8601_string(value, "created_at")


class Statistics(BaseModel):
    """Aggregate counters exposed by ``storage.get_statistics()``."""

    model_config = ConfigDict(extra="forbid")

    total: int
    achieved: int
    not_achieved: int
    partial: int
    observing: int
    pending_review: int
    success_rate: float | None
