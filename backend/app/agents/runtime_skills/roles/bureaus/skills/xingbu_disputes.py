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
    bureau="争议处置司",
    agent_id="xingbu-disputes",
    skill_id="analyze-dispute-resolution",
    method=BureauMethod(
        data_requirements=("双方陈述、诉求与事件时间线", "合同、沟通、损失和证据清单"),
        analysis_procedure=(
            "重建无评价的事实链",
            "比较双方诉求与证据强弱",
            "评估处置选项、成本和升级条件",
        ),
        required_findings=("争议焦点与证据强弱", "处置选项及升级风险"),
        forbidden_actions=("不得隐去对任一方不利的事实", "不得承诺和解金额或法律结果"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.disputes.tools",
        version="1.0.0",
        agent_id="xingbu-disputes",
        allowed_tools=(ToolName.READ_APPROVED_MATERIALS,),
        allowed_data_domains=("risk.disputes",),
        tool_operations=((ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.disputes",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.disputes.dispute_id",)),
                    ("allowed_dimensions", ("risk.disputes.dispute_stage",)),
                    ("allowed_metrics", ("risk.disputes.claim_exposure",)),
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
