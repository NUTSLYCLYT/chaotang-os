"""户部 · 已验证事实生成器（确定性计算引擎 = 数字唯一真源）

落地 docs/financial_swarm_design.md 流水线 ③:把金蝶/审计 Excel 解析(P1 parser)
+ 恒等式/比率/账龄校验(P1 validators)串成一个 **verified_facts** 字典——
这是 LLM 唯一被允许引用的数字来源,直接喂进 flow_finance 的 ctx.verified_facts,
P2 的 number_provenance 闸据此判 LLM 有没有编数。

铁律:GIGO 第0步——任一期会计恒等式不过,gate.passed=False,**不出 facts**(地基不夯不出数)。
只读源文件,数据全程本机,绝不做对外动作。
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime

from src.finance_data_parser import parse_ar_detail, parse_statements
from src.finance_validators import FinCheck, accounting_identity, ar_aging, ratios, sanity_guards


def build_verified_facts(
    statement_paths: dict[str, str],
    ar_path: str | None = None,
    ar_control: float | None = None,
    ref_date: date | None = None,
) -> dict:
    """汇总成 verified_facts。

    statement_paths: {期间: xls路径},如 {"2023": "...xls", ...}
    ar_path/ar_control: 应收明细文件 + 审计应收控制数(可选)
    返回: {periods, ratios, provenance, ar, gate{passed, checks}}
    """
    ref_date = ref_date or date.today()
    periods: dict[str, dict] = {}
    provenance: dict[str, dict] = {}
    checks: list[FinCheck] = []

    prev = None
    for period in sorted(statement_paths):
        ps = parse_statements(statement_paths[period], period)
        d = ps.plain()
        periods[period] = d
        provenance[period] = ps.provenance()
        for w in ps.warnings:
            checks.append(FinCheck(f"{period}·解析", False, w, severity="warn", gaps=[w]))
        # GIGO 门:会计恒等式
        idc = accounting_identity(d.get("资产总计"), d.get("负债合计"), d.get("所有者权益"))
        idc.name = f"{period}·会计恒等式"
        checks.append(idc)
        # 比率 + sanity
        d["_ratios"] = {k: (float(v) if v is not None else None) for k, v in ratios(d, d).items()}
        for sc in sanity_guards(d["_ratios"]):
            sc.name = f"{period}·{sc.name}"
            checks.append(sc)
        prev = d

    ar_block = None
    if ar_path:
        items = parse_ar_detail(ar_path)
        res = ar_aging(items, control_total=ar_control or 0, ref_date=ref_date)
        gate = res["control_gate"]
        gate.name = "应收·控制数闸"
        checks.append(gate)
        ar_block = {
            "control_gate_passed": gate.passed,
            "total_unpaid": float(res["total_unpaid"]),
            "aging": {k: float(v) for k, v in res["aging"].items()},
            "overdue_90plus": float(res["overdue_90plus"]),
            "priority": [
                {"客户": r["客户"], "欠款": float(r["欠"]), "账龄天": r["天"], "单号": r["单号"]}
                for r in res["priority"][:15]
            ],
        }

    # GIGO 总门:任一 hard_fail 恒等式不过 → 整体不出 facts
    hard_fails = [c for c in checks if not c.passed and c.severity == "hard_fail"]
    gate_passed = not hard_fails

    return {
        "as_of": ref_date.isoformat(),
        "periods": periods,
        "provenance": provenance,
        "ar": ar_block,
        "gate": {
            "passed": gate_passed,
            "checks": [
                {"name": c.name, "passed": c.passed, "severity": c.severity, "detail": c.detail} for c in checks
            ],
            "hard_failures": [c.name for c in hard_fails],
        },
    }


def _json_default(o):
    from decimal import Decimal

    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    return str(o)


def main(argv: list[str]) -> int:
    """CLI: finance_facts.py <bs1.xls> [bs2.xls ...] [--ar 明细.xls 控制数]

    期间名取文件名里的 4 位年份;打印 verified_facts JSON。gate 不过 → exit 2。
    """
    import re

    paths, ar_path, ar_ctrl = {}, None, None
    it = iter(argv)
    for a in it:
        if a == "--ar":
            ar_path = next(it, None)
            ar_ctrl = float(next(it, "0") or 0)
        else:
            m = re.search(r"(20\d{2})", a)
            paths[m.group(1) if m else a] = a
    if not paths:
        print("用法: finance_facts.py <报表.xls> [...] [--ar 应收明细.xls 控制数]", file=sys.stderr)
        return 2

    facts = build_verified_facts(paths, ar_path, ar_ctrl)
    print(json.dumps(facts, ensure_ascii=False, indent=2, default=_json_default))
    g = facts["gate"]
    print(
        f"\n{'✅ GIGO 门通过,facts 可用' if g['passed'] else '❌ GIGO 门未过,拒绝出数: ' + ', '.join(g['hard_failures'])}",
        file=sys.stderr,
    )
    return 0 if g["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
