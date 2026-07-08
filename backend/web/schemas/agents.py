"""Agent 注册中心 schema。"""
from __future__ import annotations

from pydantic import BaseModel


class AgentInfo(BaseModel):
    agent_id: str
    name: str = ""
    domains: list[str] = []
    tools: list[str] = []
    status: str = "unknown"
