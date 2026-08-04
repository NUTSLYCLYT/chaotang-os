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
    bureau="合规稽查司",
    agent_id="xingbu-compliance",
    skill_id="analyze-compliance-posture",
    method=BureauMethod(
        data_requirements=("适用法规、内部规则与控制清单", "业务样本、审批证据和整改记录"),
        analysis_procedure=(
            "确定适用规则和检查范围",
            "按控制点抽样并记录证据",
            "分级问题并验证整改闭环",
        ),
        required_findings=("合规偏差与风险等级", "整改责任和复核条件"),
        forbidden_actions=("不得在规则不明时作合规保证", "不得删除或改写稽查证据"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.compliance.tools",
        version="1.0.0",
        agent_id="xingbu-compliance",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("risk.compliance",),
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
                    ("allowed_domains", ("risk.compliance",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("risk.compliance.control_id",)),
                    ("allowed_dimensions", ("risk.compliance.risk_level",)),
                    ("allowed_metrics", ("risk.compliance.noncompliance_rate",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.compliance",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.compliance.control_id",)),
                    ("allowed_dimensions", ("risk.compliance.risk_level",)),
                    ("allowed_metrics", ("risk.compliance.noncompliance_rate",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("risk.compliance",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.compliance.control_id",)),
                    ("allowed_dimensions", ("risk.compliance.risk_level",)),
                    ("allowed_metrics", ("risk.compliance.noncompliance_rate",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("risk.compliance",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.compliance.control_id",)),
                    ("allowed_dimensions", ("risk.compliance.risk_level",)),
                    ("allowed_metrics", ("risk.compliance.noncompliance_rate",)),
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
