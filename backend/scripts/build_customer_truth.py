#!/usr/bin/env python3
"""客户真值台账·聚合器(把99笔真实成交 → config/eval/customer_truth.json)。

把 knowledge/real_sales_outcomes.jsonl(从公司销售合同提取的真实成交)按公司聚合成:
  成交笔数 / 总金额 / 首末年份 / 是否复购 / 客单价
让获客蜂群有真尺子:这个客户'真买过吗、复购几次、贡献多少'——竞品偷不走的一手关系资产。

用法: python scripts/build_customer_truth.py
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "knowledge" / "real_sales_outcomes.jsonl"
OUT = ROOT / "config" / "eval" / "customer_truth.json"


def build() -> dict:
    agg: dict[str, dict] = defaultdict(lambda: {"deal_count": 0, "total_cny": 0.0, "years": set()})
    for line in SRC.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        r = json.loads(line)
        name = (r.get("company") or r.get("customer") or "").strip()
        if not name:
            continue
        a = agg[name]
        a["deal_count"] += 1
        a["total_cny"] += float(r.get("amount_cny") or 0)
        if r.get("year"):
            a["years"].add(str(r["year"]))
    customers = {}
    for name, a in agg.items():
        years = sorted(a["years"])
        customers[name] = {
            "deal_count": a["deal_count"],
            "total_cny": round(a["total_cny"], 2),
            "avg_deal_cny": round(a["total_cny"] / a["deal_count"], 2) if a["deal_count"] else 0,
            "first_year": years[0] if years else None,
            "last_year": years[-1] if years else None,
            "repeat": a["deal_count"] > 1,
        }
    return customers


def main() -> int:
    if not SRC.exists():
        print(f"无成交数据: {SRC}", file=sys.stderr)
        return 1
    customers = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(customers, ensure_ascii=False, indent=2), encoding="utf-8")
    repeat = {k: v for k, v in customers.items() if v["repeat"]}
    top = sorted(customers.items(), key=lambda kv: kv[1]["total_cny"], reverse=True)[:6]
    print(
        f"✅ {len(customers)} 家客户 / {sum(v['deal_count'] for v in customers.values())} 笔成交 → {OUT.relative_to(ROOT)}"
    )
    print(f"   复购客户 {len(repeat)} 家(真·关系资产)")
    print("   贡献Top6:")
    for name, v in top:
        print(f"     {name[:20]:<20} {v['deal_count']}笔 {v['total_cny']:.0f}元 {'[复购]' if v['repeat'] else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
