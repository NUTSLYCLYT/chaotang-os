"""tests/test_jinyiwei_search.py — Tavily真实检索:解析真实响应形状 + 失败兜底。"""

from __future__ import annotations

from src import jinyiwei_search as js

_FAKE_RESPONSE = {
    "results": [
        {
            "title": "低温电池行业标准",
            "url": "https://esst.cip.com.cn/article/1",
            "content": "GB/T 36276",
            "score": 0.9,
        },
        {
            "title": "另一个来源",
            "url": "https://example.com/2",
            "content": "同一说法",
            "score": 0.7,
        },
    ]
}


def test_tavily_search_missing_key_returns_empty(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    assert js.tavily_search("任意查询") == []


def test_tavily_search_parses_real_response_shape(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-fake-key")

    class _FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return _FAKE_RESPONSE

    monkeypatch.setattr(js.httpx, "post", lambda *a, **kw: _FakeResp())
    out = js.tavily_search("低温电池标准")
    assert len(out) == 1
    assert out[0]["claim"] == "低温电池标准"
    assert len(out[0]["sources"]) == 2
    assert out[0]["sources"][0]["name"] == "https://esst.cip.com.cn/article/1"
    assert out[0]["sources"][0]["tier"] is None


def test_tavily_search_network_failure_returns_empty(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-fake-key")

    def _boom(*a, **kw):
        raise ConnectionError("no network")

    monkeypatch.setattr(js.httpx, "post", _boom)
    assert js.tavily_search("任意查询") == []


def test_tavily_search_no_results_returns_empty(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-fake-key")

    class _EmptyResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"results": []}

    monkeypatch.setattr(js.httpx, "post", lambda *a, **kw: _EmptyResp())
    assert js.tavily_search("查不到的东西") == []


def test_tavily_search_empty_query_returns_empty(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-fake-key")
    assert js.tavily_search("") == []
