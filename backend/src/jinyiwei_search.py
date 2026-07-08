"""src/jinyiwei_search.py — 锦衣卫真实检索(Tavily搜索API)。

给 src/jinyiwei_agent.py 的 gather_intel(search_fn=...) 用。TAVILY_API_KEY 缺失
或请求失败 → 空列表,gather_intel 会诚实退回"未获取到可核情报"(不编造),不崩。

只在 jinyiwei_intel_swarm 真的被选中时才调用(该 swarm 关键词窄触发:情报/核实/
可信度/信源/谣言/线报/传闻/查证,不在 route_swarms 的常任默认列表里),不会像
户部/兵部那样被无关任务意外触发。
"""

from __future__ import annotations

import os

import httpx

_SEARCH_URL = "https://api.tavily.com/search"


def tavily_search(query: str, *, max_results: int = 5) -> list[dict]:
    """query → [{"claim": query, "sources": [{"name": url, "tier": None}, ...]}]。

    source tier 留空交给 jinyiwei_vet._tier() 按名称关键词分级;多个不同域名即便
    都判"未知"档,vet_intel 仍会按"多源印证"规则放行,不需要额外域名白名单。
    """
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key or not query:
        return []
    try:
        resp = httpx.post(
            _SEARCH_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"query": query, "max_results": max_results},
            timeout=8.0,
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
    except Exception:
        return []
    sources = [
        {"name": r.get("url", ""), "tier": None} for r in results if r.get("url")
    ]
    if not sources:
        return []
    return [{"claim": query, "sources": sources}]
