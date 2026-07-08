"""异步修复循环 — POST /api/runs/{run_id}/repair/async

与 stage 4-A 的同步 /api/runs/{run_id}/repair 端点配对。
通过 /api/runs/stream/{task_id} 取进度。
"""
from __future__ import annotations

import secrets
import threading
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.tenant import with_tenant
from src.flow_engine import FlowEngine
from src.repair import RepairConfig, needs_repair, repair_cycle
from src.step_log import load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import resolve_config_path
from web.schemas.auth import CurrentUser
from web.schemas.repairs import RepairRequest
from web.schemas.streaming import TaskAcceptedResponse
from web.task_registry import mark_status, register_task

router = APIRouter(prefix="/api", tags=["repairs"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@router.post(
    "/runs/{run_id}/repair/async",
    response_model=TaskAcceptedResponse | dict[str, Any],  # 可能返回 no_repair_needed
)
def api_repair_async(
    body: RepairRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
):
    run_log = load_run(run_id)
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    config = RepairConfig(
        enabled=True,
        max_retries=body.max_retries,
        min_score=body.min_score,
        min_delta=body.min_delta,
        min_dimension_score=body.min_dimension_score,
    )

    if not needs_repair(run_log, config):
        return {
            "status": "no_repair_needed",
            "message": "质量评分已达标，无需修复",
        }

    config_path = body.config or resolve_config_path(run_id)
    if not Path(config_path).is_absolute():
        config_path = str(_PROJECT_ROOT / config_path)

    task_id = secrets.token_hex(8)
    q = register_task(task_id)

    def _run() -> None:
        try:
            engine = FlowEngine(config_path)

            def on_round_start(round_num, from_step, n_instr):
                q.put({
                    "type": "repair_round_start",
                    "round": round_num,
                    "from_step": from_step,
                    "instructions": n_instr,
                    "max_retries": config.max_retries,
                })

            def on_step_done(i, total, name, elapsed, status, output=""):
                q.put({
                    "type": "step",
                    "step": i, "total": total, "name": name,
                    "elapsed": round(elapsed, 1), "status": status,
                    "output": output[:4000] if output else "",
                })

            def on_round_done(round_num, round_record):
                q.put({
                    "type": "repair_round_done",
                    "round": round_num,
                    "total_before": round_record.total_before,
                    "total_after": round_record.total_after,
                    "delta": round_record.delta,
                    "outcome": round_record.outcome,
                })

            history = repair_cycle(
                engine, run_log, config,
                on_round_done=on_round_done,
                on_round_start=on_round_start,
                on_step_done=on_step_done,
            )
            mark_status(task_id, "done", run_id=history.final_run_id)
            q.put({
                "type": "done",
                "run_id": history.final_run_id,
                "session_id": history.session_id,
                "stop_reason": history.stop_reason,
                "rounds": len(history.rounds),
            })
        except Exception as e:
            q.put({"type": "error", "message": str(e)})
            mark_status(task_id, "error", error=str(e))

    threading.Thread(target=with_tenant(_run), daemon=True).start()
    return TaskAcceptedResponse(task_id=task_id, status="running")
