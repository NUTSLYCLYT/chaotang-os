"""ChromaDB / RAGFlow / IMA 适配器。

每个 adapter 实现 KnowledgeSource 接口，把现有 src/knowledge_rag.py 里的
KnowledgeRAG / RagFlowRAG / IMAServer 包装成统一形态。

新增源的扩展点：写一个 KnowledgeSource 子类 + @register_source(type_name) 即可，
router 与 list_available_sources 自动发现。
"""

from __future__ import annotations

import logging
import os
from typing import Type

from src.knowledge.base import Citation, KnowledgeSource

logger = logging.getLogger(__name__)


# ─── 注册表 ────────────────────────────────────────────────────

_REGISTRY: dict[str, KnowledgeSource] = {}
_CLASS_MAP: dict[str, Type[KnowledgeSource]] = {}


def register_source(source_type: str):
    """装饰器：让 KnowledgeSource 子类自注册到全局表。"""
    def deco(cls: Type[KnowledgeSource]) -> Type[KnowledgeSource]:
        cls.source_type = source_type
        _CLASS_MAP[source_type] = cls
        return cls
    return deco


def get_source(source_type: str) -> KnowledgeSource | None:
    """懒加载单例。"""
    if source_type in _REGISTRY:
        return _REGISTRY[source_type]
    cls = _CLASS_MAP.get(source_type)
    if cls is None:
        return None
    inst = cls()
    _REGISTRY[source_type] = inst
    return inst


def all_source_types() -> list[str]:
    return list(_CLASS_MAP.keys())


# ─── Chroma 适配器 ─────────────────────────────────────────────

@register_source("chroma")
class ChromaSource(KnowledgeSource):
    """本地 ChromaDB 知识库（src/knowledge_rag.py:KnowledgeRAG 包装）。"""

    requires_dataset: bool = False  # chroma 允许全量检索本地库

    def __init__(self):
        self._rag = None

    def _ensure_rag(self):
        if self._rag is None:
            from src.knowledge_rag import get_rag
            self._rag = get_rag()
        return self._rag

    def search(
        self,
        query: str,
        dataset: str | None = None,
        top_k: int = 3,
        max_chars: int = 1500,
    ) -> list[Citation]:
        rag = self._ensure_rag()
        max_tokens = int(max_chars * 1.5)
        scope = [dataset] if dataset else None
        try:
            hits = rag.search(query=query, top_k=top_k, max_tokens=max_tokens, scope=scope)
        except Exception as e:  # noqa: BLE001
            logger.warning("ChromaSource.search 失败: %s", e)
            return []

        results: list[Citation] = []
        for h in hits:
            results.append(Citation(
                text=h.get("content", ""),
                score=float(h.get("score", 0)),
                source_id=str(h.get("file", h.get("source", ""))) + f":{h.get('chunk_index', 0)}",
                source_type="chroma",
                source_name=h.get("source", "?"),
                dataset=dataset or "default",
                score_breakdown={
                    "vector": float(h.get("vector_score", 0)),
                    "keyword": float(h.get("keyword_score", 0)),
                },
            ))
        return results

    def list_datasets(self) -> list[dict]:
        rag = self._ensure_rag()
        stats = rag.stats()
        return [{
            "id": "default",
            "name": "全量 Chroma",
            "doc_count": stats.get("total_chunks", 0),
            "meta": {"db_dir": stats.get("db_dir")},
        }] + [
            {"id": src, "name": src, "doc_count": 0, "meta": {}}
            for src in stats.get("sources", [])
        ]


# ─── RAGFlow 适配器 ────────────────────────────────────────────

@register_source("ragflow")
class RagFlowSource(KnowledgeSource):
    """RAGFlow 知识库（src/knowledge_rag.py:RagFlowRAG 包装）。"""

    requires_dataset: bool = True  # ragflow 必须显式指定 dataset, 防环境变量兜底污染

    def __init__(self):
        self._rf = None

    def _ensure(self):
        if self._rf is None:
            from src.knowledge_rag import get_ragflow
            self._rf = get_ragflow()
        return self._rf

    def is_configured(self) -> bool:
        return self._ensure().is_configured()

    def search(
        self,
        query: str,
        dataset: str | None = None,
        top_k: int = 3,
        max_chars: int = 1500,
    ) -> list[Citation]:
        rf = self._ensure()
        if not rf.is_configured():
            return []
        ds_ids = [dataset] if dataset else None
        try:
            hits = rf.search(query=query, top_k=top_k, max_tokens=int(max_chars * 1.5), dataset_ids=ds_ids)
        except Exception as e:  # noqa: BLE001
            logger.warning("RagFlowSource.search 失败: %s", e)
            return []

        return [
            Citation(
                text=h.get("content", ""),
                score=float(h.get("score", 0)),
                source_id=h.get("source", ""),
                source_type="ragflow",
                source_name=h.get("source", "?"),
                dataset=dataset or "default",
            )
            for h in hits
        ]

    def list_datasets(self) -> list[dict]:
        # RAGFlow 没有 list datasets API（需 console），从环境变量读出全部 ID
        named = []
        for k, v in os.environ.items():
            if k.startswith("RAGFLOW_DS_") and v.strip():
                named.append({
                    "id": v.strip(),
                    "name": k.removeprefix("RAGFLOW_DS_"),
                    "doc_count": 0,
                    "meta": {"env_var": k},
                })
        if named:
            return named
        raw_ids = os.environ.get("RAGFLOW_DATASET_IDS", "")
        ids = [i.strip() for i in raw_ids.split(",") if i.strip()]
        return [
            {"id": ds_id, "name": ds_id[:8], "doc_count": 0, "meta": {}}
            for ds_id in ids
        ]


