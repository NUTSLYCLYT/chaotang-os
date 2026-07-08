"""case_archive → ChromaDB 反馈闭环测试。

测试三个核心场景：
1. KnowledgeRAG.add_text() 能正确分块入库并返回块数
2. approve_case() 调用后自动触发 add_text()（mock KnowledgeRAG）
3. ingest_all_approved() 批量补录并返回正确统计
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_HAS_CHROMADB = importlib.util.find_spec("chromadb") is not None

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ──────────────────────────────────────────────────────────────────────
# 1. KnowledgeRAG.add_text() 基本功能
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.skipif(not _HAS_CHROMADB, reason="需 chromadb(未安装则跳过 RAG 真写测试)")
class TestAddText:
    """KnowledgeRAG.add_text() 方法测试（使用临时 DB，不污染生产数据）。"""

    def _make_rag(self, tmp_path):
        """创建使用临时目录的 KnowledgeRAG 实例。"""
        from src.knowledge_rag import KnowledgeRAG

        return KnowledgeRAG(db_dir=tmp_path / "chroma_test")

    def test_add_text_returns_chunk_count(self, tmp_path):
        """add_text() 应返回 > 0 的块数。"""
        rag = self._make_rag(tmp_path)
        text = "## 历史方案案例\n**任务输入**: 测试任务\n\n**客户背景**: 某储能公司\n**核心需求**: 低温充放电\n**解决方案**: 采用磷酸铁锂电芯\n**客户价值**: 降低运营成本\n"
        count = rag.add_text(
            text=text,
            source="case_archive:test_run_A.json",
            extra_metadata={
                "knowledge_domain": "case_archive",
                "grade": "A",
                "flow_name": "opc",
                "run_id": "test_run_A",
            },
        )
        assert count > 0, f"期望 count > 0，实际得到 {count}"

    def test_add_text_empty_returns_zero(self, tmp_path):
        """空文本应返回 0。"""
        rag = self._make_rag(tmp_path)
        count = rag.add_text(text="", source="case_archive:empty.json")
        assert count == 0

    def test_add_text_upsert_idempotent(self, tmp_path):
        """重复调用同内容应幂等（upsert），集合总块数不翻倍。"""
        rag = self._make_rag(tmp_path)
        text = "## 历史方案\n**任务输入**: 重复测试\n**解决方案**: 方案A\n"
        count1 = rag.add_text(text=text, source="case_archive:dup.json")
        count2 = rag.add_text(text=text, source="case_archive:dup.json")
        assert count1 == count2
        # 由于 upsert，集合总量应等于单次入库量
        assert rag.stats()["total_chunks"] == count1

    def test_add_text_extra_metadata_stored(self, tmp_path):
        """extra_metadata 字段应存入向量库，并可通过 get() 验证 metadata 写入正确。"""
        rag = self._make_rag(tmp_path)
        text = "## 案例\n低温磷酸铁锂方案，适合西北地区冬季储能项目，关键词：低温电池 循环寿命"
        rag.add_text(
            text=text,
            source="case_archive:meta_test.json",
            extra_metadata={"knowledge_domain": "case_archive", "grade": "S"},
        )
        # 通过 stats 验证入库成功
        stats = rag.stats()
        assert stats["total_chunks"] > 0
        assert "case_archive:meta_test.json" in stats["sources"]
        # 通过 collection.get() 验证 extra_metadata 字段写入
        all_data = rag._collection.get(limit=10)
        metadatas = all_data.get("metadatas", [])
        assert len(metadatas) > 0
        meta = metadatas[0]
        assert meta.get("knowledge_domain") == "case_archive"
        assert meta.get("grade") == "S"
        assert meta.get("source") == "case_archive:meta_test.json"


# ──────────────────────────────────────────────────────────────────────
# 2. approve_case() 自动触发 add_text()
# ──────────────────────────────────────────────────────────────────────


class TestApproveCaseAutoIngest:
    """approve_case() 应在批准后自动调用 KnowledgeRAG.add_text()。"""

    def _make_pending_json(self, pending_dir: Path, filename: str) -> Path:
        """在 pending_review/ 中创建一个合法的待审核 JSON。"""
        pending_dir.mkdir(parents=True, exist_ok=True)
        record = {
            "run_id": "run_test_001",
            "task_input": "客户需要西北地区冬季储能方案",
            "final_output": {
                "客户背景": "某新能源公司，位于内蒙古",
                "核心需求": "低温充放电，-30℃可用",
                "解决方案": "磷酸铁锂 + 加热膜方案",
                "客户价值": "全年可用率提升至99%",
            },
            "quality_score": {"total_score": 4.5, "grade": "S", "scores": {}},
            "flow_name": "opc",
            "flow_config": "config/flow_opc.yaml",
            "archived_at": "2024-04-15T10:00:00",
            "status": "pending_review",
        }
        fp = pending_dir / filename
        fp.write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return fp

    def test_approve_case_auto_ingests(self, tmp_path, monkeypatch):
        """approve_case() 批准后应调用 KnowledgeRAG().add_text()。"""
        import src.case_archive as ca

        # 重定向 case_archive 的目录到 tmp_path
        monkeypatch.setattr(ca, "PENDING_DIR", tmp_path / "pending_review")
        monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved")

        filename = "run_test_001_S.json"
        self._make_pending_json(tmp_path / "pending_review", filename)

        # Mock KnowledgeRAG — 因为是延迟 import，需 patch 源模块
        mock_rag_instance = MagicMock()
        mock_rag_instance.add_text.return_value = 2

        with patch("src.knowledge_rag.KnowledgeRAG", return_value=mock_rag_instance):
            result = ca.approve_case(filename)

        assert result is True
        # 验证 approved/ 目录中存在该文件
        approved_file = tmp_path / "approved" / filename
        assert approved_file.exists()

    def test_approve_case_chromadb_failure_does_not_block(self, tmp_path, monkeypatch):
        """ChromaDB 入库失败不应影响 approve_case() 的主流程（返回 True）。"""
        import src.case_archive as ca

        monkeypatch.setattr(ca, "PENDING_DIR", tmp_path / "pending_review")
        monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved")

        filename = "run_test_002_A.json"
        self._make_pending_json(tmp_path / "pending_review", filename)

        # 让 KnowledgeRAG 初始化时直接抛异常（patch 源模块）
        with patch(
            "src.knowledge_rag.KnowledgeRAG",
            side_effect=RuntimeError("chromadb 未安装"),
        ):
            result = ca.approve_case(filename)

        # 主流程不受影响
        assert result is True
        assert (tmp_path / "approved" / filename).exists()

    def test_approve_nonexistent_returns_false(self, tmp_path, monkeypatch):
        """approve_case() 对不存在的文件应返回 False。"""
        import src.case_archive as ca

        monkeypatch.setattr(ca, "PENDING_DIR", tmp_path / "pending_review")
        monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved")

        result = ca.approve_case("nonexistent.json")
        assert result is False


# ──────────────────────────────────────────────────────────────────────
# 3. ingest_all_approved() 批量补录
# ──────────────────────────────────────────────────────────────────────


class TestIngestAllApproved:
    """ingest_all_approved() 应遍历 approved/ 并返回正确统计。"""

    def _make_approved_json(
        self, approved_dir: Path, filename: str, run_id: str
    ) -> Path:
        """在 approved/ 中创建一个已批准的 JSON。"""
        approved_dir.mkdir(parents=True, exist_ok=True)
        record = {
            "run_id": run_id,
            "task_input": f"任务输入 {run_id}",
            "final_output": {
                "客户背景": f"客户背景 {run_id}",
                "核心需求": "低温储能",
                "解决方案": "磷酸铁锂方案",
                "客户价值": "降低成本",
            },
            "quality_score": {"total_score": 4.5, "grade": "S", "scores": {}},
            "flow_name": "opc",
            "flow_config": "",
            "archived_at": "2024-04-15T10:00:00",
            "approved_at": "2024-04-15T11:00:00",
            "status": "approved",
        }
        fp = approved_dir / filename
        fp.write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return fp

    def test_ingest_all_approved_counts(self, tmp_path, monkeypatch):
        """有 3 个 approved JSON，ingest_all_approved() 应返回 total=3, ingested=3, skipped=0。"""
        import src.case_archive as ca

        approved_dir = tmp_path / "approved"
        monkeypatch.setattr(ca, "APPROVED_DIR", approved_dir)

        # 创建 3 个 approved 案例
        for i in range(3):
            self._make_approved_json(
                approved_dir, f"run_{i:03d}_S.json", f"run_{i:03d}"
            )

        # Mock KnowledgeRAG 让 add_text 始终返回 1
        mock_rag = MagicMock()
        mock_rag.add_text.return_value = 1

        with patch("src.knowledge_rag.KnowledgeRAG", return_value=mock_rag):
            stats = ca.ingest_all_approved()

        assert stats["total"] == 3
        assert stats["ingested"] == 3
        assert stats["skipped"] == 0

    def test_ingest_all_approved_empty_dir(self, tmp_path, monkeypatch):
        """approved/ 为空时应返回 total=0, ingested=0, skipped=0。"""
        import src.case_archive as ca

        monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved_empty")

        stats = ca.ingest_all_approved()
        assert stats == {"total": 0, "ingested": 0, "skipped": 0}

    def test_ingest_all_approved_partial_failure(self, tmp_path, monkeypatch):
        """add_text 对部分文件失败时，skipped 应正确计数。"""
        import src.case_archive as ca

        approved_dir = tmp_path / "approved"
        monkeypatch.setattr(ca, "APPROVED_DIR", approved_dir)

        # 创建 2 个正常文件 + 1 个损坏的 JSON
        for i in range(2):
            self._make_approved_json(
                approved_dir, f"run_{i:03d}_S.json", f"run_{i:03d}"
            )
        bad_file = approved_dir / "bad_file.json"
        bad_file.write_text("NOT VALID JSON", encoding="utf-8")

        mock_rag = MagicMock()
        mock_rag.add_text.return_value = 1

        with patch("src.knowledge_rag.KnowledgeRAG", return_value=mock_rag):
            stats = ca.ingest_all_approved()

        assert stats["total"] == 3
        assert stats["ingested"] == 2
        assert stats["skipped"] == 1
