#!/usr/bin/env python3
"""CRM MCP Server — 客户关系管理模拟服务。

功能：
- search_customers: 搜索客户（只读）
- get_customer_detail: 获取客户详情（只读）
- create_lead: 创建销售线索（写操作，需审批）
- prepare_email_draft: 准备邮件草稿（写操作，需审批）

使用方式：
    python3 mcp_servers/crm_server.py

配置在 config/mcp_servers.yaml 中注册后，
ToolRouter 会自动启动此进程并通过 stdin/stdout 通信。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# 确保可以导入 base_server
sys.path.insert(0, str(Path(__file__).resolve().parent))

from base_server import BaseServer

# ─── 模拟数据库 ─────────────────────────────────────

CUSTOMERS_DB = [
    {
        "id": "C001",
        "name": "某客户01",
        "contact": "联系人01",
        "phone": "138-0000-0001",
        "email": "c01@example.com",
        "industry": "风光配储",
        "region": "内蒙古呼和浩特",
        "budget_range": "500-1000万",
        "status": "active",
        "tags": ["极寒", "大规模储能", "政策配储"],
    },
    {
        "id": "C002",
        "name": "某客户02",
        "contact": "联系人02",
        "phone": "139-0000-0002",
        "email": "c02@example.com",
        "industry": "电网侧储能",
        "region": "新疆乌鲁木齐",
        "budget_range": "1000-3000万",
        "status": "active",
        "tags": ["极寒", "电网调峰", "招标项目"],
    },
    {
        "id": "C003",
        "name": "某客户03",
        "contact": "联系人03",
        "phone": "137-0000-0003",
        "email": "c03@example.com",
        "industry": "工商业储能",
        "region": "青海西宁",
        "budget_range": "200-500万",
        "status": "prospect",
        "tags": ["高原", "自用电", "光伏配储"],
    },
    {
        "id": "C004",
        "name": "某客户04",
        "contact": "联系人04",
        "phone": "136-0000-0004",
        "email": "c04@example.com",
        "industry": "微电网",
        "region": "黑龙江哈尔滨",
        "budget_range": "300-800万",
        "status": "active",
        "tags": ["极寒", "微电网", "工业园区"],
    },
    {
        "id": "C005",
        "name": "某客户05",
        "contact": "联系人05",
        "phone": "135-0000-0005",
        "email": "c05@example.com",
        "industry": "风光配储",
        "region": "甘肃酒泉",
        "budget_range": "800-2000万",
        "status": "active",
        "tags": ["沙漠", "大规模", "风电配储"],
    },
]


# ─── CRM Server ────────────────────────────────────


class CRMServer(BaseServer):
    def __init__(self):
        super().__init__(name="crm", version="1.0")

    def register_tools(self):
        self.add_tool(
            "search_customers",
            "搜索客户。支持按关键词、地区、行业、标签搜索。",
            {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词（匹配公司名、联系人、地区、行业、标签）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最大返回条数",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
            self.search_customers,
        )

        self.add_tool(
            "get_customer_detail",
            "获取客户详情（按客户ID）。",
            {
                "type": "object",
                "properties": {
                    "customer_id": {
                        "type": "string",
                        "description": "客户ID（如 C001）",
                    },
                },
                "required": ["customer_id"],
            },
            self.get_customer_detail,
        )

        self.add_tool(
            "create_lead",
            "创建销售线索（需人工审批后生效）。",
            {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "关联客户ID"},
                    "opportunity": {"type": "string", "description": "商机描述"},
                    "estimated_value": {"type": "string", "description": "预估金额"},
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "优先级",
                    },
                },
                "required": ["customer_id", "opportunity"],
            },
            self.create_lead,
        )

        self.add_tool(
            "prepare_email_draft",
            "准备邮件草稿（不直接发送，需人工确认）。",
            {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "收件人邮箱"},
                    "subject": {"type": "string", "description": "邮件主题"},
                    "body": {"type": "string", "description": "邮件正文（支持 Markdown）"},
                    "cc": {"type": "string", "description": "抄送邮箱（可选）"},
                },
                "required": ["to", "subject", "body"],
            },
            self.prepare_email_draft,
        )

    def search_customers(self, query: str, limit: int = 5) -> list[dict]:
        query_lower = query.lower()
        results = []
        for c in CUSTOMERS_DB:
            searchable = " ".join([
                c["name"], c["contact"], c["region"],
                c["industry"], " ".join(c["tags"]),
            ]).lower()
            if query_lower in searchable:
                results.append({
                    "id": c["id"],
                    "name": c["name"],
                    "contact": c["contact"],
                    "phone": c["phone"],
                    "email": c["email"],
                    "region": c["region"],
                    "industry": c["industry"],
                    "budget_range": c["budget_range"],
                    "status": c["status"],
                })
            if len(results) >= limit:
                break
        if not results:
            return [{"message": f"未找到与 '{query}' 匹配的客户", "suggestion": "尝试更宽泛的关键词"}]
        return results

    def get_customer_detail(self, customer_id: str) -> dict:
        for c in CUSTOMERS_DB:
            if c["id"] == customer_id:
                return c
        return {"error": f"客户 {customer_id} 不存在"}

    def create_lead(
        self,
        customer_id: str,
        opportunity: str,
        estimated_value: str = "待评估",
        priority: str = "medium",
    ) -> dict:
        customer = None
        for c in CUSTOMERS_DB:
            if c["id"] == customer_id:
                customer = c
                break
        return {
            "status": "draft_created",
            "lead": {
                "customer": customer["name"] if customer else customer_id,
                "opportunity": opportunity,
                "estimated_value": estimated_value,
                "priority": priority,
            },
            "message": "线索草稿已创建，需人工审批后录入CRM系统",
        }

    def prepare_email_draft(
        self, to: str, subject: str, body: str, cc: str = ""
    ) -> dict:
        return {
            "status": "draft_created",
            "email": {
                "to": to,
                "cc": cc,
                "subject": subject,
                "body_preview": body[:200] + ("..." if len(body) > 200 else ""),
            },
            "message": "邮件草稿已创建，需人工确认后发送",
        }


if __name__ == "__main__":
    CRMServer().run()