# ─── IMA 适配器 ────────────────────────────────────────────────

@register_source("ima")
class ImaSource(KnowledgeSource):
    """腾讯 IMA 知识库（mcp_servers/ima_server.py 包装）。"""

    requires_dataset: bool = True

    def __init__(self):
        self._server = None

    def _ensure(self):
        if self._server is None:
            try:
                import sys
                from pathlib import Path
                sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
                from mcp_servers.ima_server import IMAServer
                self._server = IMAServer()
            except Exception as e:  # noqa: BLE001
                logger.warning("IMAServer 初始化失败: %s", e)
                return None
        return self._server

    def is_configured(self) -> bool:
        # 凭证单一真相源：与 ima_server 实际调用远端用的同一套凭证链
        # （IMA_OPENAPI_CLIENTID/IMA_OPENAPI_APIKEY 环境变量 > ~/.config/ima/ 文件）。
        # 旧实现检查 IMA_API_KEY/IMA_TOKEN，与真实链路脱节：配了真凭证仍被判未配置，
        # ima 预检索被静默跳过。
        try:
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
            from mcp_servers.ima_server import _load_credentials
        except Exception as e:  # noqa: BLE001
            logger.warning("加载 ima 凭证链失败: %s", e)
            return False
        client_id, api_key = _load_credentials()
        return bool(client_id and api_key)

    def health_check(self) -> dict:
        """轻量健康检查 — 不调用 list_knowledge_bases (远端 HTTP)。

        前端每 60s 轮询 /api/knowledge/health；如果走默认实现，
        会持续敲 IMA 远端，浪费配额且有限流风险。
        """
        configured = self.is_configured()
        return {
            "ok": configured and self._ensure() is not None,
            "latency_ms": 0,
            "error": None if configured else "未配置 IMA_OPENAPI_CLIENTID/IMA_OPENAPI_APIKEY（或 ~/.config/ima/）",
        }

    def search(
        self,
        query: str,
        dataset: str | None = None,
        top_k: int = 3,
        max_chars: int = 1500,
    ) -> list[Citation]:
        srv = self._ensure()
        if srv is None or not dataset:
            return []
        try:
            data = srv.search_knowledge(query, dataset, limit=top_k)
        except Exception as e:  # noqa: BLE001
            logger.warning("ImaSource.search 失败: %s", e)
            return []

        results: list[Citation] = []
        total = 0
        for item in data.get("results", []):
            text = item.get("highlight") or item.get("title", "")
            if not text:
                continue
            if total + len(text) > max_chars:
                break
            results.append(Citation(
                text=text,
                score=float(item.get("score", 0.5)),
                source_id=item.get("doc_id", item.get("media_id", "")),
                source_type="ima",
                source_name=item.get("title", "?"),
                dataset=dataset,
            ))
            total += len(text)
            if len(results) >= top_k:
                break
        return results

    def list_datasets(self) -> list[dict]:
        srv = self._ensure()
        if srv is None:
            return []
        try:
            data = srv.list_knowledge_bases("")
        except Exception as e:  # noqa: BLE001
            logger.warning("ImaSource.list_datasets 失败: %s", e)
            return []

        # ima_server 失败时不抛异常而是返回 {"error": ...}，静默当空列表会把
        # "凭证失效/限流"伪装成"账号没有知识库"——必须显式告警
        if isinstance(data, dict) and data.get("error"):
            logger.warning("ImaSource.list_datasets 远端报错: %s", data["error"])
            return []

        # 远端实际返回 knowledge_bases/content_count（2026-06-12 实测），
        # 兼容旧假设的 results/doc_count
        items = (
            (data.get("knowledge_bases") or data.get("results", []))
            if isinstance(data, dict)
            else data
        )
        out = []
        for kb in items or []:
            try:
                doc_count = int(kb.get("content_count") or kb.get("doc_count") or 0)
            except (TypeError, ValueError):
                doc_count = 0
            out.append({
                "id": kb.get("id") or kb.get("knowledge_base_id") or "",
                "name": kb.get("name", ""),
                "doc_count": doc_count,
            })
        return [d for d in out if d["id"]]
