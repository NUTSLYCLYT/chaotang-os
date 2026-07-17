"""Unified archive contracts for the 史馆 (Shiguan / Hall of Records) domain.

Five archive types share one base contract (``ArchiveCreate`` /
``Archive``): ``MEMORIAL`` (奏折), ``DECISION`` (决策), ``TASK_RESULT``
(任务结果), ``KNOWLEDGE`` (知识条目) and ``PUBLICITY`` (宣传材料).
``DECISION`` archives additionally require a fixed set of decision-only
fields (participating departments, process, conclusion, time, responsible
owner); the other four types must not carry them.

This module only defines data contracts (Pydantic models). It performs
*structural* validation only (types, non-empty text, enum membership,
cross-field consistency for the ``DECISION`` type). It does not touch the
database -- storage-facing checks that need a live connection (e.g.
confirming ``related_archive_ids`` reference archives that actually exist)
live in ``app.shiguan.validation``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ArchiveType = Literal["MEMORIAL", "DECISION", "TASK_RESULT", "KNOWLEDGE", "PUBLICITY"]
RealityLabel = Literal["LIVE", "MIXED", "FALLBACK"]
ReviewStatusValue = Literal["ACHIEVED", "NOT_ACHIEVED", "PARTIAL", "OBSERVING"]

_DECISION_ONLY_FIELDS = (
    "participating_departments",
    "decision_process",
    "decision_conclusion",
    "decision_time",
    "responsible_owner",
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

    # DECISION-only fields. Required when type == "DECISION"; must not be
    # provided (non-None) for any other type. See `_validate_decision_fields`.
    participating_departments: list[str] | None = None
    decision_process: str | None = None
    decision_conclusion: str | None = None
    decision_time: str | None = None
    responsible_owner: str | None = None

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

    @field_validator("decision_process", "decision_conclusion", "responsible_owner")
    @classmethod
    def _validate_optional_decision_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            raise ValueError("字段不能为空白字符串")
        return value.strip()

    @field_validator("decision_time")
    @classmethod
    def _validate_decision_time(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_iso8601_string(value, "decision_time")

    @model_validator(mode="after")
    def _validate_decision_fields(self) -> ArchiveCreate:
        if self.type == "DECISION":
            missing = [
                field_name
                for field_name in _DECISION_ONLY_FIELDS
                if getattr(self, field_name) is None
            ]
            if missing:
                raise ValueError(f"DECISION 档案缺少必填字段: {', '.join(missing)}")

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
                for field_name in _DECISION_ONLY_FIELDS
                if getattr(self, field_name) is not None
            ]
            if provided:
                raise ValueError(f"非 DECISION 档案不应携带决策专属字段: {', '.join(provided)}")
        return self


class Archive(ArchiveCreate):
    """The full, stored representation of an archive returned by storage.py."""

    id: str
    created_at: str
    review_status: ReviewStatus | None = None

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
