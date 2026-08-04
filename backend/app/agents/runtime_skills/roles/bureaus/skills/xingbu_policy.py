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
    bureau="制度司",
    agent_id="xingbu-policy",
    skill_id="analyze-legal-policy",
    method=BureauMethod(
        data_requirements=("法律制度、处罚规则与生效版本", "业务事实、整改记录和豁免依据"),
        analysis_procedure=(
            "确认适用制度与法域",
            "比对行为、处罚条件和整改要求",
            "评估豁免条件及剩余风险",
        ),
        required_findings=("制度违反与处罚暴露", "整改路径和豁免条件"),
        forbidden_actions=("不得引用废止规则或虚构豁免", "不得代替主管机关作出处罚结论"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.xingbu.policy.tools",
        version="1.0.0",
        agent_id="xingbu-policy",
        allowed_tools=(
            ToolName.REQUEST_EVIDENCE,
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("risk.legal_policy",),
        tool_operations=(
            (ToolName.REQUEST_EVIDENCE, ("request_fact_slots",)),
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("describe", "compare", "lookup")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.REQUEST_EVIDENCE,
                (
                    ("allowed_domains", ("risk.legal_policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", False),
                    ("allowed_fields", ("risk.legal_policy.rule_id",)),
                    ("allowed_dimensions", ("risk.legal_policy.effective_period",)),
                    ("allowed_metrics", ("risk.legal_policy.conflict_count",)),
                ),
            ),
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("risk.legal_policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.legal_policy.rule_id",)),
                    ("allowed_dimensions", ("risk.legal_policy.effective_period",)),
                    ("allowed_metrics", ("risk.legal_policy.conflict_count",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("risk.legal_policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.legal_policy.rule_id",)),
                    ("allowed_dimensions", ("risk.legal_policy.effective_period",)),
                    ("allowed_metrics", ("risk.legal_policy.conflict_count",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("risk.legal_policy",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("risk.legal_policy.rule_id",)),
                    ("allowed_dimensions", ("risk.legal_policy.effective_period",)),
                    ("allowed_metrics", ("risk.legal_policy.conflict_count",)),
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
