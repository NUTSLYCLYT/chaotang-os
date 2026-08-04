"""Authoritative Runtime Skill declaration for one bureau."""

from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.tool_models import ToolName

__all__ = ("SKILL",)

SKILL: BureauRuntimeSkillSpec = BureauRuntimeSkillSpec(
    department="吏部",
    bureau="薪酬司",
    agent_id="libu-compensation",
    skill_id="analyze-compensation-equity",
    method=BureauMethod(
        data_requirements=("薪级、岗位带宽与同岗分布", "调薪奖金方案、预算和绩效依据"),
        analysis_procedure=(
            "校验口径并定位同岗样本",
            "比较带宽、绩效与内部公平性",
            "测算预算影响和倒挂风险",
        ),
        required_findings=("薪酬公平性偏差", "预算影响与薪酬倒挂"),
        forbidden_actions=("不得披露无关个人薪酬", "不得把建议写成已批准调薪"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.compensation.tools",
        version="1.0.0",
        agent_id="libu-compensation",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.compensation",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("arithmetic", "difference", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.compensation",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.compensation.position_id",)),
                    ("allowed_dimensions", ("workforce.compensation.grade",)),
                    ("allowed_metrics", ("workforce.compensation.pay_variance",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.compensation",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.compensation.position_id",)),
                    ("allowed_dimensions", ("workforce.compensation.grade",)),
                    ("allowed_metrics", ("workforce.compensation.pay_variance",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.compensation",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.compensation.position_id",)),
                    ("allowed_dimensions", ("workforce.compensation.grade",)),
                    ("allowed_metrics", ("workforce.compensation.pay_variance",)),
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
