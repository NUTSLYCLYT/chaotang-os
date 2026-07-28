"""Contracts for owner-scoped Grand Council case ledger records."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    @field_validator("decree_text")
    @classmethod
    def _required_decree_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("decree_text must not be blank")
        return normalized

    @field_validator("departments", "processing_path")
    @classmethod
    def _nonblank_values(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if not normalized or any(not item for item in normalized):
            raise ValueError("case lists must contain non-blank values")
        return normalized


class JunjichuCase(BaseModel):
    """The complete, private state of one multi-department case."""

    model_config = ConfigDict(extra="forbid")

    id: str
    owner_user_id: str
    decree_text: str
    departments: list[str]
    status: JunjichuCaseStatus
    processing_path: list[str]
    completed_ministry_opinions: list[dict[str, Any]] = Field(default_factory=list)
    council_verdict: str | None = None
    reply_id: str | None = None
    failure_reason: str | None = None
    created_at: str
    updated_at: str
