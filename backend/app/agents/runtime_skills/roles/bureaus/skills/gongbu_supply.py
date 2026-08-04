"""Authoritative Runtime Skill declaration for one bureau."""

from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.tool_models import ToolName

__all__ = ("SKILL",)

SKILL: BureauRuntimeSkillSpec = BureauRuntimeSkillSpec(
    department="工部",
    bureau="物料司",
    agent_id="gongbu-supply",
    skill_id="analyze-supply-readiness",
    method=BureauMethod(
        data_requirements=("库存、消耗预测与安全库存", "采购订单、供应商产能和交期"),
        analysis_procedure=(
            "核对库存可用量和需求口径",
            "分析供应、交期与单点依赖",
            "制定缺料预警和替代方案",
        ),
        required_findings=("库存缺口与到料风险", "供应商依赖和替代可行性"),
        forbidden_actions=("不得把在途物料当作可用库存", "不得自动下单或变更供应商"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.supply.tools",
        version="1.0.0",
        agent_id="gongbu-supply",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.supply",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "trend", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("delivery.supply",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("delivery.supply.supplier_id",)),
                    ("allowed_dimensions", ("delivery.supply.supply_category",)),
                    ("allowed_metrics", ("delivery.supply.shortage_rate",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.supply",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.supply.supplier_id",)),
                    ("allowed_dimensions", ("delivery.supply.supply_category",)),
                    ("allowed_metrics", ("delivery.supply.shortage_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.supply",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.supply.supplier_id",)),
                    ("allowed_dimensions", ("delivery.supply.supply_category",)),
                    ("allowed_metrics", ("delivery.supply.shortage_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.supply",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.supply.supplier_id",)),
                    ("allowed_dimensions", ("delivery.supply.supply_category",)),
                    ("allowed_metrics", ("delivery.supply.shortage_rate",)),
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
