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
    bureau="知识产权司",
    agent_id="xingbu-intellectual-property",
    skill_id="analyze-intellectual-property",
    method=BureauMethod(
        data_requirements=("作品、代码、商标或专利清单", "创作记录、合同、授权范围和期限"),
        analysis_procedure=(
            "识别权利客体与权属链",
            "核对授权地域、期限和使用方式",
            "筛查侵权暴露并制定保护动作",
        ),
        required_findings=("权属或授权缺口", "侵权暴露和保护优先级"),
        forbidden_actions=("不得在权属未清时保证可使用", "不得代办注册、许可或维权行动"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.intellectual_property.tools",
        version="1.0.0",
        agent_id="xingbu-intellectual-property",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("risk.intellectual_property",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("risk.intellectual_property",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("risk.intellectual_property.asset_id",)),
                    ("allowed_dimensions", ("risk.intellectual_property.right_type",)),
                    ("allowed_metrics", ("risk.intellectual_property.exposure_count",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.intellectual_property",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.intellectual_property.asset_id",)),
                    ("allowed_dimensions", ("risk.intellectual_property.right_type",)),
                    ("allowed_metrics", ("risk.intellectual_property.exposure_count",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("risk.intellectual_property",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.intellectual_property.asset_id",)),
                    ("allowed_dimensions", ("risk.intellectual_property.right_type",)),
                    ("allowed_metrics", ("risk.intellectual_property.exposure_count",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("risk.intellectual_property",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.intellectual_property.asset_id",)),
                    ("allowed_dimensions", ("risk.intellectual_property.right_type",)),
                    ("allowed_metrics", ("risk.intellectual_property.exposure_count",)),
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
