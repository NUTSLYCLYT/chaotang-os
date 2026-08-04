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
    bureau="盐铁司",
    agent_id="hubu-pricing",
    skill_id="analyze-pricing-economics",
    method=BureauMethod(
        data_requirements=("报价单、成本清单与折扣规则", "历史成交价、毛利底线与竞价条件"),
        analysis_procedure=(
            "校验报价范围和成本口径",
            "拆解毛利、折扣与敏感性",
            "识别异常价格并给出审批条件",
        ),
        required_findings=("报价毛利与异常价格", "成本漏项和价格底线风险"),
        forbidden_actions=("不得把测算报价视为对外承诺", "不得绕过折扣或毛利审批"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.pricing.tools",
        version="1.0.0",
        agent_id="hubu-pricing",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.pricing",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("compare", "top_n", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("percentage", "difference", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("finance.pricing",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("finance.pricing.quote_id",)),
                    ("allowed_dimensions", ("finance.pricing.price_band",)),
                    ("allowed_metrics", ("finance.pricing.gross_margin",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.pricing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.pricing.quote_id",)),
                    ("allowed_dimensions", ("finance.pricing.price_band",)),
                    ("allowed_metrics", ("finance.pricing.gross_margin",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.pricing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.pricing.quote_id",)),
                    ("allowed_dimensions", ("finance.pricing.price_band",)),
                    ("allowed_metrics", ("finance.pricing.gross_margin",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.pricing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.pricing.quote_id",)),
                    ("allowed_dimensions", ("finance.pricing.price_band",)),
                    ("allowed_metrics", ("finance.pricing.gross_margin",)),
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
