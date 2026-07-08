"""真实数据飞轮测试 — 朝会产出回流知识库(domain="朝会沉淀")。

主动脉飞轮(⑤):每日朝会跑完后,把《今日朝报》+各部奏折要点用 RAG.add_texts() 写回
知识库,供未来 grounding 检索。本测试覆盖三类场景:

1. 单元(mock RAG):archive_session_to_knowledge() 正确组装 items 并调 add_texts()。
2. 容错:RAG 异常不抛出,返回结构化失败统计(飞轮失败不能拖垮朝会主流程)。
3. 集成(真 embed,需 ollama):archive 后能用 scope=["朝会沉淀"] 真检索到当日内容。

集成测试用真 embed env(EMBED_API_BASE=http://localhost:11434/v1 ...);ollama 不可达时跳过。
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


SAMPLE_MEMORIALS = [
    {
        "swarm": "finance",
        "dept": "户部",
        "status": "ok",
        "summary": "磷酸铁锂电芯成本下行 8%,建议守住 ROI 红线不低于 22%。",
    },
    {
        "swarm": "opc",
        "dept": "兵部",
        "status": "submitted",
        "summary": "内蒙古通信基站备电储能项目进入议价期,切口在 -40℃ 低温可用率。",
    },
    {
        "swarm": "legal",
        "dept": "刑部",
        "status": "error",
        "summary": "(摘要不可用)",
    },
]

SAMPLE_REPORT = (
    "# 《今日朝报》— 2026-06-22\n"
    "> 每日朝会自转 · 八部 grounded 上奏 → 御史门 · 2/3 部上奏\n\n"
    "## 按部要点\n"
    "- **户部**(finance·ok):磷酸铁锂电芯成本下行 8%。\n"
    "- **兵部**(opc·submitted):内蒙古通信基站备电储能项目进入议价期。\n"
)


# ──────────────────────────────────────────────────────────────────────
# 1. 单元:组装 items 并调 add_texts()(mock RAG)
# ──────────────────────────────────────────────────────────────────────


class TestArchiveSessionUnit:
    """archive_session_to_knowledge() 组装与调用契约。"""

    def test_archives_report_and_memorials(self):
        from src.court_flywheel import archive_session_to_knowledge

        mock_rag = MagicMock()
        mock_rag.add_texts.return_value = 5

        with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
            result = archive_session_to_knowledge(
                SAMPLE_MEMORIALS, SAMPLE_REPORT, "2026-06-22"
            )

        assert result["ok"] is True
        assert result["chunks"] == 5
        # 朝报 1 条 + 2 条有效奏折(error 的刑部应被过滤) = 3 条 source
        assert result["items"] == 3

        mock_rag.add_texts.assert_called_once()
        items = mock_rag.add_texts.call_args.args[0]
        assert len(items) == 3
        # 每条 item 都标 knowledge_domain="朝会沉淀"
        for _text, _source, meta in items:
            assert meta["knowledge_domain"] == "朝会沉淀"
            assert meta["stamp"] == "2026-06-22"
        # 朝报 source 可识别
        sources = {it[1] for it in items}
        assert any("朝报" in s for s in sources)
        # 部级 source 带 swarm 标识
        assert any("finance" in s for s in sources)

    def test_skips_error_memorials_and_empty_report(self):
        from src.court_flywheel import archive_session_to_knowledge

        mock_rag = MagicMock()
        mock_rag.add_texts.return_value = 0

        only_errors = [
            {"swarm": "x", "dept": "甲", "status": "error", "summary": "boom"},
            {"swarm": "y", "dept": "乙", "status": "ok", "summary": ""},
        ]
        with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
            result = archive_session_to_knowledge(only_errors, "", "2026-06-22")

        # 无朝报 + error/空摘要全过滤 → 没有可入库内容
        assert result["items"] == 0
        assert result["ok"] is True
        mock_rag.add_texts.assert_not_called()


# ──────────────────────────────────────────────────────────────────────
# 2. 容错:RAG 异常不拖垮朝会
# ──────────────────────────────────────────────────────────────────────


class TestArchiveFaultTolerant:
    def test_rag_failure_returns_structured_error(self):
        from src.court_flywheel import archive_session_to_knowledge

        with patch(
            "src.knowledge_rag.get_rag", side_effect=RuntimeError("chromadb 未安装")
        ):
            result = archive_session_to_knowledge(
                SAMPLE_MEMORIALS, SAMPLE_REPORT, "2026-06-22"
            )

        assert result["ok"] is False
        assert "chromadb" in result["error"]
        assert result["chunks"] == 0


# ──────────────────────────────────────────────────────────────────────
# 3. 集成:真 embed,archive 后能 scope 检索回当日内容
# ──────────────────────────────────────────────────────────────────────


def _ollama_reachable() -> bool:
    base = os.environ.get("EMBED_API_BASE", "")
    if "11434" not in base and "localhost" not in base:
        return False
    try:
        import urllib.request

        host = base.split("/v1")[0].rstrip("/")
        urllib.request.urlopen(f"{host}/api/tags", timeout=3)
        return True
    except Exception:
        return False


@pytest.mark.skipif(
    not _ollama_reachable() or importlib.util.find_spec("chromadb") is None,
    reason="需真 embed env(EMBED_API_BASE=http://localhost:11434/v1)且 ollama 可达 + chromadb 已装",
)
class TestArchiveRealEmbed:
    """真 embedding 端到端:写回后能检索到「朝会沉淀」域内容。"""

    def test_archive_then_retrieve(self, tmp_path):
        from src.court_flywheel import archive_session_to_knowledge
        from src.knowledge_rag import KnowledgeRAG

        rag = KnowledgeRAG(db_dir=tmp_path / "chroma_flywheel")

        with patch("src.knowledge_rag.get_rag", return_value=rag):
            result = archive_session_to_knowledge(
                SAMPLE_MEMORIALS, SAMPLE_REPORT, "2026-06-22"
            )

        assert result["ok"] is True
        assert result["chunks"] > 0

        # scope 检索:只在「朝会沉淀」域命中
        hits = rag.search(
            "内蒙古通信基站备电储能 低温可用率",
            top_k=3,
            scope=["朝会沉淀"],
        )
        # scope=["朝会沉淀"] 的 where 过滤保证只回本域文档(search 结果不直接暴露
        # knowledge_domain 字段,故用 source 前缀 + 内容双重确认命中的是飞轮回流内容)。
        assert hits, "应能检索到朝会沉淀域内容"
        top = hits[0]
        assert str(top.get("source", "")).startswith("朝会沉淀:")
        # 命中内容应来自当日奏折/朝报
        assert "储能" in top["content"] or "通信基站备电" in top["content"]

    def test_scope_isolation(self, tmp_path):
        """写回「朝会沉淀」域后,跨域(其它 scope)检索不应误命中本域内容。"""
        from src.court_flywheel import archive_session_to_knowledge
        from src.knowledge_rag import KnowledgeRAG

        rag = KnowledgeRAG(db_dir=tmp_path / "chroma_flywheel_iso")
        with patch("src.knowledge_rag.get_rag", return_value=rag):
            archive_session_to_knowledge(SAMPLE_MEMORIALS, SAMPLE_REPORT, "2026-06-22")

        other = rag.search("磷酸铁锂", top_k=3, scope=["case_archive"])
        assert other == [], "case_archive 域应为空,不应命中朝会沉淀内容"
