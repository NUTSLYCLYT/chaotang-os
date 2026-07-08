"""KnowledgeSource 抽象基类 + Citation 数据结构。

设计要点：
- 镜像 ToolDef 的设计，让 step 可以同时配 tools 和 knowledge
- Citation 字段对齐 NotebookLM 的"引用回链"心智模型
- 适配器只负责 search() 和 health_check()，注入文本由 router 统一格式化
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TypedDict


class Citation(TypedDict, total=False):
    """单个检索片段。前端按 source_type 不同图标渲染回链。

    字段是受控的、跨源稳定的 — 不要把适配器的原始响应/内部 schema 塞进来,
    避免内部细节顺着 SSE 流到前端从而绑死前端。需要更细的分数拆解时
    用 score_breakdown 这种受控形态。
    """
    text: str           # 片段正文
    score: float        # 相关度 0-1
    source_id: str      # 唯一标识（doc_id / chunk_id）
    source_type: str    # "chroma" | "ragflow" | "ima"
    source_name: str    # 显示名（文档名 / 知识库名）
    dataset: str        # 所在数据集 ID（chroma collection / ragflow ds_id / ima kb_id）
    score_breakdown: dict[str, float]  # 可选 sub-score（vector / keyword 等），无原始响应透传


class KnowledgeSource(ABC):
    """所有知识库适配器的统一接口。"""

    source_type: str = "abstract"

    @abstractmethod
    def search(
        self,
        query: str,
        dataset: str | None = None,
        top_k: int = 3,
        max_chars: int = 1500,
    ) -> list[Citation]:
        """检索并返回 Citation 列表。

        Args:
            query: 查询字符串
            dataset: 数据集 ID（chroma collection / ragflow ds / ima kb_id）
                     为 None 时由适配器自行决定默认值
            top_k: 返回片段数
            max_chars: 总字符上限（防 context 爆炸）
        """
        ...

    def health_check(self) -> dict:
        """返回 {"ok": bool, "latency_ms": int, "error": str | None}。

        默认实现：调用 list_datasets() 测试连通性。
        子类可覆盖以实现更轻量的检查。
        """
        import time
        t0 = time.time()
        try:
            self.list_datasets()
            return {"ok": True, "latency_ms": int((time.time() - t0) * 1000), "error": None}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "latency_ms": int((time.time() - t0) * 1000), "error": str(e)}

    def list_datasets(self) -> list[dict]:
        """列出此源下所有可用数据集，供前端下拉。

        默认返回空列表 — 子类必须覆盖才能在画布上显示。

        Returns:
            [{"id": "...", "name": "...", "doc_count": N, "meta": {...}}]
        """
        return []

    def is_configured(self) -> bool:
        """是否完成必要配置（API key / 端口连通）。"""
        return True


def format_citations_as_text(citations: list[Citation]) -> str:
    """把 Citation 列表渲染成喂给 LLM 的上下文文本。"""
    if not citations:
        return ""
    parts = []
    for c in citations:
        src_label = c.get("source_name") or c.get("source_id", "?")
        score = c.get("score", 0)
        type_tag = c.get("source_type", "?")
        parts.append(
            f"【来源: {src_label} | {type_tag}】(相关度: {score:.0%})\n{c.get('text', '')}"
        )
    return "\n\n---\n\n".join(parts)


def merge_citations(
    pools: list[list[Citation]],
    top_k: int,
    max_chars: int,
) -> list[Citation]:
    """合并多源 Citation：按 score 降序，文本去重，截断到 max_chars。

    简易实现，未做 cross-encoder rerank（后续 P2 接 bge-reranker 时替换）。
    """
    flat: list[Citation] = []
    for pool in pools:
        flat.extend(pool)
    flat.sort(key=lambda c: c.get("score", 0), reverse=True)

    seen_text: set[str] = set()
    out: list[Citation] = []
    total_chars = 0
    for c in flat:
        text = c.get("text", "").strip()
        if not text:
            continue
        # 简单去重：前 80 字符相同视作重复
        sig = text[:80]
        if sig in seen_text:
            continue
        seen_text.add(sig)
        if total_chars + len(text) > max_chars:
            break
        out.append(c)
        total_chars += len(text)
        if len(out) >= top_k:
            break
    return out
