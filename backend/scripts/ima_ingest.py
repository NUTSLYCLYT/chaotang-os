#!/usr/bin/env python3
"""IMA 知识库 → 自有 hybrid 索引 的内容抽取脚手架。

为什么:IMA 的知识库是 wiki/文件管理,内部检索你不可控、且 PDF/docx 正文要下载后解析。
正确架构(大神/2026 SOTA):IMA 当人用的内容仓;把内容【抽出来】灌进你自己的 hybrid 索引(稠密+稀疏)。
本脚本走 ima_server 已连通的 OpenAPI:browse_knowledge 列文件 → get_media_info 取带签名下载 URL → 下载 → 解析正文。

⚠️ 13042 个文件全量下载+解析很重(时间+解析依赖+签名URL仅 5 分钟有效)。所以:
   默认 --list 只列举(验通管道,零下载);--ingest 才真下载,且必须显式给 --max 限量,逐步来。

用法:
  python scripts/ima_ingest.py --list                      # 列所有知识库
  python scripts/ima_ingest.py --kb <KB_ID> --list         # 列某库文件(连通性验证,不下载)
  python scripts/ima_ingest.py --kb <KB_ID> --ingest --max 20 --out /tmp/ima_chunks.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _server():
    import inspect

    import mcp_servers.ima_server as m

    for _, obj in vars(m).items():
        if inspect.isclass(obj) and hasattr(obj, "browse_knowledge"):
            return obj()
    raise RuntimeError("找不到 IMAServer 类")


def _parse_text(path: Path) -> str:
    """把下载的文件解析成纯文本。txt/md 直读;PDF/docx 需额外库(缺则跳过并提示)。"""
    ext = path.suffix.lower()
    if ext in (".txt", ".md"):
        return path.read_text(encoding="utf-8", errors="replace")
    if ext == ".pdf":
        try:
            import PyPDF2  # noqa: F401

            r = PyPDF2.PdfReader(str(path))
            return "\n".join(p.extract_text() or "" for p in r.pages)
        except Exception:
            return ""  # 缺 PyPDF2 → 跳过(全量 ingest 前先 pip install PyPDF2 python-docx)
    if ext == ".docx":
        try:
            from docx import Document

            return "\n".join(p.text for p in Document(str(path)).paragraphs)
        except Exception:
            return ""
    return ""


def main() -> int:
    ap = argparse.ArgumentParser(description="IMA 知识库内容抽取(默认只列举,不下载)")
    ap.add_argument("--kb", default="", help="知识库 ID(不给则列所有库)")
    ap.add_argument("--list", action="store_true", help="只列举,不下载(连通性验证)")
    ap.add_argument("--ingest", action="store_true", help="真下载+解析(需 --max 限量)")
    ap.add_argument("--max", type=int, default=0, help="ingest 时最多处理几个文件")
    ap.add_argument("--out", default="/tmp/ima_chunks.jsonl", help="抽取结果输出(jsonl)")
    args = ap.parse_args()

    srv = _server()

    if not args.kb:
        kbs = srv.list_knowledge_bases().get("knowledge_bases", [])
        print(f"知识库 {len(kbs)} 个:")
        for kb in kbs:
            print(f"  - {kb.get('name')} (id={kb.get('id')[:24]}… docs={kb.get('content_count')})")
        return 0

    res = srv.browse_knowledge(knowledge_base_id=args.kb, limit=50)
    files = res.get("items") or res.get("files") or res.get("contents") or []
    print(f"库 {args.kb[:24]}… 浏览到 {len(files)} 个条目(本页)")
    for f in files[:10]:
        print(f"  · {f.get('name', f)}  media_id={str(f.get('media_id', ''))[:18]}…")

    if args.list or not args.ingest:
        print("\n[list 模式] 仅验证连通,未下载。要真抽取:加 --ingest --max N")
        return 0

    if args.max <= 0:
        print("❌ --ingest 必须给 --max(防一次拉 1.3 万文件)。例:--ingest --max 20")
        return 1

    out = Path(args.out)
    n = 0
    with out.open("w", encoding="utf-8") as w:
        for f in files[: args.max]:
            mid = f.get("media_id")
            if not mid:
                continue
            info = srv.get_media_info(mid)
            url = info.get("url") or info.get("download_url")
            if not url:
                continue
            # 下载(签名 URL 5 分钟有效)+ 解析。此处留下载实现接口:
            # import urllib.request; tmp=download(url); text=_parse_text(tmp)
            text = ""  # ← 全量启用时在此填充下载+_parse_text
            w.write(
                json.dumps(
                    {"source": "ima", "kb": args.kb, "media_id": mid, "name": f.get("name"), "url": url, "text": text},
                    ensure_ascii=False,
                )
                + "\n"
            )
            n += 1
    print(f"✅ 写出 {n} 条到 {out}(text 待填充下载解析;PDF/docx 需先 pip install PyPDF2 python-docx)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
