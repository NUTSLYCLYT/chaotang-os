#!/usr/bin/env python3
"""求解器优先路由 — 落地大神共识①"倒转架构":让物理求解器当地心引力,蜂群只啃硬骨头。

机制(Altman/张小龙处方:cheap-first, escalate-on-physics-flag):
  1. 先用单模型(便宜)出草案;
  2. 零成本确定性约束求解器扫草案;
  3. 只有当求解器在物理检查上判 FAIL / WARN / 关键 UNKNOWN(真有物理取舍/风险)时,
     才升级到 5 步蜂群(慢 4.5× 但值得 —— 它在拦一次会赔钱的错)。
  否则直接采纳便宜草案。简单任务永不进蜂群 → "4.5× 慢"只花在硬骨头上。

把蜂群从"更聪明的写手"重定义成"签字前最后一道物理防线"。

用法:
  python scripts/swarm_router.py --task "..."                 # 跑一条,决策+(必要时)升级
  python scripts/swarm_router.py --golden eval/opc_golden.yaml --dry   # 零成本预演 10 例路由决策
  --execute-swarm  升级时真跑蜂群(否则只报"应升级")
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
import opc_constraint_check as cc  # noqa: E402

# 触发升级的物理检查(预算只 warn,不触发升级)
ESCALATE_CHECKS = {"低温-化学体系匹配", "极寒液冷需配加热", "PCS功率配置", "预制舱消防合规"}


def _escalate_reason(results: list[dict], task: str) -> str | None:
    has_cold = cc._regex_num_temp(task) is not None
    for c in results:
        if c["check"] not in ESCALATE_CHECKS:
            continue
        if c["status"] in ("FAIL", "WARN"):
            return f"{c['check']}={c['status']}({c['detail'][:40]})"
        if c["status"] == "UNKNOWN" and has_cold and c["check"] == "低温-化学体系匹配":
            return f"{c['check']}=UNKNOWN(有低温工况却判不出体系,需蜂群厘清)"
    return None


def _draft(task: str) -> str:
    from src.model_adapter import ModelAdapter

    a = ModelAdapter(
        model="openai/deepseek-chat",
        api_base="https://api.deepseek.com/v1",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    )
    r = a.call(system_prompt="你是储能方案专家,简洁给出方案要点(含化学体系/PCS/温控/合规/报价)。", user_prompt=task)
    return r.get("output", "") if isinstance(r, dict) else str(r)


def route(task: str, p: dict, *, dry: bool, execute_swarm: bool) -> dict:
    if dry:
        # 零成本预演:用任务侧物理信号粗判(不出草案、不调模型)
        t = cc._regex_num_temp(task)
        cont = bool(cc._regex_capacity_kwh(task))
        signals = []
        if t is not None and t <= -20:
            signals.append(f"低温{t}℃(化学选型有真取舍)")
        if t is not None and t <= -40:
            signals.append("极寒(强物理陷阱)")
        if "集装箱" in task or "预制舱" in task:
            signals.append("预制舱(合规)")
        decision = "SWARM" if signals else "SINGLE_MODEL"
        return {"mode": "dry", "decision": decision, "reason": "; ".join(signals) or "无物理陷阱信号"}

    draft = _draft(task)
    chk = cc.check_solution(task, draft, p, use_llm=False)
    reason = _escalate_reason(chk["results"], task)
    if not reason:
        return {
            "mode": "live",
            "decision": "SINGLE_MODEL",
            "reason": "求解器未发现物理问题,采纳便宜草案",
            "tally": chk["tally"],
            "draft_chars": len(draft),
        }
    out = {"mode": "live", "decision": "SWARM", "reason": reason, "tally": chk["tally"], "draft_chars": len(draft)}
    if execute_swarm:
        from src.flow_engine import FlowEngine

        t0 = time.time()
        res = FlowEngine("config/flow_opc.yaml").run(task)
        out["swarm_run_id"] = getattr(res, "run_id", "")
        out["swarm_elapsed"] = round(time.time() - t0, 1)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="求解器优先路由")
    ap.add_argument("--task")
    ap.add_argument("--golden")
    ap.add_argument("--dry", action="store_true", help="零成本预演(任务侧信号,不调模型)")
    ap.add_argument("--execute-swarm", action="store_true")
    args = ap.parse_args()
    p = cc.load_params()

    tasks = []
    if args.golden:
        tasks = [(t["id"], t["task"]) for t in yaml.safe_load(Path(args.golden).read_text(encoding="utf-8"))["tasks"]]
    elif args.task:
        tasks = [("task", args.task)]
    else:
        print("需 --task 或 --golden")
        return 2

    n_swarm = 0
    print(f"\n=== 求解器优先路由 ({'预演' if args.dry else '实跑'}) · {len(tasks)} 任务 ===\n")
    for tid, task in tasks:
        r = route(task, p, dry=args.dry, execute_swarm=args.execute_swarm)
        icon = "🐝 SWARM      " if r["decision"] == "SWARM" else "⚡ SINGLE_MODEL"
        if r["decision"] == "SWARM":
            n_swarm += 1
        extra = f" run={r['swarm_run_id']}" if r.get("swarm_run_id") else ""
        print(f"  {icon}  {tid}: {r['reason']}{extra}")
    pct = 100 * n_swarm / len(tasks)
    print(f"\n升级蜂群 {n_swarm}/{len(tasks)} ({pct:.0f}%) · 其余 {len(tasks) - n_swarm} 走便宜路径")
    print(
        f"→ 若全跑蜂群需 {len(tasks)} 次 5 步编排;路由后只 {n_swarm} 次,省 {len(tasks) - n_swarm} 次 ×(4.5 倍延迟+成本)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
