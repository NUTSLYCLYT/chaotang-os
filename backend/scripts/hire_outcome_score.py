"""HR招聘结局回写评分器(飞轮真燃料) —— 大神会审建议一/三落地。

复用 forecast_backtest predict→realize→compare 模具。HR 的'真值'(Bezos/Deming一致):
不是'JD硬性要求有没有逐项核验',是录用的人**入职了吗→留下了吗→绩效如何**。

读 eval/hire_outcome.jsonl,对每个已发 offer 的候选人:
  入职率 / 90天留存 / 首年绩效 —— 回灌成 recruit_check 的 calibration 真值。
据此可算'当初判录用的人,后来真留下且绩效达标'的命中率=招聘判断的真准度。

数据门:hired/retained_90d/perf_score 任一 null=未结算,不评分。
评分(单人): 入职+留存+绩效≥3 →PASS / 入职但90天走或绩效<3 →FAIL / 当初淘汰且确未录用→N/A
用法: python scripts/hire_outcome_score.py [--ledger]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
SRC = ROOT / "eval" / "hire_outcome.jsonl"
PERF_FLOOR = 3.0


def load() -> list[dict]:
    rows = []
    for line in SRC.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        if "_schema" in d or d.get("run_id") == "示例-待替换":
            continue
        rows.append(d)
    return rows


def score_one(r: dict) -> tuple[str, str]:
    hired, ret, perf = r.get("hired"), r.get("retained_90d"), r.get("perf_score")
    if hired is None:
        return "UNKNOWN", "offer 结局未定(入职?)"
    if not hired:
        return "UNKNOWN", "未入职(候选人拒offer/未到岗)"
    if ret is None or perf is None:
        return "UNKNOWN", "已入职,留存/绩效未结算"
    issues = []
    if not ret:
        issues.append("90天内离职")
    if perf < PERF_FLOOR:
        issues.append(f"绩效{perf}<{PERF_FLOOR}")
    if not issues:
        return "PASS", f"入职+90天留存+绩效{perf} 达标"
    return "FAIL", "; ".join(issues)


def main() -> int:
    ap = argparse.ArgumentParser(description="HR招聘结局回写评分器")
    ap.add_argument("--ledger", action="store_true")
    a = ap.parse_args()
    rows = load()
    settled = [r for r in rows if r.get("hired") and r.get("retained_90d") is not None]
    print(f"=== HR招聘结局回写 === 共 {len(rows)} offer / 已结算 {len(settled)}")
    if not rows:
        print("  ❓ 暂无招聘结局(数据门未开)——offer发出后回填入职/留存/绩效,飞轮燃料从这里进")
        return 0
    from src.truth_ledger import record

    for r in rows:
        v, ev = score_one(r)
        icon = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}[v]
        print(f"  {icon} {v:<7} {r.get('candidate', '?')}/{r.get('role', '?')}: {ev}")
        if a.ledger and v != "UNKNOWN":
            prov = "authenticated" if r.get("offer_date") else "orphan"
            record(
                "libu_recruit",
                "hire_outcome",
                v,
                case_id=f"hire_{r.get('candidate')}_{r.get('offer_date')}",
                detail=ev,
                evidence=ev,
                provenance=prov,
            )
    if a.ledger and settled:
        print("→ 已结算结局写入真值台账(checker=hire_outcome)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
