"""RL 训练数据导出脚本 — 从 runs 目录中提取 DPO 格式配对样本。

用法:
    python3 scripts/export_rl_data.py [--min-score SCORE] [--output FILE] [--runs-dir DIR]

输出格式（JSONL，每行一条 DPO 样本）:
    {
        "prompt": "...",
        "chosen": {"output": "...", "score": 4.5},
        "rejected": {"output": "...", "score": 2.1},
        "metadata": {"flow": "flow_opc", "step": "market_intel", "run_id": "..."}
    }
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict
from typing import Optional


def _find_runs_dir(runs_dir_arg: Optional[str]) -> Optional[Path]:
    """按优先级查找 runs 目录。"""
    if runs_dir_arg:
        p = Path(runs_dir_arg)
        return p if p.exists() else None

    # 脚本所在目录的父目录（即 jiqun_ai/）
    base = Path(__file__).resolve().parent.parent

    candidates = [
        base / "data" / "default" / "runs",
        base / "runs",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def _load_step_records(runs_dir: Path):
    """遍历 runs 目录，收集所有 step 记录。

    每条记录结构:
        {
            "run_id": str,
            "flow_name": str,
            "step_id": str,
            "agent_name": str,
            "output": str,
            "rendered_context": str,
            "quality_score": float | None,
        }
    """
    records = []

    for run_dir in runs_dir.iterdir():
        if not run_dir.is_dir():
            continue

        meta_path = run_dir / "run_meta.json"
        if not meta_path.exists():
            continue

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        flow_name = meta.get("flow_name", "unknown")
        run_id = meta.get("run_id", run_dir.name)

        # 读取 quality_score 汇总（run 级别）
        run_quality = meta.get("quality_score")
        run_total = None
        if run_quality and isinstance(run_quality, dict):
            run_total = run_quality.get("total_score")

        # 读取各 step 文件
        for step_file in sorted(run_dir.glob("step_*.json")):
            try:
                step_data = json.loads(step_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue

            step_id = step_data.get("step_id", "unknown")
            agent_name = step_data.get("agent_name", "unknown")
            output = step_data.get("output", "")
            rendered_context = step_data.get("rendered_context", "")

            # 优先使用 step 级质量评分，其次用 run 级
            step_qs = step_data.get("quality_score")
            step_score = None
            if step_qs and isinstance(step_qs, dict):
                step_score = step_qs.get("total_score")

            quality_score = step_score if step_score is not None else run_total

            records.append({
                "run_id": run_id,
                "flow_name": flow_name,
                "step_id": step_id,
                "agent_name": agent_name,
                "output": output,
                "rendered_context": rendered_context,
                "quality_score": quality_score,
            })

    return records


def build_dpo_pairs(records, min_score: float = 4.0, reject_threshold: float = 3.0):
    """从 records 中配对 chosen/rejected，生成 DPO 样本列表。"""
    # 按 (flow_name, step_id) 分组
    groups: dict[tuple, list] = defaultdict(list)
    for r in records:
        if r["quality_score"] is not None:
            key = (r["flow_name"], r["step_id"])
            groups[key].append(r)

    pairs = []
    for (flow_name, step_id), group in groups.items():
        chosen_candidates = [r for r in group if r["quality_score"] >= min_score]
        rejected_candidates = [r for r in group if r["quality_score"] < reject_threshold]

        if not chosen_candidates or not rejected_candidates:
            continue

        # 取最高分 chosen，最低分 rejected
        chosen = max(chosen_candidates, key=lambda r: r["quality_score"])
        rejected = min(rejected_candidates, key=lambda r: r["quality_score"])

        # prompt 使用 chosen 的 rendered_context（去除无意义空上下文）
        prompt = chosen.get("rendered_context") or chosen.get("output", "")

        pairs.append({
            "prompt": prompt,
            "chosen": {
                "output": chosen["output"],
                "score": chosen["quality_score"],
            },
            "rejected": {
                "output": rejected["output"],
                "score": rejected["quality_score"],
            },
            "metadata": {
                "flow": flow_name,
                "step": step_id,
                "run_id": chosen["run_id"],
                "rejected_run_id": rejected["run_id"],
            },
        })

    return pairs


def main():
    parser = argparse.ArgumentParser(
        description="RL 训练数据导出 — 从 runs 目录提取 DPO 格式样本"
    )
    parser.add_argument(
        "--min-score",
        type=float,
        default=4.0,
        help="chosen 样本的最低质量分（默认 4.0）",
    )
    parser.add_argument(
        "--output",
        default="rl_dataset.jsonl",
        help="输出文件路径（默认 rl_dataset.jsonl）",
    )
    parser.add_argument(
        "--runs-dir",
        default=None,
        help="runs 目录路径（默认自动查找 data/default/runs/ 或 runs/）",
    )
    args = parser.parse_args()

    runs_dir = _find_runs_dir(args.runs_dir)
    if runs_dir is None:
        print("No runs found, output 0 samples")
        sys.exit(0)

    records = _load_step_records(runs_dir)
    if not records:
        print("No runs found, output 0 samples")
        sys.exit(0)

    pairs = build_dpo_pairs(records, min_score=args.min_score, reject_threshold=3.0)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"导出完成: {len(pairs)} 条 DPO 样本 → {output_path}")
    print(f"  runs 目录:     {runs_dir}")
    print(f"  step 记录总数: {len(records)}")
    print(f"  chosen 阈值:   >= {args.min_score}")
    print(f"  rejected 阈值: < 3.0")


if __name__ == "__main__":
    main()
