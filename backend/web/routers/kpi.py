"""KPI / SLO / 回归测试端点 —

  GET  /api/kpi/latency
  GET  /api/kpi/slo
  GET  /api/kpi/business
  POST /api/kpi/business/{run_id}
  POST /api/kpi/calibration
  GET  /api/kpi/calibration/stats
  GET  /api/kpi/regression
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from web.deps import get_current_user, validate_run_id
from web.schemas.auth import CurrentUser
from web.schemas.kpi import BusinessOutcomeRequest, CalibrationRequest

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


@router.get("/latency")
def kpi_latency(
    flow: str | None = Query(default=None),
    step: str | None = Query(default=None),
    hours: int = Query(24, ge=1, le=720),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.kpi_tracker import KPIStore, LatencyTracker
        store = KPIStore()
        tracker = LatencyTracker(store)
        return tracker.get_percentiles(flow_name=flow, step_id=step, hours=hours)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/slo")
def kpi_slo(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.kpi_tracker import KPIStore, SLOMonitor
        store = KPIStore()
        monitor = SLOMonitor(store)
        statuses = monitor.check_all()
        return {
            "slos": [
                {
                    "name": s.name,
                    "current": s.current_value,
                    "target": s.target,
                    "status": s.status,
                    "burn_rate": s.burn_rate,
                    "samples": s.samples,   # status=healthy 但 samples=0 → 不是"健康",是没数据
                }
                for s in statuses
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/business")
def kpi_business(
    flow: str | None = Query(default=None),
    days: int = Query(30, ge=1, le=365),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.kpi_tracker import BusinessOutcomeTracker, KPIStore
        store = KPIStore()
        tracker = BusinessOutcomeTracker(store)
        return tracker.get_stats(flow_name=flow, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/business/{run_id}")
def kpi_record_outcome(
    body: BusinessOutcomeRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    try:
        from src.kpi_tracker import (
            BusinessOutcome,
            BusinessOutcomeTracker,
            KPIStore,
        )
        store = KPIStore()
        tracker = BusinessOutcomeTracker(store)
        tracker.record(BusinessOutcome(
            run_id=run_id,
            flow_name=body.flow_name,
            task_input=body.task_input,
            quality_score=body.quality_score,
            outcome=body.outcome,
            outcome_metadata=body.metadata,
            recorded_at=datetime.now().astimezone().isoformat(),
            recorded_by=body.reviewer,
        ))
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/calibration")
def kpi_add_calibration(
    body: CalibrationRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    try:
        from src.kpi_tracker import (
            HumanCalibration,
            HumanCalibrationManager,
            KPIStore,
        )
        store = KPIStore()
        mgr = HumanCalibrationManager(store)
        mgr.add_calibration(HumanCalibration(
            run_id=body.run_id,
            step_id=body.step_id,
            llm_score=body.llm_score,
            human_score=body.human_score,
            dimensions_llm=body.dimensions_llm,
            dimensions_human=body.dimensions_human,
            reviewer=body.reviewer,
            reviewed_at=datetime.now().astimezone().isoformat(),
            notes=body.notes,
        ))
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/calibration/stats")
def kpi_calibration_stats(
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        from src.kpi_tracker import HumanCalibrationManager, KPIStore
        store = KPIStore()
        mgr = HumanCalibrationManager(store)
        return mgr.get_calibration_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/regression")
def kpi_regression_list(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        from src.kpi_tracker import KPIStore, RegressionTestSuite
        store = KPIStore()
        suite = RegressionTestSuite(store)
        return suite.list_tests()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
