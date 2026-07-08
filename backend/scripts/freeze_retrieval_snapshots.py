#!/usr/bin/env python3
"""捕获检索快照 → 写回 golden case，把带 RAG 的蜂群 input 钉成可复现常量。

会审地基（2026-06-08）：带 knowledge_pre_retrieval / 动态电芯的蜂群，真实 input
= task + 当时命中的库片段。本工具对每个检索蜂群的每条 golden case 跑一次实时检索，
把结果 + sha256 冻进 case 的 retrieved_snapshot，之后 eval_ci.py 一律注入冻结快照
（run(context_override=...)）、不再走实时检索 → before/after delta 可归因。

这是流水线里**唯一需要检索后端**的一步：后端未灌库时检索返回空串，工具仍写出合法的
"冻结空"快照（empty=true，hash 自洽），validate_flows 的快照门照样能绿；后端起来后
重跑本工具即可升级为真内容快照。

用法:
  python scripts/freeze_retrieval_snapshots.py                 # 所有检索蜂群
  python scripts/freeze_retrieval_snapshots.py --swarm opc     # 只冻某个
  python scripts/freeze_retrieval_snapshots.py --dry-run       # 只看会冻谁，不写
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 检索直连，清代理（与 eval_ci 同纪律）
for _pvar in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(_pvar, None)
os.chdir(ROOT)

import yaml  # noqa: E402

from src.retrieval_snapshot import build_snapshot, is_retrieval_swarm  # noqa: E402

GOLDEN_DIR = ROOT / "scripts" / "golden_cases"
ORCH = ROOT / "config" / "swarm_orchestrator.yaml"


def _rag_swarms(only: str | None) -> list[tuple[str, str]]:
    """返回 [(swarm_id, config_path)]，只含带检索的蜂群。"""
    reg = yaml.safe_load(ORCH.read_text(encoding="utf-8")) or {}
    out = []
    for s in reg.get("swarms", []):
        sid, cfg = s.get("id"), s.get("config")
        if only and sid != only:
            continue
        if not cfg or not (ROOT / cfg).exists():
            continue
        flow_cfg = yaml.safe_load((ROOT / cfg).read_text(encoding="utf-8")) or {}
        if is_retrieval_swarm(flow_cfg):
            out.append((sid, str(ROOT / cfg)))
    return out


def _capture_one(config_path: str, task: str) -> dict:
    """对单条 task 跑实时检索，返回 build_snapshot 结果。"""
    from src.flow_engine import FlowEngine

    eng = FlowEngine(config_path)  # 不调 run() → _frozen_context 不存在 → 走实时检索
    rag_docs = ima_docs = knowledge = ""
    if eng._pre_retrieval_cfg.get("enabled"):
        rag_docs = eng._do_pre_retrieval(task) or ""
    if eng._ima_pre_retrieval_cfg.get("enabled"):
        ima_docs = eng._do_ima_pre_retrieval(task) or ""
    if eng._knowledge_dynamic_cells:
        try:
            from src.cell_library import format_for_swarm

            knowledge = format_for_swarm(task) or ""
        except Exception as e:  # noqa: BLE001
            print(f"    ⚠️ 动态电芯捕获失败（冻结为空）: {e}")
    frozen_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return build_snapshot(rag_docs=rag_docs, ima_docs=ima_docs, knowledge=knowledge, frozen_at=frozen_at)


def main() -> int:
    ap = argparse.ArgumentParser(description="捕获检索快照写回 golden case")
    ap.add_argument("--swarm", help="只冻指定蜂群")
    ap.add_argument("--dry-run", action="store_true", help="只列出会冻的蜂群，不写")
    args = ap.parse_args()

    swarms = _rag_swarms(args.swarm)
    if not swarms:
        print(f"没有匹配的检索蜂群（--swarm {args.swarm}）" if args.swarm else "没有检索蜂群")
        return 0

    if args.dry_run:
        print(f"将冻结 {len(swarms)} 个检索蜂群:")
        for sid, _ in swarms:
            gcf = GOLDEN_DIR / f"{sid}.json"
            n = len(json.loads(gcf.read_text(encoding="utf-8"))) if gcf.exists() else 0
            print(f"  {sid}: {n} 条 golden case")
        return 0

    total_pinned = total_empty = 0
    for sid, cfg in swarms:
        gcf = GOLDEN_DIR / f"{sid}.json"
        if not gcf.exists():
            print(f"[跳过] {sid}: golden case 文件不存在")
            continue
        cases = json.loads(gcf.read_text(encoding="utf-8")) or []
        print(f"\n{'─' * 56}\n冻结 {sid}（{len(cases)} 条）")
        for i, case in enumerate(cases):
            task = case.get("task", "")
            snap = _capture_one(cfg, task)
            case["retrieved_snapshot"] = snap
            total_pinned += 1
            mark = (
                "空(后端未命中)"
                if snap["empty"]
                else f"{len(snap['rag_docs']) + len(snap['ima_docs']) + len(snap['knowledge'])}字符"
            )
            if snap["empty"]:
                total_empty += 1
            print(f"  case {i + 1}/{len(cases)}: {mark}  sha256={snap['sha256'][:12]}…")
        gcf.write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  ✅ 已写回 {gcf.name}")

    print(f"\n{'═' * 56}")
    print(f"完成: {total_pinned} 条快照已 pin（其中 {total_empty} 条为空快照——后端未命中/未灌库）")
    if total_empty:
        print("  ℹ️ 空快照仍是合法可复现状态；后端灌库后重跑本工具升级为真内容。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
