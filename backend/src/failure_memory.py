"""Reflexion 失败记忆层 — 跨运行失败模式存储与检索。

核心思路：
- 每次 run_with_repair 触发修复循环且最终质量仍低时，通过 LLM 生成自然语言反思，
  写入 ChromaDB 独立 Collection（与知识库 Collection 分离）
- 下次同 flow 执行时，检索历史教训注入 ReAct 系统提示，减少 repair_cycle 触发率

三段式过滤漏斗（只记"重复犯的错"，避免把噪音写入长期记忆）::

    run_status == "completed"           → 排除资源耗尽/超时等非推理问题
    quality_score < SCORE_THRESHOLD     → 质量确实不达标
    repair_count >= 1                   → 有修复记录，问题真实存在
    ↓
    ChromaDB 语义查询：同 flow 是否已有相似失败
    similar_count >= 1                  → 防止把偶发错误写入长期记忆

集成点：
- flow_engine.py: run_with_repair() 调用 _maybe_record_failure()
- reasoning.py:   ReActEngine.run() 在构建系统提示前调用 retrieve()
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.step_log import RunLog

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_CHROMA_DB_DIR = str(_PROJECT_ROOT / "knowledge" / "chroma_db")
_COLLECTION_NAME = "pack_failure_patterns"

SCORE_THRESHOLD = 3.5     # 低于此分数视为需记录的失败
MIN_REPAIR_COUNT = 1      # 至少触发一次修复循环才记录
SIMILAR_MIN_COUNT = 1     # 同类失败已出现至少 N 次才写入（防噪音）


@dataclass
class FailureRecord:
    flow_name: str
    task_summary: str      # task_input 前 200 字
    failure_analysis: str  # LLM 生成的自然语言反思
    qa_score: float
    repair_count: int
    run_id: str


def _extract_score(quality_score) -> float:
    """从 quality_score（可能是 dict 或 float）提取 overall_score。"""
    if isinstance(quality_score, dict):
        return float(
            quality_score.get("overall_score", quality_score.get("score", 0.0)) or 0.0
        )
    if isinstance(quality_score, (int, float)):
        return float(quality_score)
    return 0.0


class FailureMemory:
    """跨运行失败模式存储与检索。

    使用独立的 ChromaDB Collection，与知识库 Collection 分离：
    - pack_failure_patterns: 失败模式（自动写入，按 flow_name 分区）
    - opc_knowledge 等: 领域知识（人工维护）
    """

    def __init__(self, db_dir: str = _CHROMA_DB_DIR) -> None:
        self._db_dir = db_dir
        self._col = None  # 延迟初始化，避免 import 时触发 ChromaDB 连接

    def _get_collection_name(self) -> str:
        """返回当前租户的 collection 名称，实现多租户数据隔离。"""
        try:
            from src.tenant import get_current_tenant, DEFAULT_TENANT_SLUG
            tenant = get_current_tenant()
            if tenant and tenant != DEFAULT_TENANT_SLUG:
                # 租户特定的 collection，防止跨租户失败模式污染
                return f"{_COLLECTION_NAME}__{tenant}"
        except (ImportError, Exception):
            pass
        return _COLLECTION_NAME

    def _get_collection(self):
        """延迟初始化 ChromaDB collection。"""
        if self._col is not None:
            return self._col
        try:
            import chromadb
            from src.knowledge_rag import _get_embedding_fn
            client = chromadb.PersistentClient(path=self._db_dir)
            self._col = client.get_or_create_collection(
                self._get_collection_name(),
                embedding_function=_get_embedding_fn(),
                metadata={"hnsw:space": "cosine"},
            )
            logger.debug("FailureMemory: ChromaDB collection '%s' 就绪", self._get_collection_name())
        except Exception as e:
            logger.warning("FailureMemory: ChromaDB 初始化失败，Reflexion 功能不可用: %s", e)
            return None
        return self._col

    def should_record(self, run_log: "RunLog", repair_count: int) -> bool:
        """三段式过滤漏斗：判断此次 run 是否值得写入失败记忆。"""
        # 第一段：排除非推理问题（资源耗尽/blocked）
        if run_log.run_status not in ("normal", "completed", ""):
            return False

        # 第二段：质量确实不达标
        score = _extract_score(run_log.quality_score)
        if score <= 0 or score >= SCORE_THRESHOLD:
            return False

        # 第三段：有修复记录（问题真实，不是偶发格式问题）
        if repair_count < MIN_REPAIR_COUNT:
            return False

        # 最终：同 flow 是否已有相似失败（防止把孤立事件写入长期记忆）
        col = self._get_collection()
        if col is None:
            return False
        try:
            similar = col.query(
                query_texts=[run_log.task_input[:200]],
                where={"flow_name": run_log.flow_name},
                n_results=SIMILAR_MIN_COUNT,
            )
            existing = len(similar["ids"][0]) if similar["ids"] else 0
            # 已有 SIMILAR_MIN_COUNT 条同类失败 → 第二次重复 → 写入
            # 首次失败不写入（可能是偶发），第二次相似失败写入
            return existing >= SIMILAR_MIN_COUNT
        except Exception as e:
            logger.warning("FailureMemory.should_record 查询失败: %s", e)
            return False

    def record(self, run_log: "RunLog", failure_analysis: str, repair_count: int) -> bool:
        """将失败分析写入 ChromaDB。返回 True 表示写入成功。"""
        col = self._get_collection()
        if col is None:
            return False
        score = _extract_score(run_log.quality_score)
        try:
            col.add(
                documents=[failure_analysis],
                metadatas=[{
                    "flow_name": run_log.flow_name,
                    "qa_score": score,
                    "repair_count": repair_count,
                    "task_summary": run_log.task_input[:200],
                    "created_at": int(time.time()),
                }],
                ids=[run_log.run_id],
            )
            logger.info(
                "FailureMemory: 写入失败记录 run=%s flow=%s score=%.2f repair=%d",
                run_log.run_id, run_log.flow_name, score, repair_count,
            )
            return True
        except Exception as e:
            logger.warning("FailureMemory.record 写入失败: %s", e)
            return False

    def record_first_failure(self, run_log: "RunLog", failure_analysis: str, repair_count: int) -> bool:
        """写入第一次失败记录（不受 similar_count 过滤限制）。

        用于"冷启动"阶段——在没有任何历史记录时，还是需要种下第一条记录，
        否则 should_record 永远返回 False。
        触发条件：quality_score < SCORE_THRESHOLD AND repair_count >= MIN_REPAIR_COUNT。
        """
        col = self._get_collection()
        if col is None:
            return False
        score = _extract_score(run_log.quality_score)
        if score <= 0 or score >= SCORE_THRESHOLD or repair_count < MIN_REPAIR_COUNT:
            return False
        if run_log.run_status not in ("normal", "completed", ""):
            return False

        try:
            # 检查是否已存在此 run_id（防重复写入）
            existing = col.get(ids=[run_log.run_id])
            if existing["ids"]:
                return False
            col.add(
                documents=[failure_analysis],
                metadatas=[{
                    "flow_name": run_log.flow_name,
                    "qa_score": score,
                    "repair_count": repair_count,
                    "task_summary": run_log.task_input[:200],
                    "created_at": int(time.time()),
                }],
                ids=[run_log.run_id],
            )
            logger.info(
                "FailureMemory: 写入首条失败记录（冷启动）run=%s flow=%s",
                run_log.run_id, run_log.flow_name,
            )
            return True
        except Exception as e:
            logger.warning("FailureMemory.record_first_failure 写入失败: %s", e)
            return False

    def retrieve(self, task_input: str, flow_name: str, n: int = 3) -> list[str]:
        """检索同 flow 下与当前任务最相似的历史失败教训。

        Returns:
            失败分析文本列表（自然语言），空列表表示无历史记录或检索失败。
        """
        col = self._get_collection()
        if col is None:
            return []
        try:
            results = col.query(
                query_texts=[task_input[:200]],
                where={"flow_name": flow_name},
                n_results=n,
            )
            docs = results["documents"][0] if results.get("documents") else []
            logger.debug("FailureMemory.retrieve: flow=%s 检索到 %d 条历史教训", flow_name, len(docs))
            return docs
        except Exception as e:
            logger.warning("FailureMemory.retrieve 检索失败: %s", e)
            return []

    def cleanup_old_failures(self, days: int = 90) -> int:
        """删除超过 days 天的失败记录，防止过时教训干扰检索。

        ChromaDB 无原生 TTL，通过 metadata.created_at 过滤实现。
        Returns:
            删除的记录数，0 表示无过期记录或 ChromaDB 不可用。
        """
        col = self._get_collection()
        if col is None:
            return 0
        cutoff = int(time.time()) - days * 86400
        try:
            results = col.get(where={"created_at": {"$lt": cutoff}})
            if not results["ids"]:
                return 0
            col.delete(ids=results["ids"])
            logger.info(
                "FailureMemory.cleanup_old_failures: 删除 %d 条超过 %d 天的记录",
                len(results["ids"]), days,
            )
            return len(results["ids"])
        except Exception as e:
            logger.warning("FailureMemory.cleanup_old_failures 失败: %s", e)
            return 0
