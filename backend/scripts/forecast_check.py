#!/usr/bin/env python3
"""钦天监预测蜂群·检查器(确定性,可证伪)。两层:

【结构层·立等可用】不靠未来数据,现在就能判:
  C1 情景概率自洽 —— 乐观/中性/悲观 概率之和必须≈100%(抽得出且≠100%=逻辑硬错FAIL)
  C2 量化区间    —— 各情景含数值区间(成本/IRR/装机等),非空话(0个量化=FAIL)
  C3 可证伪监测阈值 —— 含 警戒/阈值/预警 + 数字(供日后回测,缺=UNKNOWN)
  C4 应对带时间   —— 应对动作含 触发时间/立即/Q3/Q4/责任方(缺=UNKNOWN)

【回测层·数据门】预测的终极真尺子是 realized 真实结局(见 forecast_backtest.py)——
  数据未到位前,结构层先把"逻辑自洽性"焊死,杜绝'概率不和100%'这类硬伤蒙混过关。

用法: python scripts/forecast_check.py --file 预测报告.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SCENARIOS = ["乐观", "中性", "悲观", "基准", "最坏", "最好"]


def _scenario_probs(text: str) -> list[tuple[str, int]]:
    """抽 '乐观（25%）' 形式的情景概率。"""
    found = []
    for sc in SCENARIOS:
        m = re.search(sc + r"[^\d%]{0,6}(\d{1,3})\s*%", text)
        if m:
            found.append((sc, int(m.group(1))))
    return found


def check(text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    probs = _scenario_probs(text)
    if len(probs) >= 2:
        total = sum(p for _, p in probs)
        ok = 95 <= total <= 105  # 容许四舍五入
        add(
            "C1情景概率自洽",
            "PASS" if ok else "FAIL",
            f"{[f'{s}{p}%' for s, p in probs]} 和={total}%" + ("" if ok else " ✗不为100%"),
        )
    else:
        add("C1情景概率自洽", "UNKNOWN", f"抽不出≥2个情景概率(找到{probs})")

    # 量化区间:数值+单位 出现次数
    n_quant = len(re.findall(r"\d+(?:\.\d+)?\s*(?:元/Wh|GWh|MWh|%|万/吨|元/kWh|亿|GW)", text))
    add("C2量化区间", "FAIL" if n_quant == 0 else "PASS", f"量化数据 {n_quant} 处")

    has_thresh = bool(re.search(r"(警戒|阈值|预警|监测).{0,12}\d", text))
    add("C3可证伪监测阈值", "PASS" if has_thresh else "UNKNOWN", "含带数字的监测阈值" if has_thresh else "无可回测阈值")

    has_time = bool(re.search(r"触发.{0,4}时间|立即|Q[1-4]|个月内|时间节点|责任方|执行主体", text))
    add("C4应对带时间", "PASS" if has_time else "UNKNOWN", "应对含时间/责任方" if has_time else "应对缺时间锚")
    return out


def verdict_of(checks: list[dict]) -> str:
    s = {c["check"]: c["status"] for c in checks}
    if "FAIL" in [c["status"] for c in checks]:
        return "FAIL"
    # 概率自洽+量化区间 都 PASS 才算结构达标
    if s.get("C1情景概率自洽") == "PASS" and s.get("C2量化区间") == "PASS":
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="钦天监预测·结构检查器")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 钦天监预测·结构检查 ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("tianjian_forecast", "forecast_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: tianjian_forecast/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
