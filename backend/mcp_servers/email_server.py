#!/usr/bin/env python3
"""邮件 MCP Server — 邮件发送服务。

功能：
- prepare_email_draft: 准备邮件草稿（草稿模式，需人工确认后发送）
- send_notification: 发送系统通知邮件（自动执行，无需审批）

使用方式：
    python3 mcp_servers/email_server.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_server import BaseServer


class EmailServer(BaseServer):
    def __init__(self):
        super().__init__(name="email", version="1.0")

    def register_tools(self):
        self.add_tool(
            "prepare_email_draft",
            "准备邮件草稿。邮件不会直接发送，需人工在 Web UI 确认后才会发出。"
            "适用于：发送质量报告、客户方案、报价单等正式邮件。",
            {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "收件人邮箱地址",
                    },
                    "subject": {
                        "type": "string",
                        "description": "邮件主题",
                    },
                    "body": {
                        "type": "string",
                        "description": "邮件正文（支持 Markdown 格式）",
                    },
                    "cc": {
                        "type": "string",
                        "description": "抄送邮箱（可选，多个用逗号分隔）",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "normal", "low"],
                        "description": "邮件优先级",
                        "default": "normal",
                    },
                },
                "required": ["to", "subject", "body"],
            },
            self.prepare_email_draft,
        )

        self.add_tool(
            "send_notification",
            "发送系统通知邮件（自动发送，用于内部通知如质量预警、修复完成等）。",
            {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "收件人邮箱",
                    },
                    "subject": {
                        "type": "string",
                        "description": "通知主题",
                    },
                    "body": {
                        "type": "string",
                        "description": "通知内容",
                    },
                },
                "required": ["to", "subject", "body"],
            },
            self.send_notification,
        )

    def prepare_email_draft(
        self, to: str, subject: str, body: str,
        cc: str = "", priority: str = "normal",
    ) -> dict:
        return {
            "status": "draft_created",
            "message": "邮件草稿已创建，请在 Web UI「待办」中确认发送",
            "email": {
                "to": to,
                "cc": cc,
                "subject": subject,
                "priority": priority,
                "body_preview": body[:200] + ("..." if len(body) > 200 else ""),
            },
        }

    def send_notification(self, to: str, subject: str, body: str) -> dict:
        # TODO: 对接真实邮件服务（SMTP/飞书/钉钉）
        # 当前为模拟实现
        return {
            "status": "sent",
            "message": f"通知已发送到 {to}",
            "subject": subject,
        }


if __name__ == "__main__":
    EmailServer().run()
