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
    bureau="承诺司",
    agent_id="gongbu-commitments",
    skill_id="analyze-commitment-fulfillment",
    method=BureauMethod(
        data_requirements=("客户承诺文本、来源与授权记录", "责任人、期限、兑现状态和交付证据"),
        analysis_procedure=(
            "识别承诺内容与授权边界",
            "核对责任、期限和兑现证据",
            "评估缺口影响并制定补救升级",
        ),
        required_findings=("承诺兑现差距", "授权来源和逾期影响"),
        forbidden_actions=("不得把未授权表述升级为公司承诺", "不得新增、修改或对外确认承诺"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.gongbu.commitments.tools",
        version="1.0.0",
        agent_id="gongbu-commitments",
        allowed_tools=(ToolName.READ_APPROVED_MATERIALS,),
        allowed_data_domains=("delivery.commitments",),
        tool_operations=((ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("delivery.commitments",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("delivery.commitments.commitment_id",)),
                    ("allowed_dimensions", ("delivery.commitments.commitment_status",)),
                    ("allowed_metrics", ("delivery.commitments.overdue_count",)),
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
