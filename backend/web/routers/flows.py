"""Flow 配置 CRUD（不含 test_step，后者在 stage 4 迁移）。"""
from __future__ import annotations

from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException, status

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.flows import (
    FlowCreatedResponse,
    FlowCreateRequest,
    FlowSummary,
    FlowUpdateResponse,
)

router = APIRouter(prefix="/api/flows", tags=["flows"])

_CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


# ── 文件名安全校验 ────────────────────────────────────────

def _resolve_flow_path(filename: str) -> Path:
    """规范化 filename，阻断路径穿越，要求 flow_*.yaml 前缀。"""
    if not filename.endswith(".yaml"):
        filename = filename + ".yaml"
    # 任何路径分隔符或 .. 都拒绝
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail=f"非法文件名: {filename}")
    if not filename.startswith("flow_"):
        raise HTTPException(status_code=400, detail="文件名必须以 flow_ 开头")
    return _CONFIG_DIR / filename


# ── 端点 ────────────────────────────────────────────────

@router.get("", response_model=list[FlowSummary])
def api_list_flows(_: CurrentUser = Depends(get_current_user)) -> list[FlowSummary]:
    flows: list[FlowSummary] = []
    for f in sorted(_CONFIG_DIR.glob("flow_*.yaml")):
        try:
            with open(f, encoding="utf-8") as fh:
                config = yaml.safe_load(fh) or {}
            flows.append(FlowSummary(
                filename=f.name,
                flow_name=config.get("flow_name", f.stem),
                steps_count=len(config.get("steps", []) or []),
                default_model=config.get("default_model", "") or "",
                qa_version=config.get("qa_version", "") or "",
            ))
        except Exception:
            continue
    return flows


@router.get("/{filename}")
def api_get_flow(
    filename: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    filepath = _resolve_flow_path(filename)
    if not filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow '{filename}' not found",
        )
    with open(filepath, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@router.put("/{filename}", response_model=FlowUpdateResponse)
def api_update_flow(
    filename: str,
    data: dict,
    _: CurrentUser = Depends(get_current_user),
) -> FlowUpdateResponse:
    filepath = _resolve_flow_path(filename)
    if not filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow '{filename}' not found",
        )

    if not data:
        raise HTTPException(status_code=400, detail="No data provided")

    steps = data.get("steps")
    if not isinstance(steps, list) or len(steps) == 0:
        raise HTTPException(status_code=400, detail="steps must be a non-empty list")

    for i, step in enumerate(steps):
        for field in ("id", "name"):
            if field not in step:
                raise HTTPException(
                    status_code=400,
                    detail=f"Step {i} missing required field: {field}",
                )
        is_integration = step.get("step_type") in ("openclaw",)
        has_prompt = (
            (step.get("prompt_inline") or "").strip()
            or step.get("prompt_key")
            or step.get("prompt_module")
        )
        if not is_integration and not has_prompt:
            raise HTTPException(
                status_code=422,
                detail=f"Step {i} ('{step.get('name')}') must have prompt_inline, prompt_key, or prompt_module",
            )

    backup_path = filepath.with_suffix(".yaml.bak")
    if filepath.exists():
        backup_path.write_text(filepath.read_text(encoding="utf-8"), encoding="utf-8")

    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    return FlowUpdateResponse(status="saved", backup=backup_path.name)


@router.post(
    "",
    response_model=FlowCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def api_create_flow(
    body: FlowCreateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> FlowCreatedResponse:
    filepath = _resolve_flow_path(body.filename)
    if filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Flow '{body.filename}' already exists",
        )

    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(body.config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    return FlowCreatedResponse(filename=body.filename)
