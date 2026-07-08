#!/usr/bin/env python3
"""供应商真值台账·提取器(把你的采购侧 Excel/CSV → config/eval/supplier_registry.json)。

像当初抽 6.1更新电芯库.xlsx 一样:读你的供应商名录/采购台账,提取成结构化真值,
让 supply_chain_check 从"查形式"升级到"查真假"(推荐的供应商真存在吗?报价对得上真实采购价吗?)。

列名自动识别(中文表头容错):
  供应商  ← 供应商/厂商/供货商/公司名称
  型号    ← 型号/物料/电芯/产品/规格
  采购单价← 单价/采购价/含税单价/价格
  交期    ← 交期/货期/交货周期/lead
  起订量  ← 起订/MOQ/最小起订
  认证    ← 认证/资质/证书
  合格率  ← 合格率/良率/来料合格/不良率(不良率会转成合格率)

用法: python scripts/build_supplier_registry.py --file 你的供应商台账.xlsx
      python scripts/build_supplier_registry.py --file 采购记录.csv --sheet Sheet1
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "config" / "eval" / "supplier_registry.json"

COLMAP = {
    "supplier": r"供应商|厂商|供货商|公司名称|公司",
    "model": r"型号|物料|电芯|产品名称|规格",
    "price": r"单价|采购价|含税单价|价格|采购单价",
    "lead_time": r"交期|货期|交货周期|lead",
    "moq": r"起订|moq|最小起订|起订量",
    "cert": r"认证|资质|证书",
    "pass_rate": r"合格率|良率|来料合格|不良率",
}


def _match_cols(header: list[str]) -> dict:
    """把表头映射到标准字段 → {field: col_index}。"""
    idx = {}
    for j, h in enumerate(header):
        hs = str(h or "")
        for field, pat in COLMAP.items():
            if field not in idx and re.search(pat, hs, re.I):
                idx[field] = j
    return idx


def _rows_from_xlsx(path: Path, sheet: str | None):
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def _rows_from_xls(path: Path, sheet: str | None):
    import xlrd

    wb = xlrd.open_workbook(str(path))
    sh = wb.sheet_by_name(sheet) if sheet else wb.sheet_by_index(0)
    return [sh.row_values(i) for i in range(sh.nrows)]


def _rows_from_csv(path: Path):
    with path.open(encoding="utf-8-sig") as f:
        return [r for r in csv.reader(f)]


def _find_header(rows: list[list]) -> int:
    """找表头行:第一行命中≥2个已知列关键词。"""
    for i, r in enumerate(rows[:15]):
        if len(_match_cols(r)) >= 2:
            return i
    return 0


def extract(path: Path, sheet: str | None) -> list[dict]:
    ext = path.suffix.lower()
    rows = (
        _rows_from_xlsx(path, sheet)
        if ext == ".xlsx"
        else _rows_from_xls(path, sheet)
        if ext == ".xls"
        else _rows_from_csv(path)
    )
    if not rows:
        return []
    h = _find_header(rows)
    idx = _match_cols(rows[h])
    if "supplier" not in idx:
        raise SystemExit(f"❌ 未识别出'供应商'列。表头={rows[h]}。请确认文件含供应商名录类数据。")
    out = []
    for r in rows[h + 1 :]:

        def g(field):
            j = idx.get(field)
            return r[j] if j is not None and j < len(r) else None

        supplier = g("supplier")
        if not supplier or not str(supplier).strip():
            continue
        rec = {"supplier": str(supplier).strip()}
        for f in ("model", "price", "lead_time", "moq", "cert", "pass_rate"):
            v = g(f)
            if v is not None and str(v).strip() not in ("", "None"):
                rec[f] = str(v).strip()
        out.append(rec)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="供应商真值台账提取器")
    ap.add_argument("--file", required=True, help="供应商名录/采购台账 Excel/CSV")
    ap.add_argument("--sheet")
    a = ap.parse_args()
    p = Path(a.file)
    if not p.exists():
        raise SystemExit(f"文件不存在: {p}")
    recs = extract(p, a.sheet)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(recs, ensure_ascii=False, indent=2), encoding="utf-8")
    suppliers = sorted({r["supplier"] for r in recs})
    print(f"✅ 提取 {len(recs)} 条 / {len(suppliers)} 家供应商 → {OUT.relative_to(ROOT)}")
    print(f"   供应商样例: {suppliers[:8]}")
    print("   supply_chain_check 下次运行会自动启用 C5供应商存在性/C6价格对照(数据门已开)。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
