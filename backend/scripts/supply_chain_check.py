#!/usr/bin/env python3
"""供应链蜂群(电芯Sourcing)·供应链维度检查器(确定性,可证伪)。

sourcing_check 只验"选芯对不对";本检查器补上供应链那几维的硬约束:
  C1 供应商风险情报 —— 供应商须带 财务状态/红旗/产能 评估(只夸不评风险=情报失职)
  C2 四类分离     —— spec_normalizer 硬职责:实测/规格/宣传/估算 分类标注
                     (把厂商宣传当实测=数据污染,全无分类=FAIL)
  C3 询价可执行   —— 报价须同时含 价格+交期+起订量(缺交期=不可下单)
  C4 价格勾稽     —— 任务给了价格上限(≤X元/Wh)时,推荐价不得突破(突破=不合规FAIL)

诚实边界:查"情报是否完整、是否分级溯源、报价是否可执行、是否守价格红线",
不查供应商财务数据本身真假(那需第三方征信/你的真实供应商台账,见 --registry 升级)。

用法: python scripts/supply_chain_check.py --task "...≤0.55元/Wh..." --file 寻源输出.txt [--case-id X]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

RISK = r"财务状态|财务健康|红旗|红牌|风险等级|产能利用率|扩产|警戒|偿债|现金流"
FOUR_CLASS = r"实测|规格书?|标称|宣传|厂商声称|估算|推算|来源[:：]|依据[:：]"
PRICE = r"\d+(?:\.\d+)?\s*(?:元/Wh|元/wh|元/kWh|元/支|元/只|万元)"
LEADTIME = r"\d+\s*(?:周|天|个月|工作日)|交期|lead\s*time|货期"
MOQ = r"起订|MOQ|最小.{0,2}订|起订量|月\s*\d+\s*(?:MWh|GWh|万只|K只|片)"


def _price_ceiling(task: str):
    m = re.search(r"[≤<]\s*(\d+(?:\.\d+)?)\s*元/Wh", task) or re.search(r"价格上限[^\d]{0,4}(\d+(?:\.\d+)?)", task)
    return float(m.group(1)) if m else None


def _min_quoted_price(text: str):
    vals = []
    for m in re.findall(r"(\d+(?:\.\d+)?)\s*元/Wh", text):
        vals.append(float(m))
    return min(vals) if vals else None


def check(task: str, text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    n_risk = len(re.findall(RISK, text))
    add("C1供应商风险情报", "FAIL" if n_risk == 0 else "PASS", f"风险/财务/产能标记 {n_risk} 处")

    n_cls = len(re.findall(FOUR_CLASS, text))
    add(
        "C2四类分离",
        "FAIL" if n_cls == 0 else ("PASS" if n_cls >= 2 else "UNKNOWN"),
        f"实测/规格/宣传/估算/来源 标注 {n_cls} 处",
    )

    has_price = bool(re.search(PRICE, text))
    has_lead = bool(re.search(LEADTIME, text))
    if has_price and has_lead:
        add("C3询价可执行", "PASS", "含价格+交期" + ("+起订" if re.search(MOQ, text) else "(缺起订量)"))
    elif has_price or has_lead:
        add("C3询价可执行", "UNKNOWN", f"价格{'有' if has_price else '无'}/交期{'有' if has_lead else '无'},不完整")
    else:
        add("C3询价可执行", "FAIL", "既无价格也无交期(不可下单)")

    # C4 价格勾稽(大神会审建议二:关掉'虚拟询价'变异源)——
    # 文本里的报价是 virtual_inquirer 编的,不予采信:超上限仍判 FAIL(真违规),
    # 但 ≤上限只判 UNKNOWN(绝不拿 LLM 编的价当 PASS——那是'确定地验证一个幻觉')。
    # 只有 eval/sourcing_outcome.jsonl 里的真实成交价才配让 C4 PASS。
    ceil = _price_ceiling(task)
    quoted = _min_quoted_price(text)
    real_price = _real_outcome_min_price()
    if ceil is not None and real_price is not None:
        add(
            "C4价格勾稽",
            "PASS" if real_price <= ceil else "FAIL",
            f"真实成交价{real_price}元/Wh vs 上限{ceil}元/Wh(对账sourcing_outcome)",
        )
    elif ceil is not None and quoted is not None:
        add(
            "C4价格勾稽",
            "FAIL" if quoted > ceil else "UNKNOWN",
            f"LLM估价{quoted}超上限{ceil}=违规"
            if quoted > ceil
            else f"LLM估价{quoted}≤上限{ceil}但不予采信(需真实成交价对账)",
        )
    else:
        add("C4价格勾稽", "UNKNOWN", f"缺项(上限={ceil} 报价={quoted})")

    # C5 供应商存在性(数据门):有 supplier_registry.json 才启用——查真假而非查形式
    reg = _load_registry()
    if reg:
        suppliers = {r["supplier"] for r in reg if r.get("supplier")}
        named = [s for s in suppliers if len(s) >= 2 and s in text]
        if named:
            add("C5供应商存在性", "PASS", f"推荐供应商在真实台账内: {named[:3]}")
        else:
            add("C5供应商存在性", "UNKNOWN", "输出未提及台账内任何供应商(疑似臆造,需人工核)")
    # 无 registry → 不加 C5(诚实:数据门未开,不假装查了真假)
    return out


def _real_outcome_min_price():
    """从 eval/sourcing_outcome.jsonl 取已结算的真实成交价(最低)——飞轮燃料,非 LLM 估价。"""
    import json
    from pathlib import Path

    p = Path(__file__).resolve().parent.parent / "eval" / "sourcing_outcome.jsonl"
    if not p.exists():
        return None
    prices = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        if "_schema" in d or d.get("run_id") == "示例-待替换":
            continue
        rp = d.get("real_price_cny_wh")
        if rp is not None:
            prices.append(float(rp))
    return min(prices) if prices else None


def _load_registry() -> list:
    """加载供应商真值台账(由 build_supplier_registry.py 生成);不存在则返回空=数据门未开。"""
    import json
    from pathlib import Path

    p = Path(__file__).resolve().parent.parent / "config" / "eval" / "supplier_registry.json"
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def verdict_of(checks: list[dict]) -> str:
    s = {c["check"]: c["status"] for c in checks}
    if "FAIL" in [c["status"] for c in checks]:
        return "FAIL"
    # 风险情报+四类分离 都达标才算供应链维度合格
    if s.get("C1供应商风险情报") == "PASS" and s.get("C2四类分离") == "PASS":
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="供应链蜂群·供应链维度检查器")
    ap.add_argument("--task", default="")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 供应链蜂群·供应链维度核查 ===")
    results = check(a.task, text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"  整体: {ICON.get(v, '')} {v}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("sourcing", "supply_chain_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"→ 已写入真值台账: sourcing/{a.case_id} = {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
