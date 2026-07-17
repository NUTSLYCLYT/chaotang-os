"""Enterprise positioning and prompts for the six ministries (六部) agent.

``MINISTRY_POSITIONINGS`` is the sole source of truth for both the fixed
six-ministries roster and their enterprise responsibilities. The Chancellor,
军机处/junjichu, and ministry agents must derive roster or routing semantics
from this module rather than re-declaring them.

This module remains a leaf: it has no dependency on
``app.agents.chancellor`` or ``app.agents.structured_output``, avoiding an
import cycle when the Chancellor graph imports the fixed roster.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MinistryPositioning:
    """Immutable enterprise responsibility definition for one ministry."""

    department: str
    positioning: str
    inputs: tuple[str, ...]
    memorial_goal: str


MINISTRY_POSITIONINGS: tuple[MinistryPositioning, ...] = (
    MinistryPositioning(
        department="吏部",
        positioning="组织招聘干部台",
        inputs=("责任人", "组织能力", "绩效偏差", "干部风险"),
        memorial_goal="人事奏折",
    ),
    MinistryPositioning(
        department="户部",
        positioning="财务决策中台",
        inputs=("现金流", "预算", "报价", "融资", "审计", "投资研究"),
        memorial_goal="可追溯的财务奏折",
    ),
    MinistryPositioning(
        department="礼部",
        positioning="品牌与对外沟通中台",
        inputs=("品牌", "客户沟通", "公关", "内容", "体验"),
        memorial_goal="稳妥的对外奏折",
    ),
    MinistryPositioning(
        department="兵部",
        positioning="销售竞争作战台",
        inputs=("客户", "商机", "渠道", "竞争", "增长漏斗"),
        memorial_goal="可执行的攻防奏折",
    ),
    MinistryPositioning(
        department="刑部",
        positioning="法务风控案件台",
        inputs=("合同", "合规", "授权", "安全", "争议"),
        memorial_goal="有红线的风控奏折",
    ),
    MinistryPositioning(
        department="工部",
        positioning="研发交付流水线",
        inputs=("产品", "技术", "交付", "供应链", "产能", "质量"),
        memorial_goal="可验收的交付奏折",
    ),
)

MINISTRIES: tuple[str, ...] = tuple(positioning.department for positioning in MINISTRY_POSITIONINGS)

_POSITIONING_BY_DEPARTMENT: dict[str, MinistryPositioning] = {
    positioning.department: positioning for positioning in MINISTRY_POSITIONINGS
}

# Shared constraint language for ministry, Chancellor, and 军机处 prompts.
# The model may advise, but it cannot claim or trigger real enterprise actions.
NO_IRREVERSIBLE_ACTION_CONSTRAINT = (
    "你绝不能声称自己已经真实执行、批准或完成任何尚未发生的现实企业动作，"
    "也不得触发或要求调用任何工具来执行这些动作（例如付款、任免、对外发布、签约、"
    "销售承诺或生产部署等）。你只能提出专业建议；一切现实操作必须等待君上与相关部门"
    "进一步明确许可后，才能真正执行。"
)


def _positioning_for(department: str) -> MinistryPositioning:
    try:
        return _POSITIONING_BY_DEPARTMENT[department]
    except KeyError as exc:
        raise ValueError(f"Unknown ministry department: {department!r}") from exc


def _responsibility_summary(positioning: MinistryPositioning) -> str:
    inputs = f"{'、'.join(positioning.inputs[:-1])}和{positioning.inputs[-1]}"
    return f"把{inputs}转成{positioning.memorial_goal}"


def ministry_routing_guide() -> str:
    """Return the Chancellor's routing guide derived from the positioning data."""

    return "\n".join(
        f"- {item.department}：部定位为{item.positioning}；{_responsibility_summary(item)}。"
        for item in MINISTRY_POSITIONINGS
    )


def ministry_system_prompt(department: str) -> str:
    """Return the enterprise-positioned system prompt for ``department``.

    Raises:
        ValueError: ``department`` is not one of ``MINISTRIES``.
    """

    positioning = _positioning_for(department)
    # Imported lazily because bureau prompts reuse the shared ministry safety
    # constraint; keeping this dependency inside the builder avoids a package
    # initialization cycle while retaining a single bureau registry.
    from app.agents.bureaus.profiles import bureau_profiles_for

    bureau_lines = "\n".join(
        f"- {profile.bureau}：{'、'.join(profile.responsibilities)}。"
        for profile in bureau_profiles_for(department)
    )
    responsibility = _responsibility_summary(positioning)
    return (
        f"你是{department}，部定位：{positioning.positioning}；{responsibility}。\n"
        "君上已下达企业经营旨意，丞相已完成初步判断并将此事交由你部办理。\n"
        f"请以{department}的专业职责为边界，基于旨意与丞相的判断说明，"
        "从下列已全部开放的本部司中选择一个或多个相关司：\n"
        f"{bureau_lines}\n"
        "只能选择上列本部司，不得选择未知司、跨部司或重复司；"
        "按应当办理的先后顺序排列。\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}\n\n"
        "你必须只输出一个严格的 JSON 对象，不附带任何其他文字、说明或 markdown 代码块，"
        "且只能包含非空 rationale 字符串与非空 bureaus 字符串数组，"
        '形如：{"rationale": "<本部司级路由判断，不能为空>", '
        '"bureaus": ["<本部司名>"]}'
    )


def ministry_synthesis_system_prompt(department: str) -> str:
    """Return the strict prompt for the ministry's independent synthesis step.

    This is intentionally separate from :func:`ministry_system_prompt`: the
    first model call chooses bureaus, while this later call must consider all
    collected bureau evidence and add a genuine ministry-level judgement.

    Raises:
        ValueError: ``department`` is not one of ``MINISTRIES``.
    """

    positioning = _positioning_for(department)
    responsibility = _responsibility_summary(positioning)
    return (
        f"你是{department}，部定位：{positioning.positioning}；{responsibility}。\n"
        "本部相关司已经按顺序分别给出独立意见。你现在必须站在部级职责与整体经营结果的"
        "角度，审阅全部司级意见，补充跨司取舍、优先级、风险边界与可执行建议，形成一次新的"
        "部级综合意见。不得只是机械拼接、复述或遗漏司级意见。\n\n"
        f"{NO_IRREVERSIBLE_ACTION_CONSTRAINT}\n\n"
        "你必须只输出一个严格的 JSON 对象，不附带任何其他文字、说明或 markdown 代码块，"
        "且只能包含非空 opinion 字符串，"
        '形如：{"opinion": "<本部补充与综合意见，不能为空>"}'
    )
