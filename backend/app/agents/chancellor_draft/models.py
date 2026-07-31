"""Structured contracts for the pre-execution Chancellor draft flow."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.agents.bureaus.profiles import bureau_profiles_for
from app.agents.ministries.prompts import MINISTRIES


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
    bureaus: list[str] = Field(min_length=1, max_length=39)
    role: str = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=1, max_length=1000)
    responsibility: str = Field(min_length=1, max_length=1000)
    expected_output: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def _validate_department_route(self) -> DepartmentRecommendation:
        if self.department not in MINISTRIES:
            raise ValueError("department must be one of the six ministries")
        if len(set(self.bureaus)) != len(self.bureaus):
            raise ValueError("bureaus must not contain duplicates")
        allowed = {
            profile.bureau for profile in bureau_profiles_for(self.department)
        }
        if any(bureau not in allowed for bureau in self.bureaus):
            raise ValueError("bureaus must belong to the selected department")
        return self


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

    @model_validator(mode="after")
    def _validate_unique_departments(self) -> DraftEdict:
        names = [item.department for item in self.departments]
        if len(set(names)) != len(names):
            raise ValueError("departments must not contain duplicates")
        return self


class ChancellorDraftResponse(BaseModel):
    """One case-driven draft response returned to the authenticated client."""

    model_config = ConfigDict(extra="forbid")

    status: DraftStatus
    version: int = Field(ge=1)
    fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    understanding: str = Field(min_length=1, max_length=4000)
    expert_example: str = Field(min_length=1, max_length=2000)
    recommendation_reason: str = Field(min_length=1, max_length=4000)
    assumptions: list[str] = Field(max_length=30)
    revision_prompt: str = Field(min_length=1, max_length=2000)
    draft: DraftEdict | None = None
    decree_text: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _ready_state_is_internally_consistent(self) -> ChancellorDraftResponse:
        normalized_example = self.expert_example.strip()
        if not 1 <= len(normalized_example) <= 2000:
            raise ValueError(
                "expert_example must contain 1 to 2000 non-whitespace characters"
            )
        if self.status is DraftStatus.DRAFT_READY:
            if self.draft is None:
                raise ValueError("DRAFT_READY requires draft")
            if self.draft.current_status is not DraftStatus.DRAFT_READY:
                raise ValueError(
                    "DRAFT_READY requires matching draft current_status"
                )
            if self.draft.material_gaps:
                raise ValueError("DRAFT_READY requires empty material_gaps")
            if self.decree_text != normalized_example:
                raise ValueError(
                    "DRAFT_READY decree_text must equal normalized expert_example"
                )
        elif (
            self.draft is not None
            and self.draft.current_status is DraftStatus.DRAFT_READY
        ):
            raise ValueError(
                "non-ready response cannot contain a DRAFT_READY draft"
            )
        elif self.decree_text is not None:
            raise ValueError("non-ready response cannot contain decree_text")
        return self
