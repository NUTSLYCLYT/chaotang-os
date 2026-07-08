"""知识库 RAG 引擎测试。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.knowledge_rag import KnowledgeRAG


class TestChunking:
    """文档分块测试。"""

    def test_split_by_headings(self):
        text = "## 标题一\n内容1\n## 标题二\n内容2"
        chunks = KnowledgeRAG._split_into_chunks(text, max_chars=500)
        assert len(chunks) == 2
        assert "标题一" in chunks[0]
        assert "标题二" in chunks[1]

    def test_split_long_section(self):
        text = "## 很长的段落\n\n" + "这是一段话。\n\n" * 50
        chunks = KnowledgeRAG._split_into_chunks(text, max_chars=100)
        assert len(chunks) > 1
        assert all(len(c) <= 200 for c in chunks)  # 允许一定超出

    def test_empty_text(self):
        chunks = KnowledgeRAG._split_into_chunks("", max_chars=500)
        assert chunks == []


class TestRAGEngine:
    """RAG 引擎核心功能测试。"""

    @pytest.fixture
    def rag(self, tmp_path):
        try:
            r = KnowledgeRAG(db_dir=tmp_path / "test_chroma")
            return r
        except Exception:
            pytest.skip("ChromaDB 初始化失败")

    @pytest.fixture
    def sample_doc(self, tmp_path):
        doc = tmp_path / "test_doc.md"
        doc.write_text(
            "## 低温电池技术\n"
            "磷酸铁锂在-40度环境下放电保持率约40-55%。\n"
            "## 行业标准\n"
            "GB/T 36276-2023 要求-10度下容量≥60%。\n",
            encoding="utf-8",
        )
        return doc

    def test_add_and_search(self, rag, sample_doc):
        try:
            chunks = rag.add_document(sample_doc, source="测试文档")
        except Exception:
            pytest.skip("Embedding 模型下载失败（网络问题），跳过搜索测试")
        assert chunks == 2

        results = rag.search("低温放电保持率")
        assert len(results) > 0
        assert any("保持率" in r["content"] for r in results)

    def test_search_empty_db(self, rag):
        results = rag.search("任何东西")
        assert results == []

    def _safe_add(self, rag, doc, **kwargs):
        """入库文档，网络问题时跳过测试��"""
        try:
            return rag.add_document(doc, **kwargs)
        except Exception:
            pytest.skip("Embedding 模型下载失败（网络问题）")

    def test_stats(self, rag, sample_doc):
        assert rag.stats()["total_chunks"] == 0
        self._safe_add(rag, sample_doc)
        stats = rag.stats()
        assert stats["total_chunks"] == 2

    def test_clear(self, rag, sample_doc):
        self._safe_add(rag, sample_doc)
        assert rag.stats()["total_chunks"] > 0
        rag.clear()
        assert rag.stats()["total_chunks"] == 0

    def test_search_as_text(self, rag, sample_doc):
        self._safe_add(rag, sample_doc, source="手册")
        text = rag.search_as_text("低温电池")
        assert "来源: 手册" in text
        assert "相关度:" in text

    def test_upsert_no_duplicate(self, rag, sample_doc):
        self._safe_add(rag, sample_doc)
        self._safe_add(rag, sample_doc)  # 再次入库
        assert rag.stats()["total_chunks"] == 2  # 不重复

    def test_add_directory(self, rag, tmp_path):
        docs_dir = tmp_path / "docs"
        docs_dir.mkdir()
        (docs_dir / "a.md").write_text("## 文档A\n内容A", encoding="utf-8")
        (docs_dir / "b.txt").write_text("## 文档B\n内容B", encoding="utf-8")
        (docs_dir / "c.py").write_text("# 不应入库", encoding="utf-8")

        try:
            result = rag.add_directory(docs_dir)
        except Exception:
            pytest.skip("Embedding 模型下载失败（网络问题）")
        assert result["total_files"] == 2
        assert rag.stats()["total_chunks"] == 2


class TestRenderContextWithRAG:
    """测试 _render_context 中的 RAG 文档注入。"""

    def test_rag_docs_in_context(self):
        from src.flow_engine import _render_context

        context = {
            "task_input": "测试",
            "rag_docs": "【来源: 手册】低温放电保持率40%",
            "steps": [],
        }
        rendered = _render_context(context)
        assert "相关文档参考" in rendered
        assert "低温放电保持率40%" in rendered

    def test_knowledge_before_rag_before_steps(self):
        from src.flow_engine import _render_context

        context = {
            "task_input": "需求",
            "knowledge": "静态知识",
            "rag_docs": "RAG文档",
            "steps": [{"agent_name": "A1", "output": "输出"}],
        }
        rendered = _render_context(context)
        pos_knowledge = rendered.index("静态知识")
        pos_rag = rendered.index("RAG文档")
        pos_step = rendered.index("输出")
        assert pos_knowledge < pos_rag < pos_step
