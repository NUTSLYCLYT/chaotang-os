"""tests/test_polymarket_lookup.py — Polymarket 查询:解析真实响应形状 + 失败兜底。"""

from __future__ import annotations

from src import polymarket_lookup as pl

_FAKE_RESPONSE = {
    "events": [
        {
            "slug": "lithium-price-q3",
            "markets": [
                {
                    "question": "Will lithium carbonate drop below 80k CNY/ton by Q3?",
                    "outcomes": '["Yes", "No"]',
                    "outcomePrices": '["0.42", "0.58"]',
                    "closed": False,
                    "volume": 12345.6,
                }
            ],
        }
    ]
}


def test_search_markets_parses_json_string_fields(monkeypatch):
    class _FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return _FAKE_RESPONSE

    monkeypatch.setattr(pl.httpx, "get", lambda *a, **kw: _FakeResp())
    out = pl.search_markets("lithium")
    assert len(out) == 1
    assert out[0]["outcomes"] == ["Yes", "No"]
    assert out[0]["outcome_prices"] == ["0.42", "0.58"]
    assert out[0]["closed"] is False


def test_search_markets_network_failure_returns_empty(monkeypatch):
    def _boom(*a, **kw):
        raise ConnectionError("no network")

    monkeypatch.setattr(pl.httpx, "get", _boom)
    assert pl.search_markets("anything") == []


def test_search_markets_respects_limit(monkeypatch):
    two_markets = {
        "events": [
            {
                "slug": "x",
                "markets": [
                    {
                        "question": "A?",
                        "outcomes": '["Yes","No"]',
                        "outcomePrices": '["0.5","0.5"]',
                        "closed": False,
                        "volume": 1,
                    },
                    {
                        "question": "B?",
                        "outcomes": '["Yes","No"]',
                        "outcomePrices": '["0.5","0.5"]',
                        "closed": False,
                        "volume": 1,
                    },
                ],
            }
        ]
    }

    class _FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return two_markets

    monkeypatch.setattr(pl.httpx, "get", lambda *a, **kw: _FakeResp())
    assert len(pl.search_markets("x", limit=1)) == 1
