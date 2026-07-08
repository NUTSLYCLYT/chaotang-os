"""钦天监真实接地 · 回归门(2026-07-08 北极星第一锹)。

钉死:rag_hit 不再写死 False——真查库;命中≥门槛挂可回链 green item;
库空/检索失败老实回未接地;回链 green 不改变依据 vet 的独立判级(两轴不混)。
"""

from src import tianjian_verdict as tv


class _FakeRag:
    def __init__(self, hits):
        self._hits = hits

    def search(self, *a, **k):
        return self._hits


def test_grounding_hits_above_floor(monkeypatch):
    monkeypatch.setattr(
        "src.knowledge_rag.get_rag",
        lambda: _FakeRag(
            [
                {
                    "source": "battery_prices_reference.md",
                    "score": 0.48,
                    "content": "x",
                },
                {"source": "weak.md", "score": 0.30, "content": "y"},
            ]
        ),
    )
    items, hit = tv.grounding_items("储能电池价格趋势")
    assert hit is True
    assert len(items) == 1, "低于门槛的弱相关不挂回链"
    assert items[0]["level"] == "green"
    assert items[0]["evidence_ref"] == "knowledge://battery_prices_reference.md"


def test_grounding_empty_or_broken_is_honest(monkeypatch):
    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: _FakeRag([]))
    assert tv.grounding_items("任意") == ([], False)

    def _boom():
        raise RuntimeError("rag down")

    monkeypatch.setattr("src.knowledge_rag.get_rag", _boom)
    assert tv.grounding_items("任意") == ([], False), "检索故障=未接地,不冒充"


def test_rag_hit_flows_into_court_doc(monkeypatch):
    """rag_hit=True 时 headline 不再挂"参谋未接地";依据 vet 仍独立判级(黄照黄)。"""
    out = {"态势与驱动因素(含依据)": "价格走弱。依据:行业数据"}
    doc_cold = tv.build_tianjian_forecast(
        out, question="q", archive=False, rag_hit=False
    )
    assert "参谋未接地" in doc_cold["headline"]
    doc_warm = tv.build_tianjian_forecast(
        out, question="q", archive=False, rag_hit=True
    )
    assert "参谋未接地" not in doc_warm["headline"]
    # 依据"行业数据"仍是待核黄——回链不给推断镀金
    assert doc_warm["light"] == "yellow"
