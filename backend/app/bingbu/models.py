"""Provider-neutral sales facts and decision contracts for Bingbu."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OpportunityStage(StrEnum):
    QUALIFIED = "qualified"
    DISCOVERY = "discovery"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class Health(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"
    UNKNOWN = "unknown"


class ActionState(StrEnum):
    DRAFT = "DRAFT"
    APPROVED_PENDING_EXECUTION = "APPROVED_PENDING_EXECUTION"
    REJECTED = "REJECTED"


class ImportStatus(StrEnum):
    PREVIEWED = "PREVIEWED"
    COMMITTED = "COMMITTED"


class Evidence(StrictModel):
    id: str = Field(min_length=1, max_length=128)
    claim: str = Field(min_length=1, max_length=2000)
    source_type: str = Field(min_length=1, max_length=64)
    source_ref: str = Field(min_length=1, max_length=512)
    observed_at: datetime
    freshness: str = Field(min_length=1, max_length=32)
    stance: str = Field(default="supporting", min_length=1, max_length=32)
    quality: str = Field(min_length=1, max_length=32)
    confidence: str = Field(min_length=1, max_length=32)


class Activity(StrictModel):
    id: str = Field(min_length=1, max_length=128)
    opportunity_id: str = Field(min_length=1, max_length=128)
    type: str = Field(min_length=1, max_length=64)
    occurred_at: datetime
    actor: str = Field(min_length=1, max_length=128)
    summary: str = Field(min_length=1, max_length=2000)
    customer_signal: str | None = Field(default=None, max_length=1000)
    next_commitment: str | None = Field(default=None, max_length=1000)
    source_ref: str = Field(min_length=1, max_length=512)


class Opportunity(StrictModel):
    id: str = Field(min_length=1, max_length=128)
    account_name: str = Field(min_length=1, max_length=254)
    contact_name: str | None = Field(default=None, max_length=254)
    owner_user_id: str = Field(min_length=1, max_length=128)
    stage: OpportunityStage
    amount: float = Field(ge=0)
    currency: str = Field(default="CNY", min_length=3, max_length=3)
    expected_close_date: date | None = None
    last_activity_at: datetime | None = None
    next_action: str | None = Field(default=None, max_length=1000)
    next_action_owner: str | None = Field(default=None, max_length=128)
    next_action_due_at: datetime | None = None
    blocker: str | None = Field(default=None, max_length=1000)
    health: Health = Health.UNKNOWN
    source_ref: str = Field(min_length=1, max_length=512)
    external_id: str | None = Field(default=None, max_length=254)
    external_source: str | None = Field(default=None, max_length=128)
    source_updated_at: datetime | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_next_action(self) -> Opportunity:
        if self.stage not in {OpportunityStage.WON, OpportunityStage.LOST}:
            if not self.next_action or not self.next_action_owner or not self.next_action_due_at:
                raise ValueError("active opportunity requires one complete next action")
        return self


class ImportRowError(StrictModel):
    row: int = Field(ge=1)
    field: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=500)


class ImportRun(StrictModel):
    id: str
    source_type: str
    filename: str
    row_count: int = Field(ge=0)
    accepted_count: int = Field(ge=0)
    rejected_count: int = Field(ge=0)
    errors: list[ImportRowError] = Field(default_factory=list)
    status: ImportStatus
    created_at: datetime
    fingerprint: str | None = Field(default=None, max_length=64)


class DecisionPacket(StrictModel):
    id: str
    subject_id: str
    status: str
    summary: str
    facts: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    evidence_gaps: list[str] = Field(default_factory=list)
    redlines: list[str] = Field(default_factory=list)
    next_action: str
    cross_bureau_impacts: list[str] = Field(default_factory=list)
    unresolved_items: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)
    model_provider: str = "deepseek-harness"
    model_alias: str = "injected-fake"
    skill_id: str = "bingbu-revenue-os-p0"
    skill_version: str = "1.0.0"
    request_id: str | None = Field(default=None, max_length=128)
    trace_id: str | None = Field(default=None, max_length=128)
    created_at: datetime


class ActionDraft(StrictModel):
    id: str
    decision_packet_id: str
    action_type: str
    payload: dict[str, Any]
    side_effect_level: str = "external"
    requires_approval: bool = True
    approval_state: ActionState = ActionState.DRAFT
    approved_by: str | None = None
    approved_at: datetime | None = None
    execution_state: str = "NOT_EXECUTED"
    idempotency_key: str
    request_id: str | None = Field(default=None, max_length=128)
    trace_id: str | None = Field(default=None, max_length=128)
    created_at: datetime


class ImportRequest(StrictModel):
    filename: str = Field(min_length=1, max_length=254)
    content: str = Field(min_length=1, max_length=2_000_000)
    source_type: str = Field(default="csv", min_length=1, max_length=32)


class WarRoomRequest(StrictModel):
    opportunity_id: str = Field(min_length=1, max_length=128)


class ActionDraftRequest(StrictModel):
    decision_packet_id: str = Field(min_length=1, max_length=128)
    action_type: str = Field(min_length=1, max_length=128)
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


class Overview(StrictModel):
    ok: bool = True
    period: dict[str, str]
    funnel: dict[str, dict[str, float | int] | list[dict[str, Any]]]
    priority_opportunities: list[Opportunity]
    evidence_gaps: list[str]
    decision_queue: list[DecisionPacket]
    experiments: list[str]
    freshness: dict[str, Any]
