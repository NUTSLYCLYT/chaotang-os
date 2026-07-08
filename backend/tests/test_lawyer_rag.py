"""tests/test_lawyer_rag.py — 律师法条库检索 + rag_hit 系统算出(堵自报洞)。"""
from __future__ import annotations

from src import lawyer_rag
from src import xingbu_verdict as xv


def test_retrieve_hits_real_statutes():
    hits = lawyer_rag.retrieve("尾款验收标准模糊,违约金无上限")
    assert hits, "合同术语应命中律师法条库"
    assert hits[0]["score"] >= 1
    assert any("第" in h["snippet"] or "法" in h["snippet"] for h in hits)


def test_non_legal_text_not_grounded():
    assert lawyer_rag.is_grounded("今天天气不错适合散步") is False


def test_legal_text_grounded():
    assert lawyer_rag.is_grounded("合同验收标准与违约金条款") is True


def test_run_verdict_grounded_when_findings_cite_statute():
    # H:findings 引了条号 → 接地(不看输入文本含不含法律词)
    mock = lambda s, u: '[{"level":"red","title":"验收模糊","fix":"加条款","basis":"《民法典》第621条"}]'  # noqa: E731
    doc = xv.run_verdict_from_text("储能合同验收标准与违约金未约定", archive=False, call_fn=mock)
    assert doc["provenance"]["rag_grounded"] is True
    assert "需人工" not in doc["headline"]
    assert doc["items"][0]["basis"] == "《民法典》第621条"   # G:引证透传到前端


def test_run_verdict_degrades_when_findings_uncited():
    # G+H:findings 无引证 → 未接地 → 降级需人工(不冒充权威,F)
    mock = lambda s, u: '[{"level":"red","title":"验收模糊","fix":"加条款","basis":""}]'  # noqa: E731
    doc = xv.run_verdict_from_text("储能合同验收标准与违约金未约定", archive=False, call_fn=mock)
    assert doc["provenance"]["rag_grounded"] is False
    assert "需人工" in doc["headline"]


def test_citation_verification_catches_fabricated_article():
    # schneier:LLM 引了库里核不到的条号(可能编造/引错)→ 不算接地 → 降级
    mock = lambda s, u: '[{"level":"red","title":"x","fix":"y","basis":"《民法典》第9999条"}]'  # noqa: E731
    doc = xv.run_verdict_from_text("储能合同验收违约金", archive=False, call_fn=mock)
    assert doc["provenance"]["rag_grounded"] is False        # 核不到 → 不接地
    assert doc["items"][0]["basis_verified"] is False
    assert 9999 in doc["items"][0]["basis_unverified_arts"]


def test_verify_citation_direct():
    assert lawyer_rag.verify_citation("《民法典》第621条")["verified"] is True   # 库里有
    assert lawyer_rag.verify_citation("《民法典》第618条")["verified"] is True   # 本轮补的
    assert lawyer_rag.verify_citation("第9999条")["verified"] is False          # 核不到
    assert lawyer_rag.verify_citation("凭经验")["has_citation"] is False        # 无条号
