"""史馆成果回执 + outcome prior 回灌 · 回归门(第5步收尾)。

钉死:回执留名纪律、证实上浮/打脸深降权但不删、30天催收清单、租户隔离、
genius_next_step 反面教材诚实亮出 + 引用留痕。
"""

from datetime import datetime, timedelta

import pytest

import src.tenant as T
from src import shiguan_outcome as so
from src.chancellor_router import genius_next_step


@pytest.fixture()
def tenant_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_a"):
        yield tmp_path


def test_record_outcome_discipline(tenant_tmp):
    with pytest.raises(ValueError, match="outcome"):
        so.record_outcome("案A", "maybe", recorded_by="老板")
    with pytest.raises(ValueError, match="留名"):
        so.record_outcome("案A", "confirmed", recorded_by="")
    rec = so.record_outcome("案A", "confirmed", recorded_by="老板", note="签下来了")
    assert rec["outcome"] == "confirmed" and rec["recorded_by"] == "老板"


def test_weight_hits_prior(tenant_tmp):
    """证实上浮压过相似度序;打脸深降权但**不删**且带标签。"""
    so.record_outcome("案B", "confirmed", recorded_by="老板")
    so.record_outcome("案C", "refuted", recorded_by="老板")
    hits = [
        {"source": "案A", "score": 0.80, "content": "x"},
        {"source": "案B", "score": 0.70, "content": "y"},
        {"source": "案C", "score": 0.90, "content": "z"},
    ]
    out = so.weight_hits(hits)
    assert [h["source"] for h in out] == [
        "案B",
        "案A",
        "案C",
    ], "证实0.84>中性0.80>打脸0.45"
    assert len(out) == 3, "打脸的旧案不删除"
    assert out[2]["outcome"] == "refuted" and out[0]["prior"] == 1.2


def test_pending_receipts_30d(tenant_tmp):
    old = (datetime.now().astimezone() - timedelta(days=31)).isoformat()
    recent = (datetime.now().astimezone() - timedelta(days=2)).isoformat()
    so.log_citation(["老案", "新案", "已回执案"], cited_at=old)
    so.log_citation(["新案"], cited_at=recent)  # 新案最早引用仍是 old
    so.record_outcome("已回执案", "confirmed", recorded_by="老板")
    pend = so.pending_receipts(days=30)
    sources = [p["source"] for p in pend]
    assert "老案" in sources and "新案" in sources
    assert "已回执案" not in sources, "有回执的不催收"
    assert all("成了没" in p["ask"] for p in pend)


def test_recent_citation_not_pending(tenant_tmp):
    so.log_citation(["刚引的案"])
    assert so.pending_receipts(days=30) == []


def test_outcome_tenant_isolated(tenant_tmp):
    so.record_outcome("案A", "refuted", recorded_by="老板")
    with T.tenant_context("t_b"):
        assert so.outcomes_by_source() == {}, "A 的打脸账本 B 看不见"


def test_genius_marks_refuted_as_counter_example(tenant_tmp, monkeypatch):
    """打脸旧案召回时诚实标反面教材(needs_evidence),且引用留痕落账。"""
    so.record_outcome("翻车案", "refuted", recorded_by="老板")

    class _FakeRag:
        def search(self, *a, **k):
            return [
                {"source": "翻车案", "score": 0.9, "content": "当年这么干的"},
                {
                    "source": "好案",
                    "score": 0.8,
                    "content": "官网 https://a.com 实测数据",
                },
            ]

    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: _FakeRag())
    steps = genius_next_step("类似的新任务")
    by_src = {s["citations"][0]: s for s in steps}
    bad = by_src["翻车案"]
    assert "警惕" in bad["suggestion"] and bad["confidence"] == "needs_evidence"
    assert bad["outcome"] == "refuted"
    good = by_src["好案"]
    assert good["outcome"] is None and "参照" in good["suggestion"]
    # 引用留痕:两案都进 citations,供 30 天催收
    cited = {c["source"] for c in so._read_jsonl("citations.jsonl")}
    assert {"翻车案", "好案"} <= cited


def test_receipt_endpoints(tenant_tmp):
    """API 面:GET 催收清单 / POST 回执(recorded_by 取登录身份,匿名 400)。"""
    import importlib

    from fastapi.testclient import TestClient

    from web.deps import get_current_user
    from web.schemas.auth import CurrentUser

    app = importlib.import_module("web.main").app

    def _boss():
        T.set_current_tenant("t_a")
        return CurrentUser(username="老板", tenant_slug="t_a")

    app.dependency_overrides[get_current_user] = _boss
    try:
        client = TestClient(app)
        old = (datetime.now().astimezone() - timedelta(days=31)).isoformat()
        so.log_citation(["老案"], cited_at=old)

        pend = client.get("/api/cases/receipts/pending").json()
        assert [p["source"] for p in pend] == ["老案"]

        r = client.post(
            "/api/cases/receipts",
            json={"source": "老案", "outcome": "confirmed", "note": "成了"},
        )
        assert r.status_code == 200 and r.json()["recorded_by"] == "老板"
        assert client.get("/api/cases/receipts/pending").json() == []

        bad = client.post(
            "/api/cases/receipts", json={"source": "x", "outcome": "maybe"}
        )
        assert bad.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)
