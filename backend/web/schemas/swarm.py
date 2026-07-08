"""蜂群编排 schema。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SwarmRunRequest(BaseModel):
    task_input: str = Field(..., min_length=1)
    config_path: str = "config/swarm_orchestrator.yaml"
    provider: str | None = None
    entry_swarm: str | None = None
    # 客户项目关联键(可选):同一 project_id 下多次触发
    # pack_rd/hardware_design/process_manufacturing 才能被工部质量司四闸
    # (sizing/cost/DFM/FMEA)聚合识别为同一项目。见 swarm_orchestrator.py
    # list_sessions_by_project()。
    project_id: str | None = None
    courtos_task_id: str | None = None
    courtos_loop_trace_id: str | None = None
    courtos_user_id: str | None = None
    courtos_departments: list[str] = Field(default_factory=list)
    courtos_swarm_bundles: list[str] = Field(default_factory=list)
    courtos_edict_mode: str | None = None
    privacy_mode: str | None = None
    intelligence_pack_id: str | None = None
    intelligence_pack: dict | None = None
    evidence_refs: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    forbidden_outputs: list[str] = Field(default_factory=list)
    source_label: str | None = None
    evidence_bound_run: dict | None = None


class SwarmRunResponse(BaseModel):
    success: bool = True
    session_id: str
    message: str = "编排已启动"
    entry_swarm: str | None = None
    route_reason: str | None = None
    route_matched: bool | None = None


class LipuComplianceRequest(BaseModel):
    task_input: str = Field(..., min_length=1)
    archive: bool = False
    # 可选:关联同一客户项目下已完成的 xiaohongshu 蜂群舆情第三源。
    project_id: str | None = None


class SwarmSessionSummary(BaseModel):
    session_id: str
    task_input: str = ""
    status: str = "unknown"
    release_gate: str = "clear"
    synthetic: bool = False
    session_type: str = "swarm"
    swarm_count: int = 0
    completed_count: int = 0
    start_time: str = ""
    end_time: str = ""
    duration: str = ""


class SwarmConfigSwarm(BaseModel):
    id: str
    name: str
    config: str
    qa_version: str


class SwarmConfigBinding(BaseModel):
    topic: str
    target_swarm: str
    transform: str
    min_quality_score: float
    enabled: bool


class SwarmConfigResponse(BaseModel):
    swarms: list[SwarmConfigSwarm]
    bindings: list[SwarmConfigBinding]


class SwarmRosterItem(BaseModel):
    """庄园·蜂群聚集地:单蜂群 × 最近一次 run 的 join 视图。"""

    id: str
    name: str
    group: str = "unassigned"
    status: str = "idle"
    last_run_id: str | None = None
    last_quality_score: float | None = None
    last_run_at: str | None = None
    latest_title: str | None = None
