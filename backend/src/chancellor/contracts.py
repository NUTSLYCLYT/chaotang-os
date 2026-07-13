"""超级丞相路由核心数据契约（阶段0·冻结版）。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第7节。
三个契约都是后端唯一事实源；前端只消费，不在本地重新生成同名结构
（对应 frontend/src/lib/contracts/chancellor.ts 的 TS 镜像类型）。
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

SourceLabel = Literal["LIVE", "MIXED", "FALLBACK", "DEMO"]
RouteMode = Literal["direct", "council"]
RouteStrategy = Literal[
    "single_agent", "parallel_review", "serial_review", "evidence_first"
]
ParticipantRole = Literal["primary", "reviewer", "evidence_collector"]
ParticipantStatus = Literal["planned", "unavailable"]
DepartmentAssignmentStatus = Literal[
    "planned", "accepted", "executing", "reported", "blocked", "skipped"
]


class RouteParticipant(BaseModel):
    department: str
    agent_id: str | None = None
    role: ParticipantRole
    reason: str
    required: bool
    status: ParticipantStatus


class RouteDecisionV2(BaseModel):
    """方案 7.1：不可变路由快照。每次下旨生成一份，supersedes 旧决策而不覆盖。"""

    schema_version: Literal["RouteDecisionV2"] = "RouteDecisionV2"
    decision_id: str
    task_id: str
    mode: RouteMode
    strategy: RouteStrategy
    decided_by: Literal["chancellor"] = "chancellor"
    primary_department: str
    primary_agent: str | None = None
    participants: list[RouteParticipant] = Field(default_factory=list)
    reason_summary: str
    complexity_score: float = Field(ge=0.0, le=1.0)
    complexity_reasons: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    evidence_gaps: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    policy_hits: list[str] = Field(default_factory=list)
    human_confirmation_required: bool
    capability_snapshot_version: str
    prompt_version: str | None = None
    source_label: SourceLabel
    created_at: str
    supersedes_decision_id: str | None = None


class DepartmentAssignment(BaseModel):
    department: str
    agent_id: str | None = None
    status: DepartmentAssignmentStatus
    latest_message: str
    started_at: str | None = None
    completed_at: str | None = None


class TimelineEvent(BaseModel):
    event_id: str
    stage: str
    actor: str
    message: str
    occurred_at: str
    sequence: int
    event_type: str = "timeline.note"
    trace_id: str | None = None
    source_label: SourceLabel = "FALLBACK"
    payload: dict[str, Any] = Field(default_factory=dict)


class DecreeExecutionStatusV1(BaseModel):
    """方案 7.2：状态接口的返回契约，回答"圣旨在哪、谁在处理、为何阻塞、下一步是什么"。"""

    schema_version: Literal["DecreeExecutionStatusV1"] = "DecreeExecutionStatusV1"
    task_id: str
    current_stage: str
    current_owner: str
    latest_message: str
    next_stage: str | None = None
    blocked_reason: str | None = None
    route_decision: RouteDecisionV2
    departments: list[DepartmentAssignment] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)


class ChancellorAdviceOption(BaseModel):
    id: str
    title: str
    benefits: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)


class ChancellorAdviceV1(BaseModel):
    """方案 6.8：回奏后的丞相综合建议。只能在真实回奏齐备后生成（阶段4硬门）。"""

    schema_version: Literal["ChancellorAdviceV1"] = "ChancellorAdviceV1"
    task_id: str
    analysis: str
    options: list[ChancellorAdviceOption] = Field(min_length=3, max_length=5)
    recommended_option_id: str
    recommendation_reason: str
    dissent: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    human_confirmation_required: bool
    source_label: SourceLabel
