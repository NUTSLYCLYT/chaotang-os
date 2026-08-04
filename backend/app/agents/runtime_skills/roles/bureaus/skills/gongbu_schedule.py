"""Authoritative Runtime Skill declaration for one bureau."""

from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.tool_models import ToolName

__all__ = ("SKILL",)

SKILL: BureauRuntimeSkillSpec = BureauRuntimeSkillSpec(
    department="工部",
    bureau="进度司",
    agent_id="gongbu-schedule",
    skill_id="analyze-delivery-schedule",
    method=BureauMethod(
        data_requirements=("里程碑、任务、依赖与基线排期", "实际进度、阻塞、责任人与资源"),
        analysis_procedure=(
            "核验完成证据和当前状态",
            "计算关键路径和延期影响",
            "形成责任到人的恢复计划",
        ),
        required_findings=("关键路径偏差", "延期预测和资源卡点"),
        forbidden_actions=("不得用口头进度替代完成证据", "不得擅自变更里程碑或责任人"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.schedule.tools",
        version="1.0.0",
        agent_id="gongbu-schedule",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.schedule",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "trend", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.schedule",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.schedule.milestone_id",)),
                    ("allowed_dimensions", ("delivery.schedule.project_phase",)),
                    ("allowed_metrics", ("delivery.schedule.schedule_variance",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.schedule",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.schedule.milestone_id",)),
                    ("allowed_dimensions", ("delivery.schedule.project_phase",)),
                    ("allowed_metrics", ("delivery.schedule.schedule_variance",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.schedule",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.schedule.milestone_id",)),
                    ("allowed_dimensions", ("delivery.schedule.project_phase",)),
                    ("allowed_metrics", ("delivery.schedule.schedule_variance",)),
                ),
            ),
        ),
        required_data_refs=("case", "decree"),
        max_tool_calls=4,
        max_tool_rounds=2,
        max_result_rows=200,
        max_result_bytes=262144,
    ),
)
