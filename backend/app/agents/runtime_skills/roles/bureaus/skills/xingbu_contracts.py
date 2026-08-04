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
    bureau="合同司",
    agent_id="xingbu-contracts",
    skill_id="analyze-contract-risk",
    method=BureauMethod(
        data_requirements=("合同草案、模板、附件与版本差异", "交易背景、签署权限和审批记录"),
        analysis_procedure=(
            "逐条比对模板与必备条款",
            "评估偏离、缺失和责任暴露",
            "核验签署门禁并列出修订项",
        ),
        required_findings=("条款缺失与模板偏离", "签署权限和责任暴露"),
        forbidden_actions=("不得把业务意见表述为法律定论", "不得代签合同或绕过签署审批"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.contracts.tools",
        version="1.0.0",
        agent_id="xingbu-contracts",
        allowed_tools=(ToolName.READ_APPROVED_MATERIALS,),
        allowed_data_domains=("risk.contracts",),
        tool_operations=((ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.contracts",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.contracts.contract_id",)),
                    ("allowed_dimensions", ("risk.contracts.clause_category",)),
                    ("allowed_metrics", ("risk.contracts.deviation_count",)),
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
