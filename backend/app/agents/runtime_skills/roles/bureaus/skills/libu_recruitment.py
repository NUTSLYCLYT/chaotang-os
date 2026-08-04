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
    bureau="招聘司",
    agent_id="libu-recruitment",
    skill_id="analyze-recruitment-pipeline",
    method=BureauMethod(
        data_requirements=("岗位编制、画像与到岗期限", "候选人漏斗、面试评分与来源记录"),
        analysis_procedure=(
            "核验招聘需求和编制",
            "按阶段分析候选人漏斗与面试证据",
            "定位转化瓶颈并排列推进动作",
        ),
        required_findings=("候选人匹配与面试偏差", "漏斗瓶颈及到岗风险"),
        forbidden_actions=("不得虚构候选人资历或面试结论", "不得绕过招聘审批或作出录用承诺"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.recruitment.tools",
        version="1.0.0",
        agent_id="libu-recruitment",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.recruitment",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("percentage", "share", "trend")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.recruitment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.recruitment.candidate_id",)),
                    ("allowed_dimensions", ("workforce.recruitment.candidate_stage",)),
                    ("allowed_metrics", ("workforce.recruitment.conversion_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.recruitment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.recruitment.candidate_id",)),
                    ("allowed_dimensions", ("workforce.recruitment.candidate_stage",)),
                    ("allowed_metrics", ("workforce.recruitment.conversion_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.recruitment",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.recruitment.candidate_id",)),
                    ("allowed_dimensions", ("workforce.recruitment.candidate_stage",)),
                    ("allowed_metrics", ("workforce.recruitment.conversion_rate",)),
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
