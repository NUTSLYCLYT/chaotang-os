"""导出端点 — 文件下载（attachment）。

  GET /api/runs/{run_id}/export/final
  GET /api/runs/{run_id}/steps/{step_index}/export/prompt
  GET /api/runs/{run_id}/steps/{step_index}/export/output
  GET /api/compare/export
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from src.step_log import load_run

from web.deps import get_current_user, validate_run_id
from web.routers.compare import build_compare_payload
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api", tags=["exports"])


def _attachment(content: str, mime: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=mime,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/runs/{run_id}/export/final")
def export_final(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> Response:
    run_log = load_run(run_id)
    if run_log is None or run_log.final_output is None:
        raise HTTPException(status_code=404, detail="无最终输出")
    data = json.dumps(run_log.final_output, ensure_ascii=False, indent=2)
    return _attachment(data, "application/json", f"{run_id}_final_output.json")


@router.get("/runs/{run_id}/steps/{step_index}/export/prompt")
def export_prompt(
    step_index: int,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> Response:
    run_log = load_run(run_id)
    if run_log is None or step_index < 0 or step_index >= len(run_log.steps):
        raise HTTPException(status_code=404, detail="不存在")
    s = run_log.steps[step_index]
    return _attachment(
        s.system_prompt or "",
        "text/plain; charset=utf-8",
        f"{run_id}_step{step_index}_prompt.txt",
    )


@router.get("/runs/{run_id}/steps/{step_index}/export/output")
def export_output(
    step_index: int,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> Response:
    run_log = load_run(run_id)
    if run_log is None or step_index < 0 or step_index >= len(run_log.steps):
        raise HTTPException(status_code=404, detail="不存在")
    s = run_log.steps[step_index]
    return _attachment(
        s.output or "",
        "text/plain; charset=utf-8",
        f"{run_id}_step{step_index}_output.txt",
    )


@router.get("/compare/export")
def export_compare(
    left: str = Query(...),
    right: str = Query(...),
    _: CurrentUser = Depends(get_current_user),
) -> Response:
    data = build_compare_payload(left, right)
    return _attachment(
        json.dumps(data, ensure_ascii=False, indent=2),
        "application/json",
        f"compare_{left}_vs_{right}.json",
    )
