"""知识库联邦层：统一抽象 ChromaDB / RAGFlow / IMA 等多源知识库。

入口：
    from src.knowledge import KnowledgeRouter, list_available_sources

    router = KnowledgeRouter(flow_config)
    text = router.retrieve_for_step(step_config, query="...")
"""

from src.knowledge.base import Citation, KnowledgeSource
from src.knowledge.router import KnowledgeRouter, list_available_sources

__all__ = ["Citation", "KnowledgeSource", "KnowledgeRouter", "list_available_sources"]
