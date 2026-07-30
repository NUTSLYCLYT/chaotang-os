"""Structured contracts for the pre-execution Chancellor draft flow."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DraftStatus(StrEnum):
    """Governed lifecycle states shared by draft, decree and execution UI."""

    CLARIFYING = "CLARIFYING"
    DRAFT_READY = "DRAFT_READY"
    NEEDS_INPUT = "NEEDS_INPUT"
    PARTIAL = "PARTIAL"
    ISSUE_BLOCKED = "ISSUE_BLOCKED"
    ISSUED = "ISSUED"
    EXECUTING = "EXECUTING"
    RETURNED = "RETURNED"


class DepartmentRecommendation(BaseModel):
    """One minimal department recommendation made during drafting."""

    model_config = ConfigDict(extra="forbid")

    department: str = Field(min_length=1, max_length=40)
    role: str = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=1, max_length=1000)
    responsibility: str = Field(min_length=1, max_length=1000)
    expected_output: str = Field(min_length=1, max_length=1000)


class DraftEdict(BaseModel):
    """The complete draft visible to the user before issuing."""

    model_config = ConfigDict(extra="forbid")

    objective: str = Field(min_length=1, max_length=4000)
    scope: list[str] = Field(min_length=1, max_length=30)
    exclusions: list[str] = Field(max_length=30)
    input_materials: list[str] = Field(max_length=50)
    material_gaps: list[str] = Field(max_length=50)
    key_questions: list[str] = Field(min_length=1, max_length=30)
    departments: list[DepartmentRecommendation] = Field(min_length=1, max_length=6)
    execution_steps: list[str] = Field(min_length=1, max_length=30)
    deliverables: list[str] = Field(min_length=1, max_length=30)
    completion_criteria: list[str] = Field(min_length=1, max_length=30)
    permissions_and_limits: list[str] = Field(min_length=1, max_length=30)
    current_status: DraftStatus


class ChancellorDraftResponse(BaseModel):
    """One case-driven draft response returned to the authenticated client."""

    model_config = ConfigDict(extra="forbid")

    status: DraftStatus
    version: int = Field(ge=1)
    fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    understanding: str = Field(min_length=1, max_length=4000)
    expert_example: str = Field(min_length=1, max_length=12000)
    recommendation_reason: str = Field(min_length=1, max_length=4000)
    assumptions: list[str] = Field(max_length=30)
    revision_prompt: str = Field(min_length=1, max_length=2000)
    draft: DraftEdict | None = None
    decree_text: str | None = None

    @model_validator(mode="after")
    def _ready_state_is_internally_consistent(self) -> ChancellorDraftResponse:
        if self.status is DraftStatus.DRAFT_READY:
            if self.draft is None:
                raise ValueError("DRAFT_READY requires draft")
            if self.draft.current_status is not DraftStatus.DRAFT_READY:
                raise ValueError(
                    "DRAFT_READY requires matching draft current_status"
                )
            if self.draft.material_gaps:
                raise ValueError("DRAFT_READY requires empty material_gaps")
        elif (
            self.draft is not None
            and self.draft.current_status is DraftStatus.DRAFT_READY
        ):
            raise ValueError(
                "non-ready response cannot contain a DRAFT_READY draft"
            )
        return self
