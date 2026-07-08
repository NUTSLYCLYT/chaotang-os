#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""锦衣卫 vet check —— 情报入蜂群前的可信度把关,判定写真值台账。

用法:
  python scripts/jinyiwei_vet_check.py "<情报声明>" --source 国电南瑞官网公告 --source 某媒体 [--case-id X --swarm ima]
判定: 入库→PASS(可入) / 待核→UNKNOWN(需人核) / 拒→FAIL(不入)。给 --case-id 才写台账。
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from src.jinyiwei_vet import vet_and_record, vet_intel  # noqa: E402

ICON = {"入库": "✅", "待核": "🟡", "拒": "❌"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("claim", help="情报声明")
    ap.add_argument("--source", action="append", default=[], help="来源(可多次)")
    ap.add_argument("--case-id", default="", help="给定则写真值台账(把关入库)")
    ap.add_argument("--swarm", default="ima", help="归属蜂群(默认 ima)")
    a = ap.parse_args()

    print("=== 锦衣卫 vet 入库把关 ===")
    if a.case_id:
        r = vet_and_record(a.claim, a.source, swarm=a.swarm, case_id=a.case_id)
        print(
            f"  {ICON[r['decision']]} {r['decision']} (verdict={r['verdict']}) — {r['reason']}"
        )
        print(
            f"→ 已写真值台账: {a.swarm}/{a.case_id} = {r['verdict']} (gate 仅 PASS 放行入库)"
        )
    else:
        r = vet_intel(a.claim, a.source)
        print(f"  {ICON[r['decision']]} {r['decision']} [{r['grade']}] — {r['reason']}")
        print("  (未给 --case-id,仅核查未写台账)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
