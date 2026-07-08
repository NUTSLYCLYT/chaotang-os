#!/usr/bin/env python3
"""量化"假阴性率"——评分过得去、却仍含不可逆风险/幻觉的输出占比。

背景（2026-06-08 大神会审 5/5 否决上线的核心诉求）：
  卡尼曼+戴明指出，当前没人量过"放行的卷轴里到底藏了多少幻觉"。
  这盏灯没点亮就上线 = 替用户的 System 2 关灯。

本脚本只读外部裁判尺子 data/quality_eval_log.jsonl（LLM-judge 评测日志），
对账"评分 vs 真实不可逆风险标记"，输出假阴性率。不碰引擎、不改任何运行产物。

用法：
  python scripts/measure_false_negative_rate.py
  python scripts/measure_false_negative_rate.py --log data/quality_eval_log.jsonl --pass-threshold 4
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

# reasons 里出现这些词，视为软幻觉信号（irreversible_risk_error 之外的补充观测）
HALLUCINATION_MARKERS = ["幻觉", "虚构", "编造", "瞎编", "杜撰", "不存在", "捏造"]


def load_rows(log_path: Path) -> list[dict]:
    rows: list[dict] = []
    with log_path.open("r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                # fail-fast，不静默吞——脏行必须暴露
                print(f"[WARN] line {lineno} JSON 解析失败: {exc}", file=sys.stderr)
    return rows


def has_hallucination_marker(reasons: str) -> bool:
    return any(m in (reasons or "") for m in HALLUCINATION_MARKERS)


def pct(n: int, d: int) -> str:
    return f"{(100.0 * n / d):.1f}%" if d else "n/a"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default="data/quality_eval_log.jsonl")
    ap.add_argument(
        "--pass-threshold",
        type=int,
        default=4,
        help="把 overall >= 阈值 视为'放行级'评分（默认 4 = 良/优）",
    )
    args = ap.parse_args()

    log_path = Path(args.log)
    if not log_path.exists():
        print(f"[FATAL] 找不到 eval 日志: {log_path}", file=sys.stderr)
        return 2

    rows = load_rows(log_path)
    if not rows:
        print("[FATAL] eval 日志为空", file=sys.stderr)
        return 2

    # 运行失败（API/provider 报错，overall=0 且 verdict=运行失败）单独剔除——不是质量失败
    run_failures = [r for r in rows if r.get("verdict") == "运行失败"]
    quality_rows = [r for r in rows if r.get("verdict") != "运行失败"]

    total_q = len(quality_rows)

    verdict_dist = Counter(r.get("verdict", "?") for r in quality_rows)
    overall_dist = Counter(r.get("overall") for r in quality_rows)

    irreversible = [r for r in quality_rows if r.get("irreversible_risk_error") is True]
    halluc = [r for r in quality_rows if has_hallucination_marker(r.get("reasons", ""))]

    thr = args.pass_threshold
    passed = [r for r in quality_rows if isinstance(r.get("overall"), (int, float)) and r["overall"] >= thr]

    # 核心假阴性：评分过得去(>=阈值)，却仍标了不可逆风险
    fn_irreversible = [r for r in passed if r.get("irreversible_risk_error") is True]
    # 软假阴性：评分过得去，reasons 里仍提到幻觉/虚构
    fn_halluc = [
        r
        for r in passed
        if has_hallucination_marker(r.get("reasons", "")) and r.get("irreversible_risk_error") is not True
    ]
    fn_any = [
        r for r in passed if r.get("irreversible_risk_error") is True or has_hallucination_marker(r.get("reasons", ""))
    ]

    print("=" * 68)
    print("假阴性率度量 — 评分过得去却含不可逆风险/幻觉（外部裁判尺子）")
    print("=" * 68)
    print(f"日志: {log_path}  总记录: {len(rows)}  运行失败(剔除): {len(run_failures)}  质量样本: {total_q}")
    print()
    print("【1. 质量分布(外部裁判)】")
    for v in ["优", "良", "及格", "不及格"]:
        print(f"  {v:<4} : {verdict_dist.get(v, 0):>3} 条  ({pct(verdict_dist.get(v, 0), total_q)})")
    other = total_q - sum(verdict_dist.get(v, 0) for v in ["优", "良", "及格", "不及格"])
    if other:
        print(f"  其他 : {other:>3} 条  分布={dict(verdict_dist)}")
    print(f"  overall 原始分布: {dict(sorted((k, overall_dist[k]) for k in overall_dist if k is not None))}")
    print()
    print("【2. 基础危险率(整体水位线)】")
    print(f"  irreversible_risk_error=true : {len(irreversible):>3}/{total_q}  ({pct(len(irreversible), total_q)})")
    print(f"  reasons 含幻觉/虚构标记       : {len(halluc):>3}/{total_q}  ({pct(len(halluc), total_q)})")
    print()
    print(f"【3. ★假阴性率(放行级 overall>={thr} 中仍危险的)★】")
    print(f"  放行级样本(overall>={thr})         : {len(passed):>3}/{total_q}  ({pct(len(passed), total_q)})")
    print(
        f"  其中 irreversible_risk_error : {len(fn_irreversible):>3}/{len(passed)}  ({pct(len(fn_irreversible), len(passed))})  ← 高分谎言(硬)"
    )
    print(
        f"  其中仅 reasons 含幻觉标记     : {len(fn_halluc):>3}/{len(passed)}  ({pct(len(fn_halluc), len(passed))})  ← 高分谎言(软)"
    )
    print(
        f"  合计任一危险信号             : {len(fn_any):>3}/{len(passed)}  ({pct(len(fn_any), len(passed))})  ← 总假阴性率"
    )
    print()

    if fn_irreversible:
        print("【4. 高分谎言样例(评分过门却带不可逆风险，最该警惕)】")
        for r in fn_irreversible[:6]:
            print(f"  · [{r.get('swarm_id')}] overall={r.get('overall')} verdict={r.get('verdict')}")
            print(f"      {(r.get('reasons') or '')[:120]}")
    print()
    print(
        "一句话: 若把 overall>={} 当上线放行门，每放行 100 份，约有 {} 份仍带不可逆风险/幻觉。".format(
            thr, round(100.0 * len(fn_any) / len(passed)) if passed else "n/a"
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
