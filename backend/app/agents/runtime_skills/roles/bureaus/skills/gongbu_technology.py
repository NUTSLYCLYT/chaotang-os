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
    bureau="技术司",
    agent_id="gongbu-technology",
    skill_id="analyze-technical-feasibility",
    method=BureauMethod(
        data_requirements=("架构、接口、依赖与运行约束", "容量、安全、成本和技术债数据"),
        analysis_procedure=(
            "建立当前系统与约束基线",
            "验证方案可行性和依赖路径",
            "评估故障、安全、成本与迁移风险",
        ),
        required_findings=("技术可行性与关键依赖", "架构风险和技术债影响"),
        forbidden_actions=("不得声称未验证方案可上线", "不得部署、改生产或暴露凭证"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.technology.tools",
        version="1.0.0",
        agent_id="gongbu-technology",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.technology",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("percentage", "threshold", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("delivery.technology",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("delivery.technology.component_id",)),
                    ("allowed_dimensions", ("delivery.technology.lifecycle_stage",)),
                    ("allowed_metrics", ("delivery.technology.failure_rate",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.technology",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.technology.component_id",)),
                    ("allowed_dimensions", ("delivery.technology.lifecycle_stage",)),
                    ("allowed_metrics", ("delivery.technology.failure_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.technology",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.technology.component_id",)),
                    ("allowed_dimensions", ("delivery.technology.lifecycle_stage",)),
                    ("allowed_metrics", ("delivery.technology.failure_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.technology",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.technology.component_id",)),
                    ("allowed_dimensions", ("delivery.technology.lifecycle_stage",)),
                    ("allowed_metrics", ("delivery.technology.failure_rate",)),
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
