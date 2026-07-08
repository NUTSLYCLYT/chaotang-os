#!/usr/bin/env python3
"""钦天监预测·回测评分器(预测的终极真尺子:对照 realized 真实结局)。

预测和报价一样,终极裁判是现实:碳酸锂到底跌没跌到 8-12 万?装机到底多少 GWh?
本评分器读 eval/forecast_realized_golden.jsonl,对每个'已兑现'的指标判:
  真实值是否落在预测区间内(命中) → 命中率=真·预测准确度。
市场/时间替你打分,这把尺子只读现实,不读模型自夸,也不靠人工 golden 主观打分。

数据门:realized 为 null 的指标=未兑现,不参与评分(诚实标'数据门未开'),
        用户在结局发生后回填 realized 即自动纳入回测。

评分(命中率,可证伪): 命中率≥0.7→PASS(score5) / ≥0.5→WEAK(3) / <0.5→FAIL(1) / 无兑现→UNKNOWN
用法: python scripts/forecast_backtest.py [--forecast-id 2026H2储能] [--ledger]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
GOLDEN = ROOT / "eval" / "forecast_realized_golden.jsonl"


def load() -> list[dict]:
    rows = []
    for line in GOLDEN.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        if "_schema" in d:  # 跳过 schema 头行
            continue
        rows.append(d)
    return rows


def backtest(forecast_id: str | None = None):
    rows = load()
    if forecast_id:
        rows = [r for r in rows if r.get("forecast_id") == forecast_id]
    realized = [r for r in rows if r.get("realized") is not None]
    pending = [r for r in rows if r.get("realized") is None]
    hits = []
    for r in realized:
        lo, hi, act = r.get("predicted_low"), r.get("predicted_high"), r["realized"]
        hit = lo is not None and hi is not None and lo <= act <= hi
        hits.append((r, hit))
    n = len(realized)
    hit_rate = sum(1 for _, h in hits if h) / n if n else 0.0
    if n == 0:
        verdict, score = "UNKNOWN", None
    else:
        score = 5 if hit_rate >= 0.7 else 3 if hit_rate >= 0.5 else 1
        verdict = "PASS" if score == 5 else "WEAK" if score == 3 else "FAIL"
    return {
        "forecast_id": forecast_id or "ALL",
        "realized_count": n,
        "pending_count": len(pending),
        "hit_rate": round(hit_rate, 3),
        "verdict": verdict,
        "score": score,
        "hits": hits,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="钦天监预测·回测评分器(对照真实结局)")
    ap.add_argument("--forecast-id")
    ap.add_argument("--ledger", action="store_true", help="把回测判定写入真值台账")
    a = ap.parse_args()
    r = backtest(a.forecast_id)
    print(f"=== 预测回测: {r['forecast_id']} ===")
    print(f"  已兑现 {r['realized_count']} 项 / 待兑现 {r['pending_count']} 项")
    if r["realized_count"] == 0:
        print("  ❓ UNKNOWN: 暂无已兑现指标(数据门未开)——回填 realized 后自动评分")
    else:
        for row, hit in r["hits"]:
            print(
                f"  {'✅命中' if hit else '❌偏离'} {row['metric']}({row['scenario']}): "
                f"预测[{row['predicted_low']}-{row['predicted_high']}{row.get('unit', '')}] "
                f"实际{row['realized']}"
            )
        icon = "✅" if r["verdict"] == "PASS" else "⚠️" if r["verdict"] == "WEAK" else "❌"
        print(f"  {icon} 命中率 {r['hit_rate'] * 100:.0f}% → {r['verdict']}")
    if a.ledger and r["realized_count"] > 0:
        from src.truth_ledger import record

        ev = f"命中率{r['hit_rate']},已兑现{r['realized_count']}项"
        record(
            "tianjian_forecast",
            "forecast_backtest",
            r["verdict"],
            score=r["score"],
            case_id=f"backtest_{r['forecast_id']}",
            detail=ev,
            evidence=ev,
        )
        print(f"→ 已写入真值台账: tianjian_forecast/backtest_{r['forecast_id']} = {r['verdict']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
