#!/usr/bin/env python3
"""郝龙获客蜂群·检查器(确定性,可证伪)。两类锚:

【算得对吗·立等】
  C1 线索评分自洽 —— 加权公式 ΣN×M% 的算术和必须≈所报综合评分(算错=评分不可信FAIL)
  C2 推测/确认标注 —— 客户档案须区分[实测/✓确认] vs [⚠推测/缺失](全标确认无推测=可疑臆造)
  C4 触达可执行   —— 含触达方式+节奏+本次目标(缺=空话)

【对得上真客户吗·数据门】
  C3 客户真实性 —— 有 customer_truth.json 时:输出若称某客户'老客户/复购',该客户须真在成交记录里
                  (把陌生客户说成老客户=臆造关系;反之把24笔复购大户当'新客户'=情报失职)

用法: python scripts/haolong_check.py --file 获客输出.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
CUST = ROOT / "config" / "eval" / "customer_truth.json"

CONFIRM = r"\[?[✓√]|实测|已确认|已验证"
INFER = r"⚠|推测|缺失|待确认|待核实|未知|不明"
OLD_CUST = r"老客户|复购|回头客|长期合作|多年合作"
NEW_CUST = r"新客户|首次|陌生客户|从未合作|初次接触"


def _load_cust() -> dict:
    if not CUST.exists():
        return {}
    try:
        return json.loads(CUST.read_text(encoding="utf-8"))
    except Exception:
        return {}


def check(text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    # C1 线索评分自洽:ΣN×M% vs 所报综合评分
    pairs = re.findall(r"(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*%", text)
    stated = re.search(r"综合评分[:：]?\s*(\d+(?:\.\d+)?)", text) or re.search(
        r"评分[:：]?\s*(\d+(?:\.\d+)?)\s*分", text
    )
    if pairs and stated:
        calc = sum(float(a) * float(b) / 100 for a, b in pairs)
        s = float(stated.group(1))
        dev = abs(calc - s)
        add(
            "C1线索评分自洽",
            "PASS" if dev <= 5 else "FAIL",
            f"公式算得{calc:.1f} vs 所报{s:.0f} 差{dev:.1f}" + ("" if dev <= 5 else " ✗评分算错"),
        )
    else:
        add("C1线索评分自洽", "UNKNOWN", "未见加权评分公式")

    # C2 推测/确认标注
    n_conf = len(re.findall(CONFIRM, text))
    n_inf = len(re.findall(INFER, text))
    if n_conf + n_inf == 0:
        add("C2推测确认标注", "FAIL", "档案无任何确认/推测标注(无法区分事实与猜测)")
    elif n_inf == 0 and n_conf >= 3:
        add("C2推测确认标注", "UNKNOWN", f"全标确认({n_conf})无推测,数据若薄则可疑")
    else:
        add("C2推测确认标注", "PASS", f"确认{n_conf}/推测{n_inf},区分事实与猜测")

    # C3 客户真实性(数据门)
    cust = _load_cust()
    if cust:
        named = [name for name in cust if len(name) >= 4 and name in text]
        contradiction = []
        for name in named:
            window = text[max(0, text.find(name) - 30) : text.find(name) + len(name) + 30]
            if re.search(NEW_CUST, window) and cust[name]["repeat"]:
                contradiction.append(f"{name[:12]}称新客户实为{cust[name]['deal_count']}笔复购")
            if re.search(OLD_CUST, window) and not cust[name]["repeat"] and cust[name]["deal_count"] == 0:
                contradiction.append(f"{name[:12]}称老客户但无成交记录")
        # 把记录里没有、却被称'老客户/复购'的名字也算臆造关系
        if re.search(OLD_CUST, text) and not named:
            add("C3客户真实性", "UNKNOWN", "称有老客户/复购,但所提客户均不在成交记录(需人工核名)")
        elif contradiction:
            add("C3客户真实性", "FAIL", "; ".join(contradiction))
        elif named:
            add("C3客户真实性", "PASS", f"提及真实成交客户: {named[:3]}")
        else:
            add("C3客户真实性", "UNKNOWN", "未提及记录内客户(可能纯新线索)")
    # 无 customer_truth → 不加 C3(诚实:数据门未开)

    # C4 触达可执行
    has_way = bool(re.search(r"触达方式|触达策略|首选|渠道", text))
    has_rhythm = bool(re.search(r"节奏|工作日内|立即|天后|跟进", text))
    has_goal = bool(re.search(r"本次目标|目标[:：]|获取", text))
    cnt = sum([has_way, has_rhythm, has_goal])
    add(
        "C4触达可执行",
        "PASS" if cnt >= 2 else ("UNKNOWN" if cnt == 1 else "FAIL"),
        f"方式{'✓' if has_way else '✗'}/节奏{'✓' if has_rhythm else '✗'}/目标{'✓' if has_goal else '✗'}",
    )
    return out


def verdict_of(checks: list[dict]) -> str:
    s = {c["check"]: c["status"] for c in checks}
    if "FAIL" in [c["status"] for c in checks]:
        return "FAIL"
    # 评分自洽(若有公式)+触达可执行 达标算合格
    if s.get("C4触达可执行") == "PASS" and s.get("C1线索评分自洽") in ("PASS", "UNKNOWN"):
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="郝龙获客·检查器")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 郝龙获客·检查 ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("haolong", "haolong_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: haolong/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
