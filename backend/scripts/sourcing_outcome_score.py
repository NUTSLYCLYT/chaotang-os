#!/usr/bin/env python3
"""供应链结局回写评分器(飞轮真燃料) —— 大神会审建议一落地。

复用 forecast_backtest.py 的 predict→realize→compare 模具(Karpathy 钦点:
"你们已在 tianjian_forecast 造好正确的飞轮模具,现在按到供应链上")。

读 eval/sourcing_outcome.jsonl,对每张'已关闭'的采购单,把当初推荐对账现实:
  价格守诺  —— 实际成交价 vs 当初报价(超报价越多越差)
  交期守约  —— 实到周期 ≤ 承诺周期?
  来料合格  —— 首批合格率 ≥ 98%?
这才是供应链的'真值'(Bezos/Deming/张小龙一致):不是输出格式对不对,是下单后现实发生了什么。

数据门:三个 realized 字段任一为 null=未结算,不评分(诚实标'数据门未开')。
评分: 三项全达标→PASS / 仅价格超10%或迟交或合格<98%其一→WEAK / 多项失守→FAIL / 未结算→UNKNOWN
用法: python scripts/sourcing_outcome_score.py [--ledger]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
SRC = ROOT / "eval" / "sourcing_outcome.jsonl"
PASS_RATE_FLOOR = 98.0
PRICE_TOL = 0.10


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
    """单张采购单结局 → (verdict, evidence)。"""
    rp, al, pr = r.get("real_price_cny_wh"), r.get("actual_lead_weeks"), r.get("incoming_pass_rate_pct")
    if rp is None or al is None or pr is None:
        return "UNKNOWN", "未结算(成交价/实到/合格率有缺)"
    issues = []
    q = r.get("quoted_price_cny_wh")
    if q and abs(rp - q) / q > PRICE_TOL:
        issues.append(f"成交价{rp}超报价{q}的{abs(rp - q) / q * 100:.0f}%")
    pl = r.get("promised_lead_weeks")
    if pl and al > pl:
        issues.append(f"迟交({al}周>承诺{pl}周)")
    if pr < PASS_RATE_FLOOR:
        issues.append(f"来料合格{pr}%<{PASS_RATE_FLOOR}%")
    if not issues:
        return "PASS", f"价{rp}/交{al}周/合格{pr}% 全守诺"
    return ("FAIL" if len(issues) >= 2 else "WEAK"), "; ".join(issues)


def main() -> int:
    ap = argparse.ArgumentParser(description="供应链结局回写评分器")
    ap.add_argument("--ledger", action="store_true")
    a = ap.parse_args()
    rows = load()
    closed = [r for r in rows if r.get("real_price_cny_wh") is not None]
    print(f"=== 供应链结局回写 === 共 {len(rows)} 单 / 已结算 {len(closed)} 单")
    if not rows:
        print("  ❓ 暂无采购单结局(数据门未开)——采购单关闭后回填即评分,飞轮燃料从这里进")
        return 0
    from src.truth_ledger import record

    for r in rows:
        v, ev = score_one(r)
        icon = {"PASS": "✅", "WEAK": "⚠️", "FAIL": "❌", "UNKNOWN": "❓"}[v]
        print(f"  {icon} {v:<7} {r.get('supplier', '?')}/{r.get('model', '?')}: {ev}")
        if a.ledger and v != "UNKNOWN":
            # 采购单天然带鉴权(po_id) → provenance=authenticated(飞轮燃料源头干净)
            prov = "authenticated" if r.get("po_id") else "orphan"
            record(
                "sourcing",
                "sourcing_outcome",
                v,
                case_id=f"po_{r.get('po_id') or r.get('run_id')}",
                detail=ev,
                evidence=ev,
                provenance=prov,
            )
    if a.ledger and closed:
        print("→ 已结算结局写入真值台账(checker=sourcing_outcome)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
