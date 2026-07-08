#!/usr/bin/env python3
"""从IMA雨桐库全量拉取物料购买记录 → config/eval/ima_material_registry.json。

遍历所有年份+月份的采购单存档,下载每个物料购买申请表.xls,提取(物料编码/物品名称/规格/单位/数量/交期/项目)。
这是'公司实际买过什么'的真值锚——PACK/采购蜂群选型时应偏好在采购记录里出现过的物料。

诚实边界:这批数据是'采购申请单(requisition)',不是'采购订单(PO)';不含实际成交价/供应商。
价格→需从采购订单/发票侧补。本文件不造假。

用法: python scripts/ima_pull_supply.py [--max-per-month 5]
→ 写 config/eval/ima_material_registry.json
"""

from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
OUT = ROOT / "config" / "eval" / "ima_material_registry.json"
KB = "LQwD0jsCJ6DQQHd06ahTFxsNg_q0oBQ83fJDrSms7MU="

YEAR_FOLDERS = {
    "2024": "folder_7377201460693125",
    "2023": "folder_7377201422954841",
    "2021": "folder_7377206456123049",
    "2020": "folder_7377207164956799",
}


def _server():
    import mcp_servers.ima_server as m

    for v in vars(m).values():
        if isinstance(v, type) and hasattr(v, "browse_knowledge"):
            return v()
    raise SystemExit("未找到 IMAServer")


def _browse(s, fid: str, limit: int = 50) -> list:
    return s.browse_knowledge(knowledge_base_id=KB, folder_id=fid, limit=limit).get("items", [])


def _download(s, media_id: str) -> bytes | None:
    info = s.get_media_info(media_id=media_id)
    url = info.get("url")
    if not url:
        return None
    req = urllib.request.Request(url, headers=info.get("headers") or {})
    return urllib.request.urlopen(req, timeout=60).read()


def _extract_xls(data: bytes, src: str) -> list[dict]:
    import xlrd

    wb = xlrd.open_workbook(file_contents=data)
    sh = wb.sheet_by_index(0)
    hdr_row, hdr = None, None
    for i in range(sh.nrows):
        cells = [str(sh.cell_value(i, j)).strip() for j in range(min(sh.ncols, 12))]
        if "序号" in cells or any("物料编码" in c for c in cells):
            hdr_row, hdr = i, cells
            break
    if not hdr:
        return []
    # 映射列名 → 索引
    idx = {}
    for k, pat in [
        ("material_code", "物料编码"),
        ("item", "物品名称"),
        ("spec", "规格型号"),
        ("unit", "单位"),
        ("qty", "数量"),
        ("deadline", "交货日期"),
        ("note", "备注"),
    ]:
        for j, c in enumerate(hdr):
            if pat in c and j not in idx.values():
                idx[k] = j
                break
    if "item" not in idx:
        return []
    rows = []
    for i in range(hdr_row + 1, sh.nrows):
        row = [str(sh.cell_value(i, j)).strip() for j in range(min(sh.ncols, 12))]
        if not any(row):
            continue
        item = row[idx["item"]]
        if not item or re.match(r"^[\d.\s]+$", item) or "编制" in item or "审核" in item:
            continue
        rec = {"item": item, "src": src}
        for k, j in idx.items():
            v = row[j] if j < len(row) else ""
            v = v.strip()
            if not v or v in ("", "0.0", ".0"):
                continue
            rec[k] = v
        rows.append(rec)
    return rows


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description="IMA 物料购买记录全量提取器")
    ap.add_argument("--max-per-month", type=int, default=5)
    a = ap.parse_args()
    s = _server()
    all_rows = []
    for year, yf in YEAR_FOLDERS.items():
        print(f"\n{year}年:")
        top = _browse(s, yf, limit=30)
        # 直属 xls
        direct_xls = [it for it in top if it.get("media_id", "").startswith("excel")]
        for it in direct_xls[: a.max_per_month]:
            try:
                data = _download(s, it["media_id"])
                if not data:
                    continue
                rows = _extract_xls(data, f"{year}/{it['title']}")
                all_rows.extend(rows)
                print(f"  {it['title'][:30]}: +{len(rows)}")
            except Exception as e:
                print(f"  {it['title'][:25]}: err {type(e).__name__}")

        # 月份子文件夹
        months = [it for it in top if it.get("type") == "file"]
        for mo in months[:12]:
            mid = mo.get("media_id", "")
            if not mid.startswith("folder_"):
                continue
            items = _browse(s, mid, limit=a.max_per_month)
            xls = [it for it in items if it.get("media_id", "").startswith("excel")]
            for it in xls[: a.max_per_month]:
                try:
                    data = _download(s, it["media_id"])
                    if not data:
                        continue
                    rows = _extract_xls(data, f"{year}/{mo.get('title')}/{it['title']}")
                    all_rows.extend(rows)
                except Exception as e:
                    pass
            if xls:
                print(f"  {year}/{mo.get('title')}: +{sum(1 for _ in xls)} xls")

    # 去重:同 item+spec 合并
    from collections import defaultdict

    by_key = defaultdict(list)
    for r in all_rows:
        k = (r.get("item", ""), r.get("spec", ""), r.get("material_code", ""))
        by_key[k].append(r)
    deduped = []
    for (item, spec, code), recs in by_key.items():
        q = sum(float(r["qty"]) for r in recs if r.get("qty") and re.match(r"^\d+", r["qty"]))
        deduped.append(
            {
                "item": item,
                "spec": spec,
                "material_code": code,
                "unit": recs[0].get("unit", ""),
                "total_qty": round(q, 1) if q else 0,
                "request_count": len(recs),
                "sources": [r["src"] for r in recs[:3]],
            }
        )
    deduped.sort(key=lambda r: -r["request_count"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"\n→ {OUT.relative_to(ROOT)}: {len(all_rows)}条原始 → {len(deduped)} 种物料(去重)/ "
        f"高频Top5: {[d['item'] for d in deduped[:5]]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
