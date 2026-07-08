#!/usr/bin/env python3
"""Web 搜索 MCP Server — Tavily Search + Jina URL Reader。

工具：
- web_search:  调用 Tavily API 搜索互联网实时内容（竞品、行业动态、招标信息）
- fetch_url:   调用 Jina Reader 抓取任意 URL 转为干净文本（免费，无需 Key）

环境变量：
    TAVILY_API_KEY  — Tavily API Key（必需，从 https://app.tavily.com 获取）

使用方式：
    python3 mcp_servers/web_search_server.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_server import BaseServer


class WebSearchServer(BaseServer):
    def register_tools(self):
        self.tool(
            name="web_search",
            description="搜索互联网实时信息（竞品价格/行业动态/招标公告/技术规格）。返回最相关的网页摘要。",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，建议中英文混合，如'宁德时代 储能PACK 2025报价'",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "返回结果数量（1-10，默认5）",
                        "default": 5,
                    },
                    "search_depth": {
                        "type": "string",
                        "enum": ["basic", "advanced"],
                        "description": "搜索深度：basic（快速）或 advanced（深度，消耗2次配额）",
                        "default": "basic",
                    },
                },
                "required": ["query"],
            },
        )(self.web_search)

        self.tool(
            name="fetch_url",
            description="抓取指定 URL 的网页内容，转为干净的 Markdown 文本。适合读取竞品官网、招标详情页、行业报告。",
            parameters={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "要抓取的网页 URL",
                    },
                    "max_chars": {
                        "type": "integer",
                        "description": "返回内容最大字符数（默认3000）",
                        "default": 3000,
                    },
                },
                "required": ["url"],
            },
        )(self.fetch_url)

    def web_search(self, query: str, max_results: int = 5, search_depth: str = "basic") -> str:
        """调用 Tavily Search API。"""

        api_key = os.environ.get("TAVILY_API_KEY", "")
        if not api_key:
            return "❌ 错误：TAVILY_API_KEY 未配置，请在 .env 中设置。"

        max_results = max(1, min(10, int(max_results)))

        try:
            client = httpx.Client(transport=_get_transport(), timeout=30)
            resp = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "search_depth": search_depth,
                    "max_results": max_results,
                    "include_answer": True,  # 返回 AI 摘要
                    "include_raw_content": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return f"❌ Tavily 请求失败: {e}"

        lines = [f"🔍 搜索：{query}\n"]

        # AI 摘要（如有）
        if data.get("answer"):
            lines.append(f"**摘要**：{data['answer']}\n")

        # 搜索结果
        results = data.get("results", [])
        if not results:
            return f"搜索'{query}'无结果。"

        for i, r in enumerate(results, 1):
            title = r.get("title", "无标题")
            url = r.get("url", "")
            content = r.get("content", "").strip()
            score = r.get("score", 0)
            lines.append(f"**[{i}] {title}**（相关度: {score:.0%}）")
            lines.append(f"来源: {url}")
            if content:
                # 截断过长内容
                lines.append(content[:500] + ("..." if len(content) > 500 else ""))
            lines.append("")

        return "\n".join(lines)

    def fetch_url(self, url: str, max_chars: int = 3000) -> str:
        """调用 Jina Reader 抓取 URL。"""

        if not url.startswith("http"):
            url = "https://" + url

        jina_url = f"https://r.jina.ai/{url}"
        try:
            client = httpx.Client(transport=_get_transport(), timeout=30)
            resp = client.get(
                jina_url,
                headers={
                    "Accept": "text/plain",
                    "X-Return-Format": "markdown",
                },
                follow_redirects=True,
            )
            resp.raise_for_status()
            content = resp.text.strip()
        except Exception as e:
            return f"❌ 抓取失败 {url}: {e}"

        max_chars = max(500, min(10000, int(max_chars)))
        if len(content) > max_chars:
            content = content[:max_chars] + f"\n\n[已截断，原文 {len(content)} 字符]"

        return f"📄 **{url}**\n\n{content}"


def _get_transport():
    """读取环境变量代理配置，返回 httpx Transport（服务器统一走 Mihomo 127.0.0.1:7880）。"""
    proxy = (
        os.environ.get("https_proxy")
        or os.environ.get("HTTPS_PROXY")
        or os.environ.get("http_proxy")
        or os.environ.get("HTTP_PROXY")
    )
    if proxy:
        return httpx.HTTPTransport(proxy=proxy)
    return None


if __name__ == "__main__":
    WebSearchServer(name="web_search", version="1.0").run()
