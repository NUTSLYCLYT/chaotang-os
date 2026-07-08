#!/usr/bin/env python3
"""失效数据 text-to-SQL —— Karpathy 说"比 GraphRAG 高一个数量级"的护城河件。

5 年极寒失效数据天然是【表】不是图。"-40℃析锂"和"-10℃析锂"在向量空间几乎一样近、工程上天差地别,
纯向量分不开 → 用【精确过滤】:自然语言 → SQL(deepseek-chat 翻译,"用 deepseek"在此名正言顺)→ SQLite 查询。

安全:LLM 生成的 SQL 走【SELECT-only 闸】—— 只读,任何 INSERT/UPDATE/DELETE/DROP/ATTACH/PRAGMA 一律拒,
杜绝 LLM 改你的失效真值库(与 decision_guard 同一"AI 不碰不可逆"理念)。

用法:
  python scripts/failure_query.py --csv scripts/golden_cases/../../data_templates/field_data_template.csv \
      --q "-40到-30度、SOC 20-80 下有哪些失效记录,按可用度升序"
  python scripts/failure_query.py --selftest   # 仅测建表+SELECT-only闸(合成数据,不调 LLM)

字段(来自 5 年现场,见 data_templates/field_data_template.csv):
  chem, temp_zone, soc_window, batch, min_temp_c, duration_days, failed, failure_mode, availability_pct
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = "failures"
COLUMNS = [
    "chem",
    "temp_zone",
    "soc_window",
    "batch",
    "min_temp_c",
    "duration_days",
    "failed",
    "failure_mode",
    "availability_pct",
]

# SELECT-only 闸:只放行单条 SELECT,挡掉一切写/DDL/多语句
_FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|create|attach|pragma|replace|truncate|vacuum)\b", re.I)


def load_table(csv_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cols = ", ".join(f'"{c}" TEXT' for c in COLUMNS)
    conn.execute(f"CREATE TABLE {TABLE} ({cols})")
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
    for r in rows:
        conn.execute(
            f"INSERT INTO {TABLE} ({','.join(COLUMNS)}) VALUES ({','.join('?' * len(COLUMNS))})",
            [r.get(c, "") for c in COLUMNS],
        )
    conn.commit()
    return conn


def is_safe_select(sql: str) -> tuple[bool, str]:
    s = sql.strip().rstrip(";").strip()
    if ";" in s:
        return False, "禁止多语句"
    if not s.lower().startswith("select"):
        return False, "只允许 SELECT"
    if _FORBIDDEN.search(s):
        return False, "含写/DDL 关键字,拒绝"
    return True, ""


def nl_to_sql(question: str) -> str:
    """deepseek-chat 把自然语言翻成 SQLite SELECT。走 LiteLLM 网关或 DeepSeek 直连。"""
    from openai import OpenAI

    base = os.environ.get("LITELLM_BASE_URL", "http://127.0.0.1:4000/v1")
    key = os.environ.get("LITELLM_PROXY_KEY") or os.environ.get("DEEPSEEK_API_KEY", "sk-noauth")
    if os.environ.get("FAILURE_SQL_DIRECT_DEEPSEEK"):
        base, key = "https://api.deepseek.com/v1", os.environ.get("DEEPSEEK_API_KEY", "")
    client = OpenAI(base_url=base, api_key=key)
    sys_prompt = (
        f"你把中文问题翻成【一条 SQLite SELECT】。表 {TABLE} 列:{', '.join(COLUMNS)}。"
        f"只输出 SQL,不要解释、不要 markdown、不要分号后跟第二句。只能 SELECT,禁止任何写操作。"
    )
    resp = client.chat.completions.create(
        model=os.environ.get("SQL_MODEL", "openai/deepseek-chat"),
        messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": question}],
        temperature=0,
    )
    sql = (resp.choices[0].message.content or "").strip()
    sql = re.sub(r"^```\w*|```$", "", sql).strip()  # 去 markdown 围栏
    return sql


def main() -> int:
    ap = argparse.ArgumentParser(description="失效数据 text-to-SQL(DeepSeek 翻译 + SELECT-only 闸)")
    ap.add_argument("--csv", default="")
    ap.add_argument("--q", default="")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        # 合成数据,测建表 + SELECT-only 闸(不调 LLM)
        import io

        data = "chem,temp_zone,soc_window,batch,min_temp_c,duration_days,failed,failure_mode,availability_pct\nLFP,-40~-30,20-80,B1,-41,300,1,析锂,88\nLFP,-30~-20,30-90,B2,-25,365,0,,99\n"
        p = ROOT / "/tmp/_synth_fail.csv"
        Path("/tmp/_synth_fail.csv").write_text(data, encoding="utf-8")
        conn = load_table(Path("/tmp/_synth_fail.csv"))
        rows = conn.execute(f"SELECT chem,failure_mode,availability_pct FROM {TABLE} WHERE failed='1'").fetchall()
        print("建表+查询:", [dict(r) for r in rows])
        assert len(rows) == 1 and rows[0]["failure_mode"] == "析锂", "查询逻辑错"
        for bad in ["DROP TABLE failures", "SELECT 1; DELETE FROM failures", "update failures set failed=0"]:
            ok, why = is_safe_select(bad)
            assert not ok, f"应拒绝: {bad}"
        assert is_safe_select("SELECT * FROM failures WHERE min_temp_c < -35")[0]
        print("✅ 自测通过:建表+查询正确,SELECT-only 闸挡住 DROP/多语句/UPDATE,放行正常 SELECT")
        return 0

    if not args.csv or not args.q:
        print('用法: --csv <失效数据.csv> --q "自然语言问题"  (或 --selftest)')
        return 1
    conn = load_table(Path(args.csv))
    sql = nl_to_sql(args.q)
    ok, why = is_safe_select(sql)
    print(f"生成 SQL: {sql}")
    if not ok:
        print(f"⛔ SELECT-only 闸拒绝执行:{why}")
        return 1
    rows = conn.execute(sql).fetchall()
    print(f"\n命中 {len(rows)} 行:")
    for r in rows[:30]:
        print("  ", dict(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
