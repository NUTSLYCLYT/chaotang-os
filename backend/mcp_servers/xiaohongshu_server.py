#!/usr/bin/env python3
"""小红书搜索 MCP Server — 社媒内容检索服务。

功能：
- search_notes: 搜索小红书笔记（按关键词、行业标签）
- get_note_detail: 获取笔记详情（点赞/评论/内容摘要）
- search_competitors: 搜索竞品在小红书的营销动态

使用方式：
    python3 mcp_servers/xiaohongshu_server.py

注意：当前为模拟数据。接入真实小红书 API 需要：
1. 小红书开放平台 API Key
2. 或使用第三方数据服务（如新榜/蝉妈妈）
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_server import BaseServer

# 模拟数据
MOCK_NOTES = [
    {
        "id": "xhs_001",
        "title": "低温储能电池实测：-30℃还能放出85%容量？",
        "author": "储能圈老张",
        "likes": 2341,
        "comments": 187,
        "content_preview": "实测了三款主流低温磷酸铁锂方案，在-30℃环境下放电保持率分别是85%、78%、72%...",
        "tags": ["储能", "低温电池", "磷酸铁锂", "测评"],
        "publish_date": "2026-03-20",
    },
    {
        "id": "xhs_002",
        "title": "2026储能行业最新趋势：极寒场景成新蓝海",
        "author": "新能源产业观察",
        "likes": 5672,
        "comments": 423,
        "content_preview": "2026年Q1储能招标数据显示，内蒙/新疆/黑龙江三省的极寒储能项目同比增长230%...",
        "tags": ["储能趋势", "极寒", "招标", "市场分析"],
        "publish_date": "2026-03-15",
    },
    {
        "id": "xhs_003",
        "title": "宁德时代 vs 比亚迪 低温储能方案对比",
        "author": "电池技术派",
        "likes": 8923,
        "comments": 612,
        "content_preview": "从BMS策略、电芯配方、热管理系统三个维度对比两大厂商的低温解决方案...",
        "tags": ["宁德时代", "比亚迪", "低温", "竞品对比"],
        "publish_date": "2026-03-10",
    },
    {
        "id": "xhs_004",
        "title": "储能项目避坑指南：冬季施工这些成本别忽略",
        "author": "EPC老司机",
        "likes": 3456,
        "comments": 298,
        "content_preview": "极寒地区储能项目的隐性成本：冬季施工加价30%、特种运输费翻倍、防冻基础额外投入...",
        "tags": ["储能", "施工", "成本", "避坑"],
        "publish_date": "2026-03-05",
    },
    {
        "id": "xhs_005",
        "title": "客户反馈：用了XX家的低温储能系统一年了",
        "author": "内蒙储能站长",
        "likes": 1234,
        "comments": 89,
        "content_preview": "去年安装的2MWh低温储能系统，经历了零下35度的极寒冬季，整体运行数据分享...",
        "tags": ["客户反馈", "低温储能", "运行数据", "内蒙古"],
        "publish_date": "2026-02-28",
    },
]


class XiaohongshuServer(BaseServer):
    def __init__(self):
        super().__init__(name="xiaohongshu", version="1.0")

    def register_tools(self):
        self.add_tool(
            "search_notes",
            "搜索小红书笔记。支持按关键词和标签搜索，返回笔记列表（标题、作者、互动数据）。",
            {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词（如：低温储能、磷酸铁锂、储能招标）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最大返回条数",
                        "default": 5,
                    },
                    "sort_by": {
                        "type": "string",
                        "enum": ["relevance", "likes", "date"],
                        "description": "排序方式：相关性/点赞数/发布时间",
                        "default": "relevance",
                    },
                },
                "required": ["query"],
            },
            self.search_notes,
        )

        self.add_tool(
            "get_note_detail",
            "获取小红书笔记详情（完整内容、评论摘要、互动数据）。",
            {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "string",
                        "description": "笔记ID（如 xhs_001）",
                    },
                },
                "required": ["note_id"],
            },
            self.get_note_detail,
        )

        self.add_tool(
            "search_competitors",
            "搜索竞品在小红书上的营销动态（品牌提及、用户口碑、热门内容）。",
            {
                "type": "object",
                "properties": {
                    "brand": {
                        "type": "string",
                        "description": "竞品品牌名（如：宁德时代、阳光电源）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最大返回条数",
                        "default": 3,
                    },
                },
                "required": ["brand"],
            },
            self.search_competitors,
        )

    def search_notes(self, query: str, limit: int = 5, sort_by: str = "relevance") -> list[dict]:
        query_lower = query.lower()
        results = []
        for note in MOCK_NOTES:
            searchable = (
                note["title"] + " " + note["content_preview"]
                + " " + " ".join(note["tags"])
            ).lower()
            if any(kw in searchable for kw in query_lower.split()):
                results.append({
                    "id": note["id"],
                    "title": note["title"],
                    "author": note["author"],
                    "likes": note["likes"],
                    "comments": note["comments"],
                    "tags": note["tags"],
                    "publish_date": note["publish_date"],
                    "preview": note["content_preview"][:100],
                })
        if sort_by == "likes":
            results.sort(key=lambda x: -x["likes"])
        elif sort_by == "date":
            results.sort(key=lambda x: x["publish_date"], reverse=True)
        if not results:
            return [{"message": f"未找到与'{query}'相关的笔记", "suggestion": "尝试更宽泛的关键词"}]
        return results[:limit]

    def get_note_detail(self, note_id: str) -> dict:
        for note in MOCK_NOTES:
            if note["id"] == note_id:
                return note
        return {"error": f"笔记 {note_id} 不存在"}

    def search_competitors(self, brand: str, limit: int = 3) -> list[dict]:
        brand_lower = brand.lower()
        results = []
        for note in MOCK_NOTES:
            if brand_lower in (note["title"] + " " + note["content_preview"]).lower():
                results.append({
                    "id": note["id"],
                    "title": note["title"],
                    "likes": note["likes"],
                    "sentiment": "正面" if note["likes"] > 3000 else "中性",
                })
        if not results:
            return [{"message": f"未找到{brand}相关内容", "brand_mentioned": 0}]
        return results[:limit]


if __name__ == "__main__":
    XiaohongshuServer().run()
