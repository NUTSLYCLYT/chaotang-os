"""KnowledgeRouter：三级合并 global / flow / step 的知识库选择。

镜像 src/tool_router.py 的设计思路。flow_engine 在每一步执行前调用：

    router = KnowledgeRouter(flow_config)
    text = router.retrieve_for_step(step_config, query=task_input)
    if text:
        context["rag_docs"] = text

YAML schema（与 tools 平级）：

    flow_knowledge:                   # Flow 级（向后兼容老的 knowledge_pre_retrieval）
      - source: chroma
        dataset: internal
        top_k: 3

    steps:
      - id: market_intel
        knowledge:                    # Step 级
          - source: ragflow
            dataset: ${RAGFLOW_DS_INDUSTRY}
            top_k: 5
          - source: ima
            dataset: ${IMA_KB_INDUSTRY}
"""

from __future__ import annotations

import logging
import os
from typing import Any

from src.knowledge.adapters import all_source_types, get_source
from src.knowledge.base import (
    Citation,
    KnowledgeSource,
    format_citations_as_text,
    merge_citations,
)

logger = logging.getLogger(__name__)


def _expand(val: str | None) -> str:
    if not val:
        return ""
    return os.path.expandvars(str(val)).strip()


def _normalize_entries(raw: Any) -> list[dict]:
    """把 knowledge 字段统一成 entries 列表，丢弃非 dict 元素。

    仅支持新格式列表 [{source, dataset, top_k}]。
    老字段 knowledge_pre_retrieval / ima_pre_retrieval 的转译逻辑在
    KnowledgeRouter.get_flow_entries 里。
    """
    if not raw:
        return []
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    return []


class KnowledgeRouter:
    """三级合并 + 多源检索。"""

    def __init__(self, flow_config: dict | None = None):
        self.flow_config = flow_config or {}

    # ── 三级解析 ──

    @staticmethod
    def get_global_entries() -> list[dict]:
        """全局默认（暂不读外部配置，预留接口）。"""
        return []

    def get_flow_entries(self) -> list[dict]:
        """Flow 级 knowledge 配置（仅读 flow_knowledge 新字段）。

        老字段 knowledge_pre_retrieval / ima_pre_retrieval 由 flow_engine 的
        _do_pre_retrieval / _do_ima_pre_retrieval 在 flow 启动时统一处理并写入
        context["rag_docs"] / context["ima_docs"]，本 router 不再重复转译，
        避免同源被检索两次、prompt 被注入两份。
        """
        return list(_normalize_entries(self.flow_config.get("flow_knowledge")))

    @staticmethod
    def get_step_entries(step_config: dict) -> list[dict]:
        return _normalize_entries(step_config.get("knowledge"))

    def merged_entries(self, step_config: dict) -> list[dict]:
        """三级合并，按 (source, dataset) 去重，step 级覆盖 flow 级。"""
        seen: dict[tuple, dict] = {}

        def _push(level: str, entry: dict):
            src = (entry.get("source") or "").strip()
            ds = _expand(entry.get("dataset"))
            key = (src, ds)
            if not src:
                return
            merged = dict(entry)
            merged["dataset"] = ds or None
            merged["_level"] = level
            seen[key] = merged  # 后写入覆盖前写入

        for e in self.get_global_entries():
            _push("global", e)
        for e in self.get_flow_entries():
            _push("flow", e)
        for e in self.get_step_entries(step_config):
            _push("step", e)

        return list(seen.values())

    # ── 检索 ──

    def retrieve_for_step(
        self,
        step_config: dict,
        query: str,
        max_total_chars: int = 1800,
    ) -> tuple[str, list[Citation]]:
        """检索并返回 (注入文本, 命中片段列表)。

        失败的源只记日志，不阻断整体流程。

        严格模式：ragflow / ima 条目缺 dataset 时跳过（防脏数据），
        chroma 允许 dataset 为空（语义为全量检索本地库，无环境变量兜底风险）。
        """
        raw_entries = self.merged_entries(step_config)
        entries: list[dict] = []
        for e in raw_entries:
            src_type = (e.get("source") or "").strip()
            ds = (e.get("dataset") or "").strip() if e.get("dataset") else ""
            src = get_source(src_type)
            # 严格模式：源声明了 requires_dataset 时必须显式指定 dataset，
            # 否则会退化到环境变量兜底污染检索结果
            if src is not None and getattr(src, "requires_dataset", False) and not ds:
                logger.warning(
                    "知识源 %s 缺少 dataset，已跳过（严格模式，level=%s）— "
                    "请在 step.knowledge 或 flow_knowledge 中显式填写 dataset",
                    src_type, e.get("_level", "?"),
                )
                continue
            entries.append(e)

        if not entries:
            return "", []

        per_entry_max = max(800, max_total_chars // max(1, len(entries)))

        def _one(entry: dict) -> list[Citation]:
            src_type = entry["source"]
            src = get_source(src_type)
            if src is None:
                logger.warning("未知 knowledge source: %s", src_type)
                return []
            if not src.is_configured():
                logger.info("knowledge source %s 未配置，跳过", src_type)
                return []
            try:
                hits = src.search(
                    query=query,
                    dataset=entry.get("dataset"),
                    top_k=int(entry.get("top_k", 3)),
                    max_chars=per_entry_max,
                )
            except Exception as e:  # noqa: BLE001
                logger.warning("knowledge source %s 检索异常: %s", src_type, e)
                return []
            if hits:
                logger.info(
                    "knowledge[%s/%s] 命中 %d 条",
                    src_type, entry.get("dataset") or "default", len(hits),
                )
            return hits

        # 多源并行：检索是 IO bound，串行起来一个 step 等三个源就 1-3s 起步
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(len(entries), 4)) as ex:
            pools: list[list[Citation]] = [p for p in ex.map(_one, entries) if p]

        if not pools:
            return "", []

        merged = merge_citations(
            pools,
            top_k=sum(int(e.get("top_k", 3)) for e in entries),
            max_chars=max_total_chars,
        )
        return format_citations_as_text(merged), merged


def list_available_sources() -> dict:
    """供 /api/knowledge/sources 直接返回。

    Shape 对齐 /api/tools：
        {
          "chroma": {
            "type": "chroma",
            "description": "本地 ChromaDB 向量库",
            "configured": true,
            "datasets": [{"id": "...", "name": "...", "doc_count": N}]
          },
          ...
        }
    """
    descriptions = {
        "chroma": "本地 ChromaDB 向量库（语义+关键词混合检索）",
        "ragflow": "RAGFlow 文档检索（PDF/PPT/Word）",
        "ima": "腾讯 IMA 知识库（笔记/公众号/网页）",
    }
    out: dict[str, dict] = {}
    for src_type in all_source_types():
        src = get_source(src_type)
        if src is None:
            continue
        try:
            datasets = src.list_datasets()
        except Exception as e:  # noqa: BLE001
            logger.warning("list_datasets %s 失败: %s", src_type, e)
            datasets = []
        out[src_type] = {
            "type": src_type,
            "description": descriptions.get(src_type, ""),
            "configured": src.is_configured(),
            "datasets": datasets,
        }
    return out
