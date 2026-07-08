# web/schemas/chaotang.py
from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field


class Budget(BaseModel):
    maxCalls: int | None = None
    maxCostUsd: float | None = None
    maxSubagentsPerGroup: int | None = None


class DraftRequest(BaseModel):
    rawCommand: str = Field(..., min_length=1)


class Citation(BaseModel):
    source: str
    snippet: str
    score: float = 0.0


class RecommendedCategory(BaseModel):
    id: str
    label: str
    description: str = ""
    taskType: str = "general"
    ministers: list[str] = []
    groups: list[str] = []
    confidence: float = 0.5
    citations: list[Citation] = []


class DraftResponse(BaseModel):
    draft: str
    intent: str
    recommendedCategories: list[RecommendedCategory]
    source: Literal["llm", "rule"]


class CategorySelection(BaseModel):
    taskType: str = "general"
    ministers: list[str] = []
    groups: list[str] = []
    label: str | None = None


class DispatchRequest(BaseModel):
    rawCommand: str = Field(..., min_length=1)
    intent: str = ""
    selectedCategories: list[CategorySelection] = []
    councilAll: bool = False
    mode: Literal["scripted", "hybrid", "live"] | None = None
    budget: Budget | None = None
    stakes: str = "low"  # "low" | "medium" | "high"


class DispatchResponse(BaseModel):
    taskId: str
    status: str = "running"
    acceptedAt: str
    streamUrl: str
    intent: str
    taskType: str
    ministers: list[str]
    groups: list[str]
    budget: Budget | None = None


class ReviewRequest(BaseModel):
    action: Literal["approve", "reject", "inquire"]
    comment: str = ""


class StudyRunRequest(BaseModel):
    command: str = Field(..., min_length=1)
    mode: Literal["dry_run", "live"] = "dry_run"
    taskId: str | None = None
    entrySwarm: str | None = None
    provider: str | None = None
    # asyncRun=True 时 live 模式不阻塞:立即返回 taskId+skeleton,蜂群后台跑并经
    # /api/chaotang/stream/{taskId} 推送最终 edict。绕开"51s 蜂群 > 20s 代理超时"必 502 的死结。
    asyncRun: bool = False
    # 客户端可选幂等键：同一 key 重放只记一次（铁律2 每事件恰好一次）。
    idempotencyKey: str | None = None


class PersistTaskRequest(BaseModel):
    taskId: str | None = None
    command: str = Field(..., min_length=1)
    title: str | None = None
    status: str = "submitted"
    mode: str | None = None
    result: dict[str, Any] | None = None
    at: str | None = None


class PatchTaskRequest(BaseModel):
    status: str | None = None
    result: dict[str, Any] | None = None
    command: str | None = None
    title: str | None = None
    mode: str | None = None
    at: str | None = None


class Envelope(BaseModel):
    success: bool = True
    data: Any | None = None
    error: str | None = None
