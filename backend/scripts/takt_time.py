#!/usr/bin/env python3
"""Takt Time 统计 — 每个蜂群真实被采纳的输出数量。

大野耐一：「先数节拍，再谈平台化」。
白板上只有一个数字重要：今天有几个蜂群跑了真实案例、输出被真实用户采纳。

判定「被采纳」的标准（保守）：
  1. 运行成功（has_final_output=true）
  2. quality_score >= 5.0（或 null 但没有报错）
  3. 非 demo/test 任务（task_input 不包含明显的测试关键词）

用法:
  python scripts/takt_time.py              # 最近 7 天
  python scripts/takt_time.py --days 30   # 最近 30 天
  python scripts/takt_time.py --swarm opc # 只看某个蜂群
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = ROOT / "data" / "default" / "runs"

# 测试/演示任务的特征词（这些 run 不算被采纳）
_TEST_KEYWORDS = {"演示", "demo", "test", "测试", "示例", "example", "dummy", "sample"}

ADOPTION_MIN_QUALITY = 5.0  # 质量分低于此认为未被采纳


def _is_test_task(task_input: str) -> bool:
    task_lower = task_input.lower()
    return any(kw in task_lower for kw in _TEST_KEYWORDS)


def _parse_run_id_time(run_id: str) -> datetime | None:
    """run_id 格式: YYYYMMDD_HHMMSS_microseconds"""
    try:
        dt_part = run_id[:15]  # YYYYMMDD_HHMMSS
        return datetime.strptime(dt_part, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _swarm_id_from_config_path(config_path: str) -> str:
    """从 config_path 提取蜂群 ID: config/flow_opc.yaml → opc"""
    name = Path(config_path).stem  # flow_opc
    return name[5:] if name.startswith("flow_") else name


def load_runs(days: int, swarm_filter: str | None = None) -> list[dict]:
    """加载指定时间范围内的所有 run_meta.json。"""
    if not RUNS_DIR.exists():
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    runs = []

    for run_dir in RUNS_DIR.iterdir():
        if not run_dir.is_dir():
            continue
        run_time = _parse_run_id_time(run_dir.name)
        if run_time is None or run_time < cutoff:
            continue

        meta_path = run_dir / "run_meta.json"
        if not meta_path.exists():
            continue

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meta["_run_time"] = run_time
            meta["_swarm_id"] = _swarm_id_from_config_path(meta.get("config_path", ""))
            if swarm_filter and meta["_swarm_id"] != swarm_filter:
                continue
            runs.append(meta)
        except Exception:  # noqa: BLE001
            continue

    return sorted(runs, key=lambda r: r["_run_time"])


def compute_takt(runs: list[dict]) -> dict:
    """计算每个蜂群的 takt 指标。"""
    by_swarm: dict[str, list[dict]] = defaultdict(list)
    for r in runs:
        by_swarm[r["_swarm_id"]].append(r)

    result = {}
    for swarm_id, swarm_runs in sorted(by_swarm.items()):
        total = len(swarm_runs)
        successful = [r for r in swarm_runs if r.get("has_final_output")]
        not_test = [r for r in successful if not _is_test_task(r.get("task_input", ""))]

        def _numeric_score(r: dict) -> float | None:
            s = r.get("quality_score")
            if s is None:
                return None
            return float(s) if isinstance(s, (int, float)) else None

        quality_scores = [s for r in not_test if (s := _numeric_score(r)) is not None]
        adopted = [r for r in not_test if (s := _numeric_score(r)) is None or s >= ADOPTION_MIN_QUALITY]

        result[swarm_id] = {
            "total_runs": total,
            "successful": len(successful),
            "non_test": len(not_test),
            "adopted": len(adopted),
            "avg_quality": round(sum(quality_scores) / len(quality_scores), 2) if quality_scores else None,
            "active": len(adopted) > 0,
        }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="蜂群 Takt Time 统计")
    parser.add_argument("--days", type=int, default=7, help="统计天数（默认 7）")
    parser.add_argument("--swarm", help="只统计某个蜂群")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()

    runs = load_runs(args.days, swarm_filter=args.swarm)
    if not runs:
        print(f"⚠️  最近 {args.days} 天内没有运行记录（{RUNS_DIR}）")
        return 0

    takt = compute_takt(runs)

    if args.json:
        print(json.dumps(takt, ensure_ascii=False, indent=2))
        return 0

    # 白板视图
    active_swarms = [sid for sid, m in takt.items() if m["active"]]
    total_adopted = sum(m["adopted"] for m in takt.values())

    print(f"\n{'═' * 60}")
    print(f"  Takt Time 白板 — 最近 {args.days} 天")
    print(f"{'═' * 60}")
    print(f"  活跃蜂群: {len(active_swarms)}/{len(takt)}  |  总采纳输出: {total_adopted}")
    print(f"{'─' * 60}")
    print(f"  {'蜂群':<20} {'总run':>6} {'成功':>6} {'采纳':>6} {'均质量':>8}  状态")
    print(f"{'─' * 60}")

    for swarm_id, m in sorted(takt.items(), key=lambda x: -x[1]["adopted"]):
        status = "🟢 活跃" if m["active"] else "⚫ 沉默"
        avg_q = f"{m['avg_quality']:.1f}" if m["avg_quality"] is not None else "  N/A"
        print(f"  {swarm_id:<20} {m['total_runs']:>6} {m['successful']:>6} {m['adopted']:>6} {avg_q:>8}  {status}")

    print(f"{'─' * 60}")
    if not active_swarms:
        print("  ⚠️  无活跃蜂群 — 没有任何蜂群产生被采纳的输出")
    else:
        print(f"  活跃: {', '.join(active_swarms)}")

    silent = [sid for sid, m in takt.items() if not m["active"]]
    if silent:
        print(f"  沉默: {', '.join(silent)}")

    print(f"{'═' * 60}\n")
    print(f"  → 唯一重要的指标: {total_adopted} 个被真实用户采纳的输出（最近 {args.days} 天）")
    print(f"  → 在扩建新蜂群之前，先让活跃蜂群数量超过沉默蜂群数量\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
