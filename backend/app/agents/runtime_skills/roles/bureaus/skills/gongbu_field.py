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
    bureau="现场司",
    agent_id="gongbu-field",
    skill_id="analyze-field-conditions",
    method=BureauMethod(
        data_requirements=("现场记录、照片、日志与时间地点", "客户反馈、处置单和进度证据"),
        analysis_procedure=(
            "校验现场材料来源和时序",
            "还原事实、影响和已采取动作",
            "识别待处置项与回访验证点",
        ),
        required_findings=("现场事实与影响范围", "处置进度和证据缺口"),
        forbidden_actions=("不得远程臆测未记录的现场事实", "不得代替现场负责人确认完工"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.field.tools",
        version="1.0.0",
        agent_id="gongbu-field",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("delivery.field",),
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
                    ("allowed_domains", ("delivery.field",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("delivery.field.site_id",)),
                    ("allowed_dimensions", ("delivery.field.work_stage",)),
                    ("allowed_metrics", ("delivery.field.completion_variance",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.field",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.field.site_id",)),
                    ("allowed_dimensions", ("delivery.field.work_stage",)),
                    ("allowed_metrics", ("delivery.field.completion_variance",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("delivery.field",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.field.site_id",)),
                    ("allowed_dimensions", ("delivery.field.work_stage",)),
                    ("allowed_metrics", ("delivery.field.completion_variance",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("delivery.field",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.field.site_id",)),
                    ("allowed_dimensions", ("delivery.field.work_stage",)),
                    ("allowed_metrics", ("delivery.field.completion_variance",)),
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
