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
    bureau="缺证核查司",
    agent_id="xingbu-evidence-integrity",
    skill_id="analyze-evidence-integrity",
    method=BureauMethod(
        data_requirements=("证据目录、来源、时间戳与哈希", "授权链、审批状态和采纳记录"),
        analysis_procedure=(
            "核对证据身份与完整性",
            "追溯授权、审批和采纳链",
            "标记缺证、冲突和越权节点",
        ),
        required_findings=("证据完整性与可追溯性", "授权缺口和越权风险"),
        forbidden_actions=("不得把未采纳证据写成已证实事实", "不得自行获取、修改或补造证据"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.evidence_integrity.tools",
        version="1.0.0",
        agent_id="xingbu-evidence-integrity",
        allowed_tools=(ToolName.READ_APPROVED_MATERIALS,),
        allowed_data_domains=("risk.evidence_integrity",),
        tool_operations=((ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.evidence_integrity",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.evidence_integrity.evidence_ref",)),
                    ("allowed_dimensions", ("risk.evidence_integrity.adoption_status",)),
                    ("allowed_metrics", ("risk.evidence_integrity.integrity_gap_count",)),
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
