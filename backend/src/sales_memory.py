"""销售成交记忆 — 干净燃料飞轮（确定性·零 LLM·real_sales_outcomes 为唯一真源）。

大神天才设计(2026-06-09 Bezos/Hassabis):会复利的不是"记住客户叫什么",是"记住客户真金白银
接受过什么";写进飞轮的必须是 environment-grounded 真实成交(非另一个 LLM 说'我觉得成了')。
燃料 = knowledge/real_sales_outcomes.jsonl(99 条真实目录成交:company/amount_cny/year)。

飞轮三问对账:
  ① 会复利吗 → 召回的真实成交价锚点注入 opc/报价 step,改变下一次输出(test_sales_memory 证明)
  ② 燃料干净吗 → 只读真实成交目录,按 (company,year,amount) 幂等,不写 LLM 自评成交
  ③ 看得见转吗 → recall 返回 hit_count;flywheel_health = 命中真实成交 prior 的占比(可入控制图)
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTCOMES_PATH = ROOT / "knowledge" / "real_sales_outcomes.jsonl"


@lru_cache(maxsize=1)
def _load_outcomes() -> tuple[dict, ...]:
    """加载真实成交（幂等去重:同 company+year+amount 只留一条）。"""
    if not OUTCOMES_PATH.exists():
        return ()
    seen, rows = set(), []
    for line in OUTCOMES_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        company = str(d.get("company", "")).strip()
        amount = d.get("amount_cny")
        year = str(d.get("year", "")).strip()
        if not company or amount is None:
            continue
        key = (company, year, float(amount))
        if key in seen:
            continue
        seen.add(key)
        rows.append({"company": company, "amount_cny": float(amount), "year": year})
    return tuple(rows)


def _company_tokens(name: str) -> list[str]:
    """取公司名里 >=2 字的判别性 token（去掉常见后缀噪声）。"""
    noise = ("有限公司", "有限责任公司", "股份", "公司", "集团", "科技", "技术", "信息", "电子", "能源")
    s = name
    for n in noise:
        s = s.replace(n, " ")
    return [t for t in s.split() if len(t) >= 2]


def recall_real_deals(task_input: str, top_k: int = 5) -> tuple[str, int]:
    """从真实成交里召回与本任务相关的价格锚点。

    Returns:
        (注入文本, hit_count)。hit_count = 命中的真实成交条数(0=飞轮本次空转,用于 flywheel_health)。
        无任何成交数据或无匹配时,返回("", 0)——空源 fail-closed,绝不编造锚点。
    """
    outcomes = _load_outcomes()
    if not outcomes:
        return "", 0

    task = task_input or ""
    # 命中:公司名 token 出现在任务里(确定性子串匹配,非语义猜测)
    matched = []
    for row in outcomes:
        toks = _company_tokens(row["company"])
        if any(t in task for t in toks) or row["company"] in task:
            matched.append(row)

    if not matched:
        return "", 0

    matched.sort(key=lambda r: r["amount_cny"], reverse=True)
    top = matched[:top_k]
    amounts = sorted(r["amount_cny"] for r in matched)
    median = amounts[len(amounts) // 2]
    lines = [
        "以下是**真实历史成交记录**（来自公司成交目录，非估算/非编造），仅作价格锚点参考，"
        "当前报价须结合本次工况，但不得给出与这些真实成交显著背离且无理由的数字：",
        f"- 命中相关成交 {len(matched)} 笔，金额中位数 ¥{median:,.0f}",
    ]
    for r in top:
        lines.append(f"- {r['year']} · {r['company']} · 成交 ¥{r['amount_cny']:,.0f}")
    return "\n".join(lines), len(matched)


def flywheel_health() -> dict:
    """飞轮燃料健康度（看得见转吗）：成交记忆库现状。"""
    outcomes = _load_outcomes()
    if not outcomes:
        return {"deals": 0, "companies": 0, "status": "空转(无真实成交燃料)"}
    companies = {r["company"] for r in outcomes}
    return {
        "deals": len(outcomes),
        "companies": len(companies),
        "amount_total": sum(r["amount_cny"] for r in outcomes),
        "status": "有燃料",
    }
