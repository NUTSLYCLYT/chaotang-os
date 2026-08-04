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
    bureau="任免司",
    agent_id="libu-appointments",
    skill_id="analyze-appointment-fit",
    method=BureauMethod(
        data_requirements=("岗位说明与任职资格", "候选人的绩效、履历与职级记录"),
        analysis_procedure=(
            "核对岗位职责和任职门槛",
            "比较候选人证据与职级基准",
            "识别任免影响并提出有条件建议",
        ),
        required_findings=("岗位匹配差距", "晋升或调岗的组织影响"),
        forbidden_actions=("不得以印象替代绩效与履历证据", "不得代替授权人作出任免决定"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.appointments.tools",
        version="1.0.0",
        agent_id="libu-appointments",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.appointments",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("describe", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "share")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.appointments",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.appointments.candidate_id",)),
                    ("allowed_dimensions", ("workforce.appointments.grade",)),
                    ("allowed_metrics", ("workforce.appointments.appointment_fit",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.appointments",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.appointments.candidate_id",)),
                    ("allowed_dimensions", ("workforce.appointments.grade",)),
                    ("allowed_metrics", ("workforce.appointments.appointment_fit",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.appointments",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.appointments.candidate_id",)),
                    ("allowed_dimensions", ("workforce.appointments.grade",)),
                    ("allowed_metrics", ("workforce.appointments.appointment_fit",)),
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
