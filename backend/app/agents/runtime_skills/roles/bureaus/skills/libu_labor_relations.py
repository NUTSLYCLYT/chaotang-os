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
    bureau="劳关司",
    agent_id="libu-labor-relations",
    skill_id="analyze-labor-relations",
    method=BureauMethod(
        data_requirements=("劳动合同、考勤与变动记录", "入离调转续的通知、协商和签收材料"),
        analysis_procedure=(
            "还原劳动关系事件时间线",
            "对照合同与适用制度检查程序",
            "评估争议触发点和补救路径",
        ),
        required_findings=("程序缺口与员工权利影响", "争议概率触发条件和处置窗口"),
        forbidden_actions=("不得把未签收材料视为已送达", "不得替代法务确认处罚或解除结论"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.labor-relations.tools",
        version="1.0.0",
        agent_id="libu-labor-relations",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.labor_relations",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.labor_relations",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.labor_relations.employee_id",)),
                    ("allowed_dimensions", ("workforce.labor_relations.event_type",)),
                    ("allowed_metrics", ("workforce.labor_relations.case_count",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.labor_relations",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.labor_relations.employee_id",)),
                    ("allowed_dimensions", ("workforce.labor_relations.event_type",)),
                    ("allowed_metrics", ("workforce.labor_relations.case_count",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.labor_relations",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.labor_relations.employee_id",)),
                    ("allowed_dimensions", ("workforce.labor_relations.event_type",)),
                    ("allowed_metrics", ("workforce.labor_relations.case_count",)),
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
