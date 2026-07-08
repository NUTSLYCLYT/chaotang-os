#!/usr/bin/env python3
"""RAG 知识检索 MCP Server — Agent 的兜底搜索工具。

提供 search_docs 工具，让 Agent 在预检索不足时能主动搜索知识库。
限制：建议在 Flow 配置中设置 tool_max_rounds=1 防止过度调用。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mcp_servers"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from base_server import BaseServer


class RAGServer(BaseServer):
    def __init__(self):
        super().__init__(name="rag", version="1.0")

    def register_tools(self):
        self.add_tool(
            "search_docs",
            "搜索公司知识库（技术文档、产品手册、行业标准、历史方案）",
            {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词或问题描述",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "返回最相关的文档数",
                        "default": 3,
                    },
                },
                "required": ["query"],
            },
            self.search_docs,
        )
        self.add_tool(
            "knowledge_stats",
            "查看知识库统计信息（文档数量、来源列表）",
            {"type": "object", "properties": {}},
            self.knowledge_stats,
        )

    def search_docs(self, query: str, top_k: int = 3):
        from src.knowledge_rag import get_rag

        rag = get_rag()
        results = rag.search(query, top_k=top_k)
        if not results:
            return {"status": "empty", "message": "知识库中未找到相关文档", "results": []}
        return {
            "status": "ok",
            "count": len(results),
            "results": [
                {
                    "content": r["content"],
                    "source": r["source"],
                    "score": r["score"],
                }
                for r in results
            ],
        }

    def knowledge_stats(self):
        from src.knowledge_rag import get_rag

        return get_rag().stats()


if __name__ == "__main__":
    RAGServer().run()
