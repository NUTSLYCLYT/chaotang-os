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
    bureau="产研司",
    agent_id="gongbu-product",
    skill_id="analyze-product-strategy",
    method=BureauMethod(
        data_requirements=("用户问题、需求证据与目标指标", "方案、范围、资源和优先级约束"),
        analysis_procedure=(
            "验证问题与用户价值",
            "比较方案、范围和依赖",
            "按价值成本风险确定优先级",
        ),
        required_findings=("需求真实性与价值", "范围取舍和方案风险"),
        forbidden_actions=("不得把假设需求写成用户事实", "不得未经批准扩大产品范围"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.product.tools",
        version="1.0.0",
        agent_id="gongbu-product",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.product",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "trend", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.product",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.product.requirement_id",)),
                    ("allowed_dimensions", ("delivery.product.priority_band",)),
                    ("allowed_metrics", ("delivery.product.validated_need_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.product",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.product.requirement_id",)),
                    ("allowed_dimensions", ("delivery.product.priority_band",)),
                    ("allowed_metrics", ("delivery.product.validated_need_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.product",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.product.requirement_id",)),
                    ("allowed_dimensions", ("delivery.product.priority_band",)),
                    ("allowed_metrics", ("delivery.product.validated_need_rate",)),
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
