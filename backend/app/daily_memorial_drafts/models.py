
"""Strict domain and wire contracts for daily memorial drafts."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SHA256_PATTERN = r"^[0-9a-f]{64}$"


class RunStatus(StrEnum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    SKIPPED_NO_FACTS = "SKIPPED_NO_FACTS"
    FAILED = "FAILED"
    CONFIRMED = "CONFIRMED"


class StageKind(StrEnum):
    BUREAU = "BUREAU"
    MINISTRY = "MINISTRY"
    CHANCELLOR = "CHANCELLOR"


class StageStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    READY = "READY"
    NO_MATERIAL = "NO_MATERIAL"
    RETRY_WAIT = "RETRY_WAIT"
    FAILED = "FAILED"


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MinistryDailyResult(BaseModel):
    model_config = ConfigDict(extra="forbid", revalidate_instances="always")

    department: str
    bureau_units: list[str] = Field(min_length=1)
    summary: str = Field(min_length=1, max_length=6000)
    risks_and_dependencies: list[str] = Field(max_length=30)
    decisions_needed: list[str] = Field(max_length=30)
    fact_refs: list[str] = Field(min_length=1, max_length=500)

    @field_validator(
        "department",
        "summary",
    )
    @classmethod
    def _nonblank_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("field must not be blank")
        return normalized

    @field_validator(
        "bureau_units", "risks_and_dependencies", "decisions_needed", "fact_refs"
    )
    @classmethod
    def _nonblank_unique_list(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("list items must not be blank")
        if len(normalized) != len(set(normalized)):
            raise ValueError("list items must be unique")
        return normalized


class ChancellorDailyResult(BaseModel):
    model_config = ConfigDict(extra="forbid", revalidate_instances="always")

    report_date: date
    fact_cutoff: str
    ministry_sections: list[MinistryDailyResult] = Field(min_length=6, max_length=6)
    cross_ministry_risks: list[str] = Field(max_length=50)
    decisions_needed: list[str] = Field(max_length=50)
    content: str = Field(min_length=1, max_length=40000)
    fact_refs: list[str] = Field(min_length=1, max_length=2000)

    @field_validator("fact_cutoff", "content")
    @classmethod
    def _nonblank_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("field must not be blank")
        return normalized

    @field_validator("cross_ministry_risks", "decisions_needed", "fact_refs")
    @classmethod
    def _nonblank_unique_list(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("list items must not be blank")
        if len(normalized) != len(set(normalized)):
            raise ValueError("list items must be unique")
        return normalized


class DailyMemorialDraft(_StrictModel):
    id: str
    report_date: date
    source_window_start: datetime
    source_window_end: datetime
    version: int = Field(ge=1)
    fingerprint: str = Field(pattern=_SHA256_PATTERN)
    bureau_result_count: int = Field(ge=39, le=39)
    ministry_result_count: int = Field(ge=6, le=6)
    content: str
    fact_refs: list[str] = Field(min_length=1)

    @field_validator("id", "content")
    @classmethod
    def _required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("field must not be blank")
        return normalized

    @field_validator("source_window_start", "source_window_end")
    @classmethod
    def _timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("source window timestamps must include a timezone")
        if value.utcoffset() != timedelta(hours=8):
            raise ValueError("source window timestamps must use Asia/Shanghai (+08:00)")
        return value

    @field_validator("fact_refs")
    @classmethod
    def _unique_fact_refs(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("fact references must not be blank")
        if len(normalized) != len(set(normalized)):
            raise ValueError("fact references must be unique")
        return normalized

    @model_validator(mode="after")
    def _coherent_window(self) -> Self:
        if self.source_window_end <= self.source_window_start:
            raise ValueError("source window end must follow its start")
        return self

class DailyMemorialLatestResponse(_StrictModel):
    status: RunStatus
    draft: DailyMemorialDraft | None = None
    memorial_id: str | None = None
    failure_code: str | None = None

    @field_validator("memorial_id", "failure_code")
    @classmethod
    def _normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("field must not be blank")
        return normalized

    @model_validator(mode="after")
    def _matches_status(self) -> Self:
        if self.status in {RunStatus.READY_FOR_REVIEW, RunStatus.CONFIRMED}:
            if self.draft is None:
                raise ValueError("reviewable statuses require a draft")
        elif self.draft is not None:
            raise ValueError("non-reviewable statuses must not expose a draft")
        if self.status is RunStatus.CONFIRMED:
            if self.memorial_id is None:
                raise ValueError("confirmed status requires a memorial id")
        elif self.memorial_id is not None:
            raise ValueError("only confirmed status may expose a memorial id")
        if self.status is RunStatus.FAILED:
            if self.failure_code is None:
                raise ValueError("failed status requires a failure code")
        elif self.failure_code is not None:
            raise ValueError("only failed status may expose a failure code")
        return self


class ConfirmDailyMemorialRequest(_StrictModel):
    version: int = Field(ge=1)
    fingerprint: str = Field(pattern=_SHA256_PATTERN)


class ConfirmDailyMemorialResponse(_StrictModel):
    status: RunStatus
    draft_id: str
    memorial_id: str

    @field_validator("draft_id", "memorial_id")
    @classmethod
    def _required_identifier(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("identifier must not be blank")
        return normalized

    @model_validator(mode="after")
    def _confirmed_only(self) -> Self:
        if self.status is not RunStatus.CONFIRMED:
            raise ValueError("confirmation response status must be CONFIRMED")
        return self
