#!/usr/bin/env python3
"""opc 方案 确定性约束求解器 — 落地大神"先建可证伪硬 eval"的一刀。

架构(Karpathy 处方):**抽取与判定分离**。
  - 抽取层:把方案文本 → 结构化事实(ex dict)。两种实现:
      regex(默认,零成本,粗) / llm(--llm,deepseek 窄事实抽取,准,极低成本)
    LLM 只回答"单个窄事实"(选了什么电芯/报价多少/PCS 几 kW),不打分、不评价。
  - 判定层:对 ex 跑确定性 check,对照丞相裁定的参数表(storage_params.yaml)。
    判定永远确定性、可证伪、可复现 —— LLM 只动抽取,不动判定。

判定分级:PASS 满足 / FAIL 违反 usable 硬约束 / WARN human_confirm 疑似(只提示) /
         UNKNOWN 抽不出所需事实(诚实标"测不了")。

用法:
  python scripts/opc_constraint_check.py --task "..." --run-id <id> [--llm]
  python scripts/opc_constraint_check.py --from-report baseline_compare_opc_all.json --golden eval/opc_golden.yaml [--llm]
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
PARAMS_PATH = ROOT / "config" / "eval" / "storage_params.yaml"


def load_params() -> dict:
    return yaml.safe_load(PARAMS_PATH.read_text(encoding="utf-8"))


# ════════════════════════ 抽取层 ════════════════════════
# ex 字段(两种抽取器都产出同一结构):
#   task_min_temp_c, primary_chemistry, chemistry_floor_claimed_c,
#   capacity_kwh, duration_h, pcs_kw, task_budget_cny, quote_cny,
#   has_heating, has_liquid_cooling, is_container, has_fire_suppression


def _regex_num_temp(text: str) -> int | None:
    temps = [int(m) for m in re.findall(r"-\s*(\d{1,2})\s*[℃°]", text)]
    return -max(temps) if temps else None


def _regex_cny(text: str) -> float | None:
    m = re.search(r"(预算|报价|总价|总投资|造价|总包)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(亿|万|元)", text)
    if not m:
        return None
    return float(m.group(2)) * {"亿": 1e8, "万": 1e4, "元": 1.0}[m.group(3)]


def _regex_capacity_kwh(text: str) -> float | None:
    vals = [
        float(n) * {"GWh": 1e6, "MWh": 1e3, "kWh": 1.0}[u]
        for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*(GWh|MWh|kWh)", text)
    ]
    return max(vals) if vals else None


def _regex_duration_h(text: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*小时", text) or re.search(r"时长[^\d]{0,6}(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


def _regex_pcs_kw(text: str) -> float | None:
    for p in (r"PCS[^\d]{0,14}(\d+(?:\.\d+)?)\s*(MW|kW)", r"(\d+(?:\.\d+)?)\s*(MW|kW)[^。\n]{0,10}PCS"):
        m = re.search(p, text)
        if m:
            return float(m.group(1)) * (1000 if m.group(2) == "MW" else 1.0)
    return None


def _detect_chem(text: str) -> str | None:
    hits = []
    if re.search(r"磷酸铁锂|LFP|铁锂", text):
        hits.append("LFP")
    if re.search(r"三元|NMC|NCM", text):
        hits.append("NMC")
    if re.search(r"钛酸锂|LTO", text):
        hits.append("LTO")
    if re.search(r"钠离子|钠电", text):
        hits.append("sodium_ion")
    if not hits:
        return None
    return hits[0] if len(hits) == 1 else "multiple"


def extract_regex(task: str, sol: str) -> dict:
    return {
        "task_min_temp_c": _regex_num_temp(task),
        "primary_chemistry": _detect_chem(sol),
        "chemistry_floor_claimed_c": _regex_num_temp(sol),
        "capacity_kwh": _regex_capacity_kwh(task) or _regex_capacity_kwh(sol),
        "duration_h": _regex_duration_h(task) or _regex_duration_h(sol),
        "pcs_kw": _regex_pcs_kw(sol),
        "task_budget_cny": _regex_cny(task),
        "quote_cny": _regex_cny(sol),
        "has_heating": bool(re.search(r"自加热|加热膜|加热|预热", sol)),
        "has_liquid_cooling": "液冷" in sol,
        "is_container": bool(re.search(r"集装箱|预制舱", task + sol)),
        "has_fire_suppression": bool(re.search(r"消防|灭火|气溶胶", sol)),
        "_extractor": "regex",
    }


_EXTRACT_PROMPT = """你是储能方案【事实抽取器】。只从【客户需求】和【方案文本】里抽取客观事实,不推断、不评价、不打分。
严格只输出 JSON(无其他文字):
{{
 "task_min_temp_c": 客户要求的最低工况温度数值(℃,整数;无则null),
 "primary_chemistry": "方案最终主选电芯化学体系:LFP/NMC/LTO/sodium_ion;若在权衡多种未定则 multiple;无则null",
 "chemistry_floor_claimed_c": 方案声称主选体系可工作的最低温(℃;无则null),
 "capacity_kwh": 系统总容量(kWh数值;无则null),
 "duration_h": 储能时长(小时数值;无则null),
 "pcs_kw": PCS额定功率(kW数值;无则null),
 "task_budget_cny": 客户预算(人民币元数值;无则null),
 "quote_cny": 方案给出的报价/总价(人民币元数值;无则null),
 "has_heating": 方案是否含加热/自加热(true/false),
 "has_liquid_cooling": 是否采用液冷(true/false),
 "is_container": 是否预制舱/集装箱形态(true/false),
 "has_fire_suppression": 是否含消防/灭火配置(true/false)
}}
【客户需求】
{task}
【方案文本】
{sol}"""


def extract_llm(task: str, sol: str) -> dict:
    from src.model_adapter import ModelAdapter

    adapter = ModelAdapter(
        model="openai/deepseek-chat",
        api_base="https://api.deepseek.com/v1",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    )
    res = adapter.call(
        system_prompt="你是严谨的事实抽取器,只输出 JSON。",
        user_prompt=_EXTRACT_PROMPT.format(task=task, sol=sol[:8000]),
    )
    raw = res.get("output", "") if isinstance(res, dict) else str(res)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    try:
        ex = json.loads(m.group(0)) if m else {}
    except Exception:  # noqa: BLE001
        ex = {}
    ex["_extractor"] = "llm"
    return ex


# ════════════════════════ 判定层(确定性,吃 ex)════════════════════════


def check_cold_chemistry(ex: dict, p: dict) -> dict:
    name = "低温-化学体系匹配"
    t = ex.get("task_min_temp_c")
    chem = ex.get("primary_chemistry")
    if t is None:
        return {"check": name, "status": "PASS", "detail": "无低温工况要求,不触发"}
    if chem is None:
        return {"check": name, "status": "UNKNOWN", "detail": f"工况{t}℃ 但抽不出主选化学体系"}
    if chem == "multiple":
        return {"check": name, "status": "WARN", "detail": f"工况{t}℃,方案在权衡多种体系未定选型,需确认最终电芯"}
    cp = p.get("chemistry", {}).get(chem)
    if not cp:
        return {"check": name, "status": "UNKNOWN", "detail": f"{chem} 无可用参数(丞相已拒用/未入表),不表态"}
    heated = ex.get("has_heating")
    no_heat_min = cp.get("discharge_temp_min_no_heat_c", cp.get("discharge_temp_min_c"))
    heated_min = cp.get("discharge_temp_min_heated_c", no_heat_min)
    hard = cp.get("status") == "usable"
    fail = "FAIL" if hard else "WARN"
    if t < heated_min:
        return {
            "check": name,
            "status": fail,
            "detail": f"工况{t}℃ 低于 {chem} 加热后下限 {heated_min}℃"
            + ("" if hard else "(该体系参数 human_confirm,需人工核实实测)"),
        }
    if t < no_heat_min and not heated:
        return {"check": name, "status": fail, "detail": f"工况{t}℃ < {chem} 无加热下限 {no_heat_min}℃,但方案未提加热"}
    return {"check": name, "status": "PASS", "detail": f"工况{t}℃ 与 {chem}(下限{no_heat_min}℃,加热{heated})匹配"}


def check_liquid_needs_heating(ex: dict, p: dict) -> dict:
    name = "极寒液冷需配加热"
    if not p.get("rule_below_-25c_liquid_requires_heating"):
        return {"check": name, "status": "UNKNOWN", "detail": "规则未启用"}
    t = ex.get("task_min_temp_c")
    if t is None or t >= -25:
        return {"check": name, "status": "PASS", "detail": f"工况{t}℃ 未触发(≥-25℃)"}
    if ex.get("has_liquid_cooling") and not ex.get("has_heating"):
        return {"check": name, "status": "FAIL", "detail": f"工况{t}℃<-25℃ 用液冷却未配加热,导热液凝冻风险"}
    return {"check": name, "status": "PASS", "detail": f"工况{t}℃ 液冷+加热 或 未用液冷"}


def check_pcs_sizing(ex: dict, p: dict) -> dict:
    name = "PCS功率配置"
    cap, dur, pcs = ex.get("capacity_kwh"), ex.get("duration_h"), ex.get("pcs_kw")
    if not (cap and dur and pcs):
        return {"check": name, "status": "UNKNOWN", "detail": f"容量={cap}kWh 时长={dur}h PCS={pcs}kW(缺项)"}
    # close L0002 闭环:账本第一条真实 settle(200MWh/2h 判 50MW=FAIL,实测 PASS,"50MW其实够")
    # 证明 expected=cap/dur 的硬判是错的——PCS 偏离只是把系统做成了不同时长,是工程选择/C-rate 裕度,
    # 不是物理违规。改为:偏离任务述求时长 → WARN(确认设计意图);仅当隐含 C-rate 物理不可能才 FAIL。
    expected = cap / dur
    tol = p.get("pcs", {}).get("tolerance_pct", 15) / 100
    dev = abs(pcs - expected) / expected
    implied_dur = cap / pcs  # 方案实际配出的时长
    c_rate = pcs / cap  # 隐含倍率
    if c_rate > 4:  # >4C 连续:LFP 物理撑不住,真硬错
        return {
            "check": name,
            "status": "FAIL",
            "detail": f"方案{pcs:.0f}kW 对 {cap:.0f}kWh = {c_rate:.1f}C,超 LFP 连续倍率上限(物理不可行)",
        }
    if dev <= tol:
        return {"check": name, "status": "PASS", "detail": f"PCS {pcs:.0f}kW ≈ 任务 {dur:.0f}h 配置({expected:.0f}kW)"}
    return {
        "check": name,
        "status": "WARN",
        "detail": f"方案 {pcs:.0f}kW = {implied_dur:.1f}h 系统,与任务述求 {dur:.0f}h 不符,确认是否有意"
        f"(C-rate 灵活,非物理硬错;依 L0002 校准)",
    }


def check_compliance_fire(ex: dict, p: dict) -> dict:
    name = "预制舱消防合规"
    comp = p.get("compliance", {})
    if not comp.get("preset_container_requires_fire_suppression"):
        return {"check": name, "status": "UNKNOWN", "detail": "规则未启用"}
    if not ex.get("is_container"):
        return {"check": name, "status": "PASS", "detail": "非预制舱场景,不触发"}
    if ex.get("has_fire_suppression"):
        return {"check": name, "status": "PASS", "detail": "方案含消防/灭火"}
    # 校准:市场/方案层文档不写消防≠物理违规,降为 WARN 提示人工确认(工程 BOM 层可再提级)
    return {"check": name, "status": "WARN", "detail": "未提消防/灭火(GB 44240/42288 强制),需确认是否本层应覆盖"}


def check_budget(ex: dict, p: dict) -> dict:
    name = "预算合理性(warn)"
    b, q = ex.get("task_budget_cny"), ex.get("quote_cny")
    if b is None or q is None:
        return {"check": name, "status": "UNKNOWN", "detail": f"预算={b} 报价={q}"}
    if q > b:
        return {
            "check": name,
            "status": "WARN",
            "detail": f"报价 {q / 1e4:.0f}万 > 预算 {b / 1e4:.0f}万(造价数据时效敏感,需人工确认)",
        }
    return {"check": name, "status": "PASS", "detail": f"报价 {q / 1e4:.0f}万 ≤ 预算 {b / 1e4:.0f}万"}


CHECKS = [check_cold_chemistry, check_liquid_needs_heating, check_pcs_sizing, check_compliance_fire, check_budget]


def check_solution(task: str, sol: str, p: dict, use_llm: bool = False) -> dict:
    ex = extract_llm(task, sol) if use_llm else extract_regex(task, sol)
    results = [c(ex, p) for c in CHECKS]
    tally = {s: sum(1 for r in results if r["status"] == s) for s in ("PASS", "FAIL", "WARN", "UNKNOWN")}
    return {"extractor": ex.get("_extractor"), "ex": ex, "results": results, "tally": tally}


# ════════════════════════ I/O ════════════════════════


def _swarm_text_from_run(run_id: str) -> str:
    parts = []
    for f in sorted(glob.glob(str(ROOT / f"data/default/runs/{run_id}/step_*.json"))):
        if "qa_tech_support" in f:
            continue
        try:
            parts.append(str(json.load(open(f)).get("output", "")))
        except Exception:  # noqa: BLE001
            continue
    return "\n\n".join(p for p in parts if p)


def _print(label: str, task: str, sol: str, p: dict, use_llm: bool) -> dict:
    r = check_solution(task, sol, p, use_llm)
    ICON = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "UNKNOWN": "❓"}
    print(f"\n=== {label} [{r['extractor']}抽取] ===")
    for c in r["results"]:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    t = r["tally"]
    print(f"  → PASS {t['PASS']} / FAIL {t['FAIL']} / WARN {t['WARN']} / UNKNOWN {t['UNKNOWN']}")
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description="opc 方案确定性约束求解器")
    ap.add_argument("--task")
    ap.add_argument("--file")
    ap.add_argument("--run-id")
    ap.add_argument("--from-report")
    ap.add_argument("--golden")
    ap.add_argument("--llm", action="store_true", help="用 LLM 窄事实抽取(更准,极低成本)")
    ap.add_argument("--output", default="constraint_check_report.json")
    args = ap.parse_args()
    p = load_params()
    if args.llm and not os.environ.get("DEEPSEEK_API_KEY"):
        print("警告:--llm 需 DEEPSEEK_API_KEY")

    if args.from_report:
        rep = json.loads(Path(args.from_report).read_text(encoding="utf-8"))
        tasks = {t["id"]: t["task"] for t in yaml.safe_load(Path(args.golden).read_text(encoding="utf-8"))["tasks"]}
        out = []
        for row in rep:
            rid = row.get("swarm", {}).get("run_id")
            if not rid:
                continue
            sol = _swarm_text_from_run(rid)
            if not sol:
                continue
            r = _print(f"{row['id']} [swarm]", tasks.get(row["id"], ""), sol, p, args.llm)
            out.append({"id": row["id"], "extractor": r["extractor"], "tally": r["tally"], "results": r["results"]})
        Path(args.output).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n报告写入: {args.output}")
        return 0

    if not args.task:
        print("需 --task")
        return 2
    sol = (
        Path(args.file).read_text(encoding="utf-8")
        if args.file
        else (_swarm_text_from_run(args.run_id) if args.run_id else "")
    )
    if not sol:
        print("需 --file 或 --run-id")
        return 2
    _print("约束检查", args.task, sol, p, args.llm)
    return 0


if __name__ == "__main__":
    sys.exit(main())
