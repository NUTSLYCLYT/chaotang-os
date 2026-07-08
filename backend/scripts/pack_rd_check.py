#!/usr/bin/env python3
"""PACK 评估 确定性约束检查器 — pack_rd 蜂群的'真尺子'(来自公司真实 PACK 需求)。

镜像 opc_constraint_check：从 PACK 方案文本抽数值，对照真实可证伪验收标准确定性判定。
判定不靠 LLM 自评——这是大神要的'把裁判权交给代码'。

验收标准(来自 研发流程/PACK提示词.txt 真实任务)：
  C1 电量 935-1265Wh (1100±15%)         C2 软包并联 <=5
  C3 比能量勾稽: 比能量 ≈ 电量/总重量      C4 不得有低温加热(本任务明确不需要)
  C5 电压平台 12V

判级: PASS 满足 / FAIL 违反硬约束 / UNKNOWN 抽不出(诚实标,不假装通过)。

用法: python scripts/pack_rd_check.py --file 方案.txt
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # 直跑脚本时让 `import src.*` 可用


def _num(pat: str, text: str) -> float | None:
    m = re.search(pat, text)
    return float(m.group(1)) if m else None


def _pack_energy_wh(sol: str) -> float | None:
    """抽整包总电量——只认带'总电量/电量/标称'明确标签的众数。无标签返回 None(C1判UNKNOWN),
    绝不从一堆裸 Wh 里瞎猜(组件/循环 Wh 会抓错,正则在长文上不可靠,定论走 --llm)。"""
    from collections import Counter

    labeled = re.findall(
        r"(?:总电量|总能量|系统电量|PACK\s*电量|包电量|电量|标称容?量?)[^\d]{0,6}(\d+(?:\.\d+)?)\s*Wh", sol
    )
    if not labeled:
        return None
    return Counter(float(x) for x in labeled).most_common(1)[0][0]


def _uses_heating(sol: str):
    """整包是否用加热,三态(None=拿不准)。正则在长文否定上不可靠,强偏 UNKNOWN、绝不假 FAIL。
    只在'强肯定模块化用加热'(集成/采用/配置…加热膜/模块/回路)且全文无否定时判 True;
    出现否定且无强肯定→False;其余→None(交 --llm 定论)。"""
    STRONG = r"(集成|采用|配置|内置|加装|增设|具备|含)[^。\n]{0,6}(加热膜|加热模块|加热回路|加热功能|PTC|预热)|加热膜.{0,4}(启动|控温)"
    NEG = (
        r"不需|无需|不得|禁止|避免|取消|去除|不采用|不使用|不含|无须|没有|不加热|无加热|去掉|不做|省去|缺少|缺失|不额外"
    )
    strong = len(re.findall(STRONG, sol))
    neg = len(re.findall(NEG, sol))
    if strong >= 1 and neg == 0:
        return True  # 强肯定用加热 + 全文无否定 → 违规
    if neg >= 1 and strong == 0:
        return False  # 有否定 + 无强肯定 → 不用加热(符合需求)
    if strong == 0 and neg == 0 and not re.search(r"加热|PTC|预热", sol):
        return False  # 全文没提 → 没用
    return None  # 强肯定与否定并存 / 仅泛提加热 → 拿不准,交 --llm


def extract(sol: str) -> dict:
    return {
        "energy_wh": _pack_energy_wh(sol),
        "softpack_parallel": _num(r"软包[^。\n]{0,20}?(\d+)\s*并", sol) or _num(r"(\d+)\s*并[^。\n]{0,6}软包", sol),
        "total_weight_kg": _num(r"总重[量]?[^\d]{0,6}(\d+(?:\.\d+)?)\s*kg", sol),
        "specific_energy": _num(r"比能量[^\d]{0,6}(\d+(?:\.\d+)?)\s*Wh/kg", sol),
        "has_heating": _uses_heating(sol),
        "has_12v": bool(re.search(r"12\s*V", sol)),
    }


def _target_energy_band(task: str):
    """从任务解析目标电量±15%(每个任务标准不同,不可硬编码)。解析不出→None→C1判UNKNOWN。"""
    if not task:
        return None
    m = re.search(r"电量[^\d]{0,4}(\d+(?:\.\d+)?)\s*Wh", task) or re.search(r"(\d+(?:\.\d+)?)\s*Wh", task)
    wh = None
    if m:
        wh = float(m.group(1))
    else:  # 容量Ah × 电压V → Wh
        ah = re.search(r"(\d+(?:\.\d+)?)\s*Ah", task)
        v = re.search(r"(\d+(?:\.\d+)?)\s*V", task)
        if ah and v:
            wh = float(ah.group(1)) * float(v.group(1))
    if wh is None:
        return None
    tol = 0.15
    tm = re.search(r"[±\+\-]\s*(\d+)\s*%", task)
    if tm:
        tol = float(tm.group(1)) / 100
    return wh * (1 - tol), wh * (1 + tol)


def check(ex: dict, task: str = "") -> list[dict]:
    out = []

    def add(name, status, detail):
        out.append({"check": name, "status": status, "detail": detail})

    e = ex["energy_wh"]
    band = _target_energy_band(task)
    if e is None:
        add("C1电量达标", "UNKNOWN", "抽不出电量")
    elif band is None:
        add("C1电量达标", "UNKNOWN", f"电量{e:.0f}Wh,但任务未给目标电量(不套用他例标准)")
    else:
        lo, hi = band
        add("C1电量达标", "PASS" if lo <= e <= hi else "FAIL", f"电量{e:.0f}Wh vs 目标[{lo:.0f}-{hi:.0f}]Wh")

    sp = ex["softpack_parallel"]
    if sp is None:
        add("C2软包并联<=5", "UNKNOWN", "未提软包并联数(或未用软包)")
    else:
        add("C2软包并联<=5", "PASS" if sp <= 5 else "FAIL", f"软包并联 {sp:.0f}")

    w, se, en = ex["total_weight_kg"], ex["specific_energy"], ex["energy_wh"]
    if w and se and en:
        calc = en / w
        dev = abs(calc - se) / se
        add(
            "C3比能量勾稽",
            "PASS" if dev <= 0.05 else "FAIL",
            f"声称{se:.1f} vs 电量/总重={calc:.1f}Wh/kg 偏差{dev * 100:.0f}%",
        )
    else:
        add("C3比能量勾稽", "UNKNOWN", f"缺项(电量={en} 总重={w} 比能量={se})")

    # C4 三态:True→FAIL(真用加热) / False→PASS(不用,符合) / None→UNKNOWN(正则拿不准,留给--llm)
    h = ex["has_heating"]
    if h is None:
        add("C4不得低温加热", "UNKNOWN", "加热信号矛盾(正则判不准,建议 --llm 定夺)")
    else:
        add(
            "C4不得低温加热",
            "FAIL" if h else "PASS",
            "方案含加热模块(本任务明确不需要)" if h else "无低温加热,符合需求",
        )
    add("C5电压平台12V", "PASS" if ex["has_12v"] else "UNKNOWN", "含12V" if ex["has_12v"] else "未见12V")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="PACK 评估确定性约束检查器")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id", help="提供则把判定写入真值台账(truth_ledger)")
    ap.add_argument("--llm", action="store_true", help="用 LLM 抽取数字(降 blind_rate),判定仍归代码")
    ap.add_argument("--task", default="", help="任务描述(C1电量达标按此目标±15%判;不给则C1判UNKNOWN)")
    a = ap.parse_args()
    sol = Path(a.file).read_text(encoding="utf-8")
    if a.llm:
        from src.llm_extract import extract_pack_llm

        ex = extract_pack_llm(sol)  # LLM 只抽数字
    else:
        ex = extract(sol)
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== PACK 约束检查 ===")
    results = check(ex, a.task)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    verdict = "FAIL" if any(c["status"] == "FAIL" for c in results) else "PASS"
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("pack_rd", "pack_rd_check", verdict, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: pack_rd/{a.case_id} = {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
