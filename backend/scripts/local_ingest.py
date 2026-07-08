#!/usr/bin/env python3
"""本地文件夹 → 持久 RAG 库(真 Ollama embedding)。绕开 IMA API 权限墙的正解。

为什么不走 IMA API:订阅/共享库(如锂电解码库)API 返回 220030 拒绝下载正文,只能在 IMA 客户端看。
正解(SOTA & ima_ingest docstring 本意):把内容【导出成文件】→ 本地灌进自有索引。对任何来源都管用、零 token。

工作流:
  1) 在 IMA 客户端把要灌的资料导出为 md/txt/pdf/docx,丢进一个文件夹(可带子目录)。
  2) python scripts/local_ingest.py --dir <文件夹> [--reset] [--query "测试问题"]

解析:.md/.txt 直读;.pdf 用 PyPDF2;.docx 用 python-docx(没装则跳过并提示);.doc 旧格式跳过
     (需 antiword/libreoffice,建议在 IMA 里另存为 .docx/.pdf 再导)。
入库走 KnowledgeRAG.add_text → 复用持久 chroma + 已配的本地 Ollama embedding。零 LLM token。
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 加载 .env,让 EMBED_*(本地 Ollama)生效
_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

TEXT_EXT = {".md", ".txt", ".markdown"}
# markitdown(微软,2026-06 GitHub trending)统一把这些二进制/富文本格式转成 Markdown
MD_EXT = {".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".html", ".htm", ".csv", ".json", ".xml", ".epub", ".doc"}


def extract_text(fp: Path) -> tuple[str, str]:
    """返回 (正文, 状态)。状态用于汇报跳过原因。

    .md/.txt 直读;PDF/Word/Excel/PPT/HTML/CSV 等统一走 markitdown 转 Markdown
    (一个库吃掉所有格式,解锁雨桐 .doc/.pdf 失效数据直接灌库)。
    """
    ext = fp.suffix.lower()
    if ext in TEXT_EXT:
        return fp.read_text(encoding="utf-8", errors="replace"), "ok"
    if ext in MD_EXT:
        try:
            from markitdown import MarkItDown

            txt = (MarkItDown().convert(str(fp)).text_content or "").strip()
            return (txt, "ok") if txt else ("", "markitdown 解析为空")
        except ImportError:
            return "", "缺 markitdown(pip install 'markitdown[all]')"
        except Exception as e:
            return "", f"markitdown 解析失败({type(e).__name__}: {str(e)[:60]})"
    return "", f"不支持的格式 {ext}"


def main() -> int:
    ap = argparse.ArgumentParser(description="本地文件夹灌入持久 RAG 库(真 Ollama embedding)")
    ap.add_argument("--dir", required=True, help="要灌的文件夹(递归)")
    ap.add_argument("--reset", action="store_true", help="先清空现有库(换 embedding 后首次必加)")
    ap.add_argument("--max", type=int, default=0, help="最多处理几个文件(0=不限)")
    ap.add_argument("--domain", default="", help="给所有块打的领域标签(可选,如 锂电)")
    ap.add_argument("--query", default="", help="灌完跑一条测试检索")
    args = ap.parse_args()

    d = Path(args.dir).expanduser()
    if not d.exists():
        print(f"❌ 文件夹不存在: {d}")
        return 1

    from src.knowledge_rag import KnowledgeRAG

    rag = KnowledgeRAG()
    if args.reset:
        rag.clear()
        print("🗑️  已清空旧库(md5 假向量与 768 维真向量不兼容,换 embedding 后必须 reset)")

    files = [p for p in sorted(d.rglob("*")) if p.is_file()]
    if args.max:
        files = files[: args.max]

    ok = chunks = 0
    skipped: list[str] = []
    for fp in files:
        text, status = extract_text(fp)
        if status != "ok" or not text.strip():
            skipped.append(f"{fp.name} — {status or '空文件'}")
            continue
        meta = {"knowledge_domain": args.domain} if args.domain else None
        n = rag.add_text(text, source=str(fp.relative_to(d)), extra_metadata=meta)
        ok += 1
        chunks += n
        print(f"  ✅ {fp.relative_to(d)} → {n} 块")

    print(f"\n灌库完成:{ok} 个文件 → {chunks} 块,库内总块数={rag._collection.count()}")
    if skipped:
        print(f"跳过 {len(skipped)} 个:")
        for s in skipped[:15]:
            print(f"  ⚠️ {s}")

    if args.query:
        print(f"\n🔍 测试检索:「{args.query}」(混合分排序 / 同时显示纯向量分)")
        for r in rag.search(args.query, top_k=3):
            src = r.get("source", "?")
            combined = r.get("score", "")
            vec = r.get("vector_score", "")
            kw = r.get("keyword_score", "")
            snippet = (r.get("content") or "").replace("\n", " ")[:40]
            print(f"   混合={combined} (向量={vec} BM25={kw})  {src} :: {snippet}…")
        print("   ⓘ 真双路 hybrid:稠密向量 + BM25/jieba 中文分词,RRF 名次融合(词面精度纠正语义漂移)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
