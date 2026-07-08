#!/usr/bin/env python3
"""史馆归档蜂群·结构可追溯性检查器(确定性,可证伪)。

诚实边界:这是**可追溯性/结构检查器**,不是真值检查器——
它能抓"结论无来源标注、缺必备段、无自检"这类真缺陷(史馆最该防的幻觉/不可追溯),
但**无法核实'依据'本身是否事实正确**(那需要原始材料逐条比对,属另一层)。

判定(对照 prompts_shiguan_archive 的硬性要求):
  C1 结构完整 —— 决策档案/鉴往/史册/归档元数据 四段齐全(缺段=FAIL)
  C2 来源标注 —— 含 依据/来源/出处/原文 等可追溯标记(全篇 0 个=FAIL,不可追溯)
  C3 诚实标记 —— 含 未载/待考/无记录(标了未知=好;一个都没有且来源也少=可疑)
  C4 归档自检 —— 含"自检"结论段(缺=UNKNOWN,弱信号)

用法: python scripts/archive_check.py --file 归档输出.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

REQUIRED = {"决策档案": r"决策档案", "鉴往": r"鉴往", "史册": r"史册", "归档元数据": r"归档元数据|元数据|标签"}
SOURCE_MARK = r"依据|来源|出处|原文第|引用|原文|参见"
HONEST_MARK = r"未载|待考|无记录|未提及|存疑|待补"


def check(text: str) -> list[dict]:
    out = []

    def add(name, status, detail):
        out.append({"check": name, "status": status, "detail": detail})

    missing = [k for k, pat in REQUIRED.items() if not re.search(pat, text)]
    add("C1结构完整", "FAIL" if missing else "PASS", f"缺段: {missing}" if missing else "四段齐全")

    n_src = len(re.findall(SOURCE_MARK, text))
    add("C2来源标注", "FAIL" if n_src == 0 else "PASS", f"可追溯标记 {n_src} 处")

    n_honest = len(re.findall(HONEST_MARK, text))
    # 有诚实标记=好;无诚实标记且来源也稀疏→可疑(可能在臆造)
    add("C3诚实标记", "PASS" if n_honest > 0 else ("FAIL" if n_src < 2 else "UNKNOWN"), f"诚实标记 {n_honest} 处")

    has_self = bool(re.search(r"自检", text))
    add("C4归档自检", "PASS" if has_self else "UNKNOWN", "含自检" if has_self else "未见自检段")
    return out


def verdict_of(checks: list[dict]) -> str:
    s = [c["status"] for c in checks]
    if "FAIL" in s:
        return "FAIL"
    # 须结构完整 + 有来源(实质可追溯)才 PASS,否则 UNKNOWN
    sub = {c["check"]: c["status"] for c in checks}
    if sub.get("C1结构完整") == "PASS" and sub.get("C2来源标注") == "PASS":
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="史馆归档结构可追溯性检查器")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id", help="提供则写入真值台账")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 史馆归档·可追溯性检查 ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("shiguan_archive", "archive_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: shiguan_archive/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
