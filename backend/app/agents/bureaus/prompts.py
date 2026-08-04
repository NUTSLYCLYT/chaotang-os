"""Prompt construction for the data-driven bureau-level agent."""

from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, Any

from app.agents.bureaus.profiles import bureau_profile_for
from app.agents.ministries.prompts import NO_IRREVERSIBLE_ACTION_CONSTRAINT

if TYPE_CHECKING:
    from app.agents.runtime_skills.models import RuntimeSkillDefinition
    from app.agents.runtime_skills.tool_models import BureauToolPolicy


def policy_projected_tool_descriptors(
    policy: BureauToolPolicy,
) -> tuple[dict[str, Any], ...]:
    """Expose only model-safe capabilities authorized by the current policy."""

    from app.agents.runtime_skills.tool_registry import tool_descriptor_for

    projected = []
    for tool_name in sorted(policy.allowed_tools, key=lambda item: item.value):
        descriptor = tool_descriptor_for(tool_name)
        projected.append(
            {
                "tool_name": tool_name.value,
                "input_schema": descriptor.input_schema_id,
                "result_schema": descriptor.output_schema_id,
                "operations": list(policy.tool_operations[tool_name]),
                "argument_constraints": deepcopy(
                    policy.tool_argument_constraints[tool_name]
                ),
                "max_result_rows": min(policy.max_result_rows, descriptor.max_result_rows),
                "max_result_bytes": min(policy.max_result_bytes, descriptor.max_result_bytes),
            }
        )
    return tuple(projected)


def capability_prompt_section(department: str, bureau: str) -> str:
    """Render legacy packages for callers that have not migrated yet."""

    from app.agents.bureaus.capabilities import capability_profiles_for

    profiles = capability_profiles_for(department, bureau)
    if not profiles:
        return "No special capability packages are assigned to this bureau."
    packages = []
    for profile in profiles:
        packages.append(
            f"用途：{profile.purpose}\n"
            f"交付物：{'；'.join(profile.deliverables)}\n"
            f"护栏：{'；'.join(profile.guardrails)}"
        )
    return "专属能力包约束如下：\n" + "\n\n".join(packages)


def bureau_runtime_skill_for(department: str, bureau: str) -> RuntimeSkillDefinition:
    """Resolve the one enabled Runtime Skill for a validated bureau identity."""

    bureau_profile_for(department, bureau)
    # Local import avoids the registry -> bureau package initialization cycle.
    from app.agents.runtime_skills.registry import (
        build_default_downstream_skill_registry,
        bureau_agent_id,
    )

    return build_default_downstream_skill_registry().get_by_agent(
        bureau_agent_id(department, bureau)
    )


def runtime_skill_prompt_section(skill: RuntimeSkillDefinition) -> str:
    """Render only the selected Skill's bounded professional method."""

    from app.agents.bureaus.capabilities import capability_analysis_modes_for_skill

    section = (
        f"运行时 Skill：{skill.skill_id}（版本 {skill.version}）\n"
        f"专业目的：{skill.purpose}\n"
        f"所需材料：{'；'.join(skill.data_requirements)}\n"
        f"分析步骤：{'；'.join(skill.analysis_procedure)}\n"
        f"必需发现：{'；'.join(skill.required_findings)}\n"
        f"禁止事项：{'；'.join(skill.forbidden_actions)}"
    )
    modes = capability_analysis_modes_for_skill(skill.skill_id)
    if not modes:
        return section

    mode_lines = [
        f"- {mode.capability_id}: {mode.purpose} Deliverables: {'; '.join(mode.deliverables)}"
        for mode in modes
    ]
    guardrails = tuple(dict.fromkeys(guardrail for mode in modes for guardrail in mode.guardrails))
    rendered_modes = "\n".join(mode_lines)
    return (
        f"{section}\n兼容分析模式（均受本 Runtime Skill 约束）：\n"
        f"{rendered_modes}\n"
        f"兼容模式护栏：{'; '.join(guardrails)}"
    )


def bureau_system_prompt(
    department: str,
    bureau: str,
    *,
    evidence_session: bool = False,
    runtime_skill: RuntimeSkillDefinition | None = None,
) -> str:
    """Build the prompt for one validated ``(department, bureau)`` identity."""

    profile = bureau_profile_for(department, bureau)
    bound_skill = bureau_runtime_skill_for(department, bureau)
    selected_skill = runtime_skill or bound_skill
    if selected_skill != bound_skill:
        raise ValueError("Runtime Skill does not match the bureau identity.")
    responsibilities = "、".join(profile.responsibilities)
    skill_section = runtime_skill_prompt_section(selected_skill)
    prompt = (
        f"你是{profile.department}下属的{profile.bureau}。\n"
        f"你的完整职责范围是：{responsibilities}。\n"
        "你只能在上述职责范围内分析旨意与部级路由判断，给出可追溯的专业建议；"
        "不得虚构事实、越权代替其他部门或司决策，也不得声称现实动作已经完成；"
        "不得自动执行任何 HR、财务、销售、法务或交付动作。\n\n"
        f"{skill_section}\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}"
    )
    if evidence_session:
        return prompt
    return (
        f"{prompt}\n\n"
        "你必须只输出一个严格 JSON 对象，不附带其他文字或 markdown；字段必须恰为 "
        '"opinion"、"analysis"、"professional_findings"、"risks"、'
        '"recommendations"、"out_of_scope_items"。opinion 为非空字符串，其余字段均为'
        "互不重复的非空字符串数组；内容只能进入其真实对应分区，不得跨区复制。若必要数据"
        "不足，analysis、professional_findings、risks 必须为空，仅在 recommendations "
        "中给出受控补数建议。兼容期可接受仅含 opinion 的旧响应，但会被标记为降级。"
    )
