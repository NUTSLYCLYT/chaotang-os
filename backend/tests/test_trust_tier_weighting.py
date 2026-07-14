"""trust_tier 检索加权回归门(2026-07-14 吸收方案配套)。

钉死:statute 加权、self_generated 降权在 live 向量检索里成立;
seed 脚本剥离 provenance frontmatter 且透传 trust_tier。
"""

import pytest

sqlite_vec = pytest.importorskip("sqlite_vec")


def _rag(tmp_path):
    from src.sqlite_vec_rag import SqliteVecRAG

    return SqliteVecRAG(tmp_path / "t.db")


def test_trust_tier_stored_and_returned(tmp_path):
    rag = _rag(tmp_path)
    rag.add_text(
        "民法典第577条违约责任",
        "statute:577",
        {"knowledge_domain": "document", "trust_tier": "statute"},
    )
    hits = rag.search("违约责任", top_k=1)
    assert hits and hits[0]["trust_tier"] == "statute"


def test_statute_outranks_self_generated_on_equal_content(tmp_path):
    """同一正文两种 tier:statute 加权后必须排在 self_generated 前。"""
    rag = _rag(tmp_path)
    text = "低温电池容量保持率与析锂风险"
    rag.add_text(text, "selfgen", {"trust_tier": "self_generated"})
    rag.add_text(text, "statute", {"trust_tier": "statute"})
    hits = rag.search("低温电池容量", top_k=2)
    assert [h["source"] for h in hits] == ["statute", "selfgen"]


def test_untagged_docs_unaffected(tmp_path):
    """旧数据无 trust_tier:平权(1.0),检索行为不变、不报错。"""
    rag = _rag(tmp_path)
    rag.add_text("冷链物流调度方案", "legacy_doc", None)
    hits = rag.search("冷链物流", top_k=1)
    assert hits and hits[0]["source"] == "legacy_doc"
    assert hits[0]["trust_tier"] is None


def test_seed_strips_absorb_frontmatter_and_extracts_tier():
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "scripts"))
    from seed_sqlite_vec_knowledge import _strip_absorb_frontmatter

    absorbed = (
        "---\nsource_id: x\ntrust_tier: statute\nabsorbed_at: 2026-07-14\n---\n正文"
    )
    tier, body = _strip_absorb_frontmatter(absorbed)
    assert tier == "statute" and body == "正文"

    foreign = "---\ntitle: y\n---\n正文"
    tier, body = _strip_absorb_frontmatter(foreign)
    assert tier is None and body == foreign
