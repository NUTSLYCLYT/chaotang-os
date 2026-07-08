#!/usr/bin/env python3
"""飞轮统计看板 — 查看数据飞轮的积累状态

用法:
  python scripts/flywheel_stats.py                  # 所有 flow 统计
  python scripts/flywheel_stats.py --flow PACK研发蜂群流程  # 指定 flow
  python scripts/flywheel_stats.py --edge-cases     # 列出所有边界案例
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description="飞轮数据统计")
    parser.add_argument("--flow", "-f", help="过滤指定 flow")
    parser.add_argument("--edge-cases", "-e", action="store_true", help="列出边界案例")
    parser.add_argument("--limit", "-n", type=int, default=200)
    args = parser.parse_args()

    from src.run_logger import flywheel_stats, load_flywheel

    stats = flywheel_stats(flow_name=args.flow)

    print("\n═══ 数据飞轮统计 ═══")
    print(f"  总运行次数    : {stats['total_runs']}")
    print(f"  平均 QA 评分  : {stats.get('avg_qa_score', 0)}")

    print("\n  边界案例分布:")
    for k, v in stats.get("edge_case_distribution", {}).items():
        print(f"    {k:<30} {v} 次")

    print("\n  门控阻断率:")
    for sid, info in stats.get("gate_block_rates", {}).items():
        bar = "█" * int(info["blocked_pct"] / 5)
        print(f"    {sid:<35} {bar} {info['blocked_pct']}%  (n={info['total']})")

    if args.edge_cases:
        print("\n  最近边界案例详情:")
        records = load_flywheel(flow_name=args.flow, limit=args.limit)
        for r in records[:20]:
            if not r.edge_cases:
                continue
            print(f"\n  [{r.run_id}] {r.task_input[:60]}…")
            for ec in r.edge_cases:
                print(f"    [{ec.type}] {ec.step_id}: {ec.detail[:80]}")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
