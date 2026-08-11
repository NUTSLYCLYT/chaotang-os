
"""Closed-world prompts for the daily memorial bureau stage."""

from __future__ import annotations

import json

from app.agents.bureaus.profiles import BureauProfile
from app.daily_memorial_drafts.facts import ControlledFact
from app.daily_memorial_drafts.models import MinistryDailyResult

_CLOSED_FACT_RULES = (
    "只能使用所提供的事实 ID，不得补充外部知识或未提供的事实。\n"
    "每个事实性句子必须在本句内标注一个或多个精确的 "
    "[fact:<fact_id>]；fact_refs 必须唯一且只列出所用事实。\n"
    "推断或建议必须以“判断：”开头，不能伪装成事实。\n"
    "不得声称已经调查、执行、批准、归档或下旨，也不得触发这些动作。\n"
)


def build_bureau_prompt(
    profile: BureauProfile, facts: tuple[ControlledFact, ...]
) -> str:
    """Render one deterministic prompt containing only the frozen snapshot."""

    fact_payload = [
        {"fact_id": fact.fact_id, "snapshot": json.loads(fact.snapshot_json)}
        for fact in facts
    ]
    return (
        "你正在生成每日奏报的司级待审材料，不是在执行下旨流程。\n"
        f"单位：{profile.department}/{profile.bureau}\n"
        f"职责：{json.dumps(profile.responsibilities, ensure_ascii=False)}\n"
        + _CLOSED_FACT_RULES
        + "没有与本司职责相关的材料时返回 NO_MATERIAL，并保持 summary、"
        "decisions_needed、fact_refs 为空。\n"
        "冻结事实 JSON："
        + json.dumps(fact_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    )


def build_ministry_prompt(
    department: str,
    bureau_results: tuple[dict[str, object], ...],
    facts: tuple[ControlledFact, ...],
) -> str:
    """Render one ministry prompt from only its own terminal bureau outputs."""

    payload = {
        "department": department,
        "bureau_results": bureau_results,
        "frozen_facts": [
            {"fact_id": fact.fact_id, "snapshot": json.loads(fact.snapshot_json)}
            for fact in facts
        ],
    }
    return (
        "你正在生成每日奏报的部级待审材料，不是在执行下旨流程。\n"
        f"单位：{department}\n"
        + _CLOSED_FACT_RULES
        + "只能综合本部所列司级终态结果；不得读取或推断其他部输入。\n"
        + "本部输入 JSON："
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    )


def build_chancellor_prompt(
    *,
    report_date: str,
    fact_cutoff: str,
    ministry_results: tuple[MinistryDailyResult, ...],
    fact_refs: tuple[str, ...],
) -> str:
    """Render the sole Chancellor prompt from six frozen ministry outputs."""

    payload = {
        "report_date": report_date,
        "fact_cutoff": fact_cutoff,
        "ministry_results": [
            result.model_dump(mode="json") for result in ministry_results
        ],
        "frozen_fact_refs": fact_refs,
    }
    return (
        "你正在生成每日奏报的丞相待审总报，不是在执行下旨或归档流程。\n"
        + _CLOSED_FACT_RULES
        + "只能综合所列六部终态结果；必须原样保留六部固定顺序、报告日期和事实截止时间。\n"
        + "丞相输入 JSON："
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    )


__all__ = ["build_bureau_prompt", "build_chancellor_prompt", "build_ministry_prompt"]
