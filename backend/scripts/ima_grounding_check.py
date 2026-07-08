#!/usr/bin/env python3
"""IMA 接地检查器 —— 用 IMA 真实电芯测试结局守护 PACK/采购选型(确定性,可证伪)。

真值=config/eval/ima_cell_tests.json(从IMA雨桐库拉的95条公司实测,含37条NG)。
核心可证伪锚:蜂群若推荐一颗 IMA 已测出'低温NG'的电芯,就是推荐已知不合格货——FAIL。
这是 IMA 知识真正"训练"蜂群的方式:把公司踩过的坑(NG记录)变成不可逾越的硬约束。

判定:
  G1 不荐已知NG —— 输出推荐的型号若命中 IMA NG 记录 → FAIL(附厂家+测试)
  G2 选用已验证 —— 推荐型号命中 IMA OK 记录 → PASS(用了实测合格的)
  无命中 → UNKNOWN(该型号 IMA 没测过,无法接地)

用法: python scripts/ima_grounding_check.py --file 选型/PACK输出.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
TESTS = ROOT / "config" / "eval" / "ima_cell_tests.json"


def _core(model: str) -> str:
    """取型号核心 token(去括号/单位后缀)以便在输出里匹配。"""
    m = re.split(r"[（(\s]", model.strip())[0]
    return m


def _load():
    if not TESTS.exists():
        return []
    try:
        return json.loads(TESTS.read_text(encoding="utf-8"))
    except Exception:
        return []


def check(text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    recs = _load()
    if not recs:
        add("G0-IMA真值", "UNKNOWN", "ima_cell_tests.json 不存在(先跑 ima_pull_pack.py)")
        return out

    def is_ng(r):
        return any(k in r.get("result", "") for k in ("NG", "不合格", "失败", "未通过"))

    ng_hit, ok_hit = [], []
    for r in recs:
        core = _core(r.get("model", ""))
        if len(core) >= 4 and core in text:
            (ng_hit if is_ng(r) else ok_hit).append(r)

    if ng_hit:
        add(
            "G1不荐已知NG",
            "FAIL",
            "; ".join(f"{r['model'][:18]}[{r.get('vendor', '')}]{r['result']}" for r in ng_hit[:3]),
        )
    else:
        add("G1不荐已知NG", "PASS", "未推荐任何 IMA 已测NG电芯")

    if ok_hit:
        add("G2选用已验证", "PASS", f"推荐型号命中IMA实测OK: {[r['model'][:16] for r in ok_hit[:3]]}")
    elif not ng_hit:
        add("G2选用已验证", "UNKNOWN", "推荐型号 IMA 未测过(无法接地,建议送测)")
    return out


def verdict_of(checks: list[dict]) -> str:
    s = [c["status"] for c in checks]
    if "FAIL" in s:
        return "FAIL"
    if any(c["check"] == "G2选用已验证" and c["status"] == "PASS" for c in checks):
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="IMA 接地检查器(真实测试结局守护选型)")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== IMA 接地检查(真实电芯测试结局) ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("pack_rd", "ima_grounding_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: pack_rd/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
