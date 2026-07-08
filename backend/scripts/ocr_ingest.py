#!/usr/bin/env python3
"""扫描件 PDF → 中文 OCR(RapidOCR)→ 持久 RAG 库。

为扫描合同/检测报告等【无文字层】PDF 补上 OCR:PyMuPDF 渲染每页为图 → RapidOCR 中文识别
→ 拼成文本 → KnowledgeRAG.add_text(真 Ollama embedding)。离线、零外部 key。

⚠️ 运行前需 LD_LIBRARY_PATH=$HOME/miniforge3/lib(修 CXXABI;已写进 ~/.bashrc,新 shell 自动带)。
用法:
  LD_LIBRARY_PATH=$HOME/miniforge3/lib python3 scripts/ocr_ingest.py --base <根目录> --list /tmp/scanned_pdfs.json --max 2
  (--max 0 = 全量;--reset 清库重灌;--dpi 渲染清晰度,默认 200)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
for _ln in (ROOT / ".env").read_text(encoding="utf-8").splitlines() if (ROOT / ".env").exists() else []:
    _ln = _ln.strip()
    if _ln and not _ln.startswith("#") and "=" in _ln:
        _k, _v = _ln.split("=", 1)
        os.environ.setdefault(_k.strip(), _v.strip())


def ocr_pdf(path: Path, engine, dpi: int = 200, max_pages: int = 20) -> str:
    """渲染 PDF 每页为图并 OCR,返回拼接文本。"""
    import fitz
    import numpy as np

    doc = fitz.open(str(path))
    out = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=dpi)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:  # RGBA→RGB
            img = img[:, :, :3]
        res, _ = engine(img)
        if res:
            out.append("\n".join(line[1] for line in res))
    doc.close()
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="扫描件 PDF → 中文OCR → RAG 灌库")
    ap.add_argument("--base", required=True, help="PDF 根目录")
    ap.add_argument("--list", default="", help="相对路径清单 json(不给则递归扫 base 下所有 pdf)")
    ap.add_argument("--max", type=int, default=0, help="最多处理几个(0=全量)")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--domain", default="购销合同")
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()

    base = Path(args.base)
    if args.list and Path(args.list).exists():
        rels = json.loads(Path(args.list).read_text(encoding="utf-8"))
        pdfs = [base / r for r in rels]
    else:
        pdfs = sorted(base.rglob("*.pdf"))
    # --max 语义:本次最多【新灌】几个(配合"跳过已入库"分批跑,每批新进程防 OOM)

    from rapidocr_onnxruntime import RapidOCR

    from src.knowledge_rag import KnowledgeRAG

    engine = RapidOCR()
    rag = KnowledgeRAG()
    if args.reset:
        rag.clear()
        print("🗑️  已清库")

    # 已入库的 source 集合(断点续灌:跳过已 OCR 的,支持分批多进程)
    done = set()
    try:
        got = rag._collection.get(include=["metadatas"])
        done = {m.get("source", "") for m in (got.get("metadatas") or [])}
    except Exception:
        pass

    ok = empty = err = chunks = skipped = 0
    t0 = time.time()
    for i, p in enumerate(pdfs):
        src = "购销合同/" + p.name
        if src in done:
            skipped += 1
            continue
        if args.max and ok >= args.max:
            print(f"  ⏸ 已达本批上限 {args.max} 个新文件,退出(下批新进程续灌)", flush=True)
            break
        try:
            txt = ocr_pdf(p, engine, dpi=args.dpi).strip()
        except Exception as e:
            err += 1
            print(f"  ❌ [{i + 1}/{len(pdfs)}] {p.name}: {type(e).__name__}: {str(e)[:50]}", flush=True)
            continue
        if len(txt) < 30:
            empty += 1
            print(f"  ⚠️ [{i + 1}/{len(pdfs)}] {p.name}: OCR 文本过短({len(txt)}字)", flush=True)
            continue
        n = rag.add_text(txt, source="购销合同/" + p.name, extra_metadata={"knowledge_domain": args.domain})
        ok += 1
        chunks += n
        print(f"  ✅ [{i + 1}/{len(pdfs)}] {p.name} → {len(txt)}字 / {n}块", flush=True)

    dt = time.time() - t0
    print(
        f"\nOCR 灌库完成: 成功 {ok} / 空 {empty} / 错 {err} | 新增 {chunks} 块 | "
        f"库内总块数 {rag._collection.count()} | 用时 {dt:.0f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
