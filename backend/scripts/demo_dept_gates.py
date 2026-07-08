#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/demo_dept_gates.py — 各部确定性门"抓真实错误"现场演示。

回答"这套系统有什么用":用真实业务场景的坏例子,当场跑各部确定性挡门,看它拦下什么。
全部离线、不打网络、不烧 token(只跑确定性层,不跑 LLM flow)。可随时重跑、可给老板/客户演示。

用法: python scripts/demo_dept_gates.py

诚实标注:礼部/兵部/吏部的门今天真能拦;刑部合同红线是"占位期"(config status=placeholder),
只出 yellow 提醒不出权威 red——填真阈值+翻 confirmed 后才亮红,见 config/xingbu_contract_redlines.yaml。
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))


def _show(title: str, task: str, items: list[dict], dept: str = "") -> tuple[int, int]:
    reds = [i for i in items if i["level"] == "red"]
    yels = [i for i in items if i["level"] == "yellow"]
    print(f"\n【{title}】")
    print(f"  场景: {task}")
    for i in reds:
        print(f"  🔴 标红提醒: {i['title'][:72]}")
    for i in yels[:2]:
        print(f"  🟡 待核: {i['title'][:74]}")
    if not reds and not yels:
        print("  ✅ 无红线(仅供参考,定夺在你)")
    # 自动化档:这条该机器自动流转还是留人
    from src.automation_tier import tier_for_items

    t = tier_for_items(items, task_text=task, dept=dept)
    print(f"  ⚙️  自动化: {t['label']} —— {t['reason']}")
    return len(reds), len(yels)


def main() -> int:
    from src.bingbu_battlecard import _determinism_items
    from src.libu_appointment_vet import accountability_items
    from src.libu_vet import vet_recruit_plan
    from src.lipu_vet import vet_publication
    from src.xingbu_contract_vet import vet_contract

    print("=" * 66)
    print("各部确定性门 · 抓真实错误现场演示(离线,不烧token)")
    print("=" * 66)

    total_r = total_y = 0

    # 礼部:市场部推文编造认证 + 绝对化 + 素材外数字
    r, y = _show(
        "礼部·对外发布门(反幻觉)",
        "市场部推文,但素材只说容量保持率≥90%",
        vet_publication(
            "本司超低温电池全球第一,通过《国家权威储能认证》,-40℃容量保持率99.9%。",
            "素材:本司18650电芯-40℃容量保持率≥90%",
        ),
        dept="libu",  # 礼部对外发布,天然不可逆
    )
    total_r += r
    total_y += y

    # 兵部:线索评分算错 + 臆造复购客户
    r, y = _show(
        "兵部·战情真值门(算术+客户真实性)",
        "销售线索卡:技术60×40% + 预算80×60% = 72,却报综合评分90",
        _determinism_items(
            {
                "线索评分": "技术60×40% + 预算80×60%,综合评分:90分",
                "客户档案": "XX牧场[✓确认]老客户复购",
            }
        ),
        dept="bingbu",  # 内部线索卡,可逆
    )
    total_r += r
    total_y += y

    # 吏部:招聘锂电岗漏安全资质
    r, y = _show(
        "吏部·招聘资质红线",
        "招锂电PACK工艺工程师,但方案没提任何安全资质",
        vet_recruit_plan(
            "硬性要求R-01:3年焊接经验。逐项核验满足。结论:录用。",
            "招聘锂电PACK工艺工程师",
        ),
        dept="libu_personnel",  # 招聘方案草稿,可逆
    )
    total_r += r
    total_y += y

    # 吏部:高权限自动化缺人类 owner
    r, y = _show(
        "吏部·任免责任门",
        "让系统 L4 自动给客户报价并自动打款(没指定负责人)",
        accountability_items("让系统 L4 自动给这个客户报价并自动打款"),
        dept="libu_personnel",  # 任免本身可逆,但任务含L4/打款→文本判不可逆
    )
    total_r += r
    total_y += y

    # 刑部:合同高违约金 + 无限责任(专家默认档已上膛,亮 red)
    r, y = _show(
        "刑部·合同红线门(专家默认v1·法务可调)",
        "供应商合同:违约金50%、账期120天、无限责任",
        vet_contract("本采购合同违约金为合同金额的50%,账期120天,乙方承担无限责任。"),
        dept="xingbu",  # 合同签署,天然不可逆
    )
    total_r += r
    total_y += y

    print("\n" + "=" * 66)
    print(
        f"本轮标红提醒 🔴{total_r} 条 + 🟡{total_y} 条待核 —— 在到客户/合同/账上之前提个醒(定夺始终在你)"
    )
    print(
        "原则:朝堂只提醒,决策权始终在客户手中。刑部为专家默认v1(法务可调),贵司确认后翻 confirmed"
    )
    print("=" * 66)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
