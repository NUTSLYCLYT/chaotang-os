"""src/polymarket_lookup.py — Polymarket 公开 market 查询,零key、复用已有 httpx 依赖。

真实钱下注定的价格,比 LLM 猜测更接地——但只覆盖有交易量的宏观/政治/加密话题,查不到
就诚实返回 []，不编造。已解决(closed)的市场额外有价值：它是"历史事件 + 当时人群的实时
概率判断 + 最终真实结果"三件套，天然适合喂给历史参照系(reference class)分析。

ponytail: 用现成的 public-search 端点(有服务端关键词搜索),没有再自己拉全量market客户端过滤。
"""

from __future__ import annotations

import json

import httpx

_SEARCH_URL = "https://gamma-api.polymarket.com/public-search"


def search_markets(query: str, *, limit: int = 5) -> list[dict]:
    """按关键词查 Polymarket 市场,返回[{question, outcomes, outcome_prices, closed, volume}]。

    查不到/网络失败/超时 → []，调用方按"未接地"处理，不假装有市场。
    """
    try:
        resp = httpx.get(_SEARCH_URL, params={"q": query}, timeout=8.0)
        resp.raise_for_status()
        events = resp.json().get("events") or []
    except Exception:
        return []

    out: list[dict] = []
    for event in events:
        for market in event.get("markets") or []:
            try:
                outcomes = json.loads(market.get("outcomes") or "[]")
                prices = json.loads(market.get("outcomePrices") or "[]")
            except (json.JSONDecodeError, TypeError):
                outcomes, prices = [], []
            out.append(
                {
                    "question": market.get("question", ""),
                    "outcomes": outcomes,
                    "outcome_prices": prices,
                    "closed": bool(market.get("closed")),
                    "volume": market.get("volume"),
                    "url": f"https://polymarket.com/event/{event.get('slug', '')}",
                }
            )
            if len(out) >= limit:
                return out
    return out
