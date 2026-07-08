"""御史核真库 knowledge_vet 测试。

核心断言:
  - 一条能在真实知识库里找到支撑的声明(-40℃容量保持率)→ grounded=True, decision="有据"。
  - 一条编造声明(本司年营收10亿)→ grounded=False, decision 含"无据"。

检索走真 embedding(本地 Ollama nomic-embed-text-v2-moe);灌库用仓内真文档
knowledge/docs/low_temp_battery_guide.md。Ollama / ChromaDB 不可用时 skip。
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REAL_DOC = PROJECT_ROOT / "knowledge" / "docs" / "low_temp_battery_guide.md"


@pytest.fixture
def seeded_rag(tmp_path, monkeypatch):
    """用真文档灌一个临时知识库,并把 get_rag() 指向它。"""
    from src import knowledge_rag

    try:
        rag = knowledge_rag.KnowledgeRAG(db_dir=tmp_path / "vet_chroma")
    except Exception:
        pytest.skip("ChromaDB 初始化失败")

    if not REAL_DOC.exists():
        pytest.skip(f"真文档缺失: {REAL_DOC}")

    try:
        rag.add_document(REAL_DOC, source="低温电池技术指南")
    except Exception:
        pytest.skip("Embedding 不可用(Ollama 未起 / 网络问题),跳过")

    if rag.stats().get("total_chunks", 0) == 0:
        pytest.skip("知识库灌库后为空,跳过")

    # 核真库内部用 get_rag() 单例;指向本次灌好的临时库。
    monkeypatch.setattr(knowledge_rag, "_rag_instance", rag, raising=False)
    # 确保不走 RAGFlow 在线路(强制本地结构化分路)。
    monkeypatch.setattr(knowledge_rag.RagFlowRAG, "is_configured", lambda self: False)
    return rag


class TestVetAgainstKnowledge:
    def test_real_claim_is_grounded(self, seeded_rag):
        """真声明:-40℃下 LFP 容量保持率 → 知识库里有据。"""
        from src.knowledge_vet import vet_against_knowledge

        r = vet_against_knowledge("磷酸铁锂电池在-40℃低温下的容量保持率")
        assert r["grounded"] is True, r
        assert r["decision"] == "有据"
        assert r["relevance"] >= 0.35
        assert r["evidence"]  # 有据时必须附支撑片段
        assert "来源" in r["evidence"]

    def test_fabricated_claim_is_ungrounded(self, seeded_rag):
        """编造声明:本司年营收10亿 → 知识库里查无此据。"""
        from src.knowledge_vet import vet_against_knowledge

        r = vet_against_knowledge("本司电池公司2025年营业收入高达10亿元人民币")
        assert r["grounded"] is False, r
        assert "无据" in r["decision"]
        assert r["relevance"] < 0.35
        assert r["evidence"] == ""  # 无据不返回弱片段

    def test_return_shape(self, seeded_rag):
        """返回契约:四个键齐全且类型正确。"""
        from src.knowledge_vet import vet_against_knowledge

        r = vet_against_knowledge("-40℃存储恢复测试")
        assert set(r.keys()) == {"grounded", "evidence", "relevance", "decision"}
        assert isinstance(r["grounded"], bool)
        assert isinstance(r["evidence"], str)
        assert isinstance(r["relevance"], float)
        assert isinstance(r["decision"], str)


class TestVetEdgeCases:
    """边界路:不依赖真 embedding,不 skip。"""

    def test_empty_claim(self):
        from src.knowledge_vet import vet_against_knowledge

        r = vet_against_knowledge("   ")
        assert r["grounded"] is False
        assert "无据" in r["decision"]
        assert r["relevance"] == 0.0

    def test_empty_knowledge_base(self, tmp_path, monkeypatch):
        """知识库为空 → 无据·知识库为空。"""
        from src import knowledge_rag
        from src.knowledge_vet import DECISION_EMPTY, vet_against_knowledge

        try:
            empty_rag = knowledge_rag.KnowledgeRAG(db_dir=tmp_path / "empty_chroma")
        except Exception:
            pytest.skip("ChromaDB 初始化失败")
        monkeypatch.setattr(knowledge_rag, "_rag_instance", empty_rag, raising=False)
        monkeypatch.setattr(
            knowledge_rag.RagFlowRAG, "is_configured", lambda self: False
        )

        r = vet_against_knowledge("任意一句话")
        assert r["grounded"] is False
        assert r["decision"] == DECISION_EMPTY


class TestTruthLedgerRegistration:
    def test_knowledge_vet_is_deterministic(self):
        """knowledge_vet 已注册为确定性真尺子。"""
        from src.truth_ledger import _DETERMINISTIC

        assert "knowledge_vet" in _DETERMINISTIC
