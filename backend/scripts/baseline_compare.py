#!/usr/bin/env python3
"""single-model baseline vs 蜂群 对比器 — 落地大神③"先证明 6 层编排比单模型强多少"。

对黄金评测集里的每个 task,同时跑:
  (A) baseline : 一个强模型 + 一个综合 prompt,一次调用产出完整方案
  (B) swarm    : 对应蜂群的多步 flow(FlowEngine)
然后做零成本自动初筛:
  - dimension_coverage : rubric 维度被覆盖了几个(关键词存在性)
  - spec_hit           : 该 task 的硬约束关键词命中率(检验是否咬住具体规格)
  - 输出长度 / 耗时
人工质量(human_score)仍需领域专家在 eval/*.yaml 里填——自动分只是初筛,不是真相。

用法:
  # 跑 opc 黄金集的某几个 task(省钱,先验证工具)
  python scripts/baseline_compare.py --golden eval/opc_golden.yaml --tasks opc-01
  # 跑全部
  python scripts/baseline_compare.py --golden eval/opc_golden.yaml --all
  # 仅自动初筛,不跑蜂群(只跑 baseline)
  python scripts/baseline_compare.py --golden eval/opc_golden.yaml --tasks opc-01 --baseline-only

注意:外网到 api.deepseek.com 走代理会失败,跑前先 `unset HTTP(S)_PROXY` 或把
api.deepseek.com 加进 NO_PROXY;DEEPSEEK_API_KEY 需在环境或 .env 里。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

# 加载 .env(若有)
_envf = ROOT / ".env"
if _envf.exists():
    for line in _envf.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and k.strip() not in os.environ:
            os.environ[k.strip()] = v.strip()

GREEN, RED, YEL, CYAN, RST, BOLD = (
    "\033[92m",
    "\033[91m",
    "\033[93m",
    "\033[96m",
    "\033[0m",
    "\033[1m",
)


def _auto_score(text: str, dimensions: list[dict], spec: list[str]) -> dict:
    """零成本初筛:维度覆盖数 + 硬约束命中。"""
    t = text or ""
    covered = [d["key"] for d in dimensions if any(kw in t for kw in d.get("any", []))]
    spec_hit = [s for s in spec if s in t]
    return {
        "dim_covered": len(covered),
        "dim_total": len(dimensions),
        "dim_missing": [d["key"] for d in dimensions if d["key"] not in covered],
        "spec_hit": len(spec_hit),
        "spec_total": len(spec),
        "spec_missing": [s for s in spec if s not in spec_hit],
        "chars": len(t),
    }


def _run_baseline(task: str, output_fields: list[str]) -> tuple[str, float]:
    """单模型一次调用产出完整方案(公平对照:同样要求覆盖 output_fields)。"""
    from src.model_adapter import ModelAdapter

    fields = " / ".join(output_fields) if output_fields else "完整方案各要素"
    system = (
        "你是资深储能解决方案专家。针对客户需求,一次性输出结构完整、数据具体、"
        "可直接交付的方案。务实、不空泛,紧扣客户给出的每一项硬性规格(温度/容量/预算/周期等)。"
    )
    user = (
        f"客户需求:\n{task}\n\n请输出完整方案,逐节覆盖:{fields}。\n每节给具体内容(含关键数字与选型依据),不要泛泛而谈。"
    )
    adapter = ModelAdapter(
        model="openai/deepseek-reasoner",
        api_base="https://api.deepseek.com/v1",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    )
    t0 = time.time()
    res = adapter.call(system_prompt=system, user_prompt=user)
    out = res.get("output", "") if isinstance(res, dict) else str(res)
    return out, round(time.time() - t0, 1)


def _run_swarm(swarm: str, task: str) -> tuple[str, float, str]:
    from src.flow_engine import FlowEngine

    cfg = f"config/flow_{swarm}.yaml"
    t0 = time.time()
    engine = FlowEngine(cfg)
    result = engine.run(task)
    elapsed = round(time.time() - t0, 1)
    run_id = getattr(result, "run_id", "") or ""
    # 公平对照:取全部业务步骤产出(不只是末步 QA 摘要),拼成蜂群完整交付物。
    out = ""
    if run_id:
        import glob

        parts = []
        for f in sorted(glob.glob(f"data/default/runs/{run_id}/step_*.json")):
            if "qa_tech_support" in f:
                continue  # QA 是评分,不是交付内容
            try:
                parts.append(str(json.load(open(f)).get("output", "")))
            except Exception:  # noqa: BLE001
                continue
        out = "\n\n".join(p for p in parts if p)
    if not out:  # 兜底:run 产物不可读时退回 final_output
        fo = getattr(result, "final_output", None)
        out = json.dumps(fo, ensure_ascii=False) if isinstance(fo, (dict, list)) else str(fo)
    return out, elapsed, run_id


def main() -> int:
    ap = argparse.ArgumentParser(description="single-model baseline vs 蜂群 对比器")
    ap.add_argument("--golden", required=True, help="黄金评测集 yaml 路径")
    ap.add_argument("--tasks", nargs="+", default=[], help="指定 task id")
    ap.add_argument("--all", action="store_true", help="跑全部 task")
    ap.add_argument("--baseline-only", action="store_true", help="只跑 baseline,不跑蜂群")
    ap.add_argument("--output", default="baseline_compare_report.json")
    args = ap.parse_args()

    gold = yaml.safe_load(Path(args.golden).read_text(encoding="utf-8"))
    swarm = gold["swarm"]
    dims = gold["rubric"]["dimensions"]
    output_fields = yaml.safe_load(Path(f"config/flow_{swarm}.yaml").read_text(encoding="utf-8")).get(
        "output_fields", []
    )

    tasks = gold["tasks"]
    if not args.all:
        if not args.tasks:
            print(f"{RED}需 --tasks <id...> 或 --all{RST}")
            return 2
        tasks = [t for t in tasks if t["id"] in args.tasks]
    if not tasks:
        print(f"{RED}没有匹配的 task{RST}")
        return 2

    if not os.environ.get("DEEPSEEK_API_KEY"):
        print(f"{YEL}警告:未检测到 DEEPSEEK_API_KEY,调用会失败{RST}")

    print(f"\n{BOLD}{CYAN}=== baseline vs swarm[{swarm}] · {len(tasks)} task ==={RST}\n")
    report = []
    for i, t in enumerate(tasks, 1):
        tid, task = t["id"], t["task"]
        spec = t.get("spec_must_hit", [])
        print(f"[{i}/{len(tasks)}] {BOLD}{tid}{RST}  {task[:40]}...")

        b_out, b_t = _run_baseline(task, output_fields)
        b_sc = _auto_score(b_out, dims, spec)
        row = {"id": tid, "baseline": {**b_sc, "elapsed": b_t}}
        print(
            f"   baseline : 维度 {b_sc['dim_covered']}/{b_sc['dim_total']}  "
            f"硬约束 {b_sc['spec_hit']}/{b_sc['spec_total']}  "
            f"{b_sc['chars']}字  {b_t}s"
        )

        if not args.baseline_only:
            try:
                s_out, s_t, rid = _run_swarm(swarm, task)
                s_sc = _auto_score(s_out, dims, spec)
                row["swarm"] = {**s_sc, "elapsed": s_t, "run_id": rid}
                print(
                    f"   swarm    : 维度 {s_sc['dim_covered']}/{s_sc['dim_total']}  "
                    f"硬约束 {s_sc['spec_hit']}/{s_sc['spec_total']}  "
                    f"{s_sc['chars']}字  {s_t}s  ({rid})"
                )
                dd = s_sc["dim_covered"] - b_sc["dim_covered"]
                ds = s_sc["spec_hit"] - b_sc["spec_hit"]
                verdict = (
                    f"{GREEN}蜂群胜{RST}"
                    if (dd + ds) > 0
                    else f"{YEL}打平/baseline 不输{RST}"
                    if (dd + ds) == 0
                    else f"{RED}baseline 反超{RST}"
                )
                print(f"   Δ(蜂群-基线): 维度{dd:+d} 硬约束{ds:+d} → {verdict}")
            except Exception as e:  # noqa: BLE001
                row["swarm"] = {"error": f"{type(e).__name__}: {str(e)[:160]}"}
                print(f"   {RED}swarm 失败: {row['swarm']['error']}{RST}")
        report.append(row)
        print()

    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"报告写入: {args.output}")
    print(f"{YEL}提醒:自动分只是初筛(有没有谈到);真质量请在 {args.golden} 填 human_score。{RST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
