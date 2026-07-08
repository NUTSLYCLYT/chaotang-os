"""AB 测试端点 — /api/ab-tests/*"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from src.ab_test import list_ab_tests, load_ab_result, run_ab_test

from web.deps import get_current_user
from web.schemas.ab_tests import ABTestRequest
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/ab-tests", tags=["ab_tests"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@router.get("")
def api_list_ab_tests(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_ab_tests()


@router.get("/{test_id}")
def api_get_ab_test(
    test_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    result = load_ab_result(test_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"AB test '{test_id}' not found",
        )
    return result.to_dict()


@router.post("", status_code=status.HTTP_201_CREATED)
def api_run_ab_test(
    body: ABTestRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    cfg_a = (
        body.config_a
        if Path(body.config_a).is_absolute()
        else str(_PROJECT_ROOT / body.config_a)
    )
    cfg_b = (
        body.config_b
        if Path(body.config_b).is_absolute()
        else str(_PROJECT_ROOT / body.config_b)
    )

    result = run_ab_test(
        task_input=body.task,
        config_a=cfg_a,
        config_b=cfg_b,
        qa_version_a=body.qa_version_a,
        qa_version_b=body.qa_version_b,
    )
    return result.to_dict()
