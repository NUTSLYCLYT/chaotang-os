"""src/automation_tier.py — 自动化档位:让系统"该自动的全自动,不可逆处才留人"。

回答"只提醒会不会不够自动化":决策权在客户 ≠ 人审每一条。按 灯 × 可逆性 算自动化档,
绝大多数日常(绿/黄/可逆红)机器自动流转,只在不可逆/烧钱/客户承诺处强制人签——
把自动化用在对的地方,把"决策权在客户"守在真正要紧的地方(见 memory decision-authority-stays-with-user)。

稳健档(2026-07-07 用户定):
  green            → auto_pass          自动放行,不打扰人
  yellow           → auto_proceed_logged自动继续 + 留痕,人可异步抽查
  red(可逆)        → hold_for_release   自动挡下 + 给修改建议,人一键放行
  red+不可逆 / black→ require_human_sign 必须人签(不可逆/资金/客户承诺,决策权在客户)

不可逆信号:资金动作/合同签署/对客户承诺/对外发布/L4-L5自动化/解约裁员等——错一次收不回,
这正是要人的地方。可逆红(改推文/调筛选/内部方案)挡错了改回来就行,故只"一键放行"不"签字"。
"""

from __future__ import annotations

AUTO_PASS = "auto_pass"
AUTO_PROCEED_LOGGED = "auto_proceed_logged"
HOLD_FOR_RELEASE = "hold_for_release"
REQUIRE_HUMAN_SIGN = "require_human_sign"

_LABEL = {
    AUTO_PASS: "自动放行",
    AUTO_PROCEED_LOGGED: "自动继续(留痕)",
    HOLD_FOR_RELEASE: "自动挡下·人一键放行",
    REQUIRE_HUMAN_SIGN: "必须人签(不可逆)",
}

# 不可逆/高危信号:命中则红灯升级为"必须人签"(错一次收不回)。
_IRREVERSIBLE = (
    "付款",
    "打款",
    "转账",
    "汇款",
    "资金",
    "支付",
    "签署",
    "签约",
    "签合同",
    "盖章",
    "用印",
    "客户承诺",
    "对客户承诺",
    "交期承诺",
    "报价发出",
    "对外报价",
    "发货",
    "下单采购",
    "上线发布",
    "解约",
    "解除合同",
    "裁员",
    "辞退",
    "L4",
    "L5",
    "不可逆",
)

# 领域天然不可逆的部门:其红灯直接"必须人签"——不靠文本关键词(避免漏判)。
# xingbu=刑部合同(签下去收不回)/ hubu=户部资金(付出去收不回)/ libu=礼部对外发布(发出删不净)。
# 兵部线索/吏部招聘方案是内部草稿,可逆,不在此列。
_IRREVERSIBLE_DEPTS = {"xingbu", "hubu", "libu"}


def _text_of(doc: dict | None) -> str:
    if not isinstance(doc, dict):
        return ""
    parts = [str(doc.get("question", "")), str(doc.get("headline", ""))]
    parts += [str(i.get("title", "")) for i in (doc.get("items") or [])]
    return " ".join(parts)


def is_irreversible(text: str) -> bool:
    return any(k in (text or "") for k in _IRREVERSIBLE)


def decide_auto_action(
    light: str, *, text: str = "", has_black: bool = False, dept: str | None = None
) -> dict:
    """灯 × 可逆性 → 自动化档。返回 {tier,label,human_needed,reason}。
    不可逆判定 = 部门天然不可逆(dept in _IRREVERSIBLE_DEPTS)OR 文本命中不可逆信号。"""
    if light == "green":
        return _mk(AUTO_PASS, False, "无风险,自动放行")
    if light == "yellow":
        return _mk(AUTO_PROCEED_LOGGED, False, "小风险,自动继续并留痕,人可异步抽查")
    # red / black
    irreversible = (
        has_black
        or light == "black"
        or dept in _IRREVERSIBLE_DEPTS
        or is_irreversible(text)
    )
    if irreversible:
        why = (
            "合同/资金/对外发布等"
            if dept in _IRREVERSIBLE_DEPTS
            else "资金/签署/客户承诺等"
        )
        return _mk(
            REQUIRE_HUMAN_SIGN, True, f"不可逆/高危({why}),必须人签——决策权在客户"
        )
    return _mk(HOLD_FOR_RELEASE, True, "可逆红灯,自动挡下并给修改建议,人一键放行")


def tier_for_doc(doc: dict) -> dict:
    """给一张 court_doc 算自动化档(便捷入口)。"""
    light = doc.get("light", "yellow")
    has_black = any(i.get("level") == "black" for i in (doc.get("items") or []))
    return decide_auto_action(
        light, text=_text_of(doc), has_black=has_black, dept=doc.get("dept")
    )


def tier_for_items(
    items: list[dict], *, task_text: str = "", dept: str | None = None
) -> dict:
    """给一组 items(demo/vet 直出,未装 court_doc)算自动化档。"""
    levels = [i.get("level") for i in items or []]
    light = "red" if "red" in levels else "yellow" if "yellow" in levels else "green"
    text = task_text + " " + " ".join(str(i.get("title", "")) for i in items or [])
    return decide_auto_action(light, text=text, has_black="black" in levels, dept=dept)


def _mk(tier: str, human_needed: bool, reason: str) -> dict:
    return {
        "tier": tier,
        "label": _LABEL[tier],
        "human_needed": human_needed,
        "reason": reason,
    }


if __name__ == "__main__":
    assert decide_auto_action("green")["tier"] == AUTO_PASS
    assert decide_auto_action("yellow")["human_needed"] is False
    # 可逆红 → 一键放行(要人但轻)
    r = decide_auto_action("red", text="这篇推文有绝对化用语")
    assert r["tier"] == HOLD_FOR_RELEASE and r["human_needed"]
    # 不可逆红 → 必须人签
    s = decide_auto_action("red", text="这份合同违约金50%,准备签署付款")
    assert s["tier"] == REQUIRE_HUMAN_SIGN
    # black 一律人签
    assert (
        decide_auto_action("red", text="改个内部方案", has_black=True)["tier"]
        == REQUIRE_HUMAN_SIGN
    )
    print("automation_tier 自检通过:绿自动/黄留痕/可逆红一键放行/不可逆红必须人签")
