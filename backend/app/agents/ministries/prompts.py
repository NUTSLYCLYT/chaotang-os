"""Prompt and identity constants for the six ministries (六部) agent.

``MINISTRIES`` is the single source of truth for the fixed six-ministries
roster: every other module in this repository (the Chancellor's routing
validation, the 军机处/junjichu council, and any future HTTP or
frontend contract) must import it from here rather than re-declaring the
department names.

This module has no dependency on ``app.agents.chancellor`` or
``app.agents.structured_output`` -- it is a leaf module so that
``app.agents.chancellor.graph`` can safely import ``MINISTRIES`` from here at
module scope without risking an import cycle (see the module docstring of
``app.agents.ministries.agent`` for the cycle this deliberately avoids).
"""

from __future__ import annotations

MINISTRIES: tuple[str, ...] = ("吏部", "户部", "礼部", "兵部", "刑部", "工部")

# Shared constraint language every department-facing (and, eventually,
# 军机处-facing) prompt must include: the model must never claim it has
# already carried out an irreversible real-world governance action.
NO_IRREVERSIBLE_ACTION_CONSTRAINT = (
    "你绝不能声称自己已经真实执行了任何尚未发生的、不可逆的现实政务动作"
    "（例如调兵、任免、行刑、拨款、颁布政令等）——你只能在意见中提出办理建议，"
    "一切不可逆操作必须等待君上与相关部门进一步明确许可后，才能真正执行。"
)

_MINISTRY_RESPONSIBILITIES: dict[str, str] = {
    "吏部": "官员选拔、考核、任免建议与官制事务",
    "户部": "户籍、田赋、财政收支与钱粮调度事务",
    "礼部": "典礼、科举、教化与外交礼仪事务",
    "兵部": "军队调度建议、武官铨选与边防军务事务",
    "刑部": "律法、刑狱、案件审理与司法事务",
    "工部": "工程营造、水利、屯田与器械制造事务",
}


def ministry_system_prompt(department: str) -> str:
    """Return the department-specific system prompt for ``department``.

    Args:
        department: One of the six fixed ``MINISTRIES`` names.

    Returns:
        A system prompt establishing ``department``'s identity/
        responsibilities, the shared ``NO_IRREVERSIBLE_ACTION_CONSTRAINT``,
        and the required strict JSON output contract
        (``{"opinion": "<non-empty opinion text>"}``).

    Raises:
        ValueError: ``department`` is not one of ``MINISTRIES``.
    """
    if department not in _MINISTRY_RESPONSIBILITIES:
        raise ValueError(f"Unknown ministry department: {department!r}")
    responsibility = _MINISTRY_RESPONSIBILITIES[department]
    return (
        f"你是{department}，职掌{responsibility}。君上已下旨意，丞相已完成初步判断，\n"
        f"并将此事交由你部办理。请以{department}的身份，针对旨意与丞相的判断说明，\n"
        "给出你部的办理意见。\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}\n\n"
        "你必须只输出一个严格的 JSON 对象，不附带任何其他文字、说明或 markdown 代码块，"
        '形如：{"opinion": "<你部的办理意见，不能为空>"}'
    )
