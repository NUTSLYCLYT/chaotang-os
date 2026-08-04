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
    bureau="协同司",
    agent_id="libu-coordination",
    skill_id="analyze-workforce-coordination",
    method=BureauMethod(
        data_requirements=("任务清单、责任人与期限", "跨司依赖、催办和状态变更记录"),
        analysis_procedure=(
            "绘制责任与依赖链",
            "识别卡点、逾期和等待方",
            "按优先级形成催办与升级计划",
        ),
        required_findings=("关键路径卡点", "责任空缺与逾期影响"),
        forbidden_actions=("不得将未确认进度标为完成", "不得越权重分配责任人"),
    ),
    tool_policy=BureauToolPolicySpec(
        policy_id="bureau.libu.coordination.tools",
        version="1.0.0",
        agent_id="libu-coordination",
        allowed_tools=(
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
        ),
        allowed_data_domains=("workforce.coordination",),
        tool_operations=(
            (ToolName.READ_APPROVED_MATERIALS, ("read_summary", "lookup_section")),
            (ToolName.INSPECT_APPROVED_DATA, ("filter", "aggregate", "compare", "top_n")),
            (ToolName.COMPUTE_ANALYSIS, ("difference", "trend", "threshold")),
        ),
        tool_argument_constraints=(
            (
                ToolName.READ_APPROVED_MATERIALS,
                (
                    ("allowed_domains", ("workforce.coordination",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.coordination.task_id",)),
                    ("allowed_dimensions", ("workforce.coordination.owner",)),
                    ("allowed_metrics", ("workforce.coordination.overdue_count",)),
                ),
            ),
            (
                ToolName.INSPECT_APPROVED_DATA,
                (
                    ("allowed_domains", ("workforce.coordination",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.coordination.task_id",)),
                    ("allowed_dimensions", ("workforce.coordination.owner",)),
                    ("allowed_metrics", ("workforce.coordination.overdue_count",)),
                ),
            ),
            (
                ToolName.COMPUTE_ANALYSIS,
                (
                    ("allowed_domains", ("workforce.coordination",)),
                    ("operation_required", True),
                    ("approved_refs_only", True),
                    ("allowed_fields", ("workforce.coordination.task_id",)),
                    ("allowed_dimensions", ("workforce.coordination.owner",)),
                    ("allowed_metrics", ("workforce.coordination.overdue_count",)),
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
