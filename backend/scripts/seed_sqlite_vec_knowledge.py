"""把仓库自带的脱敏公开知识文档灌进 sqlite-vec 知识库(2026-07-07)。

背景:src/knowledge_rag.py 2026-07-07 默认后端已从 chromadb 切到 sqlite-vec(CVE-free)
但只切了代码,没人把内容真正灌进去——data/sqlite_vec_rag.db 直到本脚本写好前一直不存在,
IMA 检索一直静默返回空。knowledge/docs/ 下这几篇文档本身就是脱敏后保留真实技术判断价值的
公开知识(低温电池/行业标准等),不涉及任何客户/公司敏感信息,直接可用,不需要真实 IMA 凭证。

data/sqlite_vec_rag.db 是运行产物,不进 git(见 AGENTS.md 红线)——每个新环境/新 clone
跑一次本脚本即可恢复知识库。

注意:SqliteVecRAG.add_text/add_directory 本身不去重(纯 INSERT,对其他调用方可能是
合理的简单语义,不在本脚本改动共享类)。本脚本按 source 文件名用 count_by_source 做
幂等判断,重复跑不会撑大;要强制重新灌某篇,先手动删 data/sqlite_vec_rag.db 再跑。

用法: python scripts/seed_sqlite_vec_knowledge.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


def main() -> int:
    from src.sqlite_vec_rag import SqliteVecRAG

    rag = SqliteVecRAG()
    docs_dir = ROOT / "knowledge" / "docs"
    if not docs_dir.exists():
        print(f"错误: 目录不存在: {docs_dir}")
        return 1

    ingested, skipped = 0, 0
    for fp in sorted(docs_dir.rglob("*")):
        if not fp.is_file() or fp.suffix.lower() not in (".md", ".txt"):
            continue
        if rag.count_by_source(fp.name) > 0:
            skipped += 1
            continue
        ingested += rag.add_text(
            fp.read_text(encoding="utf-8", errors="replace"),
            source=fp.name,
            extra_metadata={"knowledge_domain": "document"},
        )

    print(
        f"本次新入库: {ingested} | 已存在跳过: {skipped} | 库内文档总数: {rag.count()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
