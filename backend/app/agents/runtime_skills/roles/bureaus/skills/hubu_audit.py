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
    bureau="审计司",
    agent_id="hubu-audit",
    skill_id="analyze-financial-controls",
    method=BureauMethod(
        data_requirements=("报销、付款、发票与审批链", "供应商、金额、日期和账户匹配记录"),
        analysis_procedure=(
            "执行重复和异常模式筛查",
            "追溯凭证与审批链完整性",
            "量化影响并提出控制修复",
        ),
        required_findings=("重复付款或异常报销", "缺证和流程绕行控制缺陷"),
        forbidden_actions=("不得把异常指标直接定性为舞弊", "不得修改账目或销毁审计证据"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.audit.tools",
        version="1.0.0",
        agent_id="hubu-audit",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.audit",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold", "reconcile")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.audit",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.audit.transaction_ref",)),
                    ("allowed_dimensions", ("finance.audit.control_status",)),
                    ("allowed_metrics", ("finance.audit.exception_count",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.audit",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.audit.transaction_ref",)),
                    ("allowed_dimensions", ("finance.audit.control_status",)),
                    ("allowed_metrics", ("finance.audit.exception_count",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.audit",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.audit.transaction_ref",)),
                    ("allowed_dimensions", ("finance.audit.control_status",)),
                    ("allowed_metrics", ("finance.audit.exception_count",)),
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
