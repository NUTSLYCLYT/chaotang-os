"""Authoritative Runtime Skill declaration for one bureau."""

from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.tool_models import ToolName

__all__ = ("SKILL",)

SKILL: BureauRuntimeSkillSpec = BureauRuntimeSkillSpec(
    department="户部",
    bureau="预算司",
    agent_id="hubu-budget",
    skill_id="analyze-budget-performance",
    method=BureauMethod(
        data_requirements=("批准预算、滚动预测与实际发生", "成本中心、项目和期间口径"),
        analysis_procedure=(
            "统一预算与实际口径",
            "计算差异并拆解量价因素",
            "预测年末影响并提出控制动作",
        ),
        required_findings=("预算偏差及驱动因素", "预测缺口与费用控制空间"),
        forbidden_actions=("不得混用含税、未税或期间口径", "不得把预测当作已批准预算"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.budget.tools",
        version="1.0.0",
        agent_id="hubu-budget",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.budget",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "trend", "reconcile")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.budget",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.budget.cost_center",)),
                    ("allowed_dimensions", ("finance.budget.period",)),
                    ("allowed_metrics", ("finance.budget.variance",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.budget",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.budget.cost_center",)),
                    ("allowed_dimensions", ("finance.budget.period",)),
                    ("allowed_metrics", ("finance.budget.variance",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.budget",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.budget.cost_center",)),
                    ("allowed_dimensions", ("finance.budget.period",)),
                    ("allowed_metrics", ("finance.budget.variance",)),
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
