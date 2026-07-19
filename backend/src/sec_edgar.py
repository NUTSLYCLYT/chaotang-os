"""src/sec_edgar.py — 锦衣卫 SEC EDGAR 真实取证。

免 key 公开 API；SEC 要求自报 User-Agent（默认值可用 SEC_EDGAR_USER_AGENT 覆盖）。
所有失败路径诚实降级：ticker 全量表拉不到 → 回退内置两只票；companyfacts
GET 失败 → verified=False，不编造可达性。给 finance_intel_loop_contract 的
build_finance_intel_session(evidence_fetcher=...) 注入用。
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

from src.runtime_paths import resolve_runtime_paths

_UA = os.environ.get(
    "SEC_EDGAR_USER_AGENT",
    "chaotang-os research bot (contact: ops@chaotang.internal)",
)
_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
_TICKER_MAP_TTL_SECONDS = 7 * 24 * 3600
_TIMEOUT_SECONDS = 8.0

# 与 finance_intel_loop_contract._SEC_CIKS 一致的最后回退（全量表不可得时）。
_FALLBACK_CIKS = {"AAPL": "0000320193", "MSFT": "0000789019"}


def _cache_path() -> Path:
    # ponytail: 复用 swarm_sessions 的 var 根，不给 RuntimePaths 加字段
    return resolve_runtime_paths().swarm_sessions.parent / "sec_edgar" / "company_tickers.json"


def _fetch_ticker_map() -> dict[str, str] | None:
    try:
        resp = httpx.get(_TICKER_MAP_URL, headers={"User-Agent": _UA}, timeout=_TIMEOUT_SECONDS)
        resp.raise_for_status()
        raw = resp.json()
    except Exception:
        return None
    mapping: dict[str, str] = {}
    for entry in (raw or {}).values():
        ticker = str(entry.get("ticker", "")).upper()
        cik = entry.get("cik_str")
        if ticker and cik is not None:
            mapping[ticker] = f"{int(cik):010d}"
    return mapping or None


def load_ticker_map(cache_path: Path | None = None) -> dict[str, str]:
    """SEC 全量 ticker→CIK 表，var 缓存 7 天；拉取失败回退内置两只票。"""
    path = cache_path or _cache_path()
    try:
        if path.exists() and time.time() - path.stat().st_mtime < _TICKER_MAP_TTL_SECONDS:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(cached, dict) and cached:
                return cached
    except Exception:
        pass
    fetched = _fetch_ticker_map()
    if fetched:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(f".{os.getpid()}.tmp")
            tmp.write_text(json.dumps(fetched, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, path)
        except Exception:
            pass
        return fetched
    try:
        if path.exists():  # 过期缓存好过内置两只票
            stale = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(stale, dict) and stale:
                return stale
    except Exception:
        pass
    return dict(_FALLBACK_CIKS)


def resolve_cik(ticker: str, cache_path: Path | None = None) -> str | None:
    if not ticker:
        return None
    return load_ticker_map(cache_path).get(ticker.upper())


def companyfacts_urls(cik: str) -> list[str]:
    return [
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
        f"https://data.sec.gov/submissions/CIK{cik}.json",
    ]


def gather_sec_evidence(ticker: str, cache_path: Path | None = None) -> dict[str, Any]:
    """ticker → {sourceUrls, verified, cik}。

    verified=True 仅当 companyfacts 真实 GET 到 200；其余一律 False。
    找不到 CIK → sourceUrls 空（诚实缺证，不拼假 URL）。
    """
    cik = resolve_cik(ticker, cache_path)
    if not cik:
        return {"sourceUrls": [], "verified": False, "cik": None}
    urls = companyfacts_urls(cik)
    try:
        resp = httpx.get(urls[0], headers={"User-Agent": _UA}, timeout=_TIMEOUT_SECONDS)
        verified = resp.status_code == 200
    except Exception:
        verified = False
    return {"sourceUrls": urls, "verified": verified, "cik": cik}
