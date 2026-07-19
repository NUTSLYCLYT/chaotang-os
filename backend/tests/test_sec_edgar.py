"""sec_edgar 单测：全部 monkeypatch httpx，不打真网络。"""

import httpx
import pytest

import src.sec_edgar as sec_edgar


class _Resp:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")


def _boom(*args, **kwargs):
    raise httpx.ConnectError("network down")


def test_load_ticker_map_fetches_and_caches(tmp_path, monkeypatch):
    cache = tmp_path / "company_tickers.json"
    monkeypatch.setattr(
        sec_edgar.httpx,
        "get",
        lambda *a, **k: _Resp(200, {"0": {"ticker": "NVDA", "cik_str": 1045810}}),
    )
    mapping = sec_edgar.load_ticker_map(cache)
    assert mapping["NVDA"] == "0001045810"
    assert cache.exists()
    monkeypatch.setattr(sec_edgar.httpx, "get", _boom)
    assert sec_edgar.load_ticker_map(cache)["NVDA"] == "0001045810"


def test_load_ticker_map_falls_back_when_fetch_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(sec_edgar.httpx, "get", _boom)
    mapping = sec_edgar.load_ticker_map(tmp_path / "missing.json")
    assert mapping == {"AAPL": "0000320193", "MSFT": "0000789019"}


def test_resolve_cik_uses_full_map(tmp_path, monkeypatch):
    cache = tmp_path / "company_tickers.json"
    cache.write_text('{"NVDA": "0001045810"}', encoding="utf-8")
    monkeypatch.setattr(sec_edgar.httpx, "get", _boom)
    assert sec_edgar.resolve_cik("nvda", cache) == "0001045810"
    assert sec_edgar.resolve_cik("NOPE", cache) is None


def test_gather_sec_evidence_verified_only_on_200(tmp_path, monkeypatch):
    cache = tmp_path / "company_tickers.json"
    cache.write_text('{"AAPL": "0000320193"}', encoding="utf-8")

    monkeypatch.setattr(sec_edgar.httpx, "get", lambda *a, **k: _Resp(200))
    got = sec_edgar.gather_sec_evidence("AAPL", cache)
    assert got["verified"] is True
    assert len(got["sourceUrls"]) == 2
    assert got["cik"] == "0000320193"

    monkeypatch.setattr(sec_edgar.httpx, "get", lambda *a, **k: _Resp(403))
    got = sec_edgar.gather_sec_evidence("AAPL", cache)
    assert got["verified"] is False
    assert len(got["sourceUrls"]) == 2

    monkeypatch.setattr(sec_edgar.httpx, "get", _boom)
    got = sec_edgar.gather_sec_evidence("AAPL", cache)
    assert got["verified"] is False


def test_gather_sec_evidence_unknown_ticker_returns_empty(tmp_path, monkeypatch):
    cache = tmp_path / "company_tickers.json"
    cache.write_text('{"AAPL": "0000320193"}', encoding="utf-8")
    monkeypatch.setattr(sec_edgar.httpx, "get", _boom)
    got = sec_edgar.gather_sec_evidence("ZZZZZ", cache)
    assert got == {"sourceUrls": [], "verified": False, "cik": None}
