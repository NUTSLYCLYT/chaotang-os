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
    bureau="会计司",
    agent_id="hubu-accounting",
    skill_id="analyze-accounting-position",
    method=BureauMethod(
        data_requirements=("总账、明细账、凭证与科目余额", "合同、发票、项目归集和关账清单"),
        analysis_procedure=(
            "核对总账与明细账勾稽",
            "检验科目、期间和项目归集",
            "评估关账调整与税务影响",
        ),
        required_findings=("科目错列和勾稽差异", "关账缺口与税务影响"),
        forbidden_actions=("不得无凭证编制会计事实", "不得直接过账、调账或申报税务"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.accounting.tools",
        version="1.0.0",
        agent_id="hubu-accounting",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.accounting",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("aggregate", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("arithmetic", "difference", "reconcile")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.accounting",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.accounting.ledger_ref",)),
                    ("allowed_dimensions", ("finance.accounting.account_period",)),
                    ("allowed_metrics", ("finance.accounting.balance_difference",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.accounting",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.accounting.ledger_ref",)),
                    ("allowed_dimensions", ("finance.accounting.account_period",)),
                    ("allowed_metrics", ("finance.accounting.balance_difference",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.accounting",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.accounting.ledger_ref",)),
                    ("allowed_dimensions", ("finance.accounting.account_period",)),
                    ("allowed_metrics", ("finance.accounting.balance_difference",)),
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
