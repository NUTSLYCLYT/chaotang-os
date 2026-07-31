from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Subject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["DECREE", "DRAFT", "REPLY"]
    id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=20000)


class EvidenceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=2000)
    source: str = Field(min_length=1, max_length=500)
    as_of: str | None = None


class ProbabilityInterval(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lower: float = Field(ge=0, le=1)
    upper: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def ordered(self):
        if self.lower > self.upper:
            raise ValueError("lower must not exceed upper")
        return self


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["OPTIMISTIC", "BASELINE", "PESSIMISTIC"]
    summary: str = Field(min_length=1, max_length=4000)
    impact: str = Field(min_length=1, max_length=4000)
    time_window: str = Field(min_length=1, max_length=500)
    counterfactual: str = Field(min_length=1, max_length=4000)
    probability_interval: ProbabilityInterval | None = None


class Assumption(BaseModel):
    model_config = ConfigDict(extra="forbid")
    statement: str = Field(min_length=1, max_length=2000)
    critical: bool


class Trigger(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    signal: str
    threshold: str
    window: str
    review_at: str
    status: Literal["PENDING", "REVIEWED"] = "PENDING"


class ForecastReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    forecast_id: str
    trigger_id: str
    decision: Literal["KEEP", "INVALIDATE", "REQUEST_RERUN", "ESCALATE_TO_CHANCELLOR"]
    observation: str
    judgment_invalidated: bool
    created_at: str


class Forecast(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    created_at: str
    subject: Subject
    question: str
    judgment: str
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    confidence_basis: str
    status: Literal["COMPLETED"] = "COMPLETED"
    review_at: str
    methodology_version: str = "qintianjian-v1"
    scenarios: list[Scenario]
    assumptions: list[Assumption]
    evidence_refs: list[EvidenceRef]
    triggers: list[Trigger]
    reviews: list[ForecastReview] = Field(default_factory=list)
    human_signoff_required: bool = True
    disclaimer: str = "钦天监推演仅供决策参考，不构成正式执行或事实预测。"

    @field_validator("scenarios")
    @classmethod
    def exactly_three_scenarios(cls, value: list[Scenario]) -> list[Scenario]:
        if [item.kind for item in value] != [
            "OPTIMISTIC",
            "BASELINE",
            "PESSIMISTIC",
        ]:
            raise ValueError("scenarios must contain optimistic, baseline, pessimistic")
        return value


class PendingTrigger(Trigger):
    forecast_id: str
    forecast_summary: str
    is_due: bool
    subject: Subject
    context_ref: dict[str, str]
