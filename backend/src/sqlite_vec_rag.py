"""sqlite-vec RAG 后端(2026-07-07 · 解 chromadb 安全卡点)。

背景:chromadb 因未修复 CVE(GHSA-f4j7-r4q5-qw2c)被团队故意排除 → 整个史馆召回/专项进化的
向量检索层没法安全跑。本模块用 **sqlite-vec**(轻量、本地、无该 CVE)实现 KnowledgeRAG 召回路径
所需的最小同款接口(add_text/add_texts/search/count),让 genius_next_step / case_archive / 专项进化
在不引入有洞依赖的前提下真跑。

接口与 KnowledgeRAG 对齐(消费方零改):
- search(query, top_k, ..., scope, tenant_isolation=True) → [{content, source, score, tenant_id, ...}]
- add_text(text, source, extra_metadata) / add_texts(items) / count()

租户隔离(第0步a后半):写端 extra_metadata 带 tenant_id;search 默认 tenant_doc_visible 过滤,
只返回本租户 + 共享知识,绝不跨租户。embedding 复用 knowledge_rag._get_embedding_fn(离线 ngram 兜底,无需网络)。
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "sqlite_vec_rag.db"


class SqliteVecRAG:
    """sqlite-vec 向量检索后端。单表存文档 + vec0 虚拟表存向量,rowid 对齐。"""

    def __init__(self, db_path: str | Path | None = None):
        import sqlite_vec

        from src.knowledge_rag import _get_embedding_fn

        self._embed = _get_embedding_fn()
        self._dim = len(self._embed(["探测维度"])[0])  # 动态测 embedding 维度
        self._path = Path(db_path) if db_path else DEFAULT_DB
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False:get_rag() 是进程级单例,会被 FastAPI 线程池 + 蜂群 worker
        # 多线程共用(会审 CRITICAL);单连接跨线程必须关这个检查。并发访问用 _lock 串行化(下)。
        self._db = sqlite3.connect(str(self._path), check_same_thread=False)
        self._lock = threading.Lock()  # 单连接多线程:所有 DB 操作串行化,防 race
        self._db.enable_load_extension(True)
        sqlite_vec.load(self._db)
        self._db.enable_load_extension(False)
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS docs("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, source TEXT, "
            "tenant_id TEXT, knowledge_domain TEXT)"
        )
        self._db.execute(
            f"CREATE VIRTUAL TABLE IF NOT EXISTS vec_docs USING vec0(embedding float[{self._dim}])"
        )
        self._db.commit()

    def _serialize(self, vec: list[float]) -> bytes:
        import sqlite_vec

        return sqlite_vec.serialize_float32(vec)

    def add_text(
        self, text: str, source: str = "", extra_metadata: dict | None = None
    ) -> int:
        """存一条文档(整段一块,案例文本短,够用)。返回写入块数(1 或 0)。"""
        if not (text or "").strip():
            return 0
        meta = extra_metadata or {}
        vec = self._embed([text])[0]
        with self._lock:
            cur = self._db.execute(
                "INSERT INTO docs(content, source, tenant_id, knowledge_domain) VALUES (?,?,?,?)",
                (text, source, meta.get("tenant_id"), meta.get("knowledge_domain")),
            )
            rowid = cur.lastrowid
            self._db.execute(
                "INSERT INTO vec_docs(rowid, embedding) VALUES (?, ?)",
                (rowid, self._serialize(vec)),
            )
            self._db.commit()
        return 1

    def add_texts(self, items: list[tuple]) -> int:
        """批量:items = [(text, source, extra_metadata|None), ...]。"""
        n = 0
        for it in items:
            text = it[0]
            source = it[1] if len(it) > 1 else ""
            meta = it[2] if len(it) > 2 else None
            n += self.add_text(text, source, meta)
        return n

    def count(self) -> int:
        with self._lock:
            return int(self._db.execute("SELECT COUNT(*) FROM docs").fetchone()[0])

    def count_by_source(self, source: str) -> int:
        with self._lock:
            return int(
                self._db.execute(
                    "SELECT COUNT(*) FROM docs WHERE source = ?", (source,)
                ).fetchone()[0]
            )

    def stats(self) -> dict:
        """接口对齐 KnowledgeRAG.stats(pre_retrieve 靠它判空)。"""
        with self._lock:
            rows = self._db.execute("SELECT DISTINCT source FROM docs").fetchall()
            total = int(self._db.execute("SELECT COUNT(*) FROM docs").fetchone()[0])
        return {
            "total_chunks": total,
            "sources": sorted(r[0] for r in rows if r[0]),
            "backend": "sqlite_vec",
        }

    def search_as_text(
        self,
        query: str,
        top_k: int = 3,
        max_tokens: int = 1500,
        scope: list | None = None,
    ) -> str:
        """检索并格式化为可注入上下文的文本(接口对齐 KnowledgeRAG,复用同一 formatter)。"""
        from src.knowledge_rag import _format_search_hits

        results = self.search(query, top_k=top_k, max_tokens=max_tokens, scope=scope)
        return _format_search_hits(results)

    def add_directory(
        self, dir_path: str | Path | None = None, extensions: tuple = (".md", ".txt")
    ) -> dict:
        """批量入库目录下文档(接口对齐;共享知识默认无 tenant_id→__shared__ 语义可见)。"""
        if dir_path is None:
            return {"ingested": 0, "error": "未指定目录"}
        base = Path(dir_path)
        if not base.exists():
            return {"ingested": 0, "error": f"目录不存在: {base}"}
        ingested = 0
        for fp in base.rglob("*"):
            if fp.is_file() and fp.suffix.lower() in extensions:
                try:
                    ingested += self.add_text(
                        fp.read_text(encoding="utf-8", errors="replace"),
                        source=str(fp.name),
                        extra_metadata={"knowledge_domain": "document"},
                    )
                except Exception:
                    continue
        return {"ingested": ingested}

    def search(
        self,
        query: str,
        top_k: int = 3,
        max_tokens: int = 1500,
        source_filter: str | None = None,
        hybrid_alpha: float = 0.7,
        scope: list | None = None,
        tenant_isolation: bool = True,
    ) -> list[dict]:
        """向量 KNN 检索 + 租户隔离过滤(默认安全)。返回同 KnowledgeRAG.search 形状。"""
        from src.knowledge_rag import tenant_doc_visible

        if self.count() == 0:
            return []
        qvec = self._serialize(self._embed([query])[0])
        # 过量取候选(供 scope/source/tenant 过滤后仍够 top_k)
        fetch = max(top_k * 6, 30)
        with self._lock:
            rows = self._db.execute(
                "SELECT d.content, d.source, d.tenant_id, d.knowledge_domain, v.distance "
                "FROM vec_docs v JOIN docs d ON d.id = v.rowid "
                "WHERE v.embedding MATCH ? AND k = ? ORDER BY v.distance",
                (qvec, fetch),
            ).fetchall()

        current = None
        if tenant_isolation:
            from src.tenant import get_current_tenant

            current = get_current_tenant()

        out: list[dict] = []
        for content, source, tenant_id, kdomain, distance in rows:
            if scope and kdomain not in scope:
                continue
            if source_filter and source != source_filter:
                continue
            if tenant_isolation and not tenant_doc_visible(tenant_id, current):
                continue
            out.append(
                {
                    "content": content,
                    "source": source or "?",
                    "score": round(1.0 / (1.0 + float(distance)), 4),
                    "tenant_id": tenant_id,
                }
            )
            if len(out) >= top_k:
                break
        return out
