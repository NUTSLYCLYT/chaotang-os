"""Prompt 版本管理 + 5 文件编辑 + 升级提案审核 端点。

⚠️ 路由顺序很重要：FastAPI 使用 FIFO 匹配，必须静态路由（/grouped /upgrades）
   在动态路由（/{key}）之前注册，否则会被 {key} 吞掉。
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, Depends, HTTPException

from src.prompts_versioned import (
    get_prompt_content_with_history,
    get_prompt_history,
    list_prompts,
    update_prompt,
)

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.prompts import (
    PromptFilesResponse,
    PromptFileSaveRequest,
    PromptFileSaveResponse,
    PromptGroupedResponse,
    PromptProposalActionResponse,
    PromptUpdateRequest,
    PromptUpdateResponse,
    PromptUpgradesResponse,
)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_CONFIG_DIR = _PROJECT_ROOT / "config"


# ── 内部 ─────────────────────────────────────────────────

def _extract_agent_display_name(agent_dir: Path) -> str:
    """从 IDENTITY.md 提取 agent 中文显示名。优先 ## 标题，其次「你是...」行。"""
    identity = agent_dir / "IDENTITY.md"
    if not identity.exists():
        return ""
    try:
        text = identity.read_text(encoding="utf-8")
        generic = {"你的角色", "身份", "角色", "role", "identity"}
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("## "):
                title = line[3:].strip()
                if title.lower() not in generic and len(title) > 1:
                    return title
        m = re.search(r"你是\s*([^，。、\n（(【]{2,16})", text)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    return ""


# ── 静态路由（必须先注册）──────────────────────────────

@router.get("", response_model=dict[str, list[Any]])
def api_prompts_list(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, list[Any]]:
    return {"prompts": list_prompts()}


@router.get("/grouped", response_model=PromptGroupedResponse)
def api_prompts_grouped(
    _: CurrentUser = Depends(get_current_user),
) -> PromptGroupedResponse:
    """按蜂群分组列出 Prompt Agent。"""
    from src.prompt_composer import RUNTIME_PROMPTS_DIR

    swarm_config_path = _CONFIG_DIR / "swarm_orchestrator.yaml"
    if not swarm_config_path.exists():
        return PromptGroupedResponse(swarms=[], ungrouped=[])

    with open(swarm_config_path, encoding="utf-8") as f:
        swarm_cfg = yaml.safe_load(f) or {}

    swarms = []
    grouped_keys: set[str] = set()

    for swarm in swarm_cfg.get("swarms", []):
        flow_rel = swarm.get("config", "")
        flow_path = _PROJECT_ROOT / flow_rel
        if not flow_path.exists():
            continue
        with open(flow_path, encoding="utf-8") as f:
            flow_cfg = yaml.safe_load(f) or {}

        agents = []
        for step in flow_cfg.get("steps", []) or []:
            key = step.get("prompt_key") or step.get("id", "")
            display_name = step.get("name", key)
            if key:
                agents.append({"key": key, "display_name": display_name})
                grouped_keys.add(key)
                if step.get("id"):
                    grouped_keys.add(step["id"])

        swarms.append({"id": swarm["id"], "name": swarm["name"], "agents": agents})

    ungrouped = []
    if RUNTIME_PROMPTS_DIR.exists():
        for d in sorted(RUNTIME_PROMPTS_DIR.iterdir()):
            if d.is_dir() and not d.name.startswith(".") and d.name not in grouped_keys:
                display_name = _extract_agent_display_name(d) or d.name
                ungrouped.append({"key": d.name, "display_name": display_name})

    return PromptGroupedResponse(swarms=swarms, ungrouped=ungrouped)


@router.get("/upgrades", response_model=PromptUpgradesResponse)
def api_prompt_upgrades(
    _: CurrentUser = Depends(get_current_user),
) -> PromptUpgradesResponse:
    from src.prompt_composer import list_upgrade_proposals
    return PromptUpgradesResponse(proposals=list_upgrade_proposals())


@router.post("/upgrades/check")
def api_prompt_upgrade_check(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """运行升级检查（对比代码最新版与 runtime_prompts）。"""
    from src.prompt_composer import upgrade_prompts
    return upgrade_prompts()


# ── 动态路由（{key} 必须在静态路由之后）─────────────────

@router.get("/{key}")
def api_prompt_get(
    key: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return get_prompt_content_with_history(key)
    except KeyError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt '{key}' 不存在",
        ) from e


@router.put("/{key}", response_model=PromptUpdateResponse)
def api_prompt_update(
    key: str,
    body: PromptUpdateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> PromptUpdateResponse:
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content 不能为空")

    try:
        new_version = update_prompt(key, content, body.reason, body.author)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    updated = get_prompt_content_with_history(key)
    return PromptUpdateResponse(
        status="saved",
        key=key,
        new_version=new_version,
        current_content_length=len(content),
        versions_count=len(updated["versions"]),
    )


@router.get("/{key}/files", response_model=PromptFilesResponse)
def api_prompt_files(
    key: str,
    _: CurrentUser = Depends(get_current_user),
) -> PromptFilesResponse:
    from src.prompt_composer import (
        PROMPT_FILES,
        RUNTIME_PROMPTS_DIR,
        get_prompt_file,
    )
    agent_dir = RUNTIME_PROMPTS_DIR / key
    if not agent_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{key}' 没有 runtime_prompts 目录",
        )
    files = {f: get_prompt_file(key, f) for f in PROMPT_FILES}
    return PromptFilesResponse(key=key, files=files)


@router.put(
    "/{key}/files/{filename}",
    response_model=PromptFileSaveResponse,
)
def api_prompt_file_save(
    key: str,
    filename: str,
    body: PromptFileSaveRequest,
    _: CurrentUser = Depends(get_current_user),
) -> PromptFileSaveResponse:
    from src.prompt_composer import PROMPT_FILES, save_prompt_file
    if filename not in PROMPT_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"无效文件名，必须是: {PROMPT_FILES}",
        )
    save_prompt_file(key, filename, body.content)
    return PromptFileSaveResponse(
        status="saved",
        key=key,
        filename=filename,
        length=len(body.content),
    )


@router.post(
    "/{key}/files/{filename}/accept",
    response_model=PromptProposalActionResponse,
)
def api_prompt_accept_proposal(
    key: str,
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> PromptProposalActionResponse:
    from src.prompt_composer import accept_proposal
    if not accept_proposal(key, filename):
        raise HTTPException(status_code=404, detail="提案不存在")
    return PromptProposalActionResponse(
        status="accepted",
        key=key,
        filename=filename,
    )


@router.post(
    "/{key}/files/{filename}/reject",
    response_model=PromptProposalActionResponse,
)
def api_prompt_reject_proposal(
    key: str,
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> PromptProposalActionResponse:
    from src.prompt_composer import reject_proposal
    if not reject_proposal(key, filename):
        raise HTTPException(status_code=404, detail="提案不存在")
    return PromptProposalActionResponse(
        status="rejected",
        key=key,
        filename=filename,
    )


@router.get("/{key}/versions")
def api_prompt_versions(
    key: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    history = get_prompt_history(key)
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt '{key}' 不存在",
        )
    return {
        "key": key,
        "current_version": history[-1].version if history else "unknown",
        "versions": [v.to_dict(include_content=True) for v in history],
    }
