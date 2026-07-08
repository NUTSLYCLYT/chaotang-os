#!/usr/bin/env python3
"""
部门聚合脱敏导入器（2026-06-24 · 单机私有 · "只聚合脱敏"模板）。

军工供应商的部门真数据多含军方项目/型号/实名(用户红线:跨军方)。本导入器只产**聚合统计**——
项目数、按状态计数——绝不落项目名/型号/负责人/军方单位。让部门显真统计、不泄敏感明细。

输出本地 data/dept-<key>.local.json(gitignored,绝不入git/外传)。
用法: python3 scripts/import-dept-aggregate.py tech "<项目进度表xlsx>"
"""

import sys, os, json, zipfile, re
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# 各部门:进度文本里判定"已交付/进行中/有问题"的关键词(只用于计数,不外泄原文)。
DELIVERED_KW = re.compile(r"已交货|已入库|完成|交付|已发货|结案")
ISSUE_KW = re.compile(r"问题|返修|缺|未|待解决|延期|异常|不满足|返工")


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


def aggregate_projects(path):
    """逐行判定:是否是项目行(有编号样的列) + 进度/问题文本 → 只回计数,不留原文。"""
    total = delivered = in_progress = with_issues = 0
    header_done = False
    for cells in read_rows(path):
        row_text = " ".join(str(v) for v in cells.values())
        # 跳过表头/标题行:含"立项日期/项目编号/项目名称"等列名的行
        if not header_done and re.search(r"立项日期|项目编号|项目名称|进度", row_text):
            header_done = True
            continue
        if not header_done:
            continue
        # 项目行启发:存在形如 序号/编号 的非空首列且整行有进度文本
        joined = row_text.strip()
        if not joined or len(joined) < 4:
            continue
        # 认定为项目行(保守:行内出现项目编号样式或多列有值)
        nonempty = [str(v).strip() for v in cells.values() if str(v).strip()]
        if len(nonempty) < 3:
            continue
        total += 1
        if DELIVERED_KW.search(joined):
            delivered += 1
        elif ISSUE_KW.search(joined):
            with_issues += 1
        else:
            in_progress += 1
    return total, delivered, in_progress, with_issues


def main():
    if len(sys.argv) < 3:
        print("用法: import-dept-aggregate.py <dept-key> <xlsx路径>", file=sys.stderr)
        sys.exit(2)
    key, path = sys.argv[1], sys.argv[2]
    if not os.path.exists(path):
        print(f"[agg] 找不到 xlsx: {path}", file=sys.stderr)
        sys.exit(2)

    total, delivered, in_progress, with_issues = aggregate_projects(path)
    snapshot = {
        "source": "local-real-aggregate",  # 本地真账·已脱敏聚合
        "dept": key,
        "origin": os.path.basename(path),  # 只留文件名
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "projects_total": total,
        "projects_delivered": delivered,
        "projects_in_progress": in_progress,
        "projects_with_issues": with_issues,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"dept-{key}.local.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)
    # 回执:只汇总计数,绝不打印任何项目名/型号/人名
    print(f"[agg] OK → {os.path.relpath(out)}")
    print(
        f"[agg] {key}: 项目总数={total} 已交付={delivered} 进行中={in_progress} 有问题={with_issues}"
    )


if __name__ == "__main__":
    main()
