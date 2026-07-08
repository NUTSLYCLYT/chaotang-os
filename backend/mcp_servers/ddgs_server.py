#!/usr/bin/env python3
"""DuckDuckGo 搜索 MCP Server — 完全免费，无需 API Key。

工具：
- ddg_search: DuckDuckGo 关键词搜索（实时，中英文均可）
- ddg_news:   DuckDuckGo 新闻搜索（行业动态/招标/竞品）

环境变量：
    无（完全免费，不需要任何 Key）
    HTTP_PROXY / HTTPS_PROXY: 代理（可选，自动读取）

使用方式：
    python3 mcp_servers/ddgs_server.py
"""

from __future__ import annotations
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_server import BaseServer


class DdgsServer(BaseServer):
    def register_tools(self):
        self.tool(
            name="ddg_search",
            description="用 DuckDuckGo 搜索互联网实时信息（完全免费·无 Key·中英文均可）。适合竞品价格/行业动态/技术规格查询。",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词，支持中英文混合"},
                    "max_results": {"type": "integer", "description": "返回结果数（1-10，默认5）", "default": 5},
                    "region": {"type": "string", "description": "地区：cn-zh（中文）/ us-en（英文）/ wt-wt（全球）", "default": "cn-zh"},
                },
                "required": ["query"],
            },
        )
        self.tool(
            name="ddg_news",
            description="用 DuckDuckGo 搜索最新新闻（行业动态/招标公告/竞品发布）。比普通搜索更聚焦时效性内容。",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "新闻搜索关键词"},
                    "max_results": {"type": "integer", "description": "返回数量（默认5）", "default": 5},
                    "timelimit": {"type": "string", "description": "时间范围：d=近24h / w=近7天 / m=近月", "default": "w"},
                },
                "required": ["query"],
            },
        )

    def ddg_search(self, query: str, max_results: int = 5, region: str = "cn-zh") -> str:
        try:
            from ddgs import DDGS
        except ImportError:
            return "❌ 请先安装：pip install ddgs"

        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        try:
            with DDGS(proxy=proxy, timeout=15) as ddgs:
                results = list(ddgs.text(query, max_results=max_results, region=region))
        except Exception as e:
            return f"❌ DuckDuckGo 搜索失败: {e}"

        if not results:
            return f"⚠️ 未找到「{query}」的相关结果"

        lines = [f"🔍 DuckDuckGo 搜索「{query}」— {len(results)} 条结果\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r.get('title', '无标题')}")
            lines.append(f"    {r.get('body', '')[:200]}")
            lines.append(f"    🔗 {r.get('href', '')}")
            lines.append("")
        return "\n".join(lines)

    def ddg_news(self, query: str, max_results: int = 5, timelimit: str = "w") -> str:
        try:
            from ddgs import DDGS
        except ImportError:
            return "❌ 请先安装：pip install ddgs"

        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        try:
            with DDGS(proxy=proxy, timeout=15) as ddgs:
                results = list(ddgs.news(query, max_results=max_results, timelimit=timelimit))
        except Exception as e:
            return f"❌ DuckDuckGo 新闻搜索失败: {e}"

        if not results:
            return f"⚠️ 未找到「{query}」的近期新闻"

        lines = [f"📰 DuckDuckGo 新闻「{query}」— {len(results)} 条\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r.get('title', '无标题')} ({r.get('date', '?')})")
            lines.append(f"    {r.get('body', '')[:150]}")
            lines.append(f"    🔗 {r.get('url', r.get('href', ''))}")
            lines.append("")
        return "\n".join(lines)


if __name__ == "__main__":
    DdgsServer(name="ddg_search", version="1.0").run()
