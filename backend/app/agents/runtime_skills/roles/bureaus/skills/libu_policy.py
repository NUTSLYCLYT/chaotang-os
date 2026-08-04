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
    bureau="制度司",
    agent_id="libu-policy",
    skill_id="analyze-hr-policy",
    method=BureauMethod(
        data_requirements=("现行人事制度、版本与生效范围", "流程实例、例外申请和审批记录"),
        analysis_procedure=(
            "确认适用制度版本",
            "逐条比对流程和例外条件",
            "标注冲突条款并设计修订路径",
        ),
        required_findings=("制度适用与冲突条款", "例外处理及执行一致性"),
        forbidden_actions=("不得引用失效制度作为依据", "不得自行批准制度例外"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.policy.tools",
        version="1.0.0",
        agent_id="libu-policy",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.policy",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("describe", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("workforce.policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("workforce.policy.policy_id",)),
                    ("allowed_dimensions", ("workforce.policy.effective_period",)),
                    ("allowed_metrics", ("workforce.policy.exception_rate",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.policy.policy_id",)),
                    ("allowed_dimensions", ("workforce.policy.effective_period",)),
                    ("allowed_metrics", ("workforce.policy.exception_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.policy.policy_id",)),
                    ("allowed_dimensions", ("workforce.policy.effective_period",)),
                    ("allowed_metrics", ("workforce.policy.exception_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.policy.policy_id",)),
                    ("allowed_dimensions", ("workforce.policy.effective_period",)),
                    ("allowed_metrics", ("workforce.policy.exception_rate",)),
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
