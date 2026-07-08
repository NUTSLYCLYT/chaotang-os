#!/usr/bin/env python3
"""sourcing 蜂群·真尺子 —— 用公司真实电芯库验证选型，零自评、零模型链路、不靠人工 golden。

ground truth = config/eval/cell_library.json (从 6.1更新电芯库.xlsx 提取的 197 颗实测电芯)。
每次运行重读该库——你往库里装更多电池资料,尺子自动更准更全,无需改代码。

判定(确定性,可证伪)：
  对蜂群推荐的每颗电芯：
    C1 存在性  —— 该型号真在库里吗？(臆造型号=FAIL)
    C2 温度    —— 任务要求 -X℃ → 库内该芯放电下限 ≤ -X℃？
    C3 循环    —— 任务要求 ≥N 次 → 库内该芯循环寿命 ≥ N？
  另报：库里真正满足需求的电芯有几颗(蜂群是否从合格集里选)。

用法: python scripts/sourcing_check.py --task "为-40℃户外电源找电芯,循环>=1500" --file 选型输出.txt
      python scripts/sourcing_check.py --qualify --task "..."   # 只列库内满足需求的电芯
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # 直跑脚本时让 `import src.*` 可用
LIB = ROOT / "config" / "eval" / "cell_library.json"


def load_lib() -> list[dict]:
    return json.loads(LIB.read_text(encoding="utf-8"))


def _f(x):
    try:
        return float(re.sub(r"[^\d.\-]", "", str(x)))
    except Exception:
        return None


def parse_req(task: str) -> dict:
    t = re.findall(r"-\s*(\d+)\s*[℃°]", task)
    cyc = re.search(r"循环[^\d]{0,4}(\d+)|(\d+)\s*次", task)
    return {
        "temp_min_c": -max(int(x) for x in t) if t else None,
        "cycle_min": int(next(g for g in cyc.groups() if g)) if cyc else None,
    }


def qualifying(lib: list[dict], req: dict) -> list[dict]:
    out = []
    for c in lib:
        if req["temp_min_c"] is not None:
            tm = c.get("discharge_temp_min_c")
            if tm is None or tm > req["temp_min_c"]:
                continue
        if req["cycle_min"] is not None:
            cy = _f(c.get("cycle_life"))
            if cy is None or cy < req["cycle_min"]:
                continue
        out.append(c)
    return out


def find_recommended(text: str, lib: list[dict]) -> list[dict]:
    """库内型号在输出里出现 = 被推荐。带边界判定 + 去子串误报（裸 18650 不再命中 18650-2600mAh）。"""
    hit = []
    for c in lib:
        m = str(c["model"]).strip()
        if len(m) < 4:
            continue
        for mt in re.finditer(re.escape(m), text):
            s, e = mt.start(), mt.end()
            before = text[s - 1] if s > 0 else ""
            after = text[e] if e < len(text) else ""
            # 前后若是字母数字/-/+，说明是更长 token 的一部分 → 不算独立命中
            if before.isalnum() or (after and (after.isalnum() or after in "-+")):
                continue
            hit.append(c)
            break
    # 去子串：若 "18650-2600mAh" 已命中，丢弃同时命中的裸 "18650"
    models = {str(c["model"]).strip() for c in hit}
    return [c for c in hit if not any((o := str(c["model"]).strip()) != x and o in x for x in models)]


def check(task: str, sol: str):
    lib = load_lib()
    req = parse_req(task)
    qual = qualifying(lib, req)
    recs = find_recommended(sol, lib)
    print(f"任务需求: 温度下限{req['temp_min_c']}℃, 循环≥{req['cycle_min']}")
    print(
        f"库内满足需求电芯: {len(qual)}/{len(lib)} 颗"
        + (f" 例:{[c['model'] for c in qual[:5]]}" if qual else " ⚠️ 库里没有满足该需求的电芯!")
    )
    if not recs:
        # 看输出有没有提到任何型号样式
        guess = re.findall(r"\b\d{4,5}[A-Za-z\-]*|\b[A-Z]\d{4,6}[A-Za-z\-]*", sol)
        print(f"❓ UNKNOWN: 输出里未出现任何库内型号(疑似臆造或未给具体型号)。文本疑似型号: {guess[:5]}")
        return "UNKNOWN", "未出现库内型号(疑似臆造)"
    ICON = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}
    print(f"\n蜂群推荐的库内电芯 {len(recs)} 颗，逐颗验证:")
    evid = []
    for c in recs:
        rs = []
        # C1 已存在(在库里=已通过)
        rs.append(("C1存在", "PASS", c["model"]))
        if req["temp_min_c"] is not None:
            tm = c.get("discharge_temp_min_c")
            ok = tm is not None and tm <= req["temp_min_c"]
            rs.append(
                ("C2温度", "PASS" if ok else "FAIL", f"该芯放电{c.get('discharge_temp')} vs 需{req['temp_min_c']}℃")
            )
        if req["cycle_min"] is not None:
            cy = _f(c.get("cycle_life"))
            ok = cy is not None and cy >= req["cycle_min"]
            rs.append(("C3循环", "PASS" if ok else "FAIL", f"该芯{c.get('cycle_life')} vs 需≥{req['cycle_min']}"))
        v = "FAIL" if any(s == "FAIL" for _, s, _ in rs) else "PASS"
        print(f"  {ICON[v]} {c['model']}: " + " | ".join(f"{n}={ICON[s]}{d}" for n, s, d in rs[1:]))
        evid.append(f"{c['model']}={v}")
    # 整体:任一推荐芯不达标 → FAIL(选型里混了不合格芯也算不合格)
    overall = "FAIL" if any(e.endswith("=FAIL") for e in evid) else "PASS"
    return overall, "; ".join(evid)


def main() -> int:
    ap = argparse.ArgumentParser(description="sourcing 真尺子(对照真实电芯库)")
    ap.add_argument("--task", required=True)
    ap.add_argument("--file")
    ap.add_argument("--qualify", action="store_true")
    ap.add_argument("--case-id", help="提供则把判定写入真值台账(truth_ledger)")
    a = ap.parse_args()
    if a.qualify:
        lib = load_lib()
        req = parse_req(a.task)
        q = qualifying(lib, req)
        print(f"库内满足'{req}'的电芯 {len(q)} 颗:")
        for c in q[:20]:
            print(
                f"  {c['model']:<16} {c.get('capacity_mah')}mAh 循环{c.get('cycle_life')} "
                f"{c.get('energy_density_whkg')}Wh/kg 放{c.get('discharge_temp')}"
            )
        return 0
    sol = Path(a.file).read_text(encoding="utf-8") if a.file else ""
    verdict, evid = check(a.task, sol)
    if a.case_id:
        from src.truth_ledger import record

        record("sourcing", "sourcing_check", verdict, case_id=a.case_id, detail=evid, evidence=evid)
        print(f"→ 已写入真值台账: sourcing/{a.case_id} = {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
