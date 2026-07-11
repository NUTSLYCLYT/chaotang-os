"""部门校准飞轮(2026-07-11 补齐)。

frontend/src/features/shared/components/department-flywheel-recap.tsx 和
src/lib/hooks/use-advisor-signal.ts 调用 /api/court/learning/records、
/api/court/learning/backtest、/api/court/learning/advisor-signal——三个都
从未在后端实现过。经审计确认渲染这些组件的 weekly-recap.tsx 没有任何真实
页面引用(孤立组件)，这里诚实返回空记录集，前端本身已按"records 为空 →
显飞轮待启动"设计，不需要伪造飞轮数据。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/api/court/learning", tags=["department-learning"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.get("/records")
def learning_records() -> dict:
    return {"success": True, "data": {"records": []}, "error": None}


@router.get("/backtest")
def learning_backtest() -> dict:
    return {"success": True, "data": {"replayed": 0, "missedCount": 0, "missed": []}}


@router.get("/advisor-signal")
def learning_advisor_signal() -> dict:
    return {
        "success": True,
        "data": {"signals": []},
        "meta": {"total": 0, "source": "primary", "updatedAt": _now_iso()},
        "error": None,
    }
