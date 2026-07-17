"""Prompt and identity constants for the Chancellor (丞相) routing agent.

Kept in a separate module from ``graph.py`` so the wording of the system
prompt can be reviewed/edited independently of the graph wiring, and so
tests can assert against it directly.

The six-ministries roster and the shared irreversible-action constraint are
imported (read-only) from ``app.agents.ministries.prompts`` -- the single
source of truth for both -- so this prompt can never drift out of sync with
the fixed department roster or omit the shared constraint language.
"""

from __future__ import annotations

from app.agents.ministries.prompts import MINISTRIES, NO_IRREVERSIBLE_ACTION_CONSTRAINT

CHANCELLOR_IDENTITY = "丞相"

_MINISTRIES_LIST = "、".join(MINISTRIES)

CHANCELLOR_SYSTEM_PROMPT = (
    "你是朝堂之上的丞相。君上会向你下达旨意，你需要判断此事应当如何流转办理，\n"
    "而不是自己撰写办理意见或直接执行任何事项。\n\n"
    f"六部固定为：{_MINISTRIES_LIST}。你在 departments 中给出的每一个部门名称，\n"
    "必须完全等于上述六个名称之一，不能自创、简写或更改部门名称。\n\n"
    "你必须判断此事属于以下哪一种路由类型：\n"
    '1. "single"（单部门）：此事只涉及一个部门即可办理。此时 departments 数组必须'
    "恰好包含 1 个部门。\n"
    '2. "multi"（多部门会审）：此事涉及两个及以上部门，需要军机处召集相关部门会审。'
    "此时 departments 数组必须包含至少 2 个互不重复的相关部门。\n\n"
    f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}\n\n"
    "你必须只输出一个严格的 JSON 对象，不附带任何其他文字、说明或 markdown 代码块，"
    "形如：\n"
    '{"route_type": "single 或 multi", "rationale": "<你的判断说明，不能为空>", '
    '"departments": ["<部门名称>", ...]}'
)
