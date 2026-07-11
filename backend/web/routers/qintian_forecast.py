"""钦天监预测情景/学习路径(2026-07-11 补齐)。

frontend/src/features/qintian/hooks/* 调用 /api/qintian/scenarios、
/api/qintian/scenarios/generate、/api/qintian/learning-path——这三个在
后端从未实现过。经审计确认该功能没有任何真实页面渲染(孤立组件)，这里
按契约诚实返回空情景集，不编造预测数据。注意区别于已存在的
web/routers/qintianjian.py(钦天监部门协议，同名不同义)。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/qintian", tags=["qintian-forecast"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.get("/scenarios")
def qintian_scenarios() -> dict:
    return {
        "success": True,
        "data": [],
        "meta": {"total": 0, "source": "seed", "updatedAt": _now_iso()},
        "error": None,
    }


@router.post("/scenarios/generate")
def qintian_scenarios_generate() -> dict:
    return {
        "success": False,
        "sourceLabel": "FALLBACK",
        "data": None,
        "error": "live_forecast_brain_unavailable",
    }


@router.get("/learning-path")
def qintian_learning_path(forecastId: str = Query(...)) -> dict:
    return {
        "success": False,
        "data": None,
        "meta": {"source": "fallback", "updatedAt": _now_iso()},
        "error": "no_learning_path_for_forecast",
    }
