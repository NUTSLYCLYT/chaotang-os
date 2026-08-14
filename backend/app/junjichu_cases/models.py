"""Contracts for owner-scoped Grand Council case ledger records."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.agents.runtime_skills.models import CouncilReport, MinistryReport
from app.agents.synthesis_failures import SynthesisFailureCode, SynthesisStage

JunjichuCaseStatus = Literal[
    "MINISTRY_REVIEWING",
    "COUNCIL_REVIEWING",
    "CHANCELLOR_FINALIZING",
    "ARCHIVED",
    "FAILED",
]
JunjichuRouteType = Literal["single", "multi"]


class JunjichuCaseOpenInput(BaseModel):
    """Validated snapshot available when the Chancellor selects a route."""

    model_config = ConfigDict(extra="forbid")

    decree_text: str
    route_type: JunjichuRouteType
    departments: list[str]
    processing_path: list[str] = Field(default_factory=list)
    run_id: str | None = Field(default=None, min_length=1, max_length=256, exclude=True)
    decree_id: str | None = Field(
        default=None, min_length=1, max_length=256, exclude=True
    )
    draft_fingerprint: str | None = Field(
        default=None, pattern=r"^[0-9a-f]{64}$", exclude=True
    )
    route_digest: str | None = Field(
        default=None, pattern=r"^[0-9a-f]{64}$", exclude=True
    )

    @field_validator("decree_text")
    @classmethod
    def _required_decree_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("decree_text must not be blank")
        return normalized

    @field_validator("departments")
    @classmethod
    def _nonblank_departments(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if not normalized or any(not item for item in normalized):
            raise ValueError("departments must contain non-blank values")
        return normalized

    @field_validator("processing_path")
    @classmethod
    def _nonblank_processing_path_nodes(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("processing_path nodes must be non-blank")
        return normalized

    @model_validator(mode="after")
    def _execution_binding_is_complete(self) -> JunjichuCaseOpenInput:
        values = (
            self.run_id,
            self.decree_id,
            self.draft_fingerprint,
            self.route_digest,
        )
        if any(value is not None for value in values) and any(
            value is None for value in values
        ):
            raise ValueError("case_execution_binding_incomplete")
        if self.run_id is not None and self.decree_id != self.run_id:
            raise ValueError("case_decree_run_binding_mismatch")
        return self


class JunjichuCase(BaseModel):
    """The complete, private state of one multi-department case."""

    model_config = ConfigDict(extra="forbid")

    id: str
    owner_user_id: str
    decree_text: str
    departments: list[str]
    status: JunjichuCaseStatus
    processing_path: list[str]
    run_id: str | None = Field(default=None, exclude=True)
    decree_id: str | None = Field(default=None, exclude=True)
    draft_fingerprint: str | None = Field(default=None, exclude=True)
    route_digest: str | None = Field(default=None, exclude=True)
    completed_ministry_opinions: list[dict[str, Any]] = Field(default_factory=list)
    council_verdict: str | None = None
    reply_id: str | None = None
    failure_reason: str | None = None
    failure_stage: SynthesisStage | None = Field(default=None, exclude=True)
    failure_code: SynthesisFailureCode | None = Field(default=None, exclude=True)
    created_at: str
    updated_at: str


JunjichuRuntimeReportKind = Literal["ministry", "council"]


class JunjichuRuntimeReportRecord(BaseModel):
    """One immutable typed RuntimeSkill report persisted for a bound case."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    case_id: str = Field(min_length=1, max_length=256)
    owner_user_id: str = Field(min_length=1, max_length=256)
    run_id: str = Field(min_length=1, max_length=256)
    report_kind: JunjichuRuntimeReportKind
    position: int = Field(ge=0, le=6)
    report_id: str = Field(min_length=1, max_length=512)
    content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    skill_definition_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    report: MinistryReport | CouncilReport
    created_at: datetime

    @model_validator(mode="after")
    def _report_kind_matches_payload(self) -> JunjichuRuntimeReportRecord:
        if self.report_kind == "ministry" and not isinstance(
            self.report, MinistryReport
        ):
            raise ValueError("runtime_report_kind_mismatch")
        if self.report_kind == "council" and not isinstance(
            self.report, CouncilReport
        ):
            raise ValueError("runtime_report_kind_mismatch")
        if self.report.report_id != self.report_id:
            raise ValueError("runtime_report_identity_mismatch")
        if self.report.created_at != self.created_at:
            raise ValueError("runtime_report_timestamp_mismatch")
        return self


class JunjichuRuntimeReportSnapshot(BaseModel):
    """Owner/run-scoped reload of the exact reports available to council."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    case_id: str = Field(min_length=1, max_length=256)
    owner_user_id: str = Field(min_length=1, max_length=256)
    run_id: str = Field(min_length=1, max_length=256)
    decree_id: str = Field(min_length=1, max_length=256)
    draft_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    route_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    departments: tuple[str, ...] = Field(min_length=2, max_length=6)
    case_status: JunjichuCaseStatus
    receipt_ref: str | None = Field(default=None, min_length=1, max_length=512)
    ministry_records: tuple[JunjichuRuntimeReportRecord, ...]
    council_record: JunjichuRuntimeReportRecord | None

    @model_validator(mode="after")
    def _archived_snapshot_requires_persisted_receipt(
        self,
    ) -> JunjichuRuntimeReportSnapshot:
        if self.case_status == "ARCHIVED" and self.receipt_ref is None:
            raise ValueError("archived_case_receipt_missing")
        if self.case_status != "ARCHIVED" and self.receipt_ref is not None:
            raise ValueError("nonarchived_case_cannot_have_receipt")
        return self
