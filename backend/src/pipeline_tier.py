"""src/pipeline_tier.py — 管线复杂度分档(P0–P3)。

回答"不是每件事都该上全套":按 风险×不可逆×范围 决定**开几层**(手/嘴/闸/脸),
默认最简,按需升级(向 Claude Code 学:结构是挣来的)。

  P0 直答    : 琐碎/事实/低风险 → 单模型答,不开蜂群/大神/court_doc
  P1 单参谋  : 需一个视角     → 1 大神/模型 + 轻输出
  P2 部门蜂群: 真活           → 蜂群 + 大神参谋 + 御史闸 + court_doc
  P3 会审    : 不可逆/高风险/跨部门 → 全院会审 + 对抗验证 + 人工签字 + court_doc

与 decree_swarm_router.select_orchestration_tier 互补:本模块决定"开几层(管线档)",
后者决定"P2+ 蜂群内部开几个 agent(编排档)"。绝不静默——必带 reason。
"""
from __future__ import annotations

from typing import Iterable

P0, P1, P2, P3 = "P0", "P1", "P2", "P3"

LAYERS = {
    P0: ["answer"],
    P1: ["advisor", "answer"],
    P2: ["swarm", "advisor", "gate", "court_doc"],
    P3: ["council", "swarm", "advisor", "gate", "signoff", "court_doc"],
}

# P3:不可逆 / 高风险 / 对客承诺 / 上线发布(命中即最高档,要人工签字)
_P3_MARKERS = (
    "不可逆", "上线", "发布", "生产", "客户承诺", "签约", "签合同", "付款", "打款",
    "删库", "迁移", "对外公布", "报价确认", "irreversible", "deploy", "release",
)
# P2:真要出活/审查/部门交付(命中或指定了 entry_swarm)
_P2_MARKERS = (
    "审查", "评审", "判决", "核算", "报价", "复盘", "方案", "测试", "验收",
    "合同审", "尽调", "出报告", "战报", "归档", "review",
)
# P0:琐碎/事实/状态/问候(命中且无 P2/P3 信号 → 直答)
_P0_MARKERS = (
    "是什么", "什么意思", "怎么读", "在哪", "查一下", "状态", "进度", "你好",
    "谢谢", "解释", "定义", "翻译", "几点", "多少",
)


def _hit(text: str, markers: tuple[str, ...]) -> str | None:
    return next((m for m in markers if m.lower() in text), None)


_ORDER = [P0, P1, P2, P3]


def _escalate(tier: str) -> str:
    """往上抬一档(C5:不确定往上抬,不往下漏),封顶 P3。"""
    i = _ORDER.index(tier)
    return _ORDER[min(i + 1, len(_ORDER) - 1)]


def select_pipeline_tier(
    command: str,
    *,
    decision_class: str | None = None,
    involved_depts: Iterable[str] | None = None,
    entry_swarm: str | None = None,
    uncertain: bool = False,
) -> dict:
    """选管线档。返回 {tier, layers, reason, needs_signoff}。

    优先级:P3(不可逆/高风险) > P2(真活/指定蜂群/多部门) > P1(需视角) > P0(直答)。
    uncertain=True(C5):分档拿不准时往上抬一档,绝不降档省事——防高风险任务被轻问绕过。
    """
    text = (command or "").lower()
    depts = list(involved_depts or [])
    multidept = len(depts) >= 2

    # 1. 定基础档(P3 最高优先 → P2 → P0 → 默认 P1)
    if decision_class == "irreversible" or _hit(text, _P3_MARKERS):
        why = ("decision_class=irreversible" if decision_class == "irreversible"
               else f"命中高风险标记 '{_hit(text, _P3_MARKERS)}'")
        tier, reason = P3, f"P3 会审: {why} → 全院会审 + 对抗验证 + 人工签字"
    elif entry_swarm or _hit(text, _P2_MARKERS) or multidept:
        why = (f"指定蜂群 {entry_swarm}" if entry_swarm
               else f"涉及 {len(depts)} 部门" if multidept
               else f"命中产出标记 '{_hit(text, _P2_MARKERS)}'")
        tier, reason = P2, f"P2 部门蜂群: {why} → 蜂群 + 参谋 + 御史闸 + court_doc"
    elif (p0_hit := _hit(text, _P0_MARKERS)) and len(text) <= 40:
        tier = P0
        reason = f"P0 直答: 命中琐碎/事实标记 '{p0_hit}' 且短问 → 单模型直答,不开蜂群"
    else:
        tier, reason = P1, "P1 单参谋: 需分析但非部门级产出 → 1 大神/模型 + 轻输出"

    # 2. C5:不确定 → 往上抬一档(绝不降档省事)
    if uncertain and tier != P3:
        bumped = _escalate(tier)
        reason = f"{reason}|C5 不确定升档 {tier}→{bumped}"
        tier = bumped

    return {
        "tier": tier,
        "layers": LAYERS[tier],
        "reason": reason,
        "needs_signoff": tier == P3,
    }
