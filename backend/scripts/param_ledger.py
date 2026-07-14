#!/usr/bin/env python3
"""参数证伪账本 + 防腐烂 — 落地大神④(证伪账本/skin-in-game)+ 全员警告(表会腐烂)。

把"表是公司的资产"做成会自维护的资产,而非会腐烂的快照:
  - record   : 每次求解器对真实项目的裁定写入账本(带 task/verdict/provenance/时间锚)。
  - settle   : 项目实测结果回填(verdict 对了/错了)→ 这是 skin-in-the-game,判错留痕。
  - stale    : 扫 storage_params.yaml 的 as_of,超期参数告警(防"护城河变沼泽")。
  - report   : 账本统计 —— 裁定命中率(被实测证伪的比例)= 表的可信度真分。

账本文件:data/param_ledger.jsonl (append-only,每行一条)

用法:
  python scripts/param_ledger.py record --task "..." --verdict FAIL --basis "PCS偏差50%"
  python scripts/param_ledger.py settle --id <ledger_id> --actual pass --note "现场实测达标"
  python scripts/param_ledger.py stale --months 6
  python scripts/param_ledger.py report
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from src.runtime_paths import resolve_runtime_paths

LEDGER = resolve_runtime_paths().data / "param_ledger.jsonl"
PARAMS = ROOT / "config" / "eval" / "storage_params.yaml"


def _append(rec: dict) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _load() -> list[dict]:
    if not LEDGER.exists():
        return []
    return [json.loads(line) for line in LEDGER.read_text(encoding="utf-8").splitlines() if line.strip()]


def cmd_record(a) -> int:
    n = len(_load()) if LEDGER.exists() else 0
    rec = {
        "id": f"L{n + 1:04d}",
        "ts": a.today,
        "task": a.task,
        "verdict": a.verdict,
        "basis": a.basis,
        "actual": None,
        "settled": False,
        "note": "",
    }
    _append(rec)
    print(f"记录 {rec['id']}: {a.verdict} — {a.basis}")
    return 0


def cmd_settle(a) -> int:
    recs = _load()
    hit = next((r for r in recs if r["id"] == a.id), None)
    if not hit:
        print(f"未找到 {a.id}")
        return 1
    hit["actual"] = a.actual
    hit["settled"] = True
    hit["note"] = a.note
    # 重写整本(settle 改历史行)
    LEDGER.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in recs) + "\n", encoding="utf-8")
    falsified = (hit["verdict"].lower().startswith("fail") and a.actual == "pass") or (
        hit["verdict"].lower() == "pass" and a.actual == "fail"
    )
    print(
        f"回填 {a.id}: 裁定={hit['verdict']} 实测={a.actual} → {'⚠️ 裁定被证伪(表需修正!)' if falsified else '✅ 裁定与实测一致'}"
    )
    return 0


def cmd_stale(a) -> int:
    p = yaml.safe_load(PARAMS.read_text(encoding="utf-8"))
    yr_now = int(a.today[:4])
    print(f"\n=== 参数时效扫描 (阈值 {a.months} 月) ===")
    flagged = 0
    for block, v in p.items():
        if isinstance(v, dict) and "as_of" in v:
            as_of = str(v["as_of"])
            yrs = [int(y) for y in __import__("re").findall(r"20\d{2}", as_of)]
            old = yrs and (yr_now - max(yrs)) * 12 > a.months
            mark = "🔴 疑似过期" if old else "🟢"
            if old:
                flagged += 1
            print(f"  {mark} {block}: as_of={as_of} (status={v.get('status')})")
    print(f"\n{flagged} 个参数块疑似过期 → 需触发锦衣卫重搜 + 丞相重裁定(防护城河变沼泽)")
    return 0


def cmd_report(a) -> int:
    recs = _load()
    settled = [r for r in recs if r["settled"]]
    fals = [
        r
        for r in settled
        if (r["verdict"].lower().startswith("fail") and r["actual"] == "pass")
        or (r["verdict"].lower() == "pass" and r["actual"] == "fail")
    ]
    print(f"\n=== 证伪账本 ===")
    print(f"总裁定 {len(recs)} · 已实测回填 {len(settled)} · 被证伪 {len(fals)}")
    if settled:
        acc = 100 * (1 - len(fals) / len(settled))
        print(f"裁定命中率(表的可信度真分): {acc:.0f}%  ← 这才是护城河的硬指标,不是 LLM 自评分")
    if fals:
        print("被证伪的裁定(表必须据此修正):")
        for r in fals:
            print(f"  {r['id']}: 判{r['verdict']} 实测{r['actual']} — {r['note']}")
    else:
        print("(尚无实测回填;接入真实项目后,每个 settle 都在为表挣可信度)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="参数证伪账本 + 防腐烂")
    ap.add_argument(
        "--today",
        default=date.today().isoformat(),
        help="当前日期(脚本环境无系统时钟,显式传)",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("record")
    r.add_argument("--task", required=True)
    r.add_argument("--verdict", required=True)
    r.add_argument("--basis", default="")
    s = sub.add_parser("settle")
    s.add_argument("--id", required=True)
    s.add_argument("--actual", required=True, choices=["pass", "fail"])
    s.add_argument("--note", default="")
    st = sub.add_parser("stale")
    st.add_argument("--months", type=int, default=6)
    sub.add_parser("report")
    a = ap.parse_args()
    return {"record": cmd_record, "settle": cmd_settle, "stale": cmd_stale, "report": cmd_report}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
