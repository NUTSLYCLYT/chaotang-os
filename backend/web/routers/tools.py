"""MCP 工具列表端点 — /api/tools。"""
from __future__ import annotations

from pathlib import Path

import yaml
from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.flows import ToolDescription

router = APIRouter(prefix="/api/tools", tags=["tools"])

_MCP_CONFIG = (
    Path(__file__).resolve().parent.parent.parent / "config" / "mcp_servers.yaml"
)


@router.get("", response_model=dict[str, ToolDescription])
def api_list_tools(_: CurrentUser = Depends(get_current_user)) -> dict[str, ToolDescription]:
    """返回 MCP 工具描述，供前端展示 tooltip。"""
    if not _MCP_CONFIG.exists():
        return {}

    with open(_MCP_CONFIG, encoding="utf-8") as f:
        mcp_cfg = yaml.safe_load(f) or {}

    result: dict[str, ToolDescription] = {}
    for server_id, srv in (mcp_cfg.get("servers") or {}).items():
        if not isinstance(srv, dict):
            # 跳过 servers: 下混入的全局标量配置（max_tool_rounds 等）
            continue
        caps = {
            t["name"]: t.get("description", "")
            for t in srv.get("tools", []) or []
            if isinstance(t, dict) and "name" in t
        }
        result[server_id] = ToolDescription(
            description=srv.get("description", "") or "",
            capabilities=caps,
        )
    return result
