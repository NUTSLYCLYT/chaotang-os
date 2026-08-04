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
    bureau="出纳司",
    agent_id="hubu-treasury",
    skill_id="analyze-cash-safety",
    method=BureauMethod(
        data_requirements=("银行流水、资金余额与受限资金", "应收应付账期、付款审批和回款计划"),
        analysis_procedure=(
            "核对账面与银行可用资金",
            "排序回付款到期与审批状态",
            "测算安全垫和短期流动性缺口",
        ),
        required_findings=("现金头寸与账期错配", "付款授权和资金安全风险"),
        forbidden_actions=("不得展示凭证、账号或完整流水敏感字段", "不得发起付款、转账或回款承诺"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.treasury.tools",
        version="1.0.0",
        agent_id="hubu-treasury",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.treasury",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("arithmetic", "difference", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.treasury",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.treasury.account_ref",)),
                    ("allowed_dimensions", ("finance.treasury.maturity_bucket",)),
                    ("allowed_metrics", ("finance.treasury.liquidity_gap",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.treasury",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.treasury.account_ref",)),
                    ("allowed_dimensions", ("finance.treasury.maturity_bucket",)),
                    ("allowed_metrics", ("finance.treasury.liquidity_gap",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.treasury",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.treasury.account_ref",)),
                    ("allowed_dimensions", ("finance.treasury.maturity_bucket",)),
                    ("allowed_metrics", ("finance.treasury.liquidity_gap",)),
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
