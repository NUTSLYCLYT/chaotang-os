#!/usr/bin/env python3
"""吏部招聘蜂群·JD硬性匹配检查器(确定性,可证伪)。

核心可证伪锚:淘汰不挂红线/录用不挂硬性要求=无依据决策。
诚实边界:查"决策是否锚定具体硬性要求(R-xx)与红线(D-xx)、是否逐项核验、淘汰是否有据",
不查候选人材料本身真假(那需背调,属另一层)。

判定(对照真实招聘奏报结构):
  C1 硬性要求锚定 —— 含 R-0\\d 编号或'硬性要求'(全无=FAIL,凭感觉招人)
  C2 逐项核验   —— 含 核验/逐项/满足/触发/达标/未达(0个=FAIL)
  C3 淘汰可追溯 —— 若出现淘汰/不录用,必须同时出现红线/D-0\\d/未达/不满足/<N年(否则=FAIL,黑箱淘汰)
  C4 结论完整   —— 含 录用/淘汰/有条件 结论

用法: python scripts/recruit_check.py --file 招聘建议.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

REQ_ANCHOR = r"R-0\d|硬性要求|硬性条件"
VERIFY = r"核验|逐项|满足|触发|达标|未达|不满足|符合"
REJECT = r"淘汰|不录用|出局|否决"
REJECT_REASON = r"红线|D-0\d|R-0\d|未达|不满足|不符合|<\s*\d|低于|缺.{0,4}经验|红牌"
CONCLUSION = r"录用|淘汰|有条件|建议.{0,4}(进入|面试|offer|入职)"


def check(text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    n_anchor = len(re.findall(REQ_ANCHOR, text))
    add("C1硬性要求锚定", "FAIL" if n_anchor == 0 else "PASS", f"要求锚点 {n_anchor} 处")

    n_ver = len(re.findall(VERIFY, text))
    add("C2逐项核验", "FAIL" if n_ver == 0 else "PASS", f"核验动作 {n_ver} 处")

    has_reject = bool(re.search(REJECT, text))
    if has_reject:
        has_reason = bool(re.search(REJECT_REASON, text))
        add(
            "C3淘汰可追溯",
            "PASS" if has_reason else "FAIL",
            "淘汰挂具体红线/未达项" if has_reason else "有淘汰但无具体依据(黑箱)",
        )
    else:
        add("C3淘汰可追溯", "UNKNOWN", "本案无淘汰决策")

    add(
        "C4结论完整",
        "PASS" if re.search(CONCLUSION, text) else "FAIL",
        "含录用/淘汰结论" if re.search(CONCLUSION, text) else "无明确结论",
    )
    return out


def verdict_of(checks: list[dict]) -> str:
    s = {c["check"]: c["status"] for c in checks}
    if "FAIL" in [c["status"] for c in checks]:
        return "FAIL"
    if s.get("C1硬性要求锚定") == "PASS" and s.get("C4结论完整") == "PASS":
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="吏部招聘·JD硬性匹配检查器")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 吏部招聘·JD硬性匹配核查 ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("libu_recruit", "recruit_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: libu_recruit/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
