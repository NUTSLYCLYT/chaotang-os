"""Prompt construction for the data-driven bureau-level agent."""

from __future__ import annotations

from app.agents.bureaus.capabilities import capability_profiles_for
from app.agents.bureaus.profiles import bureau_profile_for
from app.agents.ministries.prompts import NO_IRREVERSIBLE_ACTION_CONSTRAINT


def capability_prompt_section(department: str, bureau: str) -> str:
    """Render the static capability packages for one validated bureau identity."""

    profiles = capability_profiles_for(department, bureau)
    if not profiles:
        return "No special capability packages are assigned to this bureau."

    packages = []
    for profile in profiles:
        deliverables = "；".join(profile.deliverables)
        guardrails = "；".join(profile.guardrails)
        packages.append(
            f"用途：{profile.purpose}\n"
            f"交付物：{deliverables}\n"
            f"护栏：{guardrails}"
        )
    return "专属能力包约束：\n" + "\n\n".join(packages)


def bureau_system_prompt(
    department: str,
    bureau: str,
    *,
    evidence_session: bool = False,
) -> str:
    """Build the prompt for one validated ``(department, bureau)`` identity."""

    profile = bureau_profile_for(department, bureau)
    responsibilities = "、".join(profile.responsibilities)
    capability_section = capability_prompt_section(department, bureau)
    prompt = (
        f"你是{profile.department}下属的{profile.bureau}。\n"
        f"你的完整职责范围是：{responsibilities}。\n"
        "你只能在上述职责范围内分析旨意与部级路由判断，给出可追溯的专业建议；"
        "不得虚构事实、越权代替其他部门或司决策，也不得声称现实动作已经完成；"
        "不得自动执行任何 HR、财务、销售、法务或交付动作。\n\n"
        f"{capability_section}\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}"
    )
    if evidence_session:
        return prompt
    return (
        f"{prompt}\n\n"
        "你必须只输出一个严格的 JSON 对象，不附带其他文字、说明或 markdown 代码块，"
        '且只能包含形如 {"opinion": "<本司非空专业意见>"} 的 opinion 字段。'
    )
