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
    bureau="质量司",
    agent_id="gongbu-quality",
    skill_id="analyze-quality-readiness",
    method=BureauMethod(
        data_requirements=("验收标准、测试结果与质量门禁", "缺陷、严重度、返工和复测证据"),
        analysis_procedure=(
            "核验验收范围和证据完整性",
            "按严重度分析缺陷与根因",
            "评估返工、复测和放行条件",
        ),
        required_findings=("缺陷分布与根因", "验收缺口和返工风险"),
        forbidden_actions=("不得把未复测缺陷标记为关闭", "不得越过质量门禁宣布验收"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.quality.tools",
        version="1.0.0",
        agent_id="gongbu-quality",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.quality",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("percentage", "threshold", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.quality",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.quality.inspection_id",)),
                    ("allowed_dimensions", ("delivery.quality.severity",)),
                    ("allowed_metrics", ("delivery.quality.defect_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.quality",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.quality.inspection_id",)),
                    ("allowed_dimensions", ("delivery.quality.severity",)),
                    ("allowed_metrics", ("delivery.quality.defect_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.quality",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.quality.inspection_id",)),
                    ("allowed_dimensions", ("delivery.quality.severity",)),
                    ("allowed_metrics", ("delivery.quality.defect_rate",)),
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
