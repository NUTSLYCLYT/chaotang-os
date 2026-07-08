"""知识库 RAG 引擎 — 文档向量化检索。

第2层知识库：将公司内部非结构化文档（白皮书、标准、历史方案）
通过 Embedding 向量化存储到 ChromaDB，支持语义检索。

技术选型：
    - 向量库: ChromaDB（纯 Python、零运维、本地文件存储）
    - Embedding: 智谱 embedding-3（中文优化）/ 本地 fallback
    - 分块策略: 按章节切分，保留标题和来源

用法：
    rag = KnowledgeRAG()
    rag.add_document("path/to/doc.md", source="产品手册v2")
    results = rag.search("低温电池循环寿命", top_k=3)
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_DIR = PROJECT_ROOT / "knowledge" / "chroma_db"
DOCS_DIR = PROJECT_ROOT / "knowledge" / "docs"


class _LocalEmbeddingFunction:
    """离线字符 n-gram embedding — 无需网络，无需额外依赖。

    用字符 bigram + trigram 哈希到固定维度向量，L2 归一化。
    精度不及语义模型，但完全离线，适合内网部署环境。
    """

    DIM = 512

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in input]

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * self.DIM
        for n in (2, 3):
            for i in range(max(0, len(text) - n + 1)):
                gram = text[i : i + n]
                h = int(
                    hashlib.md5(gram.encode("utf-8", errors="replace")).hexdigest(), 16
                )
                vec[h % self.DIM] += 1.0
        norm = sum(x * x for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    # ChromaDB EmbeddingFunction 协议所需方法
    def name(self) -> str:
        return "local_ngram"

    def get_config(self) -> dict:
        return {"dim": self.DIM}

    @classmethod
    def build_from_config(cls, config: dict) -> "_LocalEmbeddingFunction":
        return cls()

    def is_legacy(self) -> bool:
        return False

    def embed_documents(self, input, **kwargs) -> list[list[float]]:  # noqa: A002
        if isinstance(input, str):
            return [self._embed(input)]
        return [self._embed(t) for t in input]

    def embed_query(self, input, **kwargs) -> list[list[float]]:  # noqa: A002
        if isinstance(input, list):
            return [self._embed(t) for t in input]
        return [self._embed(input)]


class _ZhipuEmbeddingFunction:
    """智谱 embedding-3 API embedding，中文语义效果好。

    单次请求支持 list 输入（批量），N 个文本省去 N-1 次 RTT。
    高分知识回流批量写入时尤其重要。
    """

    BATCH_SIZE = 32  # 智谱 embedding-3 单请求文本数上限

    def __call__(self, input: list[str]) -> list[list[float]]:
        import httpx

        api_key = os.environ.get("ZHIPU_API_KEY", "")
        if not api_key:
            raise RuntimeError("ZHIPU_API_KEY 未设置，无法使用智谱 Embedding")
        embeddings: list[list[float]] = []
        for i in range(0, len(input), self.BATCH_SIZE):
            batch = input[i : i + self.BATCH_SIZE]
            resp = httpx.post(
                "https://open.bigmodel.cn/api/paas/v4/embeddings",
                json={"model": "embedding-3", "input": batch},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            # 按 index 排序保证返回顺序对齐（API 一般按入参顺序，但 spec 没强保证）
            entries = sorted(data["data"], key=lambda x: x.get("index", 0))
            embeddings.extend(e["embedding"] for e in entries)
        return embeddings

    def embed_documents(self, input, **kwargs) -> list[list[float]]:  # noqa: A002
        if isinstance(input, str):
            return self([input])
        return self(input)

    def embed_query(self, input, **kwargs) -> list[list[float]]:  # noqa: A002
        if isinstance(input, list):
            return self(input)
        return self([input])

    # ChromaDB EmbeddingFunction 协议所需方法
    def name(self) -> str:
        return "zhipu_embedding3"

    def get_config(self) -> dict:
        return {"model": "embedding-3"}

    @classmethod
    def build_from_config(cls, config: dict) -> "_ZhipuEmbeddingFunction":
        return cls()

    def is_legacy(self) -> bool:
        return False


class _OpenAICompatEmbeddingFunction:
    """OpenAI 兼容 /embeddings 的【真语义】embedding。默认阿里百炼 text-embedding-v3(中文最强)。
    provider 无关:改 EMBED_API_BASE / EMBED_MODEL / EMBED_API_KEY 即可切 DashScope / OpenAI / 其它兼容端点。
    注:DeepSeek、Claude 均无 embedding API,不可用于此。"""

    BATCH_SIZE = 10  # DashScope text-embedding-v3 单请求上限

    def __init__(self):
        self.base = os.environ.get(
            "EMBED_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1"
        ).rstrip("/")
        self.model = os.environ.get("EMBED_MODEL", "text-embedding-v3")
        self.key = os.environ.get("EMBED_API_KEY") or os.environ.get(
            "DASHSCOPE_API_KEY", ""
        )

    def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
        import httpx

        if not self.key:
            raise RuntimeError(
                "EMBED_API_KEY / DASHSCOPE_API_KEY 未设置,无法使用真 embedding"
            )
        # 截断到安全长度,防超 embedding 模型 token 上限(nomic ~2048tok);空串→占位
        _max = int(os.environ.get("EMBED_MAX_CHARS", "1500"))

        def _clip(t):
            t = (t or "").strip()
            return (t[:_max] if len(t) > _max else t) or "·"

        def _post(batch):
            resp = httpx.post(
                f"{self.base}/embeddings",
                json={"model": self.model, "input": batch},
                headers={"Authorization": f"Bearer {self.key}"},
                timeout=60,
            )
            resp.raise_for_status()
            return [
                e["embedding"]
                for e in sorted(resp.json()["data"], key=lambda x: x.get("index", 0))
            ]

        clean = [_clip(t) for t in input]
        out: list[list[float]] = []
        for i in range(0, len(clean), self.BATCH_SIZE):
            batch = clean[i : i + self.BATCH_SIZE]
            try:
                out.extend(_post(batch))
            except Exception:
                # 批失败→逐条;单条仍失败→再截 1/3 重试;还不行→零向量占位(绝不崩整批)
                for one in batch:
                    try:
                        out.extend(_post([one]))
                    except Exception:
                        try:
                            out.extend(_post([one[: _max // 3] or "·"]))
                        except Exception:
                            logger.warning(
                                "embedding 单条失败,零向量占位 (len=%d)", len(one)
                            )
                            out.append([0.0] * 768)
        return out

    def embed_documents(self, input, **kwargs):  # noqa: A002
        return self([input] if isinstance(input, str) else input)

    def embed_query(self, input, **kwargs):  # noqa: A002
        return self(input if isinstance(input, list) else [input])

    def name(self) -> str:
        return f"openai_compat:{self.model}"

    def get_config(self) -> dict:
        return {"model": self.model, "base": self.base}

    @classmethod
    def build_from_config(cls, config: dict) -> "_OpenAICompatEmbeddingFunction":
        return cls()

    def is_legacy(self) -> bool:
        return False


class _MinimaxEmbeddingFunction:
    """MiniMax embo-01 embedding（1536维，中文友好）。
    格式与 OpenAI 不同：请求用 texts 字段，响应用 vectors 字段。
    环境变量：MINIMAX_API_KEY
    """

    BATCH_SIZE = 20
    BASE = "https://api.minimaxi.com/v1"
    MODEL = "embo-01"

    def __init__(self):
        self.key = os.environ.get("MINIMAX_API_KEY", "")

    def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
        import httpx

        if not self.key:
            raise RuntimeError("MINIMAX_API_KEY 未设置")
        out: list[list[float]] = []
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        transport = httpx.HTTPTransport(proxy=proxy) if proxy else None
        with httpx.Client(transport=transport, timeout=60) as client:
            for i in range(0, len(input), self.BATCH_SIZE):
                batch = input[i : i + self.BATCH_SIZE]
                resp = client.post(
                    f"{self.BASE}/embeddings",
                    json={"model": self.MODEL, "texts": batch, "type": "db"},
                    headers={"Authorization": f"Bearer {self.key}"},
                )
                resp.raise_for_status()
                vecs = resp.json().get("vectors", [])
                out.extend(vecs)
        return out

    def embed_documents(self, input, **kwargs):  # noqa: A002
        return self([input] if isinstance(input, str) else input)

    def embed_query(self, input, **kwargs):  # noqa: A002
        return self(input if isinstance(input, list) else [input])

    def name(self) -> str:
        return f"minimax:{self.MODEL}"

    def get_config(self) -> dict:
        return {"model": self.MODEL, "base": self.BASE}

    @classmethod
    def build_from_config(cls, _: dict) -> "_MinimaxEmbeddingFunction":
        return cls()

    def is_legacy(self) -> bool:
        return False


def _is_ollama_embed_available() -> bool:
    """检测 Ollama embedding 服务是否可用（本地免费）。"""
    import urllib.request

    try:
        req = urllib.request.Request(
            "http://localhost:11434/api/tags",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            import json

            data = json.loads(resp.read())
            models = [m["name"] for m in data.get("models", [])]
            return any("embed" in m or "nomic" in m or "bge" in m for m in models)
    except Exception:
        return False


def _get_embedding_fn():
    """选 embedding（优先级）：
    显式 EMBED_API_BASE(用户明确指定的端点,如本地Ollama) > MiniMax > DashScope/OpenAI兼容 >
    智谱 > Ollama本地探测 > md5假向量(兜底·最差)。

    显式 EMBED_API_BASE 最优先:用户在 .env 里明写了端点就该用它,不被 MINIMAX_API_KEY 抢走
    (避免:在 SNI 受限网络上 MiniMax HTTPS 崩 / 1536维与已灌 768维向量冲突)。
    """
    if os.environ.get("EMBED_API_BASE") and os.environ.get("EMBED_API_KEY"):
        fn = _OpenAICompatEmbeddingFunction()
        logger.info("使用显式配置 embedding（最高优先）: %s @ %s", fn.name(), fn.base)
        return fn
    if os.environ.get("MINIMAX_API_KEY"):
        fn = _MinimaxEmbeddingFunction()
        logger.info("使用 MiniMax embo-01 真 embedding（1536维）")
        return fn
    if os.environ.get("EMBED_API_KEY") or os.environ.get("DASHSCOPE_API_KEY"):
        fn = _OpenAICompatEmbeddingFunction()
        logger.info("使用 OpenAI 兼容真 embedding: %s", fn.name())
        return fn
    if os.environ.get("ZHIPU_API_KEY"):
        logger.info("使用智谱 embedding-3 API")
        return _ZhipuEmbeddingFunction()
    # Ollama 本地 embedding（完全免费，自动探测已安装的 embed 模型）
    if _is_ollama_embed_available():
        ollama_model = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text-v2-moe")
        os.environ.setdefault("EMBED_API_BASE", "http://localhost:11434/v1")
        os.environ.setdefault("EMBED_MODEL", ollama_model)
        os.environ.setdefault("EMBED_API_KEY", "ollama")
        fn = _OpenAICompatEmbeddingFunction()
        logger.info("使用 Ollama 本地 embedding（免费）: %s", ollama_model)
        return fn
    logger.warning(
        "无真 embedding（MINIMAX_API_KEY / EMBED_API_KEY / DASHSCOPE_API_KEY / "
        "ZHIPU_API_KEY / Ollama 均不可用）→ fallback md5 假向量（检索质量差）"
    )
    return _LocalEmbeddingFunction()


# ── 租户可见性(2026-07-07 · 三层架构会审 CRITICAL 第0步a·后半) ──
# 病根:case_archive 把租户案例(客户/报价机密)写进单一全局 collection 'fengqun_knowledge',
# 8 个 reader 经 get_rag().search() 不带租户过滤 → B 的案例被 A 的蜂群检索命中塞进 A 的输出。
# 修法:写端打 tenant_id,读端 search() 默认按租户过滤(隔离是默认,不靠调用方自觉——Schneier)。
SHARED_TENANT_ID = "__shared__"


def tenant_doc_visible(doc_tenant_id: object, current_tenant: str) -> bool:
    """一个文档对当前租户是否可见。默认安全:只放行本租户 + 共享知识,挡掉别家租户。

    - tenant_id 缺失(None/'')→ 视为共享/历史遗留知识(法条等),可见(不误伤既有共享语料)。
    - tenant_id == '__shared__' → 朝堂共享知识,可见。
    - tenant_id == current_tenant → 本租户自己的案例,可见。
    - 其它(别家租户 slug)→ 挡掉。
    注:历史 case_archive 数据(打 fix 前写入、无 tenant_id)仍会被当共享放行,需单独 backfill;
    fix 后的新写入一律带 tenant_id,即时隔离。
    """
    if doc_tenant_id in (None, "", SHARED_TENANT_ID):
        return True
    return doc_tenant_id == current_tenant


class KnowledgeRAG:
    """文档 RAG 引擎，基于 ChromaDB。"""

    def __init__(
        self,
        db_dir: str | Path | None = None,
        collection_name: str = "fengqun_knowledge",
    ):
        import chromadb

        self._db_dir = Path(db_dir) if db_dir else DEFAULT_DB_DIR
        self._db_dir.mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(path=str(self._db_dir))
        self._embedding_fn = _get_embedding_fn()
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "RAG 引擎初始化: db=%s, collection=%s, docs=%d",
            self._db_dir,
            collection_name,
            self._collection.count(),
        )

    # ─── 文档入库 ─────────────────────────────────────

    def add_document(
        self,
        file_path: str | Path,
        source: str | None = None,
        chunk_max_chars: int = 800,
    ) -> int:
        """将文档分块后入库。

        Args:
            file_path: 文档路径（支持 .md / .txt）
            source: 来源标注（如"产品手册v2"）
            chunk_max_chars: 每块最大字符数

        Returns:
            入库的块数
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文档不存在: {file_path}")

        text = file_path.read_text(encoding="utf-8")
        source = source or file_path.name

        chunks = self._split_into_chunks(text, chunk_max_chars)
        if not chunks:
            logger.warning("文档为空或无法分块: %s", file_path)
            return 0

        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            # 用内容哈希作为 ID，避免重复入库
            chunk_id = hashlib.md5(f"{source}:{i}:{chunk[:100]}".encode()).hexdigest()
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append(
                {
                    "source": source,
                    "file": str(file_path.name),
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "indexed_at": datetime.now().astimezone().isoformat(),
                }
            )

        # upsert 避免重复
        self._collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info("入库完成: %s → %d 块", source, len(chunks))
        return len(chunks)

    def add_text(
        self,
        text: str,
        source: str,
        chunk_max_chars: int = 800,
        extra_metadata: dict | None = None,
    ) -> int:
        """将原始文本分块后入库（不需要文件路径）。

        Args:
            text: 原始文本内容
            source: 来源标注（如"case_archive:run_20240415"）
            chunk_max_chars: 每块最大字符数
            extra_metadata: 额外元数据（如 knowledge_domain, grade, flow_name）

        Returns:
            入库的块数
        """
        chunks = self._split_into_chunks(text, chunk_max_chars)
        if not chunks:
            logger.warning("文本为空或无法分块: source=%s", source)
            return 0

        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{source}:{i}:{chunk[:100]}".encode()).hexdigest()
            ids.append(chunk_id)
            documents.append(chunk)
            meta = {
                "source": source,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "indexed_at": datetime.now().astimezone().isoformat(),
            }
            if extra_metadata:
                meta.update(extra_metadata)
            metadatas.append(meta)

        self._collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info("文本入库完成: %s → %d 块", source, len(chunks))
        return len(chunks)

    def add_texts(
        self,
        items: list[tuple[str, str, dict | None]],
        chunk_max_chars: int = 800,
    ) -> int:
        """批量入库多条文本。

        相比循环调 add_text(): 共用一次 collection.upsert(支持批量 embedding),
        显著降低高分回流场景下的同步阻塞时间。

        Args:
            items: [(text, source, extra_metadata|None), ...]
            chunk_max_chars: 每块最大字符数

        Returns:
            实际入库的总块数(分块后)
        """
        all_ids: list[str] = []
        all_docs: list[str] = []
        all_meta: list[dict] = []
        total_added = 0

        for text, source, extra_metadata in items:
            chunks = self._split_into_chunks(text, chunk_max_chars)
            if not chunks:
                continue
            indexed_at = datetime.now().astimezone().isoformat()
            for i, chunk in enumerate(chunks):
                chunk_id = hashlib.md5(
                    f"{source}:{i}:{chunk[:100]}".encode()
                ).hexdigest()
                all_ids.append(chunk_id)
                all_docs.append(chunk)
                meta = {
                    "source": source,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "indexed_at": indexed_at,
                }
                if extra_metadata:
                    meta.update(extra_metadata)
                all_meta.append(meta)
                total_added += 1

        if all_ids:
            self._collection.upsert(ids=all_ids, documents=all_docs, metadatas=all_meta)
            logger.info("批量入库完成: %d 条 source -> %d 块", len(items), total_added)
        return total_added

    def add_directory(
        self, dir_path: str | Path | None = None, extensions: tuple = (".md", ".txt")
    ) -> dict:
        """批量入库目录下所有文档。

        Returns:
            {"total_files": N, "total_chunks": M, "files": [...]}
        """
        dir_path = Path(dir_path) if dir_path else DOCS_DIR
        if not dir_path.exists():
            return {"total_files": 0, "total_chunks": 0, "files": []}

        results = {"total_files": 0, "total_chunks": 0, "files": []}
        for fp in sorted(dir_path.iterdir()):
            if fp.is_file() and fp.suffix.lower() in extensions:
                chunks = self.add_document(fp, source=fp.stem)
                results["total_files"] += 1
                results["total_chunks"] += chunks
                results["files"].append({"file": fp.name, "chunks": chunks})

        return results

    # ─── 检索 ─────────────────────────────────────────

    @staticmethod
    def _keyword_score(query: str, text: str) -> float:
        """简单关键词重叠分数（BM25-lite）。用于与向量分数混合排序。"""
        import re as _re2

        q_words = set(_re2.findall(r"\w+", query.lower()))
        t_words = set(_re2.findall(r"\w+", text.lower()))
        if not q_words or not t_words:
            return 0.0
        overlap = len(q_words & t_words)
        return overlap / ((len(q_words) ** 0.5) * (len(t_words) ** 0.5) + 1e-9)

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
        """混合检索（向量 + 关键词）文档片段。

        tenant_isolation:默认 True(安全默认)。只返回本租户 + 共享知识,挡掉别家租户案例
        (见 tenant_doc_visible)。刻意做全局/跨租户检索时显式传 False。

        Args:
            query: 搜索查询
            top_k: 返回最相关的 K 个片段
            max_tokens: 结果总 token 上限（粗估）
            source_filter: 按来源过滤（可选）
            hybrid_alpha: 向量分数权重（0~1，1=纯向量，0=纯关键词）
            scope: 知识域列表，非空时只检索 knowledge_domain metadata 匹配的文档；
                   None 或空列表表示全量检索（向后兼容）

        Returns:
            [{"content": "...", "source": "...", "score": 0.85, ...}, ...]
        """
        if self._collection.count() == 0:
            return []

        # 构建 ChromaDB where 过滤条件
        if source_filter and scope:
            # 同时有 source_filter 和 scope，使用 $and 组合
            where = {
                "$and": [
                    {"source": source_filter},
                    {"knowledge_domain": {"$in": list(scope)}},
                ]
            }
        elif source_filter:
            where = {"source": source_filter}
        elif scope:
            # 按 knowledge_domain metadata 字段过滤，只检索指定知识域
            where = {"knowledge_domain": {"$in": list(scope)}}
        else:
            where = None

        n_total = self._collection.count()
        fetch = min(max(top_k * 6, 30), n_total)

        # ── 稠密路:真语义向量(本地 Ollama embedding)取候选池 ──
        try:
            dres = self._collection.query(
                query_texts=[query], n_results=fetch, where=where
            )
        except Exception as e:
            logger.error("RAG 稠密检索失败: %s", e)
            return []

        by_id: dict[str, dict] = {}
        dense_ranked: list[dict] = []
        for i, _id in enumerate(dres["ids"][0]):
            meta = dres["metadatas"][0][i]
            distance = dres["distances"][0][i] if dres.get("distances") else 0
            cand = {
                "id": _id,
                "content": dres["documents"][0][i],
                "source": meta.get("source", "?"),
                "file": meta.get("file", "?"),
                "chunk_index": meta.get("chunk_index", 0),
                "vector_score": round(1 - distance, 4) if distance else 0.0,
                "bm25_score": 0.0,
                "tenant_id": meta.get("tenant_id"),
            }
            by_id[_id] = cand
            dense_ranked.append(cand)

        # ── 稀疏路:BM25 + jieba 中文分词,对 where 过滤后【全量语料】独立检索 ──
        # (中文 \w+ 切不开词→旧关键词分恒 0;jieba 分词后 BM25 才是真稀疏信号)
        sparse_ranked: list[dict] = []
        try:
            import jieba
            from rank_bm25 import BM25Okapi

            sig = (self._collection.name, n_total, repr(where))
            cache = getattr(self, "_bm25_cache", None)
            if not cache or cache.get("sig") != sig:
                got = self._collection.get(
                    where=where, include=["documents", "metadatas"]
                )
                tokenized = [list(jieba.cut(d or "")) for d in got["documents"]]
                cache = {
                    "sig": sig,
                    "bm25": BM25Okapi(tokenized) if tokenized else None,
                    "ids": got["ids"],
                    "docs": got["documents"],
                    "meta": got["metadatas"],
                }
                self._bm25_cache = cache
            bm25 = cache["bm25"]
            if bm25 is not None:
                scores = bm25.get_scores(list(jieba.cut(query)))
                order = sorted(
                    range(len(scores)), key=lambda j: scores[j], reverse=True
                )[:fetch]
                for j in order:
                    if scores[j] <= 0:
                        continue
                    _id = cache["ids"][j]
                    m = cache["meta"][j]
                    cand = by_id.get(_id) or {
                        "id": _id,
                        "content": cache["docs"][j],
                        "source": m.get("source", "?"),
                        "file": m.get("file", "?"),
                        "chunk_index": m.get("chunk_index", 0),
                        "vector_score": 0.0,
                        "tenant_id": m.get("tenant_id"),
                    }
                    cand["bm25_score"] = round(float(scores[j]), 4)
                    by_id[_id] = cand
                    sparse_ranked.append(cand)
        except Exception as e:
            logger.warning("BM25 稀疏检索不可用,回退纯向量: %s", e)

        # ── RRF 融合:按【名次】融合两路,免去 α 加权的量纲稀释问题 ──
        def _rrf(lists: list[list[dict]], k: int = 60) -> dict:
            agg: dict[str, float] = {}
            for lst in lists:
                for rank, c in enumerate(lst):
                    agg[c["id"]] = agg.get(c["id"], 0.0) + 1.0 / (k + rank + 1)
            return agg

        if sparse_ranked:
            fused = _rrf([dense_ranked, sparse_ranked])
            for _id, s in fused.items():
                by_id[_id]["score"] = round(s, 6)
        else:
            # 稀疏不可用 → 纯向量分(仍是真语义,不退回假关键词)
            for c in dense_ranked:
                c["score"] = c["vector_score"]

        # 向后兼容:保留 keyword_score 键(旧调用方可能读)
        for c in by_id.values():
            c.setdefault("keyword_score", c.get("bm25_score", 0.0))

        candidates = sorted(
            by_id.values(), key=lambda x: x.get("score", 0.0), reverse=True
        )

        # 租户隔离(默认安全):挡掉别家租户的案例,只留本租户 + 共享知识。
        if tenant_isolation:
            from src.tenant import get_current_tenant

            current = get_current_tenant()
            candidates = [
                c for c in candidates if tenant_doc_visible(c.get("tenant_id"), current)
            ]

        items = []
        total_chars = 0
        max_chars = int(max_tokens / 1.5)
        for c in candidates[:top_k]:
            # 保证至少返回 1 条（即使单条超过 max_chars，截断后返回）
            if total_chars + len(c["content"]) > max_chars and items:
                break
            content = c["content"]
            if len(content) > max_chars and not items:
                content = content[:max_chars]
                c = {**c, "content": content}
            total_chars += len(c["content"])
            items.append(c)

        return items

    def search_as_text(
        self,
        query: str,
        top_k: int = 3,
        max_tokens: int = 1500,
        scope: list | None = None,
    ) -> str:
        """检索并格式化为可注入上下文的文本。

        Args:
            scope: 知识域列表，非空时只检索 knowledge_domain metadata 匹配的文档；
                   None 或空列表表示全量检索（向后兼容）
        """
        results = self.search(query, top_k=top_k, max_tokens=max_tokens, scope=scope)
        return _format_search_hits(results)

    # ─── 管理 ─────────────────────────────────────────

    def count_by_source(self, source: str) -> int:
        """返回指定 source 的 chunk 数。不存在或 RAG 不可用时返回 0。"""
        try:
            result = self._collection.get(where={"source": source}, limit=9999)
            return len(result.get("ids") or [])
        except Exception:
            return 0

    def stats(self) -> dict:
        """返回知识库统计信息。"""
        count = self._collection.count()
        sources = set()
        if count > 0:
            all_meta = self._collection.get(limit=count)
            for m in all_meta.get("metadatas", []):
                sources.add(m.get("source", "?"))
        return {
            "total_chunks": count,
            "sources": sorted(sources),
            "db_dir": str(self._db_dir),
        }

    def clear(self):
        """清空知识库。"""
        self._client.delete_collection(self._collection.name)
        self._collection = self._client.get_or_create_collection(
            name=self._collection.name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    # ─── 分块 ─────────────────────────────────────────

    @staticmethod
    def _split_into_chunks(text: str, max_chars: int = 800) -> list[str]:
        """按章节标题切分文档，保留标题上下文。

        优先按 Markdown 标题（## / ###）切分，超长段落再按段落切。
        """
        # 按 Markdown 标题切分
        sections = re.split(r"\n(?=#{1,3}\s)", text)

        chunks = []
        for section in sections:
            section = section.strip()
            if not section:
                continue

            if len(section) <= max_chars:
                chunks.append(section)
            else:
                # 超长段落按双换行切分
                paragraphs = section.split("\n\n")
                current = ""
                for para in paragraphs:
                    para = para.strip()
                    if not para:
                        continue
                    if len(current) + len(para) + 2 > max_chars:
                        if current:
                            chunks.append(current)
                        current = para
                    else:
                        current = f"{current}\n\n{para}" if current else para
                if current:
                    chunks.append(current)

        return chunks


# ─── RAGFlow 检索适配器 ──────────────────────────────


class RagFlowRAG:
    """RAGFlow 文档检索适配器。

    调用 RAGFlow /v1/retrieval API，支持 PDF/PPT/Word 等格式文档的语义检索。

    环境变量配置：
        RAGFLOW_API_KEY     — RAGFlow API Key（从 RAGFlow UI → API Key 页面获取）
        RAGFLOW_BASE_URL    — RAGFlow 服务地址，默认 http://127.0.0.1:9380
        RAGFLOW_DATASET_IDS — 知识库 ID 列表，逗号分隔（从 RAGFlow UI → 知识库 → 设置获取）
    """

    def __init__(self):
        self._api_key = os.environ.get("RAGFLOW_API_KEY", "")
        self._base_url = os.environ.get(
            "RAGFLOW_BASE_URL", "http://127.0.0.1:9380"
        ).rstrip("/")
        raw_ids = os.environ.get("RAGFLOW_DATASET_IDS", "")
        self._dataset_ids = [i.strip() for i in raw_ids.split(",") if i.strip()]

    def is_configured(self) -> bool:
        return bool(self._api_key and self._dataset_ids)

    def search(
        self,
        query: str,
        top_k: int = 3,
        max_tokens: int = 1500,
        dataset_ids: list[str] | None = None,
    ) -> list[dict]:
        """调用 RAGFlow /v1/retrieval 检索文档片段。

        Args:
            dataset_ids: 覆盖全局配置，指定本次检索的知识库 ID 列表

        Returns:
            [{"content": "...", "source": "...", "score": 0.85}, ...]
        """
        import httpx

        ids = dataset_ids if dataset_ids else self._dataset_ids
        if not ids:
            return []

        try:
            resp = httpx.post(
                f"{self._base_url}/api/v1/retrieval",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "question": query,
                    "dataset_ids": ids,
                    "top_k": top_k,
                    "similarity_threshold": 0.2,
                    "vector_similarity_weight": 0.3,
                    "highlight": False,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning("RAGFlow 检索失败: %s", e)
            return []

        chunks = data.get("data", {}).get("chunks", [])
        if not chunks:
            return []

        results = []
        total_chars = 0
        max_chars = int(max_tokens / 1.5)

        for chunk in chunks[:top_k]:
            content = chunk.get("content", "").strip()
            if not content:
                continue
            if total_chars + len(content) > max_chars:
                break
            total_chars += len(content)
            results.append(
                {
                    "content": content,
                    "source": chunk.get("document_name", chunk.get("document_id", "?")),
                    "score": round(chunk.get("similarity", 0), 4),
                }
            )

        return results

    def search_as_text(
        self,
        query: str,
        top_k: int = 3,
        max_tokens: int = 1500,
        dataset_ids: list[str] | None = None,
    ) -> str:
        """检索并格式化为可注入上下文的文本。"""
        results = self.search(
            query, top_k=top_k, max_tokens=max_tokens, dataset_ids=dataset_ids
        )
        return _format_search_hits(results)


# ─── 共享格式化 ─────────────────────────────────


def _format_search_hits(hits: list[dict]) -> str:
    """KnowledgeRAG.search() / RagFlowRAG.search() 返回的 dict 列表统一格式化。

    src/knowledge/base.py:format_citations_as_text 是新 Citation 形态的版本；
    本函数处理的是老 dict 形态（{content, source, score}），二者保持模板一致。
    """
    if not hits:
        return ""
    return "\n\n---\n\n".join(
        f"【来源: {r.get('source', '?')}】(相关度: {r.get('score', 0):.0%})\n{r.get('content', '')}"
        for r in hits
    )


# ─── 预检索辅助函数 ─────────────────────────────────

_rag_instance: KnowledgeRAG | None = None
_ragflow_instance: RagFlowRAG | None = None


def get_rag():
    """获取全局 RAG 实例(懒加载单例)。

    2026-07-07:后端默认走 **sqlite-vec**(CVE-free,解 chromadb GHSA-f4j7-r4q5-qw2c 安全卡点)。
    仅当显式 CHAOTANG_RAG_BACKEND=chromadb 且 chromadb 可用时才用旧后端(留退路,不默认引入有洞依赖)。
    两后端接口对齐(add_text/add_texts/search/count),消费方零改。
    """
    global _rag_instance
    if _rag_instance is None:
        backend = os.environ.get("CHAOTANG_RAG_BACKEND", "sqlite_vec")
        if backend == "chromadb":
            _rag_instance = KnowledgeRAG()
        else:
            from src.sqlite_vec_rag import SqliteVecRAG

            _rag_instance = SqliteVecRAG()
    return _rag_instance


def get_ragflow() -> RagFlowRAG:
    """获取全局 RagFlowRAG 实例（懒加载单例）。"""
    global _ragflow_instance
    if _ragflow_instance is None:
        _ragflow_instance = RagFlowRAG()
    return _ragflow_instance


def pre_retrieve(
    task_input: str,
    top_k: int = 3,
    max_tokens: int = 1500,
    dataset_ids: list[str] | None = None,
    scope: list | None = None,
) -> str:
    """预检索：根据任务描述检索相关文档片段。

    优先使用 RAGFlow（支持 PDF/PPT/Word），未配置时 fallback 到本地 ChromaDB。

    Args:
        task_input: 客户需求描述
        top_k: 检索 Top-K
        max_tokens: 结果 token 上限
        dataset_ids: 指定检索的知识库 ID 列表（覆盖全局 RAGFLOW_DATASET_IDS）
        scope: 知识域列表（knowledge_domain metadata），非空时只检索指定知识域；
               None 表示全量检索（向后兼容）。仅对本地 ChromaDB 生效，
               RAGFlow 侧用 dataset_ids 区分知识库，scope 不传递。

    Returns:
        格式化的检索结果文本，空字符串表示无结果
    """
    ragflow = get_ragflow()
    if ragflow.is_configured():
        logger.info("使用 RAGFlow 进行文档预检索 dataset_ids=%s", dataset_ids or "全局")
        return ragflow.search_as_text(
            task_input, top_k=top_k, max_tokens=max_tokens, dataset_ids=dataset_ids
        )

    # fallback：本地 ChromaDB
    rag = get_rag()
    if rag.stats()["total_chunks"] == 0:
        return ""
    logger.info(
        "RAGFlow 未配置，使用本地 ChromaDB 检索 scope=%s",
        scope or "全量",
    )
    return rag.search_as_text(
        task_input, top_k=top_k, max_tokens=max_tokens, scope=scope
    )
