"""Authoritative Runtime Skill declaration for one bureau."""

from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.tool_models import ToolName

__all__ = ("SKILL",)

SKILL: BureauRuntimeSkillSpec = BureauRuntimeSkillSpec(
    department="刑部",
    bureau="风控司",
    agent_id="xingbu-risk-control",
    skill_id="analyze-enterprise-risk",
    method=BureauMethod(
        data_requirements=("风险台账、损失事件与关键指标", "控制措施、风险偏好和准入标准"),
        analysis_procedure=(
            "统一风险分类和评分口径",
            "分析暴露、趋势与控制有效性",
            "对照风险偏好提出准入条件",
        ),
        required_findings=("主要风险暴露与趋势", "控制缺口和准入建议"),
        forbidden_actions=("不得用单一分数掩盖重大风险", "不得代替授权人批准准入"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.risk_control.tools",
        version="1.0.0",
        agent_id="xingbu-risk-control",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("risk.enterprise",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.enterprise",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.enterprise.risk_id",)),
                    ("allowed_dimensions", ("risk.enterprise.risk_category",)),
                    ("allowed_metrics", ("risk.enterprise.exposure_score",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("risk.enterprise",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.enterprise.risk_id",)),
                    ("allowed_dimensions", ("risk.enterprise.risk_category",)),
                    ("allowed_metrics", ("risk.enterprise.exposure_score",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("risk.enterprise",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.enterprise.risk_id",)),
                    ("allowed_dimensions", ("risk.enterprise.risk_category",)),
                    ("allowed_metrics", ("risk.enterprise.exposure_score",)),
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
