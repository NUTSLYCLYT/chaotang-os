"""Prompt and identity constants for the 军机处 (Grand Council) agent.

军机处 is only invoked on the ``"multi"`` routing path, after the Chancellor
has selected at least two departments and every one of them has already
produced its own opinion (via
``app.agents.ministries.agent.invoke_ministry_agent``, called once per
department, in order, by ``app.agents.junjichu.agent.run_junjichu_council``).
军机处's own model turn is the last call in that sequence: it is given every
department's opinion and must produce a single, final, non-empty council
verdict.

The shared irreversible-action constraint is imported (read-only) from
``app.agents.ministries.prompts`` -- the single source of truth for it -- so
this prompt can never drift out of sync with the six-ministries-facing
wording (see ``docs/product/tasks/2026-07-17-decree-six-ministries-joint-
review.md``, Acceptance Criteria: "六部与军机处使用清晰、可审计的专用角色提示词,
不声称尚未发生的现实执行已经完成").

This module has no dependency on ``app.agents.chancellor`` -- like
``app.agents.ministries.agent``, it is a leaf module with respect to the
Chancellor graph (``app.agents.chancellor.graph`` imports from here, not the
other way around), so importing it at module scope never risks an import
cycle.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.agents.ministries.prompts import NO_IRREVERSIBLE_ACTION_CONSTRAINT

JUNJICHU_IDENTITY = "军机处"


def junjichu_system_prompt(departments: Sequence[str]) -> str:
    """Return the system prompt for 军机处's council-verdict model turn.

    Args:
        departments: The ordered list of departments the Chancellor called
            in for this multi-department decree (already validated
            upstream; this function does not re-validate membership in the
            fixed six-ministries roster or minimum count).

    Returns:
        A system prompt establishing 军机处's identity/role, the consulted
        departments, the shared ``NO_IRREVERSIBLE_ACTION_CONSTRAINT``, and
        the required strict JSON output contract
        (``{"verdict": "<non-empty council verdict text>"}``).
    """
    departments_list = "、".join(departments)
    return (
        f"你是{JUNJICHU_IDENTITY}。此事涉及多个部门（{departments_list}），"
        "丞相已判断需要军机处召集相关部门会审，而不是交由单一部门自行办理。\n\n"
        "你会收到旨意、丞相的判断说明，以及每个被召集部门的全部有序司级意见和独立部级补充意见。\n"
        "请你以军机处的身份，讨论并综合全部分层意见，形成一个统一的会审结论，\n"
        "而不是简单重复某一个部门的意见，也不要遗漏任何部门已经提出的关切。\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}\n\n"
        "你必须只输出一个严格的 JSON 对象，不附带任何其他文字、说明或 markdown 代码块。"
        "对象必须且只能包含 verdict、consensus、disagreements、cross_ministry_dependencies、"
        "joint_options、matters_for_chancellor_decision 六个字段；verdict 必须是非空字符串，"
        "其余字段必须是字符串数组，没有事项时返回空数组。必须保留真实分歧、依赖和待丞相裁决事项。"
        "不得把 verdict 复制到任何数组字段，也不得在同一字段内或不同数组字段之间复制同一事项。"
        "旧版只包含 verdict 字段的对象仅用于兼容，运行时会明确降级。"
    )
