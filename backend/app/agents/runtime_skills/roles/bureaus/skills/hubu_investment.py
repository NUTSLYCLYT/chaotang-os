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
    bureau="投资司",
    agent_id="hubu-investment",
    skill_id="analyze-investment-case",
    method=BureauMethod(
        data_requirements=("投资方案、现金流假设与退出条款", "经授权的行情、估值和可比标的数据"),
        analysis_procedure=(
            "验证估值输入和数据时点",
            "测算收益、敏感性和下行情景",
            "审查退出路径与风险限额",
        ),
        required_findings=("风险调整收益与估值区间", "退出约束和最大损失情景"),
        forbidden_actions=("不得把行情快照表述为实时或保证收益", "不得下单、荐股或代替投资审批"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.investment.tools",
        version="1.0.0",
        agent_id="hubu-investment",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.investment",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("compare", "top_n", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("percentage", "trend", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("finance.investment",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("finance.investment.instrument_ref",)),
                    ("allowed_dimensions", ("finance.investment.valuation_date",)),
                    ("allowed_metrics", ("finance.investment.risk_adjusted_return",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.investment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.investment.instrument_ref",)),
                    ("allowed_dimensions", ("finance.investment.valuation_date",)),
                    ("allowed_metrics", ("finance.investment.risk_adjusted_return",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.investment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.investment.instrument_ref",)),
                    ("allowed_dimensions", ("finance.investment.valuation_date",)),
                    ("allowed_metrics", ("finance.investment.risk_adjusted_return",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.investment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.investment.instrument_ref",)),
                    ("allowed_dimensions", ("finance.investment.valuation_date",)),
                    ("allowed_metrics", ("finance.investment.risk_adjusted_return",)),
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
