"""人工反馈端点 —

  GET  /api/runs/{run_id}/feedback
  POST /api/runs/{run_id}/feedback
  GET  /api/feedback
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.step_log import _get_runs_dir, list_runs, load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import feedback_path
from web.schemas.auth import CurrentUser
from web.schemas.runs import FeedbackRequest, FeedbackSaveResponse

router = APIRouter(prefix="/api", tags=["feedback"])


@router.get("/runs/{run_id}/feedback")
def api_get_feedback(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any] | None:
    fp = feedback_path(run_id)
    if not fp.exists():
        return None
    return json.loads(fp.read_text(encoding="utf-8"))


@router.post(
    "/runs/{run_id}/feedback",
    response_model=FeedbackSaveResponse,
)
def api_post_feedback(
    body: FeedbackRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> FeedbackSaveResponse:
    run_dir = _get_runs_dir() / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    feedback = {
        "run_id": run_id,
        "rating": body.rating,
        "thumb": body.thumb,
        "comment": body.comment,
        "dimension_ratings": body.dimension_ratings,
        "tags": body.tags,
        "annotator": "human",
        "created_at": datetime.now().isoformat(),
    }
    fp = feedback_path(run_id)
    fp.write_text(
        json.dumps(feedback, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return FeedbackSaveResponse(status="saved", run_id=run_id)


@router.get("/feedback")
def api_list_feedback(
    flow: str | None = Query(default=None),
    days: int = Query(30, ge=1, le=365),
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    results: list[dict[str, Any]] = []
    for run_id in list_runs():
        fp = feedback_path(run_id)
        if not fp.exists():
            continue
        fb = json.loads(fp.read_text(encoding="utf-8"))
        if fb.get("created_at", "") < cutoff:
            continue
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
            fb["flow_name"] = run_log.flow_name
            if flow and run_log.flow_name != flow:
                continue
        except Exception:
            continue
        results.append(fb)

    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results
