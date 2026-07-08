"""src/difficulty_assessor.py — 难易度评判系统(旨意×自动化×军机处意见,用户可改)。

系统怎么干,取决于三个难度因子,本模块把它们合成一个**可解释的难度评分 + 档位**,
供军机处项目执行进度面板呈现,且**像 Claude Code 一样允许用户改档**(人选优先,但留痕)。

三因子:
  ① 旨意难度    —— 任务本身多复杂/多高风险(由 resource_router/pipeline_tier 出基础档)。
  ② 自动化难度  —— 让 agent 自动到哪一级(L0-L5,L5 不可逆最难,御史命门)。
  ③ 军机处意见  —— 会审的信心(高/中/低)与冲突数(分歧越多越难,要更重审)。

合成 → {tier(P0-P3), effort_score(1-10), 三因子明细, 该开哪些层, 是否用户改档, 面板行}。
纯函数,可测;不调 LLM。
"""
from __future__ import annotations

from typing import Iterable

from src import resource_router

_TIER_EFFORT = {"P0": 1, "P1": 3, "P2": 6, "P3": 9}
_TIER_ORDER = ["P0", "P1", "P2", "P3"]
# 自动化难度:L5 不可逆/对外承诺最难
_AUTO_SEV = {"L0": 0, "L1": 0, "L2": 1, "L3": 2, "L4": 3, "L5": 4}
# 军机处信心 → 难度加成(信心越低越难,要更重审)
_CONF_PENALTY = {"高": 0, "中": 1, "低": 2}


def _escalate(tier: str) -> str:
    i = _TIER_ORDER.index(tier)
    return _TIER_ORDER[min(i + 1, len(_TIER_ORDER) - 1)]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def assess(
    command: str,
    *,
    decision_class: str | None = None,
    involved_depts: Iterable[str] | None = None,
    automation_level: str = "L0",
    council_confidence: str = "中",
    council_conflicts: int = 0,
    user_force_tier: str | None = None,
) -> dict:
    """评判一个旨意/任务的难度档 + 分数 + 该开哪些层。user_force_tier 给则人选优先。"""
    base = resource_router.route(
        command, decision_class=decision_class, involved_depts=involved_depts)
    auto_sev = _AUTO_SEV.get(automation_level, 0)
    conf_pen = _CONF_PENALTY.get(council_confidence, 1)
    conflicts = max(0, int(council_conflicts))

    # ① 自动评档:基础档 + 自动化/军机处 上抬(更难=更重审)
    auto_tier = base["tier"]
    bumped_reason = []
    if auto_sev >= 4:  # L5 不可逆
        auto_tier = "P3"
        bumped_reason.append("自动化 L5 不可逆→P3")
    if conf_pen >= 2 or conflicts >= 1:  # 军机处信心低/有分歧
        auto_tier = _escalate(auto_tier)
        bumped_reason.append("军机处信心低/有分歧→升档")

    # ② 用户改档(Claude Code 式人选优先,留痕)
    overridden = bool(user_force_tier and user_force_tier in _TIER_ORDER)
    tier = user_force_tier if overridden else auto_tier

    # ③ 难度评分 1-10(供面板进度条)
    effort = _clamp(
        _TIER_EFFORT[tier] + auto_sev * 0.5 + conf_pen + min(conflicts, 3) * 0.5, 1, 10)

    # ④ 该开哪些层(按最终档)
    final = resource_router.route(
        ("确认 上线" if tier == "P3" else command),  # 借 P3 关键词拿全开;否则用原命令
        decision_class=decision_class, involved_depts=involved_depts)
    engage = resource_router._ENGAGE[tier]  # 直接按最终档取,确定性
    engage = {k: v for k, v in engage.items() if k != "model_tier"}

    reason = (f"用户改档→{tier}(自动评 {auto_tier})" if overridden
              else "；".join(bumped_reason) or f"自动评档 {tier}")
    return {
        "tier": tier,
        "auto_tier": auto_tier,
        "effort_score": round(effort, 1),
        "factors": {
            "edict": base["tier"], "automation": automation_level,
            "council_confidence": council_confidence, "council_conflicts": conflicts,
        },
        "engage": engage,
        "model_tier": resource_router._ENGAGE[tier]["model_tier"],
        "needs_signoff": tier == "P3",
        "overridden": overridden,
        "reason": reason,
    }


def panel_row(task_id: str, command: str, **kw) -> dict:
    """军机处项目执行进度面板的一行(给前端渲染)。"""
    a = assess(command, **kw)
    return {
        "task_id": task_id,
        "title": command[:40],
        "tier": a["tier"],                      # 难度档 P0-P3
        "effort": a["effort_score"],            # 难度 1-10(进度条/星级)
        "confidence": a["factors"]["council_confidence"],
        "conflicts": a["factors"]["council_conflicts"],
        "automation": a["factors"]["automation"],
        "engaged_layers": [k for k, v in a["engage"].items() if v],
        "needs_signoff": a["needs_signoff"],
        "overridden": a["overridden"],          # 是否用户手动改过档
        "reason": a["reason"],
    }
