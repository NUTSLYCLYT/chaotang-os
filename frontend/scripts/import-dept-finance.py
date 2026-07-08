#!/usr/bin/env python3
"""
户部接真数据导入器（2026-06-24 · 单机私有 · 模板:H盘真账 → 本地 gitignored 快照 → 户部读真）。

从「发生额及余额表(科目余额表)」xlsx 抽取最少结构化运营数(货币资金/应收账款等期末余额),
写本地 data/dept-finance.local.json(已 gitignore,绝不入 git)。户部 overview 读它显真 cash_reserve。

纪律:只取结构化会计科目余额(运营数);不碰姓名/合同/军方/证件。不打印明细到日志,只回执汇总。
用法: python3 scripts/import-dept-finance.py "<xlsx路径>"
       缺省读 H 盘 2025 发生额及余额表。
"""

import sys, os, json, zipfile, re
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DEFAULT_XLSX = "/mnt/h/各部门备份/财务部/上传数据库资料/20-25年财务报表及科目余额表/2025年发生额及余额表.xlsx"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "dept-finance.local.json")


def col_idx(ref):
    s = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in s:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        t = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in t.findall(f"{NS}si"):
            shared.append("".join(n.text or "" for n in si.iter(f"{NS}t")))
    t = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    for r in t.iter(f"{NS}row"):
        cells = {}
        for c in r.findall(f"{NS}c"):
            ref, typ, v = c.get("r", ""), c.get("t"), c.find(f"{NS}v")
            if ref and v is not None and v.text is not None:
                cells[col_idx(ref)] = shared[int(v.text)] if typ == "s" else v.text
        yield cells


def num(x):
    try:
        return float(str(x).replace(",", "").strip())
    except Exception:
        return 0.0


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    if not os.path.exists(path):
        print(f"[import] 找不到 xlsx: {path}", file=sys.stderr)
        sys.exit(2)

    # 列约定(据 2025 发生额及余额表实测):1=类别 2=编码 3=名称 ... 8=期末借 9=期末贷
    period = ""
    accounts = []  # 仅 4 位顶层科目,避免子科目重复计
    for cells in read_rows(path):
        code = str(cells.get(2, "")).strip()
        name = str(cells.get(3, "")).strip()
        if not period:
            joined = " ".join(str(v) for v in cells.values())
            m = re.search(r"期间[:：]\s*([\d.]+\s*-\s*[\d.]+)", joined)
            if m:
                period = m.group(1)
        if re.fullmatch(r"\d{4}", code):  # 顶层科目
            end_debit = num(cells.get(8, 0))
            end_credit = num(cells.get(9, 0))
            accounts.append(
                {"code": code, "name": name, "end": round(end_debit - end_credit, 2)}
            )

    by_code = {a["code"]: a for a in accounts}
    cash = round(
        by_code.get("1001", {}).get("end", 0) + by_code.get("1002", {}).get("end", 0), 2
    )
    receivables = by_code.get("1122", {}).get("end", 0)

    def wan(v):
        return f"{round(v / 10000, 1)} 万"

    snapshot = {
        "source": "local-real",  # 本地真账,非 LIVE/演示
        "origin": os.path.basename(path),  # 只留文件名,不留敏感全路径
        "period": period or "unknown",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cash_reserve_cny": cash,
        "cash_reserve": wan(cash),
        "receivables_cny": receivables,
        "receivables": wan(receivables),
        "top_accounts": sorted(accounts, key=lambda a: abs(a["end"]), reverse=True)[:8],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    # 回执:只汇总,不泄明细
    print(f"[import] OK → {os.path.relpath(OUT)}")
    print(
        f'[import] 期间={snapshot["period"]} 货币资金={snapshot["cash_reserve"]} 应收={snapshot["receivables"]} 顶层科目数={len(accounts)}'
    )


if __name__ == "__main__":
    main()
