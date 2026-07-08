#!/usr/bin/env python3
"""UNKNOWN 热力图 — 落地张一鸣点子③:UNKNOWN 是金子,它标出"行业在哪拍脑袋"。

聚合约束求解器报告里每个维度的 PASS/FAIL/WARN/UNKNOWN 频次。
高频 UNKNOWN = 这个物理量行业里没人有可信参数 = 补数据的优先级(飞轮燃料)。

用法:
  python scripts/unknown_heatmap.py constraint_check_opc_llm.json [更多报告...]
"""

from __future__ import annotations

import collections
import json
import sys
from pathlib import Path


def main() -> int:
    files = sys.argv[1:] or ["constraint_check_opc_llm.json"]
    by_check: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    n = 0
    for f in files:
        for row in json.loads(Path(f).read_text(encoding="utf-8")):
            n += 1
            for c in row.get("results", []):
                by_check[c["check"]][c["status"]] += 1

    print(f"\n=== UNKNOWN 热力图 (基于 {n} 个方案 / {len(files)} 份报告) ===\n")
    print(f"{'约束维度':<22}{'UNKNOWN':>9}{'FAIL':>7}{'WARN':>7}{'PASS':>7}   补数据优先级")
    print("-" * 72)
    rows = sorted(by_check.items(), key=lambda kv: -kv[1]["UNKNOWN"])
    for check, cnt in rows:
        u = cnt["UNKNOWN"]
        pri = "🔴 高" if u >= n * 0.5 else ("🟡 中" if u >= n * 0.2 else "🟢 低")
        print(f"{check:<22}{u:>9}{cnt['FAIL']:>7}{cnt['WARN']:>7}{cnt['PASS']:>7}   {pri}")
    print("\n解读:🔴 高频 UNKNOWN = 行业认知缺口 → 每补一个(实测/第三方验证),求解器覆盖率↑、下一份判得更准。")
    print("飞轮燃料 = 你获客生意天然就有的真实方案流量,别人烧钱都没有这个入口。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
