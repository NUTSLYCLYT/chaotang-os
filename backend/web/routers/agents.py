"""Agent 注册中心端点 —

  GET /api/agents/registry  — 列出所有 agent
  GET /api/agents/discover  — 按 domain/tool 检索
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/registry")
def agent_registry_list(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.jiqun_registry import JiqunRegistry

        registry = JiqunRegistry()
        return {
            "system": registry.data.get("system", {}),
            "runtime_policy": registry.runtime_policy(),
            "agents": registry.list_agents(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/discover")
def agent_discover(
    domain: str | None = Query(default=None),
    tool: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.jiqun_registry import JiqunRegistry

        registry = JiqunRegistry()
        agents = registry.list_agents()
        if domain:
            agents = [
                a for a in agents
                if a.get("category") == domain
                or a.get("swarm_id") == domain
                or a.get("kind") == domain
            ]
        if tool:
            # The new registry is role/runtime based rather than tool based.
            # Keep this filter useful for callers by matching known path/runtime fields.
            agents = [
                a for a in agents
                if tool in str(a.get("prompt_path", ""))
                or tool in str(a.get("skill_path", ""))
                or tool in str(a.get("runtime", ""))
            ]
        return {"agents": agents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
