"""朝堂 OS 前端聚合 schema —— 契约见 chaotang-os/docs/API_CONTRACT.md。

Memorial / Minister / SystemStatus 这些字段都是 camelCase（前端 TS 类型直接对齐），
和项目其他端点的 snake_case 不一致 —— 按契约保留。
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TransferRequest(BaseModel):
    target_department: str = Field(..., min_length=1)
    reason: str = ""


class TransferResponse(BaseModel):
    status: str = "transferred"
    transfer_id: str
    source_run_id: str
    source_flow: str = ""
    target_department: str
    reason: str
    operator: str = "anonymous"
    created_at: str
    task_input_excerpt: str = ""


class DigestResponse(BaseModel):
    run_id: str
    digest: str
    archive_id: str | None = None
    status: str = "generated"


class OverviewMetrics(BaseModel):
    revenue: float | None = None
    cashflow: float | None = None
    activeProjects: int = 0
    pendingApprovals: int = 0
    riskCount: int = 0
    opportunityCount: int = 0
    avgQualityScore: float = 0.0
    passRate: float = 0.0
    asOf: str = ""


class SystemStatus(BaseModel):
    overall: str = "ok"
    litellm: str = "up"
    knowledge: str = "ok"


class OverviewResponse(BaseModel):
    ministers: list[dict[str, Any]]
    memorialsToday: list[dict[str, Any]]
    risks: list[dict[str, Any]]
    metrics: OverviewMetrics
    systemStatus: SystemStatus
    generatedAt: str


class MemorialsListResponse(BaseModel):
    total: int
    items: list[dict[str, Any]]
