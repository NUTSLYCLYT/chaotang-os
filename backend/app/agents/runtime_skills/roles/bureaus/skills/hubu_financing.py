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
    bureau="融资司",
    agent_id="hubu-financing",
    skill_id="analyze-financing-options",
    method=BureauMethod(
        data_requirements=("资金缺口、现金流预测与融资期限", "利率、费用、担保、还款与契约条款"),
        analysis_procedure=(
            "确认缺口金额和使用周期",
            "比较综合资金成本与还款曲线",
            "压力测试契约红线和再融资风险",
        ),
        required_findings=("融资成本与期限匹配", "偿债压力及契约红线"),
        forbidden_actions=("不得承诺融资可得性", "不得签署、提款或提供担保"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.hubu.financing.tools",
        version="1.0.0",
        agent_id="hubu-financing",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("finance.financing",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("arithmetic", "difference", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("finance.financing",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("finance.financing.facility_id",)),
                    ("allowed_dimensions", ("finance.financing.maturity_bucket",)),
                    ("allowed_metrics", ("finance.financing.funding_cost",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("finance.financing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.financing.facility_id",)),
                    ("allowed_dimensions", ("finance.financing.maturity_bucket",)),
                    ("allowed_metrics", ("finance.financing.funding_cost",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("finance.financing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.financing.facility_id",)),
                    ("allowed_dimensions", ("finance.financing.maturity_bucket",)),
                    ("allowed_metrics", ("finance.financing.funding_cost",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("finance.financing",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("finance.financing.facility_id",)),
                    ("allowed_dimensions", ("finance.financing.maturity_bucket",)),
                    ("allowed_metrics", ("finance.financing.funding_cost",)),
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
